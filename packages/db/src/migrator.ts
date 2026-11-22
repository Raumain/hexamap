import { type Kysely, sql } from 'kysely';
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
import type { Database } from './index';

/**
 * Source unique de la liste des migrations. Elle est aussi exportée
 * (`migrationNames`) pour que `prepare.ts` puisse vérifier l'intégrité de
 * `kysely_migration` avant que les workers parallèles ne s'en servent.
 */
const migrations: Record<string, Migration> = {
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
};

/** Les noms dans l'ordre alphabétique, c'est-à-dire l'ordre d'exécution attendu. */
export const migrationNames: readonly string[] = Object.keys(migrations).sort((a, b) =>
  a.localeCompare(b),
);

/**
 * Verrou consultatif PostgreSQL, stable entre processus et entre machines.
 * Il tient sur **une seule connexion** : `pg_advisory_lock` est un verrou de
 * session, donc l'acquérir sur une connexion du pool et le relâcher sur une autre
 * le laisserait fui. `db.connection()` épingle la session pour toute la durée.
 */
const MIGRATION_LOCK_KEY = 2_147_483_000;

class StaticMigrationProvider implements MigrationProvider {
  async getMigrations(): Promise<Record<string, Migration>> {
    return migrations;
  }
}

/**
 * Applique les migrations manquantes, **un seul processus à la fois par base**.
 *
 * `bun test` exécute les fichiers de spécification en parallèle, et douze d'entre
 * eux appellent `runMigrations` sur la même base : sans sérialisation, deux
 * migrateurs lisent le même état « rien n'est appliqué », puis écrivent chacun leur
 * tour dans `kysely_migration` — la liste enregistrée ne correspond plus à l'ordre
 * du code et Kysely refuse ensuite de démarrer (`corrupted migrations`). Le verrou
 * consultatif est pris **avant** la lecture de l'état, donc il n'y a plus de
 * lecture-écriture entrelacée.
 */
export async function runMigrations(db: Kysely<Database>): Promise<void> {
  await db.connection().execute(async (connection) => {
    await sql`select pg_advisory_lock(${MIGRATION_LOCK_KEY})`.execute(connection);

    try {
      const migrator = new Migrator({
        db: connection,
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
    } finally {
      await sql`select pg_advisory_unlock(${MIGRATION_LOCK_KEY})`.execute(connection);
    }
  });
}
