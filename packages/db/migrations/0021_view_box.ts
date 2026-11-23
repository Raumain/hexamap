import { type Kysely, sql } from 'kysely';

/**
 * Cadres d'atlas — `view_box` sur les trois tables de référentiel.
 *
 * **Ce que cette colonne est.** `view_box` est le `viewBox` SVG de l'entité, tel
 * qu'il s'écrit dans l'attribut. Il porte le cadre du **groupe** auquel l'entité
 * appartient — un DROM : la région, son département et ses communes partagent la
 * même valeur, calculée sur la bbox de l'ensemble. C'est ce cadre de groupe qui
 * fait qu'une commune d'outre-mer s'assemble avec ses voisines, alors que sa
 * projection reste la projection globale métropolitaine (le `path_d` est dans le
 * même repère, seul le `viewBox` choisit la fenêtre).
 *
 * **La métropole est le défaut.** `'0 0 1000 1000'` est la valeur par défaut de
 * la colonne : les ~35 000 lignes métropolitaines sont remplies par le `DEFAULT`
 * et ne sont **jamais** réécrites.
 *
 * **Aucune donnée n'est écrite ici.** Une migration ne lit pas `geom` et ne
 * reprojette rien : le cadre d'outre-mer est calculé une seule fois par le script
 * `scripts/import/src/atlas-overseas.ts`, comme `path_d` par `atlas.ts`.
 *
 * **Rejouable.** `add column if not exists` / `drop column if exists` : la table
 * `kysely_migration` peut être supprimée et l'ensemble rejoué sans erreur.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`alter table ref_regions add column if not exists view_box text not null default '0 0 1000 1000'`.execute(
    db,
  );
  await sql`alter table ref_departements add column if not exists view_box text not null default '0 0 1000 1000'`.execute(
    db,
  );
  await sql`alter table ref_communes add column if not exists view_box text not null default '0 0 1000 1000'`.execute(
    db,
  );
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`alter table ref_communes drop column if exists view_box`.execute(db);
  await sql`alter table ref_departements drop column if exists view_box`.execute(db);
  await sql`alter table ref_regions drop column if exists view_box`.execute(db);
}
