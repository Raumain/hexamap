import { type Kysely, sql } from 'kysely';

/**
 * Forme de secours des régions et départements : silhouette agrégée de leurs
 * communes (IGN Admin Express), écrite sous `contours/{niveau}/{code}.svg`.
 * `ref_communes` avait déjà `contour_url` ; les deux niveaux supérieurs le
 * gagnent pour qu'aucune carte ne reste sans image.
 *
 * Les colonnes sont ajoutées en SQL (`if not exists`) : la migration doit
 * pouvoir être rejouée sur une base qui les porte déjà.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`alter table ref_regions add column if not exists contour_url text`.execute(db);
  await sql`alter table ref_departements add column if not exists contour_url text`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('ref_departements').dropColumn('contour_url').execute();
  await db.schema.alterTable('ref_regions').dropColumn('contour_url').execute();
}
