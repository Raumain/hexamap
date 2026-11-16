import { type Kysely, sql } from 'kysely';

/**
 * Marché V1 : une carte ne peut être vendue qu'une seule fois à la fois.
 * La contrainte `unique` globale sur `market_listings.user_card_id` empêchait
 * de remettre en vente une carte après annulation (ligne `CANCELLED` conservée).
 * On la remplace par un index unique partiel limité aux annonces `OPEN`.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`alter table market_listings drop constraint if exists market_listings_user_card_id_key`.execute(
    db,
  );
  await sql`create unique index if not exists market_listings_open_card_idx on market_listings (user_card_id) where status = 'OPEN'`.execute(
    db,
  );
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`drop index if exists market_listings_open_card_idx`.execute(db);
  await sql`create unique index if not exists market_listings_user_card_id_key on market_listings (user_card_id)`.execute(
    db,
  );
}
