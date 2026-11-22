/**
 * Acquisition de `geom` — le seul écrivain de la colonne.
 *
 * L'audit de la phase 33 a montré que `geom` était vide sur les trois tables de
 * référentiel : aucun module n'écrivait la colonne. Ce fichier la remplit en
 * masse depuis le WFS IGN `ADMINEXPRESS-COG-CARTO`, avec le même flux paginé que
 * `blasons.ts` — `COUNT` / `STARTINDEX` jusqu'à une page vide.
 *
 * **Aucun appel par entité**, aucune clé d'API : une page porte 500 géométries,
 * un lot absent de la base est simplement ignoré. L'appel externe vit donc dans
 * le pipeline d'import, jamais au runtime d'une requête joueur (Archi §4.1).
 *
 * Un `geom` déjà écrit n'est **jamais** réécrit sauf `force` : la colonne
 * appartient aux étapes blasons et atlas, et un réimport non destructeur ne doit
 * pas laisser un référentiel sans géométrie derrière lui.
 */

import type { Database } from '@hexamap/db';
import { type Kysely, sql } from 'kysely';
import { ATLAS_TABLES, type AtlasTableSpec } from './atlas';
import type { AtlasLevel } from './atlas-projection';

const IGN_WFS = 'https://data.geopf.fr/wfs/ows';
const PAGE_SIZE = 500;
/**
 * Garde-fou de pagination. Le référentiel national compte ≈ 34 900 communes,
 * soit 80 pages de 500 ; la marge de quatre pages couvre une dérive de
 * `totalFeatures`. Sans cette borne, un serveur qui ignore `STARTINDEX` et
 * n'annonce aucun total ferait boucler le parcours national indéfiniment, en
 * silence.
 */
const MAX_PAGES = Math.ceil(40_000 / PAGE_SIZE) + 4;
const RETRY_ATTEMPTS = 3;
const RETRY_BACKOFF_MS: readonly number[] = [5_000, 15_000];
const USER_AGENT = 'Hexamap-Import/1.0 (+https://hexamap.fr; atlas)';

const TYPENAMES: Record<AtlasLevel, string> = {
  REGION: 'region',
  DEPARTEMENT: 'departement',
  COMMUNE: 'commune',
};

export interface AtlasGeometryCounters {
  /** Entités reçues du WFS, toutes pages confondues. */
  fetched: number;
  /** Lignes dont `geom` a été écrit. */
  stored: number;
  /** Entités ignorées : code absent de la base, ou géométrie nulle. */
  skipped: number;
}

export interface AtlasGeometryOptions {
  force?: boolean;
}

interface WfsFeature {
  properties?: Record<string, unknown>;
  geometry?: unknown;
}

interface WfsPage {
  features: WfsFeature[];
  /** Longueur brute de `features`, **avant** filtrage : c'est elle qui pagine. */
  rawCount: number;
  totalFeatures: number;
}

interface GeometryRow {
  code: string;
  geom: unknown;
}

function formatCount(value: number): string {
  return value.toLocaleString('fr-FR');
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/** Valide la forme GeoJSON d'une page ; `null` si la page est inexploitable. */
function asWfsPage(value: unknown): WfsPage | null {
  if (typeof value !== 'object' || value === null) return null;

  const record = value as {
    type?: unknown;
    features?: unknown;
    totalFeatures?: unknown;
  };

  if (record.type !== 'FeatureCollection') return null;
  if (!Array.isArray(record.features)) return null;

  const features: WfsFeature[] = [];
  for (const entry of record.features) {
    if (typeof entry === 'object' && entry !== null) features.push(entry as WfsFeature);
  }

  return {
    features,
    rawCount: record.features.length,
    totalFeatures: typeof record.totalFeatures === 'number' ? record.totalFeatures : 0,
  };
}

/**
 * Une page WFS, retentée de façon **bornée** (trois tentatives) sur erreur
 * réseau, corps non JSON ou statut non-2xx. Au-delà, l'échec est relayé avec un
 * message français : une acquisition nationale ne doit pas boucler.
 */
async function fetchPage(level: AtlasLevel, startIndex: number): Promise<WfsPage> {
  const params = new URLSearchParams({
    SERVICE: 'WFS',
    VERSION: '2.0.0',
    REQUEST: 'GetFeature',
    TYPENAMES: `ADMINEXPRESS-COG-CARTO.LATEST:${TYPENAMES[level]}`,
    SRSNAME: 'CRS:84',
    OUTPUTFORMAT: 'application/json',
    COUNT: String(PAGE_SIZE),
    STARTINDEX: String(startIndex),
  });

  const url = `${IGN_WFS}?${params.toString()}`;
  let detail = 'aucune tentative';

  for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt += 1) {
    if (attempt > 0) {
      await sleep(RETRY_BACKOFF_MS[attempt - 1] ?? 15_000);
    }

    try {
      const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });

      if (!response.ok) {
        detail = `HTTP ${response.status}`;
        continue;
      }

      const payload: unknown = await response.json();
      const page = asWfsPage(payload);

      if (page === null) {
        detail = 'corps non GeoJSON';
        continue;
      }

      return page;
    } catch (error) {
      detail = `erreur réseau · ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  throw new Error(
    `ATLAS_IGN_FETCH_FAILED : ${level} @${startIndex} — ${detail}. ` +
      'Les pages déjà lues sont écrites ; un rejeu reprend la suite, ' +
      'puisque seules les entités dont `geom` est null sont acquises.',
  );
}

function readCode(properties: Record<string, unknown> | undefined): string | null {
  if (properties === undefined) return null;

  const codeInsee = properties.code_insee;
  if (typeof codeInsee === 'string' && codeInsee.length > 0) return codeInsee;

  const code = properties.code;
  if (typeof code === 'string' && code.length > 0) return code;

  return null;
}

async function readExistingCodes(db: Kysely<Database>, spec: AtlasTableSpec): Promise<Set<string>> {
  const result = await sql<{ code: string }>`
    select ${sql.id(spec.codeColumn)} as code
    from ${sql.id(spec.table)}
  `.execute(db);

  return new Set(result.rows.map((row) => row.code));
}

/** Une requête par lot : `update … from (values …)`, jamais une par entité. */
async function writeGeometryBatch(
  db: Kysely<Database>,
  spec: AtlasTableSpec,
  rows: readonly GeometryRow[],
  force: boolean,
): Promise<number> {
  if (rows.length === 0) return 0;

  const values = sql.join(
    // `::text::jsonb` : la chaîne part en **texte**, Postgres la parse. Sans le
    // premier cast, le driver inférerait un paramètre `jsonb` et sérialiserait
    // une chaîne déjà sérialisée — un `geom` qui serait alors une *chaîne* jsonb.
    rows.map((row) => sql`(${row.code}, ${JSON.stringify(row.geom)}::text::jsonb)`),
    sql`, `,
  );

  const guard = force ? sql`true` : sql`t.geom is null`;

  const result = await sql`
    update ${sql.id(spec.table)} as t
    set geom = v.geom
    from (values ${values}) as v(code, geom)
    where ${sql.id('t', spec.codeColumn)} = v.code
      and ${guard}
  `.execute(db);

  return Number(result.numAffectedRows ?? 0);
}

/**
 * Remplit `geom` pour un niveau. Seules les entités déjà présentes en base sont
 * écrites : un lot hors périmètre est ignoré, jamais inséré.
 */
export async function fillAtlasGeometry(
  db: Kysely<Database>,
  level: AtlasLevel,
  options: AtlasGeometryOptions = {},
): Promise<AtlasGeometryCounters> {
  const spec = ATLAS_TABLES[level];
  const force = options.force === true;
  const counters: AtlasGeometryCounters = { fetched: 0, stored: 0, skipped: 0 };

  const existing = await readExistingCodes(db, spec);

  if (existing.size === 0) {
    console.log(
      `[atlas] ${spec.table} : aucune entité en base, acquisition de la géométrie ignorée`,
    );
    return counters;
  }

  let startIndex = 0;
  let pagesRead = 0;

  for (;;) {
    if (pagesRead >= MAX_PAGES) {
      throw new Error(
        `ATLAS_IGN_PAGINATION_LOOP : ${level} @${startIndex} — ` +
          `${formatCount(pagesRead)} pages déjà lues et le flux ne se termine pas. ` +
          'Le serveur WFS ignore probablement STARTINDEX ; l’acquisition est ' +
          'interrompue plutôt que de boucler indéfiniment.',
      );
    }

    const page = await fetchPage(level, startIndex);
    pagesRead += 1;
    if (page.rawCount === 0) break;

    counters.fetched += page.features.length;

    const rows: GeometryRow[] = [];
    for (const feature of page.features) {
      const code = readCode(feature.properties);
      if (code === null || !existing.has(code)) {
        counters.skipped += 1;
        continue;
      }

      const geometry = feature.geometry;
      if (typeof geometry !== 'object' || geometry === null) {
        counters.skipped += 1;
        continue;
      }

      rows.push({ code, geom: geometry });
    }

    counters.stored += await writeGeometryBatch(db, spec, rows, force);

    // La pagination avance du compte **brut** : une entrée non-objet écartée par
    // `asWfsPage` ne doit pas décaler le parcours d'une entité.
    startIndex += page.rawCount;

    if (page.rawCount < PAGE_SIZE) break;
    if (page.totalFeatures > 0 && startIndex >= page.totalFeatures) break;
  }

  console.log(
    `[atlas] ${spec.table} : ${formatCount(counters.fetched)} entités lues, ` +
      `${formatCount(counters.stored)} géométries écrites, ` +
      `${formatCount(counters.skipped)} ignorées`,
  );

  return counters;
}
