import type { Kysely } from 'kysely';

/**
 * Blasons (Wikidata / Wikimedia Commons) et contours de repli (IGN Admin Express).
 * `ref_communes` gagne le blason, le contour et le crédit ; `ref_departements` et
 * `ref_regions` ont déjà `blason_url`, elles ne gagnent que le crédit.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('ref_communes')
    .addColumn('blason_url', 'text')
    .addColumn('contour_url', 'text')
    .addColumn('blason_credit', 'text')
    .execute();

  await db.schema.alterTable('ref_departements').addColumn('blason_credit', 'text').execute();

  await db.schema.alterTable('ref_regions').addColumn('blason_credit', 'text').execute();
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
