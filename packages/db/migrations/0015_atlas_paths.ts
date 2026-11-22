import { type Kysely, sql } from 'kysely';

/**
 * Tracés d'atlas — `path_d` sur les trois tables de référentiel.
 *
 * **Ce que cette colonne est, et ce qu'elle n'est pas.** `path_d` est le tracé SVG
 * d'une région, d'un département ou d'une commune, **dérivé de `geom`** et projeté
 * une seule fois par le pipeline d'import dans le `viewBox` partagé
 * `0 0 1000 1000` (Mercator sphérique EPSG:3857, emprise métropolitaine — le
 * contrat exact vit dans `.docs/02-database.md` §5). Elle existe pour que le
 * navigateur n'ait plus jamais à projeter ni à simplifier une géométrie : la
 * promesse de la carte à trois niveaux tient dans cette seule colonne.
 *
 * **Pourquoi aucun index, aucun `CHECK`, aucun `NOT NULL`.** La colonne ne se
 * filtre pas : elle se lit par clé primaire, avec le nom et les assets de la même
 * ligne, et aucun écran ne cherche « les entités dont le tracé contient … ». Un
 * index ne servirait aucune requête et coûterait à chaque réimport. Pas de
 * `CHECK` non plus : la forme du tracé appartient au module de projection, qui a
 * ses propres tests, et une contrainte SQL figerait une décision de rendu dans le
 * schéma. Enfin `NULL` est une valeur **légitime**, pas un défaut à corriger : la
 * géométrie peut manquer, être invalide, ou sortir du cadre métropolitain —
 * l'outre-mer est exactement ce dernier cas.
 *
 * **Rejouable.** `add column if not exists` / `drop column if exists` : la table
 * `kysely_migration` peut être supprimée et l'ensemble rejoué sans erreur.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`alter table ref_regions add column if not exists path_d text`.execute(db);
  await sql`alter table ref_departements add column if not exists path_d text`.execute(db);
  await sql`alter table ref_communes add column if not exists path_d text`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`alter table ref_communes drop column if exists path_d`.execute(db);
  await sql`alter table ref_departements drop column if exists path_d`.execute(db);
  await sql`alter table ref_regions drop column if exists path_d`.execute(db);
}
