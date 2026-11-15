import type { Database } from '@hexamap/db';
import { createDb } from '@hexamap/db';
import { type Kysely, sql } from 'kysely';

/** Taille des lots d'insertion (2 000 lignes, largement sous la limite de variables PG). */
export const INSERT_CHUNK_SIZE = 2_000;

export function connectDatabase(): Kysely<Database> {
  const url = process.env.DATABASE_URL;
  if (url === undefined || url.trim().length === 0) {
    throw new Error('DATABASE_URL manquant : impossible de se connecter à PostgreSQL');
  }
  return createDb(url);
}

/** Rend le pipeline rejouable : repart d'un référentiel vide. */
export async function truncateReferenceTables(db: Kysely<Database>): Promise<void> {
  await sql`
    truncate table commune_odonymes, ref_odonymes, ref_communes, ref_departements, ref_regions
    restart identity cascade
  `.execute(db);
}

/** Réinitialise uniquement les odonymes (utile pour rejouer l'étape BAN sans l'API Gouv). */
export async function truncateOdonymeTables(db: Kysely<Database>): Promise<void> {
  await sql`truncate table commune_odonymes, ref_odonymes restart identity cascade`.execute(db);
}

export async function readCommuneCodes(db: Kysely<Database>): Promise<Set<string>> {
  const rows = await db.selectFrom('ref_communes').select('code_insee').execute();
  return new Set(rows.map((row) => row.code_insee));
}

export async function readDepartementCodes(
  db: Kysely<Database>,
  regionCodes: readonly string[] | null,
): Promise<string[]> {
  let query = db.selectFrom('ref_communes').select('code_departement').distinct();
  if (regionCodes !== null) {
    query = query.where('code_region', 'in', [...regionCodes]);
  }

  const rows = await query.execute();
  return [...new Set(rows.map((row) => row.code_departement))].sort();
}

async function countRows(
  db: Kysely<Database>,
  table: 'ref_communes' | 'ref_odonymes',
): Promise<number> {
  const row = await db
    .selectFrom(table)
    .select((expression) => expression.fn.countAll<string>().as('count'))
    .executeTakeFirst();

  return row === undefined ? 0 : Number(row.count);
}

export interface ReferenceDataCounts {
  communes: number;
  odonymes: number;
}

export async function referenceDataCounts(db: Kysely<Database>): Promise<ReferenceDataCounts> {
  return {
    communes: await countRows(db, 'ref_communes'),
    odonymes: await countRows(db, 'ref_odonymes'),
  };
}
