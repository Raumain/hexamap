import { type Kysely, sql } from 'kysely';

/**
 * Relations sociales : une seule ligne par paire non ordonnée, et le blocage
 * unilatéral qui la supprime. Contrat : `.docs/02-database.md` §4.9.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('friendships')
    .ifNotExists()
    .addColumn('requester_id', 'text', (column) =>
      column.notNull().references('user.id').onDelete('cascade'),
    )
    .addColumn('addressee_id', 'text', (column) =>
      column.notNull().references('user.id').onDelete('cascade'),
    )
    .addColumn('status', 'text', (column) => column.notNull().defaultTo('PENDING'))
    .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addColumn('responded_at', 'timestamptz')
    .addPrimaryKeyConstraint('friendships_pkey', ['requester_id', 'addressee_id'])
    .addCheckConstraint(
      'friendships_status_check',
      sql`status in ('PENDING', 'ACCEPTED', 'DECLINED')`,
    )
    .addCheckConstraint('friendships_self_check', sql`requester_id <> addressee_id`)
    .execute();

  await db.schema
    .createIndex('friendships_pair_idx')
    .ifNotExists()
    .on('friendships')
    .expression(sql`least(requester_id, addressee_id)`)
    .expression(sql`greatest(requester_id, addressee_id)`)
    .unique()
    .execute();
  await db.schema
    .createIndex('friendships_addressee_idx')
    .ifNotExists()
    .on('friendships')
    .columns(['addressee_id', 'status'])
    .execute();

  await db.schema
    .createTable('blocks')
    .ifNotExists()
    .addColumn('blocker_id', 'text', (column) =>
      column.notNull().references('user.id').onDelete('cascade'),
    )
    .addColumn('blocked_id', 'text', (column) =>
      column.notNull().references('user.id').onDelete('cascade'),
    )
    .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addPrimaryKeyConstraint('blocks_pkey', ['blocker_id', 'blocked_id'])
    .addCheckConstraint('blocks_self_check', sql`blocker_id <> blocked_id`)
    .execute();

  await db.schema
    .createIndex('blocks_blocked_idx')
    .ifNotExists()
    .on('blocks')
    .columns(['blocked_id'])
    .execute();

  await sql`insert into game_config (key, value) values
    ('FRIEND_REQUEST_DAILY_CAP', '20'::jsonb),
    ('FRIEND_REQUEST_REOPEN_MS', '604800000'::jsonb)
    on conflict (key) do nothing`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('blocks').ifExists().execute();
  await db.schema.dropTable('friendships').ifExists().execute();
}
