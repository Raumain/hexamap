import { createDb } from './index';
import { runMigrations } from './migrator';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('[db] DATABASE_URL manquant');
  process.exit(1);
}

const db = createDb(databaseUrl);

try {
  await runMigrations(db);
} finally {
  await db.destroy();
}
