import { type Kysely, sql } from 'kysely';

/**
 * Le Guichet (`.docs/02-database.md` §4.10).
 *
 * `kind` reste `text` : la liste fermée vit dans
 * `packages/shared/src/notifications.ts`, pas dans un `CHECK`, pour que la
 * phase 40 émette `TRADE_*` sans migration.
 *
 * `dedupe_key` porte l'idempotence par l'index unique `(user_id, dedupe_key)` :
 * l'émission écrit `on conflict do nothing`, donc un rejeu ne duplique pas la
 * ligne. `notifications_user_idx` est partiel sur `read_at is null` : la salle
 * ne liste que les non-lues récentes, la purge à 90 jours aussi.
 *
 * Rejouable : `if not exists` partout.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create table if not exists notifications (
      id uuid primary key default gen_random_uuid(),
      user_id text not null references "user" ("id") on delete cascade,
      kind text not null,
      dedupe_key text not null,
      payload jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      read_at timestamptz
    )
  `.execute(db);

  await sql`create unique index if not exists notifications_user_dedupe_idx
    on notifications (user_id, dedupe_key)`.execute(db);

  await sql`create index if not exists notifications_user_idx
    on notifications (user_id, created_at desc) where read_at is null`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`drop table if exists notifications`.execute(db);
}
