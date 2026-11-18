// Sonde de disponibilité de la base : ouvre une connexion, exécute `select 1`
// puis referme le pool. Sortie 0 si la base répond, 1 sinon.
import { sql } from 'kysely';
import { createDb } from './index';

const connectionString = process.env.DATABASE_URL ?? '';
const db = createDb(connectionString);

try {
  await sql`select 1`.execute(db);
  console.log('[hexamap] Base de données joignable.');
  await db.destroy();
  process.exit(0);
} catch (error) {
  const reason = error instanceof Error ? error.message : String(error);
  const state = connectionString ? 'définie' : 'absente';
  console.error(
    `[hexamap] ✗ Base de données injoignable : ${reason}. Vérifier DATABASE_URL (${state}).`,
  );
  await db.destroy();
  process.exit(1);
}
