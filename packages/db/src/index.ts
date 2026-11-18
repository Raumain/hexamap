import { Kysely } from 'kysely';
import { PostgresJSDialect } from 'kysely-postgres-js';
import postgres from 'postgres';
import type { Database } from './schema';

export { sql } from 'kysely';
export { runMigrations } from './migrator';
export * from './schema';

export function createDb(connectionString: string): Kysely<Database> {
  const sql = postgres(connectionString, { max: 10 });

  return new Kysely<Database>({
    dialect: new PostgresJSDialect({ postgres: sql }),
  });
}
