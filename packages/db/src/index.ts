import { Kysely, type KyselyConfig } from 'kysely';
import { PostgresJSDialect } from 'kysely-postgres-js';
import postgres from 'postgres';
import type { Database } from './schema';

export { sql } from 'kysely';
export { runMigrations } from './migrator';
export * from './reference-integrity';
export * from './schema';

/**
 * Crée le client Kysely. `options.log` est **optionnel** et purement additif :
 * il existe pour qu'un test d'intégration puisse compter les instructions
 * émises par un service, aucune route ne le renseigne.
 */
export function createDb(
  connectionString: string,
  options?: { log?: KyselyConfig['log'] },
): Kysely<Database> {
  const sql = postgres(connectionString, { max: 10 });

  return new Kysely<Database>({
    dialect: new PostgresJSDialect({ postgres: sql }),
    ...(options?.log ? { log: options.log } : {}),
  });
}
