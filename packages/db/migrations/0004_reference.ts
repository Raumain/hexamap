import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('ref_regions')
    .ifNotExists()
    .addColumn('code', 'text', (column) => column.primaryKey())
    .addColumn('nom', 'text', (column) => column.notNull())
    .addColumn('geom', 'jsonb')
    .addColumn('blason_url', 'text')
    .execute();

  await db.schema
    .createTable('ref_departements')
    .ifNotExists()
    .addColumn('code', 'text', (column) => column.primaryKey())
    .addColumn('nom', 'text', (column) => column.notNull())
    .addColumn('code_region', 'text', (column) => column.notNull().references('ref_regions.code'))
    .addColumn('population', 'integer', (column) => column.notNull().defaultTo(0))
    .addColumn('geom', 'jsonb')
    .addColumn('blason_url', 'text')
    .execute();

  await db.schema
    .createTable('ref_communes')
    .ifNotExists()
    .addColumn('code_insee', 'text', (column) => column.primaryKey())
    .addColumn('nom', 'text', (column) => column.notNull())
    .addColumn('code_departement', 'text', (column) =>
      column.notNull().references('ref_departements.code'),
    )
    .addColumn('code_region', 'text', (column) => column.notNull().references('ref_regions.code'))
    .addColumn('population', 'integer', (column) => column.notNull().check(sql`population >= 0`))
    .addColumn('latitude', 'double precision')
    .addColumn('longitude', 'double precision')
    .addColumn('rarete', 'text', (column) =>
      column
        .notNull()
        .check(
          sql`rarete in ('COMMUNE', 'INHABITUELLE', 'RARE', 'EPIQUE', 'LEGENDAIRE', 'MYTHIQUE')`,
        ),
    )
    .addColumn('score_base', 'integer', (column) => column.notNull().check(sql`score_base >= 0`))
    .addColumn('draw_bucket', 'smallint', (column) => column.notNull().defaultTo(0))
    .addColumn('geom', 'jsonb')
    .execute();

  await db.schema
    .createTable('ref_odonymes')
    .ifNotExists()
    .addColumn('id', 'bigserial', (column) => column.primaryKey())
    .addColumn('nom_normalise', 'text', (column) => column.notNull().unique())
    .addColumn('nom_affichage', 'text', (column) => column.notNull())
    .addColumn('nb_communes', 'integer', (column) => column.notNull().check(sql`nb_communes >= 1`))
    .addColumn('rarete', 'text', (column) =>
      column
        .notNull()
        .check(
          sql`rarete in ('COMMUNE', 'INHABITUELLE', 'RARE', 'EPIQUE', 'LEGENDAIRE', 'MYTHIQUE')`,
        ),
    )
    .addColumn('score_base', 'integer', (column) => column.notNull().check(sql`score_base >= 0`))
    .addColumn('draw_bucket', 'smallint', (column) => column.notNull().defaultTo(0))
    .execute();

  await db.schema
    .createTable('commune_odonymes')
    .ifNotExists()
    .addColumn('code_insee', 'text', (column) =>
      column.notNull().references('ref_communes.code_insee').onDelete('cascade'),
    )
    .addColumn('odonyme_id', 'bigint', (column) =>
      column.notNull().references('ref_odonymes.id').onDelete('cascade'),
    )
    .addPrimaryKeyConstraint('commune_odonymes_pkey', ['code_insee', 'odonyme_id'])
    .execute();

  await db.schema
    .createIndex('ref_departements_region_idx')
    .ifNotExists()
    .on('ref_departements')
    .column('code_region')
    .execute();

  await db.schema
    .createIndex('ref_communes_rarete_bucket_idx')
    .ifNotExists()
    .on('ref_communes')
    .columns(['rarete', 'draw_bucket'])
    .execute();

  await db.schema
    .createIndex('ref_communes_departement_idx')
    .ifNotExists()
    .on('ref_communes')
    .column('code_departement')
    .execute();

  await db.schema
    .createIndex('ref_odonymes_rarete_bucket_idx')
    .ifNotExists()
    .on('ref_odonymes')
    .columns(['rarete', 'draw_bucket'])
    .execute();

  await db.schema
    .createIndex('commune_odonymes_odonyme_idx')
    .ifNotExists()
    .on('commune_odonymes')
    .column('odonyme_id')
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('commune_odonymes').ifExists().execute();
  await db.schema.dropTable('ref_odonymes').ifExists().execute();
  await db.schema.dropTable('ref_communes').ifExists().execute();
  await db.schema.dropTable('ref_departements').ifExists().execute();
  await db.schema.dropTable('ref_regions').ifExists().execute();
}
