import { type Kysely, sql } from 'kysely';

/**
 * Blasons (Wikidata / Wikimedia Commons) et contours de repli (IGN Admin Express).
 * `ref_communes` gagne le blason, le contour et le crédit ; `ref_departements` et
 * `ref_regions` ont déjà `blason_url`, elles ne gagnent que le crédit.
 *
 * `alterTable().addColumn()` n'expose pas `ifNotExists()` dans Kysely 0.29 : les
 * colonnes sont ajoutées en SQL pour que la migration reste rejouable sur une base
 * qui les porte déjà (table `kysely_migration` supprimée puis rejouée).
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    alter table ref_communes
      add column if not exists blason_url text,
      add column if not exists contour_url text,
      add column if not exists blason_credit text
  `.execute(db);

  await sql`alter table ref_departements add column if not exists blason_credit text`.execute(db);

  await sql`alter table ref_regions add column if not exists blason_credit text`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('ref_regions').dropColumn('blason_credit').execute();
  await db.schema.alterTable('ref_departements').dropColumn('blason_credit').execute();

  await db.schema
    .alterTable('ref_communes')
    .dropColumn('blason_credit')
    .dropColumn('contour_url')
    .dropColumn('blason_url')
    .execute();
}
