import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('user_achievements')
    .ifNotExists()
    .addColumn('user_id', 'text', (column) =>
      column.notNull().references('user.id').onDelete('cascade'),
    )
    .addColumn('achievement_key', 'text', (column) => column.notNull())
    .addColumn('unlocked_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addPrimaryKeyConstraint('user_achievements_pkey', ['user_id', 'achievement_key'])
    .execute();

  await db.schema
    .createIndex('user_achievements_key_idx')
    .ifNotExists()
    .on('user_achievements')
    .column('achievement_key')
    .execute();

  await sql`insert into game_config (key, value)
    values ('ACHIEVEMENT_PAYOUTS_ENABLED', 'true'::jsonb)
    on conflict (key) do nothing`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('user_achievements_key_idx').ifExists().execute();
  await db.schema.dropTable('user_achievements').ifExists().execute();
}
