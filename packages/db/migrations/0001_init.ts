import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('game_config')
    .ifNotExists()
    .addColumn('key', 'text', (column) => column.primaryKey())
    .addColumn('value', 'jsonb', (column) => column.notNull())
    .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('game_config').ifExists().execute();
}
