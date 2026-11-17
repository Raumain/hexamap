import { communeRarity, communeScore, type Rarity } from '@hexamap/shared';

const GEO_API_BASE = 'https://geo.api.gouv.fr';
const COMMUNE_FIELDS = 'nom,code,codeDepartement,codeRegion,population,centre';
const DEPARTEMENT_FIELDS = 'nom,code,codeRegion,population';

export interface RefRegionRow {
  code: string;
  nom: string;
  geom: unknown | null;
  blason_url: string | null;
}

export interface RefDepartementRow {
  code: string;
  nom: string;
  code_region: string;
  population: number;
  geom: unknown | null;
  blason_url: string | null;
}

export interface RefCommuneRow {
  code_insee: string;
  nom: string;
  code_departement: string;
  code_region: string;
  population: number;
  latitude: number | null;
  longitude: number | null;
  rarete: Rarity;
  score_base: number;
  draw_bucket: number;
  geom: unknown | null;
}

type RawRecord = Record<string, unknown>;

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

const BODY_PREVIEW_LENGTH = 120;

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`GET ${url} → HTTP ${response.status} ${response.statusText}`);
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    const contentType = response.headers.get('content-type') ?? 'content-type absent';
    const preview = text.slice(0, BODY_PREVIEW_LENGTH).replace(/\s+/g, ' ').trim();
    throw new Error(
      `GET ${url} → réponse non JSON (HTTP ${response.status}, ${contentType}) — «${preview}»`,
    );
  }
}

async function fetchArray(url: string): Promise<RawRecord[]> {
  const data = await fetchJson(url);
  if (!Array.isArray(data)) {
    throw new Error(`Réponse inattendue pour ${url} : tableau JSON attendu`);
  }
  return data as RawRecord[];
}

export interface GouvReferenceData {
  regions: RefRegionRow[];
  departements: RefDepartementRow[];
  communes: RefCommuneRow[];
  skippedCommunes: number;
}

export function randomDrawBucket(): number {
  return Math.floor(Math.random() * 256);
}

function buildQuery(params: Record<string, string>): string {
  const search = new URLSearchParams(params);
  return search.toString();
}

export async function fetchRegions(regionCodes: readonly string[] | null): Promise<RefRegionRow[]> {
  const url = `${GEO_API_BASE}/regions?${buildQuery({ fields: 'nom,code' })}`;
  const raw = await fetchArray(url);

  const rows: RefRegionRow[] = [];
  for (const entry of raw) {
    const code = asString(entry.code);
    const nom = asString(entry.nom);
    if (code === null || nom === null) continue;
    if (regionCodes !== null && !regionCodes.includes(code)) continue;
    rows.push({ code, nom, geom: null, blason_url: null });
  }

  if (rows.length === 0) {
    throw new Error('Aucune région retournée par geo.api.gouv.fr');
  }
  return rows;
}

export async function fetchDepartements(
  regionCodes: readonly string[] | null,
): Promise<RefDepartementRow[]> {
  const url = `${GEO_API_BASE}/departements?${buildQuery({ fields: DEPARTEMENT_FIELDS })}`;
  const raw = await fetchArray(url);

  const rows: RefDepartementRow[] = [];
  for (const entry of raw) {
    const code = asString(entry.code);
    const nom = asString(entry.nom);
    const codeRegion = asString(entry.codeRegion);
    if (code === null || nom === null || codeRegion === null) continue;
    if (regionCodes !== null && !regionCodes.includes(codeRegion)) continue;
    rows.push({
      code,
      nom,
      code_region: codeRegion,
      population: asNumber(entry.population) ?? 0,
      geom: null,
      blason_url: null,
    });
  }

  if (rows.length === 0) {
    throw new Error('Aucun département retourné par geo.api.gouv.fr');
  }
  return rows;
}

interface FetchCommunesOptions {
  regionCodes: readonly string[] | null;
  knownRegionCodes: ReadonlySet<string>;
  knownDepartementCodes: ReadonlySet<string>;
}

export async function fetchCommunes(options: FetchCommunesOptions): Promise<{
  rows: RefCommuneRow[];
  skipped: number;
}> {
  const raw: RawRecord[] = [];

  if (options.regionCodes === null) {
    raw.push(
      ...(await fetchArray(`${GEO_API_BASE}/communes?${buildQuery({ fields: COMMUNE_FIELDS })}`)),
    );
  } else {
    for (const codeRegion of options.regionCodes) {
      raw.push(
        ...(await fetchArray(
          `${GEO_API_BASE}/communes?${buildQuery({ codeRegion, fields: COMMUNE_FIELDS })}`,
        )),
      );
    }
  }

  const rows: RefCommuneRow[] = [];
  let skipped = 0;

  for (const entry of raw) {
    const codeInsee = asString(entry.code);
    const nom = asString(entry.nom);
    const codeDepartement = asString(entry.codeDepartement);
    const codeRegion = asString(entry.codeRegion);
    const population = asNumber(entry.population);

    if (
      codeInsee === null ||
      nom === null ||
      codeDepartement === null ||
      codeRegion === null ||
      population === null ||
      population <= 0 ||
      !options.knownRegionCodes.has(codeRegion) ||
      !options.knownDepartementCodes.has(codeDepartement)
    ) {
      skipped += 1;
      continue;
    }

    const [longitude, latitude] = readCentre(entry.centre);

    rows.push({
      code_insee: codeInsee,
      nom,
      code_departement: codeDepartement,
      code_region: codeRegion,
      population,
      latitude,
      longitude,
      rarete: communeRarity(population),
      score_base: communeScore(population),
      draw_bucket: randomDrawBucket(),
      geom: null,
    });
  }

  return { rows, skipped };
}

function readCentre(value: unknown): [number | null, number | null] {
  if (typeof value !== 'object' || value === null) return [null, null];
  const coordinates = (value as RawRecord).coordinates;
  if (!Array.isArray(coordinates)) return [null, null];

  const longitude = asNumber(coordinates[0]);
  const latitude = asNumber(coordinates[1]);
  return [longitude, latitude];
}

/** Complète la population des départements à partir de la somme des communes. */
export function withCommunePopulations(
  departements: readonly RefDepartementRow[],
  communes: readonly RefCommuneRow[],
): RefDepartementRow[] {
  const totals = new Map<string, number>();
  for (const commune of communes) {
    totals.set(
      commune.code_departement,
      (totals.get(commune.code_departement) ?? 0) + commune.population,
    );
  }

  return departements.map((departement) => {
    const total = totals.get(departement.code);
    if (departement.population > 0 || total === undefined) return departement;
    return { ...departement, population: total };
  });
}

export async function loadGouvReferenceData(
  regionCodes: readonly string[] | null,
): Promise<GouvReferenceData> {
  const regions = await fetchRegions(regionCodes);
  const departements = await fetchDepartements(regionCodes);

  const { rows: communes, skipped } = await fetchCommunes({
    regionCodes,
    knownRegionCodes: new Set(regions.map((region) => region.code)),
    knownDepartementCodes: new Set(departements.map((departement) => departement.code)),
  });

  if (communes.length === 0) {
    throw new Error('Aucune commune avec population retournée par geo.api.gouv.fr');
  }

  return {
    regions,
    departements: withCommunePopulations(departements, communes),
    communes,
    skippedCommunes: skipped,
  };
}
