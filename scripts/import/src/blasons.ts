import { access, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { Database } from '@hexamap/db';
import { type Kysely, sql } from 'kysely';
import sharp from 'sharp';
import { readCommuneCodes } from './db';
import { chunkArray } from './normalize';
import type { ImportProgressWriter } from './progress';

const WIKIDATA_SPARQL = 'https://query.wikidata.org/sparql';
const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
const IGN_WFS = 'https://data.geopf.fr/wfs/ows';
const DEFAULT_BLASONS_DIR = '/data/blasons';
const USER_AGENT = 'HexamapImport/0.1 (https://github.com/hexamap)';
const SPARQL_PAGE_SIZE = 5_000;
const COMMONS_BATCH_SIZE = 50;
const SEARCH_RESULT_LIMIT = 20;
/** Largeur maximale des rasters convertis en WebP (jamais d'agrandissement). */
const BLASON_IMAGE_WIDTH = 320;
const BLASON_WEBP_QUALITY = 80;
const DOWNLOAD_CONCURRENCY = 4;
const UPSERT_CHUNK_SIZE = 500;
const IGN_PAGE_SIZE = 500;
/** Retentatives d'une page WFS invalide, avec les délais de `IGN_PAGE_BACKOFF_MS`. */
const IGN_PAGE_RETRIES = 4;
const IGN_PAGE_BACKOFF_MS = [1_000, 3_000, 7_000, 15_000];
const BODY_PREVIEW_LENGTH = 120;
const CONTOUR_FILL = '#94a3b8';
const CONTOUR_MARGIN = 4;
const CONTOUR_BOX = 100;
const CONTOUR_MIN_POINTS = 40;
const CONTOUR_MAX_POINTS = 200;
const RETRY_ATTEMPTS = 6;
const RETRY_BACKOFF_BASE_MS = [500, 1000, 2000, 4000, 8000];
const RETRY_BACKOFF_JITTER_MIN = 0.7;
const RETRY_BACKOFF_JITTER_MAX = 1.3;
const RETRY_AFTER_MAX_MS = 30_000;
const REQUEST_MIN_INTERVAL_MS = 100;

export type BlasonLevel = 'communes' | 'departements' | 'regions';

export interface BlasonOptions {
  only?: BlasonLevel;
  limit?: number;
  force?: boolean;
  contours: boolean;
  /** Reprise : ne génère que les contours manquants, sans toucher aux blasons. */
  contoursOnly?: boolean;
  /** Suivi d'avancement optionnel, partagé avec le fichier d'état de l'API. */
  progress?: ImportProgressWriter;
}

const LEVEL_LABELS: Record<BlasonLevel, string> = {
  communes: 'Blasons des communes',
  departements: 'Blasons des départements',
  regions: 'Blasons des régions',
};

export interface LevelReport {
  blasons: number;
  contours: number;
  skipped: number;
  failed: number;
  missing: number;
  reasons: Record<string, number>;
}

export interface BlasonReport {
  communes: LevelReport;
  departements: LevelReport;
  regions: LevelReport;
  durationMs: number;
}

export interface Point {
  x: number;
  y: number;
}

function emptyLevel(): LevelReport {
  return { blasons: 0, contours: 0, skipped: 0, failed: 0, missing: 0, reasons: {} };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/** Formats écrits sur le volume `blasons` : SVG assaini ou raster converti en WebP. */
export const IMAGE_EXTENSIONS = ['svg', 'webp'] as const;

export type ImageExtension = (typeof IMAGE_EXTENSIONS)[number];

/** Résultat d'un blason téléchargé : crédit d'attribution et extension réelle du fichier. */
export interface BlasonOutcome {
  credit: string;
  ext: ImageExtension;
}

/** Cherche le fichier d'un code quel que soit son format (`svg` ou `webp`). */
async function findExistingImage(dir: string, code: string): Promise<ImageExtension | null> {
  for (const ext of IMAGE_EXTENSIONS) {
    if (await fileExists(join(dir, `${code}.${ext}`))) return ext;
  }
  return null;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Erreur de téléchargement typée, pour ventiler les causes d'échec dans le rapport. */
class DownloadError extends Error {
  readonly reason: string;

  constructor(reason: string, message: string) {
    super(message);
    this.name = 'DownloadError';
    this.reason = reason;
  }
}

function httpReason(status: number): string {
  if (status === 404) return 'HTTP 404';
  if (status === 403) return 'HTTP 403';
  if (status === 408) return 'HTTP 408';
  if (status === 425) return 'HTTP 425';
  if (status === 429) return 'HTTP 429';
  if (status >= 500) return 'HTTP 5xx';
  return `HTTP ${status}`;
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || (status >= 500 && status < 600);
}

function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  if (error instanceof Error) {
    return /ECONNRESET|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|EAI_AGAIN|network|fetch failed|connection reset/i.test(
      error.message,
    );
  }
  return false;
}

/** Décode `Retry-After` (secondes ou date HTTP) en millisecondes, `null` si absent/invalide. */
function parseRetryAfterMs(header: string | null): number | null {
  if (header === null) return null;
  const trimmed = header.trim();
  if (trimmed === '') return null;
  if (/^\d+$/.test(trimmed)) {
    const seconds = Number(trimmed);
    return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : null;
  }
  const date = Date.parse(trimmed);
  if (Number.isNaN(date)) return null;
  return Math.max(0, date - Date.now());
}

/** Délai avant retentative : honore `Retry-After` (plafonné), sinon backoff exponentiel + jitter. */
function retryDelayMs(attempt: number, retryAfter: string | null): number {
  const retryAfterMs = parseRetryAfterMs(retryAfter);
  if (retryAfterMs !== null) return Math.min(retryAfterMs, RETRY_AFTER_MAX_MS);

  const base =
    RETRY_BACKOFF_BASE_MS[attempt] ??
    RETRY_BACKOFF_BASE_MS[RETRY_BACKOFF_BASE_MS.length - 1] ??
    8_000;
  const jitter =
    RETRY_BACKOFF_JITTER_MIN +
    Math.random() * (RETRY_BACKOFF_JITTER_MAX - RETRY_BACKOFF_JITTER_MIN);
  return Math.round(base * jitter);
}

/* Espacement global entre démarrages de requêtes externes, pour rester sous
   les limites de débit de Wikimedia. Ne concerne que les requêtes HTTP, jamais
   les écritures disque (qui ne passent pas par `throttleRequest`). */
let nextRequestAt = 0;

async function throttleRequest(): Promise<void> {
  const now = performance.now();
  if (now < nextRequestAt) {
    const wait = nextRequestAt - now;
    nextRequestAt += REQUEST_MIN_INTERVAL_MS;
    await sleep(wait);
  } else {
    nextRequestAt = now + REQUEST_MIN_INTERVAL_MS;
  }
}

/**
 * FETCH avec retry borné : retente sur 408/425/429/5xx (en honorant
 * `Retry-After`) et sur erreur réseau, jamais sur 400/403/404.
 */
async function fetchWithRetry(url: string, headers: Record<string, string>): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt += 1) {
    try {
      await throttleRequest();
      const response = await fetch(url, { headers, redirect: 'follow' });
      if (isRetryableStatus(response.status)) {
        lastError = new DownloadError(
          httpReason(response.status),
          `HTTP ${response.status} pour ${url}`,
        );
        await sleep(retryDelayMs(attempt, response.headers.get('retry-after')));
        continue;
      }
      return response;
    } catch (error) {
      if (!isNetworkError(error)) throw error;
      lastError = error;
      await sleep(retryDelayMs(attempt, null));
    }
  }

  throw lastError instanceof DownloadError
    ? lastError
    : new DownloadError('réseau', 'Échec réseau après plusieurs tentatives');
}

/* ------------------------------------------------------------------ */
/* Lecture JSON défensive                                              */
/* ------------------------------------------------------------------ */

type JsonParseOutcome = { ok: true; value: unknown } | { ok: false; text: string; error: Error };

/** Aperçu compact du corps d'une réponse, pour diagnostiquer un incident. */
function bodyPreview(text: string): string {
  return text.slice(0, BODY_PREVIEW_LENGTH).replace(/\s+/g, ' ').trim();
}

function contentTypeOf(response: Response): string {
  return response.headers.get('content-type') ?? 'content-type absent';
}

/** Analyse un corps texte en JSON sans jamais laisser fuiter l'erreur de Bun. */
function parseJsonText(text: string): JsonParseOutcome {
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch (error) {
    return {
      ok: false,
      text,
      error: error instanceof Error ? error : new Error('JSON invalide'),
    };
  }
}

/**
 * Lit la réponse en texte puis la parse en JSON. Si le corps n'est pas du JSON,
 * lève une erreur explicite (statut, content-type, début du corps) au lieu du
 * message opaque du parseur.
 */
async function readJsonResponse(response: Response, label: string): Promise<unknown> {
  const text = await response.text();
  const parsed = parseJsonText(text);
  if (parsed.ok) return parsed.value;
  throw new Error(
    `${label} : corps non JSON (HTTP ${response.status}, ${contentTypeOf(response)}) — «${bodyPreview(text)}»`,
  );
}

/* ------------------------------------------------------------------ */
/* Wikidata SPARQL : code -> nom de fichier Commons                     */
/* ------------------------------------------------------------------ */

const SPARQL_INSTANCE: Record<BlasonLevel, string> = {
  communes: 'wd:Q484170',
  departements: 'wd:Q6465',
  regions: 'wd:Q36784',
};

// `P374` est le code INSEE des communes uniquement. Les départements et régions
// utilisent leurs propres propriétés (`P2586` / `P2585`), sans quoi la requête
// ne renvoie aucun résultat.
const SPARQL_CODE_PROPERTY: Record<BlasonLevel, string> = {
  communes: 'P374',
  departements: 'P2586',
  regions: 'P2585',
};

interface SparqlBinding {
  code?: { value?: string };
  file?: { value?: string };
}

interface SparqlResult {
  results?: { bindings?: SparqlBinding[] };
}

function filenameFromFileUri(uri: string): string | null {
  try {
    const path = new URL(uri).pathname;
    const segment = path.slice(path.lastIndexOf('/') + 1);
    if (segment.length === 0) return null;
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

async function sparqlBlasons(level: BlasonLevel): Promise<Map<string, string>> {
  const instance = SPARQL_INSTANCE[level];
  const codeProperty = SPARQL_CODE_PROPERTY[level];
  const result = new Map<string, string>();
  let offset = 0;

  for (;;) {
    const query = [
      'SELECT ?code ?file WHERE {',
      `  ?i wdt:P31 ${instance} ; wdt:${codeProperty} ?code ; wdt:P94 ?file .`,
      `} ORDER BY ?code LIMIT ${SPARQL_PAGE_SIZE} OFFSET ${offset}`,
    ].join('\n');

    const url = `${WIKIDATA_SPARQL}?${new URLSearchParams({ format: 'json', query }).toString()}`;
    const response = await fetchWithRetry(url, {
      Accept: 'application/sparql-results+json',
      'User-Agent': USER_AGENT,
    });

    if (!response.ok) {
      throw new Error(`Wikidata SPARQL HTTP ${response.status} (niveau ${level})`);
    }

    const data = (await readJsonResponse(
      response,
      `Wikidata SPARQL (niveau ${level})`,
    )) as SparqlResult;
    const bindings = data.results?.bindings ?? [];

    for (const binding of bindings) {
      const code = binding.code?.value;
      const file = binding.file?.value;
      if (code === undefined || file === undefined) continue;
      const filename = filenameFromFileUri(file);
      if (filename !== null) result.set(code, filename);
    }

    if (bindings.length < SPARQL_PAGE_SIZE) break;
    offset += SPARQL_PAGE_SIZE;
  }

  return result;
}

/* ------------------------------------------------------------------ */
/* Wikimedia Commons : licences par lots de 50                         */
/* ------------------------------------------------------------------ */

interface LicenseInfo {
  mime: string;
  license: string | null;
  artist: string | null;
  credit: string | null;
  url: string;
  descriptionurl: string | null;
}

interface CommonsPage {
  title?: string;
  missing?: boolean;
  imageinfo?: Array<{
    url?: string;
    descriptionurl?: string;
    mime?: string;
    extmetadata?: Record<string, { value?: unknown }>;
  }>;
}

interface CommonsResult {
  query?: { pages?: CommonsPage[] };
}

function metadataString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function resolveLicenses(filenames: readonly string[]): Promise<Map<string, LicenseInfo>> {
  const result = new Map<string, LicenseInfo>();

  for (const batch of chunkArray(filenames, COMMONS_BATCH_SIZE)) {
    const titles = batch.map((filename) => `File:${filename}`).join('|');
    const url = `${COMMONS_API}?${new URLSearchParams({
      action: 'query',
      format: 'json',
      formatversion: '2',
      prop: 'imageinfo',
      iiprop: 'url|mime|extmetadata|descriptionurl',
      titles,
    }).toString()}`;

    const response = await fetchWithRetry(url, { 'User-Agent': USER_AGENT });
    if (!response.ok) {
      throw new Error(`Commons API HTTP ${response.status}`);
    }

    const data = (await readJsonResponse(response, 'Commons API')) as CommonsResult;
    for (const page of data.query?.pages ?? []) {
      if (page.missing === true) continue;
      const info = page.imageinfo?.[0];
      if (info === undefined || info.url === undefined) continue;

      const filename = (page.title ?? '').replace(/^File:/, '');
      const extmetadata = info.extmetadata ?? {};
      result.set(filename, {
        mime: info.mime ?? '',
        license: metadataString(extmetadata.LicenseShortName?.value),
        artist: metadataString(extmetadata.Artist?.value),
        credit: metadataString(extmetadata.Credit?.value),
        url: info.url,
        descriptionurl: metadataString(info.descriptionurl),
      });
    }
  }

  return result;
}

/* ------------------------------------------------------------------ */
/* Recherche Commons : repli après Wikidata (propriété P94)            */
/* ------------------------------------------------------------------ */

export type BlasonKind = 'departement' | 'region' | 'commune';

// Wikidata ne référence pas toutes les entités (3 régions et 13 départements
// manquants), et les fichiers Commons ne suivent aucun nommage standard
// (`Blason Île-de-France moderne 2.svg`, `Blason paris 75.svg`…). Le scoring
// reste volontairement strict : mieux vaut aucune image qu'une armoirie de
// famille ou une photo d'illustration.
const SEARCH_REJECTED_WORDS = [
  'famille',
  'ville fr',
  'commune',
  'propose',
  'proposition',
  'branche',
  'empire',
  'ancien',
] as const;
const SEARCH_BONUS_BLASON = 3;
const SEARCH_BONUS_ARMOIRIES = 2;
const SEARCH_BONUS_KIND = 2;
const SEARCH_BONUS_SVG = 1;

// Mots génériques d'un titre d'armoiries : une fois le nom de l'entité retiré,
// il ne doit rien rester d'autre, sinon le fichier désigne une autre entité
// (« Blason de Muro (Haute-Corse) », « Blason ville DomFr Les Avirons »…).
const SEARCH_ALLOWED_TOKENS = new Set([
  'blason',
  'blasons',
  'armoiries',
  'armes',
  'de',
  'du',
  'des',
  'del',
  'la',
  'le',
  'les',
  'd',
  'l',
  'fr',
  'france',
  'francais',
  'francaise',
  'departement',
  'region',
  'moderne',
  'officiel',
  'officielle',
  'svg',
  'png',
]);

/** Minuscules sans accent, extension ni ponctuation : « Grand-Est » → « grand est ». */
export function normalizeForSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\.(?:svg|png|jpe?g|webp|gif)$/, '')
    .replace(/['’‘`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function kindWord(kind: BlasonKind): string {
  if (kind === 'region') return 'region';
  if (kind === 'departement') return 'departement';
  return 'commune';
}

/**
 * Vrai quand le titre contient, hors nom de l'entité et mots génériques, un
 * token qui trahit une autre entité (une commune, un homonyme…).
 */
function hasUnexpectedTokens(normalizedTitle: string, normalizedName: string): boolean {
  const nameTokens = new Set(normalizedName.split(' '));
  const rest = normalizedTitle.replace(normalizedName, ' ');
  return rest
    .split(' ')
    .some(
      (token) =>
        token !== '' &&
        !nameTokens.has(token) &&
        !SEARCH_ALLOWED_TOKENS.has(token) &&
        !/^\d+$/.test(token),
    );
}

/**
 * Score un titre Commons contre le nom d'une entité. `null` quand le titre ne
 * désigne manifestement pas cette entité : nom absent, armorial de famille,
 * proposition, branche, ancienne entité…
 */
export function scoreCommonsTitle(title: string, nom: string, kind: BlasonKind): number | null {
  const cleanTitle = title.replace(/^File:/, '');
  const normalizedName = normalizeForSearch(nom);
  const normalizedTitle = normalizeForSearch(cleanTitle);
  if (normalizedName === '' || !normalizedTitle.includes(normalizedName)) return null;
  if (SEARCH_REJECTED_WORDS.some((word) => normalizedTitle.includes(word))) return null;
  // Les armoiries communales sont titrées « Blason ville fr X » / « Blason ville
  // DomFr X » : pour une région ou un département, tout « ville » est un intrus.
  if (kind !== 'commune' && normalizedTitle.split(' ').includes('ville')) return null;
  if (hasUnexpectedTokens(normalizedTitle, normalizedName)) return null;

  let score = 0;
  if (normalizedTitle.startsWith('blason')) score += SEARCH_BONUS_BLASON;
  if (normalizedTitle.includes('armoiries')) score += SEARCH_BONUS_ARMOIRIES;
  if (normalizedTitle.includes(kindWord(kind))) score += SEARCH_BONUS_KIND;
  if (cleanTitle.toLowerCase().endsWith('.svg')) score += SEARCH_BONUS_SVG;
  return score;
}

interface CommonsSearchResponse {
  query?: { search?: Array<{ title?: string }> };
}

async function searchCommonsTitles(search: string): Promise<string[]> {
  const url = `${COMMONS_API}?${new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    list: 'search',
    srnamespace: '6',
    srlimit: String(SEARCH_RESULT_LIMIT),
    srsearch: search,
  }).toString()}`;

  const response = await fetchWithRetry(url, { 'User-Agent': USER_AGENT });
  if (!response.ok) {
    throw new Error(`Commons search HTTP ${response.status}`);
  }

  const data = (await readJsonResponse(response, 'Commons search')) as CommonsSearchResponse;
  return (data.query?.search ?? [])
    .map((page) => page.title)
    .filter((title): title is string => typeof title === 'string' && title.length > 0);
}

export interface CommonsBlasonMatch {
  filename: string;
  info: LicenseInfo;
}

/**
 * Cherche l'armoirie d'une entité sur Commons : `intitle:"<nom>" intitle:blason`
 * puis, à défaut, `intitle:<nom> intitle:armoiries`. Retourne le meilleur titre
 * scoré avec ses métadonnées (licence, MIME, URL), `null` si rien de fiable.
 */
export async function searchCommonsBlason(
  nom: string,
  kind: BlasonKind,
): Promise<CommonsBlasonMatch | null> {
  const quotedName = nom.replace(/"/g, '').trim();
  if (quotedName === '') return null;

  const searches = [
    `intitle:"${quotedName}" intitle:blason`,
    `intitle:"${quotedName}" intitle:armoiries`,
  ];
  for (const search of searches) {
    const titles = await searchCommonsTitles(search);

    let best: { title: string; score: number } | null = null;
    for (const title of titles) {
      const score = scoreCommonsTitle(title, nom, kind);
      if (score === null) continue;
      if (best === null || score > best.score) best = { title, score };
    }
    if (best === null) continue;

    const filename = best.title.replace(/^File:/, '');
    const licenses = await resolveLicenses([filename]);
    const info = licenses.get(filename);
    if (info === undefined) continue;
    return { filename, info };
  }

  return null;
}

const MAX_CREDIT_LENGTH = 400;

/** Décode les entités HTML nommées et numériques courantes. */
function decodeHtmlEntities(input: string): string {
  const named: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    '#39': "'",
    nbsp: ' ',
  };
  return input.replace(/&(#?[a-z0-9]+);/gi, (entity, name: string) => {
    const key = name.toLowerCase();
    if (named[key] !== undefined) return named[key] as string;
    const hex = key.match(/^#x([0-9a-f]+)$/);
    if (hex !== null) {
      const codePoint = Number.parseInt(hex[1] as string, 16);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : entity;
    }
    const dec = key.match(/^#(\d+)$/);
    if (dec !== null) {
      const codePoint = Number.parseInt(dec[1] as string, 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : entity;
    }
    return entity;
  });
}

/**
 * Convertit une valeur HTML (licence, auteur, crédit) en texte brut :
 * supprime les balises, décode les entités, compacte les espaces.
 */
export function plainText(value: string): string {
  return decodeHtmlEntities(value.replace(/<[^>]*>/g, ''))
    .replace(/\s+/g, ' ')
    .trim();
}

/** Tronque sans couper au milieu d'une entité HTML. */
function truncateClean(value: string, max: number): string {
  if (value.length <= max) return value;
  const cut = value.slice(0, max);
  const entity = cut.match(/&(?:#\d+|#x[0-9a-f]+|[a-z]+)$/i);
  if (entity !== null) return cut.slice(0, cut.length - entity[0].length);
  return cut;
}

function buildCredit(info: LicenseInfo): string {
  const license = plainText(info.license ?? '') || 'Licence non précisée';
  const artist = plainText(info.artist ?? '') || 'Auteur non précisé';

  let descriptionurl = info.descriptionurl;
  if (descriptionurl === null || descriptionurl === '') {
    const credit = plainText(info.credit ?? '');
    descriptionurl = credit !== '' ? credit : 'https://commons.wikimedia.org/';
  }

  return truncateClean(`${license} · ${artist} · ${descriptionurl}`, MAX_CREDIT_LENGTH);
}

/* ------------------------------------------------------------------ */
/* Assainissement SVG (sans dépendance)                                */
/* ------------------------------------------------------------------ */

function readAttribute(tag: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = tag.match(new RegExp(`\\b${escaped}\\s*=\\s*("([^"]*)"|'([^']*)')`));
  if (match === null) return null;
  return match[2] ?? match[3] ?? null;
}

function parseNumericDimension(value: string | null): number | null {
  if (value === null) return null;
  const trimmed = value.trim();
  if (trimmed.endsWith('%')) return null;
  const match = trimmed.match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+))(?:[a-z]+)?$/i);
  if (match === null) return null;
  const number = Number(match[1]);
  return Number.isFinite(number) ? number : null;
}

/**
 * Préfixes d'éditeur (Inkscape, Sodipodi, RDF/Dublin Core) dont on retire
 * **éléments et attributs** : leurs déclarations `xmlns` sautent avec eux, et
 * un préfixe déclaré sans usage (ou utilisé sans déclaration) rend le document
 * non well-formed, donc invisible dans un `<img>`.
 */
const EDITOR_PREFIXES = 'sodipodi|inkscape|dc|cc|rdf';

const SELF_CLOSING_EDITOR_ELEMENT = new RegExp(`<(${EDITOR_PREFIXES}):[\\w-]+[^>]*\\/>`, 'g');
const PAIRED_EDITOR_ELEMENT = new RegExp(
  `<(${EDITOR_PREFIXES}):[\\w-]+[^>]*>[\\s\\S]*?<\\/\\1:[\\w-]+>`,
  'g',
);
const ANY_EDITOR_ELEMENT = new RegExp(`<\\/?(?:${EDITOR_PREFIXES}):[\\w-]+[^>]*>`, 'g');
const EDITOR_ATTRIBUTE = new RegExp(
  `\\s(?:${EDITOR_PREFIXES}):[\\w-]+\\s*=\\s*("[^"]*"|'[^']*')`,
  'g',
);
const EDITOR_XMLNS = new RegExp(`\\s+xmlns:(?:${EDITOR_PREFIXES})\\s*=\\s*("[^"]*"|'[^']*')`, 'g');

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

/**
 * Entités du sous-ensemble DOCTYPE d'Illustrator, lorsque les déclarations ont
 * déjà été retirées par une passe antérieure : elles alimentent des `xmlns`.
 */
const ILLUSTRATOR_ENTITIES: Readonly<Record<string, string>> = {
  ns_extend: 'http://ns.adobe.com/Extensibility/1.0/',
  ns_ai: 'http://ns.adobe.com/AdobeIllustrator/10.0/',
  ns_graphs: 'http://ns.adobe.com/Graphs/1.0/',
  ns_vars: 'http://ns.adobe.com/Variables/1.0/',
  ns_imrep: 'http://ns.adobe.com/ImageReplacement/1.0/',
  ns_sfw: 'http://ns.adobe.com/SaveForWeb/1.0/',
  ns_custom: 'http://ns.adobe.com/GenericCustomNamespace/1.0/',
  ns_adobe_xpath: 'http://ns.adobe.com/XPath/1.0/',
};

/**
 * Répare un attribut de racine resté sans guillemet fermant après une ancienne
 * passe d'assainissement (`<svg viewBox="0 0 600 660` puis retour à la ligne).
 * Ne touche à rien quand les guillemets sont appariés.
 */
function closeUnbalancedRootQuote(rootTag: string): string {
  const quoteCount = rootTag.match(/"/g)?.length ?? 0;
  if (quoteCount % 2 === 0) return rootTag;
  return rootTag.replace(/(\b[\w:.-]+\s*=\s*")([^"<>]*?)(?=\s+[\w:.-]+\s*=|\s*>)/, '$1$2"');
}

/** URI des préfixes qu'on sait redéclarer ; tout autre préfixe inconnu fait rejeter le document. */
const NAMESPACE_URIS: Readonly<Record<string, string>> = {
  sodipodi: 'http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd',
  inkscape: 'http://www.inkscape.org/namespaces/inkscape',
  xlink: 'http://www.w3.org/1999/xlink',
  dc: 'http://purl.org/dc/elements/1.1/',
  cc: 'http://creativecommons.org/ns#',
  rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
};

const PREFIX_IN_ELEMENT = /<([a-zA-Z_][\w.-]*):[a-zA-Z]/g;
const PREFIX_IN_ATTRIBUTE = /\s([a-zA-Z_][\w.-]*):[\w.-]+\s*=/g;
const NAMESPACE_DECLARATION = /xmlns:([\w.-]+)\s*=/g;

/** Retire les éléments d'éditeur, y compris ceux imbriqués sur plusieurs passes. */
function stripEditorElements(svg: string): string {
  let current = svg;
  for (let pass = 0; pass < 3; pass += 1) {
    const before = current;
    current = current.replace(SELF_CLOSING_EDITOR_ELEMENT, '');
    current = current.replace(PAIRED_EDITOR_ELEMENT, '');
    if (current === before) break;
  }
  // Filet : un élément d'éditeur non fermé (document déjà invalide) disparaît
  // quand même, plutôt que de laisser un préfixe dans le document.
  return current.replace(ANY_EDITOR_ELEMENT, '');
}

/* ------------------------------------------------------------------ */
/* Analyse XML par pile de balises                                     */
/* ------------------------------------------------------------------ */

/** Balise repérée dans le document, avec ses bornes dans le texte source. */
interface SvgTagToken {
  name: string;
  closing: boolean;
  selfClosing: boolean;
  start: number;
  end: number;
}

/**
 * Balises `<x>`, `</x>` et `<x/>` dans l'ordre du document. Les commentaires
 * `<!-- -->`, les instructions `<?…?>` et les déclarations `<!…>` ne commencent
 * pas par `[\w:.-]` : ils ne sont donc jamais tokenisés comme des balises.
 */
const SVG_TAG_PATTERN = /<\/?([\w:.-]+)(?:"[^"]*"|'[^']*'|[^>"'])*>/g;

function svgTagTokens(svg: string): SvgTagToken[] {
  const tokens: SvgTagToken[] = [];
  for (const match of svg.matchAll(SVG_TAG_PATTERN)) {
    const raw = match[0];
    const name = match[1];
    if (name === undefined) continue;
    tokens.push({
      name,
      closing: raw.startsWith('</'),
      selfClosing: /\/\s*>$/.test(raw),
      start: match.index,
      end: match.index + raw.length,
    });
  }
  return tokens;
}

/**
 * Retire, par indice de la dernière ouverture correspondante, la balise trouvée
 * et tout ce qu'elle contenait dans la pile (imbrication cassée). `-1` quand le
 * nom n'est pas ouvert.
 */
function lastOpenIndex(stack: readonly SvgTagToken[], name: string): number {
  for (let index = stack.length - 1; index >= 0; index -= 1) {
    if (stack[index]?.name === name) return index;
  }
  return -1;
}

/** Supprime des plages de texte (balises seules) en une passe, sans décalage d'indice. */
function removeTokenRanges(svg: string, tokens: readonly SvgTagToken[]): string {
  if (tokens.length === 0) return svg;
  let result = '';
  let cursor = 0;
  for (const token of [...tokens].sort((left, right) => left.start - right.start)) {
    if (token.start < cursor) continue;
    result += svg.slice(cursor, token.start);
    cursor = token.end;
  }
  return result + svg.slice(cursor);
}

/**
 * `defs` n'est qu'un conteneur de définitions : une ouverture `<defs>` restée
 * sans `</defs>` est supprimée plutôt que refermée à la fin du document, ce qui
 * rendrait invisible tout le dessin qu'elle engloberait.
 *
 * La pile suit toutes les balises : une fermeture qui ne correspond pas au
 * sommet referme implicitement les éléments qu'elle englobe, et tout `<defs>`
 * ainsi fermé par son parent — comme celui encore ouvert à la fin — est un
 * `<defs>` sans `</defs>` propre, donc retiré. Un simple comptage de regex
 * confondait `<defs/>` auto-fermant avec une ouverture réelle.
 */
function dropUnclosedDefs(svg: string): string {
  const stack: SvgTagToken[] = [];
  const unclosed: SvgTagToken[] = [];

  const collectDefs = (tokens: readonly SvgTagToken[]): void => {
    for (const token of tokens) {
      if (token.name.toLowerCase() === 'defs') unclosed.push(token);
    }
  };

  for (const token of svgTagTokens(svg)) {
    if (token.selfClosing) continue;
    if (!token.closing) {
      stack.push(token);
      continue;
    }
    const matched = lastOpenIndex(stack, token.name);
    if (matched < 0) continue; // fermeture orpheline : traitée en dernière passe
    collectDefs(stack.slice(matched + 1));
    stack.length = matched;
  }

  collectDefs(stack);
  return removeTokenRanges(svg, unclosed);
}

/**
 * Dernière passe : supprime les fermetures orphelines (`</defs>` sans `<defs>`
 * ouvert), seules responsables d'un « Opening and ending tag mismatch » chez
 * librsvg. Une fermeture imbriquée à l'envers referme simplement les éléments
 * qu'elle englobe sans retirer de texte ; une balise encore ouverte à la fin
 * fait rejeter le document (`null`) plutôt que produire un XML douteux.
 */
export function dropOrphanClosingTags(svg: string): string | null {
  const stack: SvgTagToken[] = [];
  const orphans: SvgTagToken[] = [];
  let unclosedCount = 0;

  for (const token of svgTagTokens(svg)) {
    if (token.selfClosing) continue;
    if (!token.closing) {
      stack.push(token);
      continue;
    }

    const matched = lastOpenIndex(stack, token.name);
    if (matched < 0) {
      orphans.push(token);
      continue;
    }
    unclosedCount += stack.length - matched - 1;
    stack.length = matched;
  }

  if (stack.length > 0 || unclosedCount > 0) return null;
  return removeTokenRanges(svg, orphans);
}

/**
 * Filet de sécurité XML : tout préfixe encore utilisé sans être déclaré est
 * déclaré sur la racine `<svg>`. Un préfixe inconnu fait rejeter le document.
 */
function declareUsedPrefixes(svg: string): string | null {
  const declared = new Set<string>();
  for (const match of svg.matchAll(NAMESPACE_DECLARATION)) {
    const prefix = match[1];
    if (prefix !== undefined) declared.add(prefix);
  }

  const used = new Set<string>();
  for (const pattern of [PREFIX_IN_ELEMENT, PREFIX_IN_ATTRIBUTE]) {
    for (const match of svg.matchAll(pattern)) {
      const prefix = match[1];
      if (prefix !== undefined) used.add(prefix);
    }
  }

  const additions: string[] = [];
  for (const prefix of used) {
    if (prefix === 'xml' || prefix === 'xmlns' || declared.has(prefix)) continue;
    const uri = NAMESPACE_URIS[prefix];
    if (uri === undefined) return null;
    additions.push(`xmlns:${prefix}="${uri}"`);
  }
  if (additions.length === 0) return svg;

  const svgStart = svg.indexOf('<svg');
  const tagEnd = svgStart < 0 ? -1 : svg.indexOf('>', svgStart);
  if (svgStart < 0 || tagEnd < 0) return null;
  return `${svg.slice(0, tagEnd)} ${additions.join(' ')}${svg.slice(tagEnd)}`;
}

/**
 * Nettoie un SVG Wikimedia pour un rendu `<img>` portable et sûr.
 * Retourne `null` si le document n'est pas exploitable.
 */
export function sanitizeSvg(raw: string): string | null {
  let svg = raw;
  if (!svg.includes('<svg')) return null;

  svg = svg.replace(/<\?xml[^>]*\?>/g, '');
  // Les entités du sous-ensemble DOCTYPE (`&ns_ai;`…) alimentent les `xmlns` :
  // les résoudre avant de retirer les déclarations, sinon les namespaces
  // deviennent vides et le document est invalide.
  const entities = new Map<string, string>(Object.entries(ILLUSTRATOR_ENTITIES));
  for (const match of svg.matchAll(/<!ENTITY\s+([\w.:-]+)\s+["']([^"']*)["']\s*>/gi)) {
    const name = match[1];
    const value = match[2];
    if (name !== undefined && value !== undefined) entities.set(name, value);
  }
  svg = svg.replace(/&([\w.:-]+);/g, (whole, name: string) => entities.get(name) ?? whole);
  // DOCTYPE à sous-ensemble interne : couper au premier `>` laissait les
  // `<!ENTITY …>` et le `]>` dans le document, qui devenait non well-formed.
  svg = svg.replace(/<!DOCTYPE\b[^>]*\[[\s\S]*?\]>/gi, '');
  svg = svg.replace(/<!DOCTYPE[^>]*>/gi, '');
  svg = svg.replace(/<!(?:ENTITY|NOTATION|ELEMENT|ATTLIST)\b[^>]*>/gi, '');
  svg = svg.replace(/^\s*\]>\s*/i, '');
  svg = svg.replace(/<!--[\s\S]*?-->/g, '');
  svg = svg.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');

  if (/href\s*=\s*["']https?:/i.test(svg) || /xlink:href\s*=\s*["']https?:/i.test(svg)) {
    return null;
  }
  if (/href\s*=\s*["']data:image/i.test(svg) || /xlink:href\s*=\s*["']data:image/i.test(svg)) {
    return null;
  }

  svg = svg.replace(
    /<(?:[\w.-]+:)?(?:metadata|title|desc)\b[^>]*>[\s\S]*?<\/(?:[\w.-]+:)?(?:metadata|title|desc)>/gi,
    '',
  );
  svg = svg.replace(/<(?:[\w.-]+:)?(?:metadata|title|desc)\b[^>]*\/>/gi, '');
  svg = stripEditorElements(svg);
  svg = dropUnclosedDefs(svg);
  svg = svg.replace(EDITOR_ATTRIBUTE, '');
  svg = svg.replace(EDITOR_XMLNS, '');
  svg = svg.replace(/\s+on[a-z][a-z0-9]*\s*=\s*("[^"]*"|'[^']*')/gi, '');

  // Artefact d'une ancienne passe : `viewBox` inséré juste après le `<svg` d'une
  // racine préfixée `<svg:svg>` d'Illustrator, laissant `<svg viewBox="…":svg …>`.
  // On recolle la racine avant toute autre analyse.
  svg = svg.replace(/<svg(\s[^>]*?)":svg/g, '<svg$1"');
  // Racine préfixée `<svg:svg>` d'Illustrator → racine canonique `<svg>`.
  svg = svg.replace(/<svg:svg\b/g, '<svg');
  svg = svg.replace(/<\/svg:svg\s*>/g, '</svg>');

  const svgStart = svg.indexOf('<svg');
  const tagEnd = svg.indexOf('>', svgStart);
  if (svgStart < 0 || tagEnd < 0) return null;

  const rootTag = closeUnbalancedRootQuote(svg.slice(svgStart, tagEnd + 1));
  const width = readAttribute(rootTag, 'width');
  const height = readAttribute(rootTag, 'height');
  let viewBox = readAttribute(rootTag, 'viewBox');

  if (viewBox === null) {
    const numericWidth = parseNumericDimension(width);
    const numericHeight = parseNumericDimension(height);
    if (
      numericWidth === null ||
      numericHeight === null ||
      numericWidth <= 0 ||
      numericHeight <= 0
    ) {
      return null;
    }
    viewBox = `0 0 ${numericWidth} ${numericHeight}`;
  }

  let cleanRoot = rootTag.replace(/\s+width\s*=\s*("[^"]*"|'[^']*')/g, '');
  cleanRoot = cleanRoot.replace(/\s+height\s*=\s*("[^"]*"|'[^']*')/g, '');

  // Certains exports Illustrator ne déclarent que `xmlns:svg` : sans namespace
  // par défaut, la racine n'est plus un élément SVG pour le rendu.
  if (readAttribute(cleanRoot, 'xmlns') === null) {
    cleanRoot = cleanRoot.replace(/<svg(?=[\s/>])/, `<svg xmlns="${SVG_NAMESPACE}"`);
  }

  // Garantit un `viewBox` explicite sur la racine, même déduit de width/height.
  if (readAttribute(cleanRoot, 'viewBox') === null) {
    cleanRoot = cleanRoot.replace(/<svg(?=[\s/>])/, `$& viewBox="${viewBox}"`);
  }

  svg = `${svg.slice(0, svgStart)}${cleanRoot}${svg.slice(tagEnd + 1)}`;

  // Un préfixe résiduel sans déclaration casserait le parseur XML du navigateur :
  // on le déclare, ou on rejette le fichier s'il est inconnu.
  const namespaced = declareUsedPrefixes(svg);
  if (namespaced === null) return null;
  svg = namespaced;

  svg = svg
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Dernière passe, une fois toutes les balises stabilisées : une fermeture
  // orpheline (ou une balise restée ouverte) rendrait le document non
  // well-formed pour librsvg.
  const balanced = dropOrphanClosingTags(svg);
  if (balanced === null) return null;
  svg = balanced;

  return `${svg}\n`;
}

/* ------------------------------------------------------------------ */
/* Simplification Ramer–Douglas–Peucker + projection contours          */
/* ------------------------------------------------------------------ */

function perpendicularDistance(point: Point, start: Point, end: Point): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }

  const t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy);
  const clamped = Math.max(0, Math.min(1, t));
  const projectedX = start.x + clamped * dx;
  const projectedY = start.y + clamped * dy;
  return Math.hypot(point.x - projectedX, point.y - projectedY);
}

export function simplify(points: readonly Point[], epsilon: number): Point[] {
  if (points.length <= 2) return [...points];

  const first = points[0];
  const last = points[points.length - 1];
  if (first === undefined || last === undefined) return [...points];

  let maxDistance = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i += 1) {
    const point = points[i];
    if (point === undefined) continue;
    const distance = perpendicularDistance(point, first, last);
    if (distance > maxDistance) {
      maxDistance = distance;
      index = i;
    }
  }

  if (maxDistance > epsilon) {
    const left = simplify(points.slice(0, index + 1), epsilon);
    const right = simplify(points.slice(index), epsilon);
    return [...left.slice(0, -1), ...right];
  }

  return [first, last];
}

function simplifyRings(rings: readonly Point[][]): Point[][] {
  let epsilon = 0.001;
  for (let iteration = 0; iteration < 12; iteration += 1) {
    const simplified = rings.map((ring) => simplify(ring, epsilon));
    const total = simplified.reduce((sum, ring) => sum + ring.length, 0);
    if (total <= CONTOUR_MAX_POINTS && total >= CONTOUR_MIN_POINTS) return simplified;
    if (total > CONTOUR_MAX_POINTS) epsilon *= 2;
    else epsilon /= 2;
  }
  return rings.map((ring) => simplify(ring, epsilon));
}

function formatCoordinate(value: number): string {
  return String(Math.round(value * 100) / 100);
}

function ringPath(ring: readonly Point[]): string {
  let path = '';
  for (let index = 0; index < ring.length; index += 1) {
    const point = ring[index];
    if (point === undefined) continue;
    path += `${index === 0 ? 'M' : 'L'}${formatCoordinate(point.x)} ${formatCoordinate(point.y)}`;
  }
  return `${path}Z`;
}

/**
 * Transforme un MultiPolygone (anneaux [lon, lat]) en SVG 100×100 simplifié,
 * projeté en équirectangulaire corrigé, `fill-rule="evenodd"` pour les trous.
 */
export function contourSvg(polygons: readonly (readonly (readonly Point[])[])[]): string | null {
  const lats: number[] = [];
  for (const polygon of polygons) {
    for (const ring of polygon) {
      for (const point of ring) lats.push(point.y);
    }
  }
  if (lats.length === 0) return null;

  const latAverage = lats.reduce((sum, lat) => sum + lat, 0) / lats.length;
  const cosLat = Math.cos((latAverage * Math.PI) / 180);

  const projected: Point[][] = [];
  for (const polygon of polygons) {
    for (const ring of polygon) {
      projected.push(ring.map((point) => ({ x: point.x * cosLat, y: -point.y })));
    }
  }

  const simplified = simplifyRings(projected);

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const ring of simplified) {
    for (const point of ring) {
      if (point.x < minX) minX = point.x;
      if (point.x > maxX) maxX = point.x;
      if (point.y < minY) minY = point.y;
      if (point.y > maxY) maxY = point.y;
    }
  }
  if (!Number.isFinite(minX)) return null;

  const width = maxX - minX || 1;
  const height = maxY - minY || 1;
  const available = CONTOUR_BOX - 2 * CONTOUR_MARGIN;
  const scale = Math.min(available / width, available / height);
  const scaledWidth = width * scale;
  const scaledHeight = height * scale;
  const offsetX = (CONTOUR_BOX - scaledWidth) / 2;
  const offsetY = (CONTOUR_BOX - scaledHeight) / 2;

  const paths: string[] = [];
  for (const ring of simplified) {
    const scaled = ring.map((point) => ({
      x: (point.x - minX) * scale + offsetX,
      y: (point.y - minY) * scale + offsetY,
    }));
    paths.push(ringPath(scaled));
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CONTOUR_BOX} ${CONTOUR_BOX}"><path fill-rule="evenodd" d="${paths.join(' ')}" fill="${CONTOUR_FILL}"/></svg>`;
}

/* ------------------------------------------------------------------ */
/* IGN Admin Express : contours de repli (communes)                    */
/* ------------------------------------------------------------------ */

interface GeoFeature {
  properties?: { code_insee?: string };
  geometry?: { type?: string; coordinates?: unknown };
}

interface WfsPage {
  features: GeoFeature[];
  totalFeatures: number;
  numberReturned: number;
}

/** Valide la forme GeoJSON d'une page WFS ; `null` si la page est inexploitable. */
function asWfsPage(value: unknown): WfsPage | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as {
    type?: unknown;
    features?: unknown;
    totalFeatures?: unknown;
    numberReturned?: unknown;
  };
  if (record.type !== 'FeatureCollection') return null;
  if (!Array.isArray(record.features)) return null;

  const features: GeoFeature[] = [];
  for (const entry of record.features) {
    if (typeof entry === 'object' && entry !== null) features.push(entry as GeoFeature);
  }

  return {
    features,
    totalFeatures: typeof record.totalFeatures === 'number' ? record.totalFeatures : 0,
    numberReturned:
      typeof record.numberReturned === 'number' ? record.numberReturned : features.length,
  };
}

function pageBackoffMs(attempt: number): number {
  const index = Math.min(attempt, IGN_PAGE_BACKOFF_MS.length - 1);
  return IGN_PAGE_BACKOFF_MS[index] ?? 15_000;
}

type WfsPageResult = { ok: true; page: WfsPage } | { ok: false; detail: string };

/**
 * Récupère une page WFS. Toute anomalie (statut non-2xx, corps non JSON, JSON
 * non-GeoJSON, erreur réseau) est retentée selon `IGN_PAGE_BACKOFF_MS`.
 * Ne lève jamais : l'appelant décide de sauter la page.
 */
async function fetchContourPage(url: string): Promise<WfsPageResult> {
  let detail = 'aucune tentative';

  for (let attempt = 0; attempt <= IGN_PAGE_RETRIES; attempt += 1) {
    if (attempt > 0) await sleep(pageBackoffMs(attempt - 1));

    try {
      const response = await fetchWithRetry(url, { 'User-Agent': USER_AGENT });
      const text = await response.text();
      const contentType = contentTypeOf(response);

      if (!response.ok) {
        detail = `HTTP ${response.status} · ${contentType} · «${bodyPreview(text)}»`;
        continue;
      }

      const parsed = parseJsonText(text);
      if (!parsed.ok) {
        detail = `corps non JSON · ${contentType} · «${bodyPreview(text)}»`;
        continue;
      }

      const page = asWfsPage(parsed.value);
      if (page === null) {
        detail = `JSON non GeoJSON · ${contentType} · «${bodyPreview(text)}»`;
        continue;
      }

      return { ok: true, page };
    } catch (error) {
      detail = `erreur réseau · ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  return { ok: false, detail };
}

function readRing(raw: unknown): Point[] {
  if (!Array.isArray(raw)) return [];
  const points: Point[] = [];
  for (const entry of raw) {
    if (!Array.isArray(entry)) continue;
    const [lon, lat] = entry;
    if (typeof lon !== 'number' || typeof lat !== 'number') continue;
    points.push({ x: lon, y: lat });
  }
  return points;
}

function readPolygon(raw: unknown): Point[][] {
  if (!Array.isArray(raw)) return [];
  const rings: Point[][] = [];
  for (const ring of raw) {
    const points = readRing(ring);
    if (points.length >= 3) rings.push(points);
  }
  return rings;
}

function readMultiPolygon(geometry: GeoFeature['geometry']): Point[][][] | null {
  if (geometry === undefined || geometry.coordinates === undefined) return null;

  if (geometry.type === 'Polygon') {
    const rings = readPolygon(geometry.coordinates);
    return rings.length > 0 ? [rings] : null;
  }

  if (geometry.type === 'MultiPolygon') {
    if (!Array.isArray(geometry.coordinates)) return null;
    const polygons: Point[][][] = [];
    for (const polygon of geometry.coordinates) {
      const rings = readPolygon(polygon);
      if (rings.length > 0) polygons.push(rings);
    }
    return polygons.length > 0 ? polygons : null;
  }

  return null;
}

interface ContourResult {
  written: number;
  failed: number;
  skippedPages: number;
}

async function streamContours(
  needed: Set<string>,
  onFeature: (code: string, svg: string) => Promise<void>,
  progress?: ImportProgressWriter,
): Promise<ContourResult> {
  let written = 0;
  let failed = 0;
  let skippedPages = 0;
  let startIndex = 0;
  let totalFeatures = 0;

  if (needed.size === 0) return { written, failed, skippedPages };

  for (;;) {
    const params = new URLSearchParams({
      SERVICE: 'WFS',
      VERSION: '2.0.0',
      REQUEST: 'GetFeature',
      TYPENAMES: 'ADMINEXPRESS-COG-CARTO.LATEST:commune',
      SRSNAME: 'CRS:84',
      OUTPUTFORMAT: 'application/json',
      COUNT: String(IGN_PAGE_SIZE),
      STARTINDEX: String(startIndex),
    });

    const url = `${IGN_WFS}?${params.toString()}`;
    const result = await fetchContourPage(url);

    if (!result.ok) {
      // Une page durablement invalide ne doit jamais interrompre le streaming :
      // on la journalise, on compte l'échec et on passe à la suivante.
      skippedPages += 1;
      failed += 1;
      progress?.log(`Contours — page @${startIndex} ignorée : ${result.detail}`);
      startIndex += IGN_PAGE_SIZE;
      if (totalFeatures > 0 && startIndex >= totalFeatures) break;
      continue;
    }

    const { features, numberReturned } = result.page;
    if (result.page.totalFeatures > 0) totalFeatures = result.page.totalFeatures;

    for (const feature of features) {
      const code = feature.properties?.code_insee;
      if (code === undefined || !needed.has(code)) continue;
      const multiPolygon = readMultiPolygon(feature.geometry);
      if (multiPolygon === null) continue;
      const svg = contourSvg(multiPolygon);
      if (svg === null) continue;

      try {
        await onFeature(code, svg);
        written += 1;
        needed.delete(code);
      } catch {
        failed += 1;
      }
    }

    startIndex += features.length > 0 ? features.length : IGN_PAGE_SIZE;
    if (numberReturned === 0 || features.length === 0) break;
    if (totalFeatures > 0 && startIndex >= totalFeatures) break;
    if (needed.size === 0) break;
  }

  return { written, failed, skippedPages };
}

/* ------------------------------------------------------------------ */
/* Pool de téléchargement borné                                        */
/* ------------------------------------------------------------------ */

async function runPool<T>(
  items: readonly T[],
  worker: (item: T) => Promise<void>,
  concurrency: number,
): Promise<void> {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    for (;;) {
      const item = queue.shift();
      if (item === undefined) return;
      await worker(item);
    }
  });
  await Promise.all(workers);
}

function failureReason(error: unknown): string {
  if (error instanceof DownloadError) return error.reason;
  if (error instanceof Error) {
    const match = error.message.match(/^HTTP (\d{3})/);
    if (match !== null) return httpReason(Number(match[1]));
    if (isNetworkError(error)) return 'réseau';
  }
  return 'autre';
}

function recordFailure(target: LevelReport, error: unknown): void {
  target.failed += 1;
  const reason = failureReason(error);
  target.reasons[reason] = (target.reasons[reason] ?? 0) + 1;
}

function isRasterMime(mime: string): boolean {
  return mime.startsWith('image/') && mime !== 'image/svg+xml';
}

function isSupportedMime(mime: string): boolean {
  return mime === 'image/svg+xml' || isRasterMime(mime);
}

/**
 * Convertit un raster (PNG/JPEG/WebP…) en WebP 320 px : un blason de carte n'a
 * pas besoin de la pleine résolution, et 5–10 Ko suffisent largement.
 * `null` si `sharp` ne sait pas décoder le fichier.
 */
async function toWebp(buffer: Uint8Array): Promise<Uint8Array | null> {
  try {
    return await sharp(Buffer.from(buffer))
      .resize({ width: BLASON_IMAGE_WIDTH, withoutEnlargement: true })
      .webp({ quality: BLASON_WEBP_QUALITY })
      .toBuffer();
  } catch {
    return null;
  }
}

export interface DownloadedBlason {
  data: string | Uint8Array;
  ext: ImageExtension;
}

/**
 * Télécharge une image Commons et la normalise : SVG assaini tel quel, raster
 * converti en WebP. `null` quand le fichier n'est pas exploitable.
 */
async function downloadBlason(info: LicenseInfo): Promise<DownloadedBlason | null> {
  const response = await fetchWithRetry(info.url, { 'User-Agent': USER_AGENT });
  if (!response.ok) {
    throw new DownloadError(
      httpReason(response.status),
      `HTTP ${response.status} pour ${info.url}`,
    );
  }

  if (info.mime === 'image/svg+xml') {
    const svg = sanitizeSvg(await response.text());
    return svg === null ? null : { data: svg, ext: 'svg' };
  }

  if (isRasterMime(info.mime)) {
    const webp = await toWebp(new Uint8Array(await response.arrayBuffer()));
    return webp === null ? null : { data: webp, ext: 'webp' };
  }

  return null;
}

/* ------------------------------------------------------------------ */
/* Upsert en base par lots                                             */
/* ------------------------------------------------------------------ */

interface CommuneUpsertRow {
  code: string;
  blasonUrl: string | null;
  contourUrl: string | null;
  credit: string | null;
}

async function upsertCommunes(
  db: Kysely<Database>,
  blasons: ReadonlyMap<string, BlasonOutcome>,
  contours: ReadonlySet<string>,
): Promise<number> {
  const codes = new Set([...blasons.keys(), ...contours]);
  const rows: CommuneUpsertRow[] = [];
  for (const code of codes) {
    const blason = blasons.get(code);
    rows.push({
      code,
      blasonUrl: blason === undefined ? null : `/blasons/communes/${code}.${blason.ext}`,
      contourUrl: contours.has(code) ? `/blasons/contours/communes/${code}.svg` : null,
      credit: blason?.credit ?? null,
    });
  }
  if (rows.length === 0) return 0;

  let missing = 0;
  for (const chunk of chunkArray(rows, UPSERT_CHUNK_SIZE)) {
    const tuples = chunk.map(
      (row) => sql`(${row.code}, ${row.blasonUrl}, ${row.contourUrl}, ${row.credit})`,
    );
    const result = await sql`
      update ref_communes as c
      set
        blason_url = v.blason_url,
        contour_url = v.contour_url,
        blason_credit = v.blason_credit
      from (values ${sql.join(tuples)}) as v(code_insee, blason_url, contour_url, blason_credit)
      where c.code_insee = v.code_insee
    `.execute(db);
    missing += chunk.length - Number(result.numAffectedRows ?? 0);
  }

  return missing;
}

/**
 * Met à jour **uniquement** `contour_url` pour les codes fournis. Utilisé par la
 * reprise `--contours-only` : ne touche jamais `blason_url` ni `blason_credit`.
 */
export async function updateContourUrls(
  db: Kysely<Database>,
  codes: ReadonlySet<string>,
): Promise<number> {
  if (codes.size === 0) return 0;

  const rows = [...codes].map((code) => ({
    code,
    url: `/blasons/contours/communes/${code}.svg`,
  }));

  let missing = 0;
  for (const chunk of chunkArray(rows, UPSERT_CHUNK_SIZE)) {
    const tuples = chunk.map((row) => sql`(${row.code}, ${row.url})`);
    const result = await sql`
      update ref_communes as c
      set contour_url = v.contour_url
      from (values ${sql.join(tuples)}) as v(code_insee, contour_url)
      where c.code_insee = v.code_insee
    `.execute(db);
    missing += chunk.length - Number(result.numAffectedRows ?? 0);
  }

  return missing;
}

async function upsertBlasons(
  db: Kysely<Database>,
  table: 'ref_departements' | 'ref_regions',
  blasons: ReadonlyMap<string, BlasonOutcome>,
  contours: ReadonlyMap<string, string>,
): Promise<number> {
  const level: BlasonLevel = table === 'ref_departements' ? 'departements' : 'regions';
  const rows = [...new Set([...blasons.keys(), ...contours.keys()])].sort().map((code) => {
    const blason = blasons.get(code);
    return {
      code,
      url: blason === undefined ? null : `/blasons/${level}/${code}.${blason.ext}`,
      contourUrl: contours.get(code) ?? null,
      credit: blason?.credit ?? null,
    };
  });
  if (rows.length === 0) return 0;

  let missing = 0;
  for (const chunk of chunkArray(rows, UPSERT_CHUNK_SIZE)) {
    const tuples = chunk.map(
      (row) => sql`(${row.code}, ${row.url}, ${row.contourUrl}, ${row.credit})`,
    );
    const result = await sql`
      update ${sql.table(table)} as t
      set
        blason_url = v.blason_url,
        contour_url = v.contour_url,
        blason_credit = v.blason_credit
      from (values ${sql.join(tuples)}) as v(code, blason_url, contour_url, blason_credit)
      where t.code = v.code
    `.execute(db);
    missing += chunk.length - Number(result.numAffectedRows ?? 0);
  }

  return missing;
}

/* ------------------------------------------------------------------ */
/* Orchestration                                                        */
/* ------------------------------------------------------------------ */

interface LevelEntity {
  code: string;
  nom: string;
  filename: string | null;
}

async function entityNames(db: Kysely<Database>, level: BlasonLevel): Promise<Map<string, string>> {
  if (level === 'regions') {
    const rows = await db
      .selectFrom('ref_regions')
      .select(['code', 'nom'])
      .orderBy('code')
      .execute();
    return new Map(rows.map((row) => [row.code, row.nom]));
  }

  if (level === 'departements') {
    const rows = await db
      .selectFrom('ref_departements')
      .select(['code', 'nom'])
      .orderBy('code')
      .execute();
    return new Map(rows.map((row) => [row.code, row.nom]));
  }

  const rows = await db
    .selectFrom('ref_communes')
    .select(['code_insee', 'nom'])
    .orderBy('code_insee')
    .execute();
  return new Map(rows.map((row) => [row.code_insee, row.nom]));
}

/**
 * Univers d'un niveau. Régions et départements partent des tables de référence
 * (18 / 101 entités connues, y compris celles absentes de Wikidata) ; les
 * communes restent pilotées par SPARQL, faute de quoi 34 869 requêtes de
 * recherche seraient nécessaires.
 */
async function levelEntities(
  db: Kysely<Database>,
  level: BlasonLevel,
  codeToFile: ReadonlyMap<string, string>,
): Promise<LevelEntity[]> {
  if (level === 'communes') {
    return [...codeToFile.entries()]
      .map(([code, filename]) => ({ code, nom: code, filename }))
      .sort((a, b) => a.code.localeCompare(b.code));
  }

  const names = await entityNames(db, level);
  return [...names.entries()]
    .map(([code, nom]) => ({ code, nom, filename: codeToFile.get(code) ?? null }))
    .sort((a, b) => a.code.localeCompare(b.code));
}

function kindOfLevel(level: BlasonLevel): BlasonKind {
  if (level === 'regions') return 'region';
  if (level === 'departements') return 'departement';
  return 'commune';
}

/* ------------------------------------------------------------------ */
/* Forme de secours : silhouette agrégée des communes                  */
/* ------------------------------------------------------------------ */

const CONTOUR_LEVEL_FILTER = {
  departements: 'code_insee_du_departement',
  regions: 'code_insee_de_la_region',
} as const;

type ShapeLevel = keyof typeof CONTOUR_LEVEL_FILTER;

/**
 * Récupère tous les polygones des communes d'un département ou d'une région
 * (WFS Admin Express, filtre CQL), page par page.
 */
async function fetchEntityPolygons(
  level: ShapeLevel,
  code: string,
  progress?: ImportProgressWriter,
): Promise<Point[][][]> {
  const polygons: Point[][][] = [];
  let startIndex = 0;
  let totalFeatures = 0;

  for (;;) {
    const params = new URLSearchParams({
      SERVICE: 'WFS',
      VERSION: '2.0.0',
      REQUEST: 'GetFeature',
      TYPENAMES: 'ADMINEXPRESS-COG-CARTO.LATEST:commune',
      SRSNAME: 'CRS:84',
      OUTPUTFORMAT: 'application/json',
      COUNT: String(IGN_PAGE_SIZE),
      STARTINDEX: String(startIndex),
      CQL_FILTER: `${CONTOUR_LEVEL_FILTER[level]}='${code.replace(/'/g, "''")}'`,
    });

    const result = await fetchContourPage(`${IGN_WFS}?${params.toString()}`);
    if (!result.ok) {
      progress?.log(`Forme ${level}/${code} — page @${startIndex} ignorée : ${result.detail}`);
      break;
    }

    const { features, numberReturned } = result.page;
    if (result.page.totalFeatures > 0) totalFeatures = result.page.totalFeatures;
    for (const feature of features) {
      const multiPolygon = readMultiPolygon(feature.geometry);
      if (multiPolygon !== null) polygons.push(...multiPolygon);
    }

    startIndex += features.length > 0 ? features.length : IGN_PAGE_SIZE;
    if (features.length === 0 || numberReturned === 0) break;
    if (totalFeatures > 0 && startIndex >= totalFeatures) break;
  }

  return polygons;
}

/**
 * Écrit la silhouette de l'entité dans `contours/{niveau}/{code}.svg` et
 * retourne l'URL relative. Tous les anneaux sont concaténés dans un seul
 * `<path>` : les frontières internes restent visibles, la silhouette est juste.
 */
async function writeEntityShape(
  level: ShapeLevel,
  code: string,
  blasonsDir: string,
  progress?: ImportProgressWriter,
): Promise<string | null> {
  const polygons = await fetchEntityPolygons(level, code, progress);
  if (polygons.length === 0) return null;

  const svg = contourSvg(polygons);
  if (svg === null) return null;

  const dir = join(blasonsDir, 'contours', level);
  await mkdir(dir, { recursive: true });
  await Bun.write(join(dir, `${code}.svg`), svg);
  return `/blasons/contours/${level}/${code}.svg`;
}

/* ------------------------------------------------------------------ */
/* Orchestration                                                        */
/* ------------------------------------------------------------------ */

async function importLevel(
  db: Kysely<Database>,
  level: BlasonLevel,
  blasonsDir: string,
  options: BlasonOptions,
  report: BlasonReport,
  outcome: Map<string, BlasonOutcome>,
  contours: Map<string, string>,
): Promise<void> {
  const target = report[level];
  const dir = join(blasonsDir, level);
  await mkdir(dir, { recursive: true });

  const progress = options.progress;
  const codeToFile = await sparqlBlasons(level);
  const entities = await levelEntities(db, level, codeToFile);
  const limited =
    options.limit !== undefined ? entities.slice(0, Math.max(0, options.limit)) : entities;

  progress?.begin(`blasons-${level}`, LEVEL_LABELS[level], limited.length);
  progress?.log(
    `${LEVEL_LABELS[level]} — ${limited.length.toLocaleString('fr-FR')} entrées à traiter`,
  );

  // Repli Commons après P94 : réservé aux régions et départements, dont le
  // volume (18 + 101) rend une requête par entité acceptable.
  const searched = new Map<string, LicenseInfo>();
  if (level !== 'communes') {
    const missing = limited.filter((entity) => entity.filename === null);
    if (missing.length > 0) {
      progress?.log(
        `Recherche Commons — ${missing.length.toLocaleString('fr-FR')} entité(s) sans P94`,
      );
    }
    for (const entity of missing) {
      try {
        const match = await searchCommonsBlason(entity.nom, kindOfLevel(level));
        if (match === null) {
          progress?.log(`Recherche Commons — ${entity.code} ${entity.nom} : aucune correspondance`);
          continue;
        }
        entity.filename = match.filename;
        searched.set(entity.code, match.info);
        progress?.log(`Recherche Commons — ${entity.code} ${entity.nom} : File:${match.filename}`);
      } catch (error) {
        progress?.log(`Recherche Commons — ${entity.code} ${entity.nom} : ${errorText(error)}`);
      }
    }
  }

  const filenames = limited
    .map((entity) => entity.filename)
    .filter((filename): filename is string => filename !== null);
  const licenses = await resolveLicenses(filenames);

  let processed = 0;
  await runPool(
    limited,
    async (entity) => {
      try {
        const info =
          searched.get(entity.code) ??
          (entity.filename === null ? undefined : licenses.get(entity.filename));

        if (info === undefined || !isSupportedMime(info.mime)) {
          target.skipped += 1;
          return;
        }

        const credit = buildCredit(info);
        const existing = options.force === true ? null : await findExistingImage(dir, entity.code);
        if (existing !== null) {
          outcome.set(entity.code, { credit, ext: existing });
          target.blasons += 1;
          return;
        }

        try {
          const image = await downloadBlason(info);
          if (image === null) {
            target.skipped += 1;
            progress?.log(
              `Blason ignoré — ${entity.code} : image inexploitable (${info.mime || 'mime inconnu'})`,
            );
            return;
          }
          await Bun.write(join(dir, `${entity.code}.${image.ext}`), image.data);
          outcome.set(entity.code, { credit, ext: image.ext });
          target.blasons += 1;
        } catch (error) {
          recordFailure(target, error);
        }
      } finally {
        processed += 1;
        progress?.advance();
        progress?.set(processed, entity.code);
      }
    },
    DOWNLOAD_CONCURRENCY,
  );

  progress?.log(
    `${LEVEL_LABELS[level]} — terminé : ${target.blasons.toLocaleString('fr-FR')} blasons · ` +
      `${target.skipped.toLocaleString('fr-FR')} ignorés · ` +
      `${target.failed.toLocaleString('fr-FR')} échecs`,
  );

  // Dernier repli garanti : une silhouette agrégée pour qu'aucune carte de
  // région ou de département ne reste sans image.
  if (level !== 'communes') {
    const shapes = limited.filter((entity) => !outcome.has(entity.code));
    if (shapes.length > 0) {
      progress?.log(
        `Forme de secours — ${shapes.length.toLocaleString('fr-FR')} entité(s) sans blason`,
      );
    }
    for (const entity of shapes) {
      try {
        const url = await writeEntityShape(level, entity.code, blasonsDir, progress);
        if (url === null) {
          progress?.log(`Forme de secours — ${entity.code} : aucune géométrie`);
          continue;
        }
        contours.set(entity.code, url);
        target.contours += 1;
        progress?.log(`Forme de secours — ${entity.code} ${entity.nom} : ${url}`);
      } catch (error) {
        recordFailure(target, error);
      }
    }
  }
}

/**
 * Génère les contours IGN des communes listées dans `needed`.
 * Les fichiers déjà présents sont sautés (sauf `--force`) mais restent
 * enregistrés dans `contourCodes` pour que la base pointe dessus.
 */
async function generateContours(
  blasonsDir: string,
  options: BlasonOptions,
  target: LevelReport,
  needed: Set<string>,
  contourCodes: Set<string>,
): Promise<number> {
  const progress = options.progress;
  const contoursDir = join(blasonsDir, 'contours', 'communes');
  await mkdir(contoursDir, { recursive: true });

  progress?.begin('contours', 'Contours IGN des communes', needed.size);
  progress?.log(`Contours — ${needed.size.toLocaleString('fr-FR')} communes à traiter`);

  let processedContours = 0;
  const { written, failed, skippedPages } = await streamContours(
    needed,
    async (code, svg) => {
      try {
        const filePath = join(contoursDir, `${code}.svg`);
        if (options.force !== true && (await fileExists(filePath))) {
          contourCodes.add(code);
          return;
        }
        await Bun.write(filePath, svg);
        contourCodes.add(code);
      } finally {
        processedContours += 1;
        progress?.advance();
        progress?.set(processedContours, code);
      }
    },
    progress,
  );

  target.contours = written;
  target.failed += failed;
  progress?.log(
    `Contours — terminé : ${written.toLocaleString('fr-FR')} écrits · ` +
      `${failed.toLocaleString('fr-FR')} échecs · ` +
      `${skippedPages.toLocaleString('fr-FR')} pages ignorées`,
  );

  return written;
}

/** Reprise `--contours-only` : aucun appel SPARQL/Commons, aucun blason réécrit. */
async function importMissingContours(
  db: Kysely<Database>,
  blasonsDir: string,
  options: BlasonOptions,
  report: BlasonReport,
): Promise<void> {
  const dbCodes = await readCommuneCodes(db);
  const communeDir = join(blasonsDir, 'communes');
  const contoursDir = join(blasonsDir, 'contours', 'communes');
  const sorted = [...dbCodes].sort();
  const limit = options.limit !== undefined ? Math.max(0, options.limit) : undefined;

  // Périmètre : les communes sans blason, dans un ordre stable. `--limit` borne
  // ce périmètre, ce qui rend une seconde exécution quasi instantanée.
  const candidates: string[] = [];
  for (const code of sorted) {
    if (limit !== undefined && candidates.length >= limit) break;
    if ((await findExistingImage(communeDir, code)) !== null) continue;
    candidates.push(code);
  }

  const needed = new Set<string>();
  const contourCodes = new Set<string>();
  for (const code of candidates) {
    if (options.force !== true && (await fileExists(join(contoursDir, `${code}.svg`)))) {
      contourCodes.add(code);
      continue;
    }
    needed.add(code);
  }

  options.progress?.log(
    `Contours — reprise seule · ${dbCodes.size.toLocaleString('fr-FR')} communes en base · ` +
      `${needed.size.toLocaleString('fr-FR')} contours à générer`,
  );

  await generateContours(blasonsDir, options, report.communes, needed, contourCodes);
  report.communes.missing = await updateContourUrls(db, contourCodes);
}

export async function importBlasons(
  db: Kysely<Database>,
  options: BlasonOptions,
): Promise<BlasonReport> {
  const startedAt = performance.now();
  const blasonsDir = process.env.BLASONS_DIR?.trim() || DEFAULT_BLASONS_DIR;
  const report: BlasonReport = {
    communes: emptyLevel(),
    departements: emptyLevel(),
    regions: emptyLevel(),
    durationMs: 0,
  };

  // Reprise ciblée : aucune requête SPARQL/Commons, aucun blason réécrit.
  if (options.contoursOnly === true) {
    await importMissingContours(db, blasonsDir, options, report);
    report.durationMs = performance.now() - startedAt;
    return report;
  }

  const levels: BlasonLevel[] =
    options.only !== undefined ? [options.only] : ['communes', 'departements', 'regions'];

  const outcomes: Record<BlasonLevel, Map<string, BlasonOutcome>> = {
    communes: new Map(),
    departements: new Map(),
    regions: new Map(),
  };
  const entityContours: Record<BlasonLevel, Map<string, string>> = {
    communes: new Map(),
    departements: new Map(),
    regions: new Map(),
  };
  const communeContourCodes = new Set<string>();

  for (const level of levels) {
    await importLevel(
      db,
      level,
      blasonsDir,
      options,
      report,
      outcomes[level],
      entityContours[level],
    );
  }

  // Les contours passent en dernier pour que le compteur d'étapes reste ordonné.
  if (levels.includes('communes') && options.contours) {
    const dbCodes = await readCommuneCodes(db);
    const withBlason = new Set(outcomes.communes.keys());
    const needed = new Set([...dbCodes].filter((code) => !withBlason.has(code)));
    await generateContours(blasonsDir, options, report.communes, needed, communeContourCodes);
  }

  report.communes.missing = await upsertCommunes(db, outcomes.communes, communeContourCodes);
  report.departements.missing = await upsertBlasons(
    db,
    'ref_departements',
    outcomes.departements,
    entityContours.departements,
  );
  report.regions.missing = await upsertBlasons(
    db,
    'ref_regions',
    outcomes.regions,
    entityContours.regions,
  );

  report.durationMs = performance.now() - startedAt;
  return report;
}
