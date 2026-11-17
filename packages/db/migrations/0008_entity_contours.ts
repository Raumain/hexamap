import type { Kysely } from 'kysely';

/**
 * Forme de secours des régions et départements : silhouette agrégée de leurs
 * communes (IGN Admin Express), écrite sous `contours/{niveau}/{code}.svg`.
 * `ref_communes` avait déjà `contour_url` ; les deux niveaux supérieurs le
 * gagnent pour qu'aucune carte ne reste sans image.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('ref_regions').addColumn('contour_url', 'text').execute();
  await db.schema.alterTable('ref_departements').addColumn('contour_url', 'text').execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('ref_departements').dropColumn('contour_url').execute();
  await db.schema.alterTable('ref_regions').dropColumn('contour_url').execute();
}
