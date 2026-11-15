import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('user_cards')
    .ifNotExists()
    .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('user_id', 'text', (column) =>
      column.notNull().references('user.id').onDelete('cascade'),
    )
    .addColumn('category', 'text', (column) =>
      column.notNull().check(sql`category in ('REGION', 'DEPARTEMENT', 'COMMUNE', 'RUE')`),
    )
    .addColumn('ref_code', 'text', (column) => column.notNull())
    .addColumn('rarity', 'text', (column) =>
      column
        .notNull()
        .check(
          sql`rarity in ('COMMUNE', 'INHABITUELLE', 'RARE', 'EPIQUE', 'LEGENDAIRE', 'MYTHIQUE')`,
        ),
    )
    .addColumn('score', 'integer', (column) => column.notNull().check(sql`score >= 0`))
    .addColumn('acquired_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addColumn('source', 'text', (column) =>
      column.notNull().defaultTo('TICKET').check(sql`source in ('TICKET', 'MARKET', 'REWARD')`),
    )
    .addColumn('locked', 'boolean', (column) => column.notNull().defaultTo(false))
    .execute();

  await db.schema
    .createTable('tickets')
    .ifNotExists()
    .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('user_id', 'text', (column) =>
      column.notNull().references('user.id').onDelete('cascade'),
    )
    .addColumn('status', 'text', (column) =>
      column.notNull().defaultTo('ACTIVE').check(sql`status in ('ACTIVE', 'EXHAUSTED', 'EXPIRED')`),
    )
    .addColumn('grid', 'jsonb', (column) => column.notNull())
    .addColumn('treasure_index', 'smallint', (column) =>
      column.notNull().check(sql`treasure_index between 0 and 15`),
    )
    .addColumn('scrapes_remaining', 'smallint', (column) =>
      column.notNull().defaultTo(4).check(sql`scrapes_remaining >= 0`),
    )
    .addColumn('renovation_pending', 'boolean', (column) => column.notNull().defaultTo(false))
    .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addColumn('expires_at', 'timestamptz')
    .execute();

  await db.schema
    .createTable('ticket_reveals')
    .ifNotExists()
    .addColumn('ticket_id', 'uuid', (column) =>
      column.notNull().references('tickets.id').onDelete('cascade'),
    )
    .addColumn('cell_index', 'smallint', (column) =>
      column.notNull().check(sql`cell_index between 0 and 15`),
    )
    .addColumn('card_user_id', 'uuid', (column) =>
      column.references('user_cards.id').onDelete('set null'),
    )
    .addColumn('distance', 'smallint', (column) =>
      column.notNull().check(sql`distance between 0 and 6`),
    )
    .addColumn('revealed_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addPrimaryKeyConstraint('ticket_reveals_pkey', ['ticket_id', 'cell_index'])
    .execute();

  await db.schema
    .createTable('tableaux')
    .ifNotExists()
    .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('user_id', 'text', (column) =>
      column.notNull().references('user.id').onDelete('cascade'),
    )
    .addColumn('name', 'text', (column) => column.notNull().defaultTo('Mon tableau'))
    .addColumn('region_card_id', 'uuid', (column) =>
      column.references('user_cards.id').onDelete('set null'),
    )
    .addColumn('departement_card_id', 'uuid', (column) =>
      column.references('user_cards.id').onDelete('set null'),
    )
    .addColumn('commune_card_id', 'uuid', (column) =>
      column.references('user_cards.id').onDelete('set null'),
    )
    .addColumn('rue_card_id', 'uuid', (column) =>
      column.references('user_cards.id').onDelete('set null'),
    )
    .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createTable('market_listings')
    .ifNotExists()
    .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('seller_id', 'text', (column) =>
      column.notNull().references('user.id').onDelete('cascade'),
    )
    .addColumn('user_card_id', 'uuid', (column) =>
      column.notNull().unique().references('user_cards.id').onDelete('cascade'),
    )
    .addColumn('price', 'integer', (column) => column.notNull().check(sql`price > 0`))
    .addColumn('status', 'text', (column) =>
      column.notNull().defaultTo('OPEN').check(sql`status in ('OPEN', 'SOLD', 'CANCELLED')`),
    )
    .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addColumn('sold_at', 'timestamptz')
    .addColumn('buyer_id', 'text', (column) => column.references('user.id').onDelete('set null'))
    .execute();

  await db.schema
    .createTable('currency_ledger')
    .ifNotExists()
    .addColumn('id', 'bigserial', (column) => column.primaryKey())
    .addColumn('user_id', 'text', (column) =>
      column.notNull().references('user.id').onDelete('cascade'),
    )
    .addColumn('delta', 'integer', (column) => column.notNull())
    .addColumn('reason', 'text', (column) => column.notNull())
    .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createIndex('user_cards_owner_idx')
    .ifNotExists()
    .on('user_cards')
    .columns(['user_id', 'category'])
    .execute();

  await db.schema
    .createIndex('user_cards_ref_idx')
    .ifNotExists()
    .on('user_cards')
    .columns(['category', 'ref_code'])
    .execute();

  await sql`create unique index if not exists tickets_one_active_per_user on tickets (user_id) where status = 'ACTIVE'`.execute(
    db,
  );

  await db.schema
    .createIndex('tickets_user_idx')
    .ifNotExists()
    .on('tickets')
    .columns(['user_id', sql`created_at desc`])
    .execute();

  await db.schema
    .createIndex('tableaux_user_idx')
    .ifNotExists()
    .on('tableaux')
    .column('user_id')
    .execute();

  await db.schema
    .createIndex('market_listings_status_idx')
    .ifNotExists()
    .on('market_listings')
    .columns(['status', sql`created_at desc`])
    .execute();

  await db.schema
    .createIndex('currency_ledger_user_idx')
    .ifNotExists()
    .on('currency_ledger')
    .columns(['user_id', sql`created_at desc`])
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('currency_ledger').ifExists().execute();
  await db.schema.dropTable('market_listings').ifExists().execute();
  await db.schema.dropTable('tableaux').ifExists().execute();
  await db.schema.dropTable('ticket_reveals').ifExists().execute();
  await db.schema.dropTable('tickets').ifExists().execute();
  await db.schema.dropTable('user_cards').ifExists().execute();
}
