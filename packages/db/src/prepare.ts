// Prépare la base de test avant les spécifications : joignable, puis migrée
// **une seule fois, sérialement**, avant que les workers parallèles de `bun test`
// ne s'en servent. Une table `kysely_migration` incohérente (liste qui n'est pas
// le préfixe de l'ordre du code) est reconstruite : la base de test est jetable
// par contrat, et une base laissée à moitié migrée par un ancien worktree rend
// toutes les spécifications rouges avec `corrupted migrations`.
import { sql } from 'kysely';
import { createDb } from './index';
import { migrationNames, runMigrations } from './migrator';

const connectionString = process.env.DATABASE_URL ?? '';

function fail(message: string): never {
  console.error(`[hexamap] ✗ ${message}`);
  process.exit(1);
}

if (process.env.NODE_ENV === 'production') {
  fail('Refus de préparer une base en production : ce script reconstruit le schéma public.');
}

if (!connectionString) {
  fail('DATABASE_URL absente : la préparation exige la base de test.');
}

const db = createDb(connectionString);

async function executedMigrationNames(): Promise<string[]> {
  const table = await sql<{ present: boolean }>`
    select to_regclass('kysely_migration') is not null as present
  `.execute(db);

  if (!table.rows[0]?.present) {
    return [];
  }

  // Kysely ordonne les lignes exécutées par horodatage (puis par nom en cas
  // d'égalité) : le contrôle doit lire le même ordre, pas l'ordre alphabétique.
  const rows = await sql<{ name: string }>`
    select name from kysely_migration order by timestamp, name
  `.execute(db);

  return rows.rows.map((row) => row.name);
}

try {
  await sql`select 1`.execute(db);
  console.log('[hexamap] Base de données joignable.');
} catch (error) {
  const reason = error instanceof Error ? error.message : String(error);
  await db.destroy();
  fail(`Base de données injoignable : ${reason}.`);
}

const executed = await executedMigrationNames();

const corrupted = executed.some((name, index) => migrationNames[index] !== name);

if (corrupted) {
  const awaited = migrationNames.slice(0, executed.length).join(', ');
  console.warn(
    [
      '[hexamap] ⚠ table de migrations incohérente :',
      `enregistré  = ${executed.join(', ') || '(vide)'}`,
      `attendu     = ${awaited || '(vide)'}`,
      'Le schéma public de la base de test est reconstruit, puis migré de zéro.',
    ].join('\n'),
  );

  await sql`drop schema if exists public cascade`.execute(db);
  await sql`create schema public`.execute(db);
}

await runMigrations(db);

const final = await executedMigrationNames();

if (final.join(',') !== migrationNames.join(',')) {
  await db.destroy();
  fail(
    `la base de test n'est pas dans l'ordre du code : ${final.join(', ') || '(vide)'} au lieu de ${migrationNames.join(', ')}.`,
  );
}

console.log(`[hexamap] Base de test prête : ${final.length} migrations, dans l'ordre.`);

await db.destroy();
