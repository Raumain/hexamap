import { type Kysely, sql } from 'kysely';

/**
 * L'Atelier — `user_cards.source` accepte la valeur `CRAFT`.
 *
 * La contrainte de `0003_game` est anonyme : PostgreSQL l'a nommée
 * `user_cards_source_check`. `0003` est immuable, donc `0018` la remplace.
 *
 * Rejouable : `drop … if exists` puis `add constraint`. Rejouer la migration
 * après une suppression de `kysely_migration` réapplique le même état.
 * Aucune donnée n'est écrite par cette migration.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`alter table user_cards drop constraint if exists user_cards_source_check`.execute(db);

  await sql`
    alter table user_cards
    add constraint user_cards_source_check
    check (source in ('TICKET', 'MARKET', 'REWARD', 'CRAFT'))
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`alter table user_cards drop constraint if exists user_cards_source_check`.execute(db);

  await sql`
    alter table user_cards
    add constraint user_cards_source_check
    check (source in ('TICKET', 'MARKET', 'REWARD'))
  `.execute(db);
}
