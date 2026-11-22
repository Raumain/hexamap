/**
 * Étape atlas — lecture de `geom`, écriture de `path_d`.
 *
 * **Couche d'entrée-sortie uniquement.** Aucune géométrie n'est calculée ici :
 * la projection, la simplification et la classification appartiennent à
 * `atlas-projection.ts`, seul propriétaire des deux valeurs figées (Mercator
 * sphérique EPSG:3857 cadré sur la métropole, `viewBox 0 0 1000 1000`).
 *
 * **Un `path_d` existant n'est jamais réécrit sans `force`.** C'est ce qui rend
 * un rejeu du pipeline gratuit, et identique à l'octet près.
 *
 * **Une entité sans géométrie, invalide ou hors du cadre n'écrit rien et ne
 * lève jamais** : c'est un compteur, pas une erreur. Un trou dans la carte se
 * mesure, il ne s'interrompt pas.
 */

import type { Database } from '@hexamap/db';
import { type Kysely, sql } from 'kysely';
import { type AtlasLevel, classifyGeometry, geometryToPathD } from './atlas-projection';

export interface AtlasCounters {
  /** Lignes lues. */
  scanned: number;
  /** `path_d` calculés avec succès. */
  computed: number;
  /** `path_d` déjà non nul, non recalculé. */
  alreadySet: number;
  /** `geom` NULL. */
  missingGeom: number;
  /** `classifyGeometry` a rendu `invalid`. */
  invalidGeom: number;
  /** `classifyGeometry` a rendu `out_of_viewbox` (outre-mer). */
  outOfViewbox: number;
  /** Lignes effectivement mises à jour. */
  written: number;
}

export interface AtlasOptions {
  force?: boolean;
  limit?: number | null;
}

/** Table et colonne de code d'un niveau : une seule correspondance, typée. */
export interface AtlasTableSpec {
  readonly table: 'ref_regions' | 'ref_departements' | 'ref_communes';
  readonly codeColumn: 'code' | 'code_insee';
}

export const ATLAS_TABLES: Record<AtlasLevel, AtlasTableSpec> = {
  REGION: { table: 'ref_regions', codeColumn: 'code' },
  DEPARTEMENT: { table: 'ref_departements', codeColumn: 'code' },
  COMMUNE: { table: 'ref_communes', codeColumn: 'code_insee' },
};

/** Ordre imposé : la région, qui contient le département, qui contient la commune. */
export const ATLAS_LEVELS: readonly AtlasLevel[] = ['REGION', 'DEPARTEMENT', 'COMMUNE'];

const READ_BATCH_SIZE = 500;
const WRITE_BATCH_SIZE = 500;

interface GeomRow {
  code: string;
  geom: unknown;
  path_d: string | null;
}

interface PathUpdate {
  code: string;
  path_d: string;
}

function emptyCounters(): AtlasCounters {
  return {
    scanned: 0,
    computed: 0,
    alreadySet: 0,
    missingGeom: 0,
    invalidGeom: 0,
    outOfViewbox: 0,
    written: 0,
  };
}

function chunkArray<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function formatCount(value: number): string {
  return value.toLocaleString('fr-FR');
}

/**
 * Lecture par lots, en keyset pagination sur le code : aucune ligne n'est
 * sautée ni lue deux fois, même si le tableau se réécrit pendant le parcours.
 */
async function readBatch(
  db: Kysely<Database>,
  spec: AtlasTableSpec,
  afterCode: string | null,
  size: number,
): Promise<GeomRow[]> {
  const code = sql.id(spec.codeColumn);

  if (afterCode === null) {
    const result = await sql<GeomRow>`
      select ${code} as code, geom, path_d
      from ${sql.id(spec.table)}
      order by ${code}
      limit ${size}
    `.execute(db);
    return result.rows;
  }

  const result = await sql<GeomRow>`
    select ${code} as code, geom, path_d
    from ${sql.id(spec.table)}
    where ${code} > ${afterCode}
    order by ${code}
    limit ${size}
  `.execute(db);
  return result.rows;
}

/**
 * Une requête par lot, jamais une par ligne : `update … from (values …)`.
 * Le coût d'un rejeu national tient donc au nombre de lots, pas au nombre de
 * communes.
 */
async function writeBatch(
  db: Kysely<Database>,
  spec: AtlasTableSpec,
  updates: readonly PathUpdate[],
): Promise<number> {
  if (updates.length === 0) return 0;

  const values = sql.join(
    updates.map((update) => sql`(${update.code}, ${update.path_d})`),
    sql`, `,
  );

  const result = await sql`
    update ${sql.id(spec.table)} as t
    set path_d = v.path_d
    from (values ${values}) as v(code, path_d)
    where ${sql.id('t', spec.codeColumn)} = v.code
  `.execute(db);

  return Number(result.numAffectedRows ?? 0);
}

/**
 * Normalise un `geom` lu. Le driver du dépôt rend déjà un objet (`jsonb` décodé) ;
 * seule une valeur **textuelle** est reparsée, pour qu'une géométrie écrite en
 * texte reste lisible au lieu d'être classée invalide. Un texte illisible devient
 * `{}`, que la classification compte comme `invalid`.
 */
function readGeometry(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw;

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return {};
  }
}

/**
 * Calcule et écrit le `path_d` d'un niveau. Idempotent : un second passage sur
 * les mêmes données rend `alreadySet === computed` du premier et n'écrit rien.
 */
export async function computeAtlasPaths(
  db: Kysely<Database>,
  level: AtlasLevel,
  options: AtlasOptions = {},
): Promise<AtlasCounters> {
  const spec = ATLAS_TABLES[level];
  const force = options.force === true;
  const limit = options.limit ?? null;
  const counters = emptyCounters();

  let afterCode: string | null = null;

  for (;;) {
    const remaining =
      limit === null ? READ_BATCH_SIZE : Math.min(READ_BATCH_SIZE, limit - counters.scanned);
    if (remaining <= 0) break;

    const rows = await readBatch(db, spec, afterCode, remaining);
    if (rows.length === 0) break;

    const last = rows[rows.length - 1];
    if (last !== undefined) afterCode = last.code;

    const updates: PathUpdate[] = [];

    for (const row of rows) {
      counters.scanned += 1;

      // `''` n'est pas un tracé : sans le test de longueur, une chaîne vide
      // serait traitée comme déjà calculée et ne serait **jamais** réparée.
      if (row.path_d !== null && row.path_d.length > 0 && !force) {
        counters.alreadySet += 1;
        continue;
      }

      if (row.geom === null) {
        counters.missingGeom += 1;
        continue;
      }

      const geometry = readGeometry(row.geom);
      const verdict = classifyGeometry(geometry, level);
      if (verdict === 'invalid') {
        counters.invalidGeom += 1;
        continue;
      }
      if (verdict === 'out_of_viewbox') {
        counters.outOfViewbox += 1;
        continue;
      }

      const pathD = geometryToPathD(geometry, level);
      if (pathD === null || pathD.length === 0) {
        // `classifyGeometry` a dit `ok` mais le rendu est vide : on le compte
        // comme invalide plutôt que d'écrire une chaîne vide.
        counters.invalidGeom += 1;
        continue;
      }

      counters.computed += 1;
      updates.push({ code: row.code, path_d: pathD });
    }

    for (const chunk of chunkArray(updates, WRITE_BATCH_SIZE)) {
      counters.written += await writeBatch(db, spec, chunk);
    }

    if (rows.length < remaining) break;
  }

  return counters;
}

function formatCounters(level: AtlasLevel, counters: AtlasCounters): string {
  return (
    `[atlas] ${ATLAS_TABLES[level].table} : ${formatCount(counters.scanned)} lues, ` +
    `${formatCount(counters.computed)} tracés, ` +
    `${formatCount(counters.outOfViewbox)} hors viewBox, ` +
    `${formatCount(counters.invalidGeom)} géométrie(s) invalide(s), ` +
    `${formatCount(counters.missingGeom)} sans géométrie, ` +
    `${formatCount(counters.alreadySet)} déjà tracés`
  );
}

/** Les trois niveaux dans l'ordre région → département → commune, puis un total. */
export async function runAtlas(
  db: Kysely<Database>,
  options: AtlasOptions = {},
): Promise<Record<AtlasLevel, AtlasCounters>> {
  const report: Record<AtlasLevel, AtlasCounters> = {
    REGION: emptyCounters(),
    DEPARTEMENT: emptyCounters(),
    COMMUNE: emptyCounters(),
  };

  const total = emptyCounters();

  for (const level of ATLAS_LEVELS) {
    const counters = await computeAtlasPaths(db, level, options);
    report[level] = counters;
    console.log(formatCounters(level, counters));

    total.scanned += counters.scanned;
    total.computed += counters.computed;
    total.alreadySet += counters.alreadySet;
    total.missingGeom += counters.missingGeom;
    total.invalidGeom += counters.invalidGeom;
    total.outOfViewbox += counters.outOfViewbox;
    total.written += counters.written;
  }

  console.log(
    `[atlas] total : ${formatCount(total.scanned)} lues, ` +
      `${formatCount(total.computed)} tracés, ` +
      `${formatCount(total.written)} écrites, ` +
      `${formatCount(total.outOfViewbox)} hors viewBox, ` +
      `${formatCount(total.invalidGeom)} invalides, ` +
      `${formatCount(total.missingGeom)} sans géométrie`,
  );

  return report;
}
