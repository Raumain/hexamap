import type { Kysely } from 'kysely';
import { type Migration, type MigrationProvider, Migrator } from 'kysely/migration';
import * as init from '../migrations/0001_init';
import * as auth from '../migrations/0002_auth';
import * as game from '../migrations/0003_game';
import * as reference from '../migrations/0004_reference';
import type { Database } from './index';

class StaticMigrationProvider implements MigrationProvider {
  async getMigrations(): Promise<Record<string, Migration>> {
    return {
      '0001_init': init,
      '0002_auth': auth,
      '0003_game': game,
      '0004_reference': reference,
    };
  }
}

export async function runMigrations(db: Kysely<Database>): Promise<void> {
  const migrator = new Migrator({
    db,
    provider: new StaticMigrationProvider(),
  });

  const { error, results } = await migrator.migrateToLatest();

  for (const result of results ?? []) {
    if (result.status === 'Success') {
      console.log(`[db] migration ${result.migrationName} appliquée`);
    }

    if (result.status === 'Error') {
      console.error(`[db] migration ${result.migrationName} en échec`);
    }
  }

  if (error) {
    throw error;
  }
}
