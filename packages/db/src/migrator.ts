import type { Kysely } from 'kysely';
import { type Migration, type MigrationProvider, Migrator } from 'kysely/migration';
import * as init from '../migrations/0001_init';
import * as auth from '../migrations/0002_auth';
import * as game from '../migrations/0003_game';
import * as reference from '../migrations/0004_reference';
import * as rateLimit from '../migrations/0005_rate_limit';
import * as marketRelist from '../migrations/0006_market_relist';
import * as blasons from '../migrations/0007_blasons';
import * as entityContours from '../migrations/0008_entity_contours';
import * as scratchCharges from '../migrations/0009_scratch_charges';
import * as friendships from '../migrations/0010_friendships';
import * as achievements from '../migrations/0011_achievements';
import * as profiles from '../migrations/0012_profiles';
import * as shop from '../migrations/0013_shop';
import * as refIntegrity from '../migrations/0014_ref_integrity';
import * as atlasPaths from '../migrations/0015_atlas_paths';
import type { Database } from './index';

class StaticMigrationProvider implements MigrationProvider {
  async getMigrations(): Promise<Record<string, Migration>> {
    return {
      '0001_init': init,
      '0002_auth': auth,
      '0003_game': game,
      '0004_reference': reference,
      '0005_rate_limit': rateLimit,
      '0006_market_relist': marketRelist,
      '0007_blasons': blasons,
      '0008_entity_contours': entityContours,
      '0009_scratch_charges': scratchCharges,
      '0010_friendships': friendships,
      '0011_achievements': achievements,
      '0012_profiles': profiles,
      '0013_shop': shop,
      '0014_ref_integrity': refIntegrity,
      '0015_atlas_paths': atlasPaths,
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
