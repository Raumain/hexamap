import { type Kysely, sql } from 'kysely';

/**
 * Le troc — une offre échange une carte contre une carte.
 *
 * Rejouable : `create table if not exists`, `create index if not exists`.
 * Aucune donnée n'est écrite par cette migration.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create table if not exists trade_offers (
      id uuid primary key default gen_random_uuid(),
      proposer_id text not null references "user" ("id") on delete cascade,
      receiver_id text not null references "user" ("id") on delete cascade,
      offered_card_id uuid not null references user_cards (id) on delete cascade,
      requested_card_id uuid not null references user_cards (id) on delete cascade,
      status text not null default 'PENDING'
        check (status in ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED', 'EXPIRED')),
      created_at timestamptz not null default now(),
      responded_at timestamptz,
      expires_at timestamptz not null,
      check (proposer_id <> receiver_id),
      check (offered_card_id <> requested_card_id)
    )
  `.execute(db);

  await sql`create index if not exists trade_offers_receiver_idx
    on trade_offers (receiver_id, status, created_at desc)`.execute(db);

  await sql`create index if not exists trade_offers_proposer_idx
    on trade_offers (proposer_id, status, created_at desc)`.execute(db);

  // Une carte engagée ne se repropose pas, et ne se revend pas.
  await sql`create unique index if not exists trade_offers_offered_pending_idx
    on trade_offers (offered_card_id) where status = 'PENDING'`.execute(db);

  // Une carte demandée n'est l'objet que d'une seule offre ouverte : c'est cette
  // unicité qui rend l'acceptation décidable.
  await sql`create unique index if not exists trade_offers_requested_pending_idx
    on trade_offers (requested_card_id) where status = 'PENDING'`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`drop table if exists trade_offers`.execute(db);
}
