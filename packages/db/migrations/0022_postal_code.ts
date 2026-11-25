import { type Kysely, sql } from 'kysely';

/**
 * Code postal d'une commune — `ref_communes.code_postal`.
 *
 * **Ce que cette colonne est.** Le code postal **principal** d'une commune, un
 * seul, à cinq chiffres. `geo.api.gouv.fr` publie `codesPostaux` en tableau et
 * n'en désigne aucun comme principal : la règle du produit est le premier code à
 * cinq chiffres non vide de ce tableau, calculée à l'import par
 * `principalPostalCode` de `packages/shared`. Le tableau complet n'est **pas**
 * stocké ici : une commune porte une colonne, pas une liste.
 *
 * **Nullable, sans défaut.** Une commune dont la source ne publie aucun code
 * postal n'en a pas, et un code postal n'est pas une clé : plusieurs communes le
 * partagent, et une commune peut en changer. La colonne ne reçoit donc ni
 * `NOT NULL` ni `DEFAULT`, et l'ajout sur une table déjà peuplée laisse les
 * lignes existantes à `NULL` jusqu'au prochain import `--merge`.
 *
 * **Aucune donnée n'est écrite ici.** Une migration ne lit pas la source : la
 * valeur vient du pipeline d'import, y compris sur les lignes existantes.
 *
 * **Rejouable.** `add column if not exists` / `create index if not exists` /
 * `drop … if exists` : la table `kysely_migration` peut être supprimée et
 * l'ensemble rejoué sans erreur ni perte de données.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`alter table ref_communes add column if not exists code_postal text`.execute(db);
  await sql`create index if not exists ref_communes_code_postal_idx on ref_communes (code_postal)`.execute(
    db,
  );
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`drop index if exists ref_communes_code_postal_idx`.execute(db);
  await sql`alter table ref_communes drop column if exists code_postal`.execute(db);
}
