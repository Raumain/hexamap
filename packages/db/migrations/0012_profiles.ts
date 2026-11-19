import { type Kysely, sql } from 'kysely';

/**
 * Vitrine publique (`.docs/02-database.md` §4.9).
 *
 * `user_profiles` isole la biographie et la confidentialité de la table
 * d'authentification : `"user"` appartient au CLI Better Auth et ne reçoit
 * jamais de colonne écrite à la main.
 *
 * L'unicité du pseudo, elle, porte sur `"user".pseudo` et s'ajoute donc par
 * migration sous forme d'index : un index supplémentaire ne contredit pas la
 * génération du schéma par Better Auth, une colonne ajoutée à la main si.
 * L'index est partiel (`where pseudo is not null`) et insensible à la casse,
 * parce que le pseudo sert d'identité publique dans l'URL `/players/:id`.
 *
 * Un index unique échoue si la base contient déjà deux pseudos identiques à la
 * casse près. L'API migre au démarrage : cet échec deviendrait une boucle de
 * redémarrage. Les doublons sont donc repris **avant** la création de l'index,
 * de façon déterministe — le compte le plus ancien (`"createdAt"`, puis `id` en
 * départage) garde son pseudo, les suivants reçoivent un suffixe `-<rang>`.
 * La troncature à 18 caractères garde le résultat sous 24 caractères, la borne
 * de forme d'un pseudo.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('user_profiles')
    .addColumn('user_id', 'text', (col) =>
      col.primaryKey().references('user.id').onDelete('cascade'),
    )
    .addColumn('bio', 'text')
    .addColumn('profile_public', 'boolean', (col) => col.notNull().defaultTo(true))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await sql`
    with doublons as (
      select id, pseudo,
             row_number() over (partition by lower(pseudo) order by "createdAt", id) as rang
      from "user" where pseudo is not null
    )
    update "user" cible
       set pseudo = left(doublons.pseudo, 18) || '-' || doublons.rang
      from doublons
     where cible.id = doublons.id and doublons.rang > 1
  `.execute(db);

  await sql`create unique index if not exists user_pseudo_lower_idx
    on "user" (lower(pseudo)) where pseudo is not null`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`drop index if exists user_pseudo_lower_idx`.execute(db);
  await db.schema.dropTable('user_profiles').ifExists().execute();
}
