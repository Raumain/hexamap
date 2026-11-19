import { type Kysely, sql } from 'kysely';

/**
 * Le carnet de charges. Le solde se dérive de `last_regen_at`, il n'est jamais
 * incrémenté par une requête. Aucune borne haute dans le `CHECK` : le plafond
 * vit dans `game_config` (`SCRATCH_CHARGE_CAP`), pour qu'un réglage de jeu ne
 * demande pas une migration.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create table user_scratch_charges (
      user_id text primary key references "user" ("id") on delete cascade,
      charges smallint not null check (charges >= 0),
      last_regen_at timestamptz not null default now()
    )
  `.execute(db);

  await sql`
    insert into game_config (key, value) values
      ('SCRATCH_CHARGE_CAP', '6'::jsonb),
      ('SCRATCH_REGEN_MS', '1800000'::jsonb),
      ('SCRATCH_START_CHARGES', '6'::jsonb),
      ('FRIEND_REQUEST_DAILY_CAP', '20'::jsonb),
      ('FRIEND_REQUEST_REOPEN_MS', '604800000'::jsonb),
      ('ACHIEVEMENT_PAYOUTS_ENABLED', 'true'::jsonb)
    on conflict (key) do nothing
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`drop table user_scratch_charges`.execute(db);

  await sql`
    delete from game_config
    where (key = 'SCRATCH_CHARGE_CAP' and value = '6'::jsonb)
      or (key = 'SCRATCH_REGEN_MS' and value = '1800000'::jsonb)
      or (key = 'SCRATCH_START_CHARGES' and value = '6'::jsonb)
      or (key = 'FRIEND_REQUEST_DAILY_CAP' and value = '20'::jsonb)
      or (key = 'FRIEND_REQUEST_REOPEN_MS' and value = '604800000'::jsonb)
      or (key = 'ACHIEVEMENT_PAYOUTS_ENABLED' and value = 'true'::jsonb)
  `.execute(db);
}
