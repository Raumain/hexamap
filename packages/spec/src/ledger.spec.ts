import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { app } from '@hexamap/api/app';
import { createDb, runMigrations, sql } from '@hexamap/db';

/**
 * `currency_ledger` — idempotence d'un achat et plafond quotidien
 * (`.docs/02-database.md` §4.6, §4.1).
 *
 * L'unicité d'un webhook ne peut pas être une vérification avant insertion :
 * deux livraisons simultanées du même événement lisent toutes deux « absent »
 * puis insèrent toutes deux. Elle est donc portée par la base, sur un index
 * partiel qui ne couvre que les motifs `PURCHASE:%`.
 */

const db = createDb(process.env.DATABASE_URL ?? '');
const baseUrl = 'http://localhost:3000';
const origin = 'http://localhost:5174';
const prefix = crypto.randomUUID().slice(0, 8);
const createdUserIds: string[] = [];

async function signUp(): Promise<string> {
  const res = await app.handle(
    new Request(`${baseUrl}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin },
      body: JSON.stringify({
        email: `ledger-${prefix}-${crypto.randomUUID()}@hexamap.test`,
        password: 'motdepasse-123',
        name: 'Spec',
        pseudo: `${prefix}-${crypto.randomUUID().slice(0, 6)}`,
      }),
    }),
  );
  expect(res.status).toBeGreaterThanOrEqual(200);
  expect(res.status).toBeLessThan(300);
  const body = (await res.json()) as { user: { id: string } };
  createdUserIds.push(body.user.id);
  return body.user.id;
}

async function insertLedger(userId: string, delta: number, reason: string): Promise<void> {
  await sql`
    insert into currency_ledger (user_id, delta, reason)
    values (${userId}, ${delta}, ${reason})
    on conflict do nothing
  `.execute(db);
}

async function countLedger(userId: string, reason: string): Promise<number> {
  const result = await sql<{ n: string }>`
    select count(*)::text as n
    from currency_ledger
    where user_id = ${userId} and reason = ${reason}
  `.execute(db);
  return Number(result.rows[0]?.n ?? '0');
}

beforeAll(async () => {
  await runMigrations(db);
}, 60_000);

afterAll(async () => {
  if (createdUserIds.length > 0) {
    await db.deleteFrom('user').where('id', 'in', createdUserIds).execute();
  }
  await db.destroy();
});

describe('currency_ledger — idempotence et plafond', () => {
  it('l’index partiel currency_ledger_purchase_uniq existe', async () => {
    const result = await sql<{ indexname: string }>`
      select indexname from pg_indexes
      where schemaname = current_schema() and tablename = 'currency_ledger'
    `.execute(db);
    expect(result.rows.map((row) => row.indexname)).toContain('currency_ledger_purchase_uniq');
  });

  it('un rejeu PURCHASE:<id> n’écrit qu’une ligne', async () => {
    const userId = await signUp();
    const reason = `PURCHASE:${crypto.randomUUID()}`;
    await insertLedger(userId, 500, reason);
    await insertLedger(userId, 500, reason);
    expect(await countLedger(userId, reason)).toBe(1);
  });

  it('deux MARKET_BUY identiques écrivent deux lignes', async () => {
    const userId = await signUp();
    await insertLedger(userId, -500, 'MARKET_BUY');
    await insertLedger(userId, -500, 'MARKET_BUY');
    expect(await countLedger(userId, 'MARKET_BUY')).toBe(2);
  });

  it('deux PURCHASE_REFUND:<id> identiques écrivent deux lignes', async () => {
    const userId = await signUp();
    const reason = `PURCHASE_REFUND:${crypto.randomUUID()}`;
    await insertLedger(userId, -500, reason);
    await insertLedger(userId, -500, reason);
    expect(await countLedger(userId, reason)).toBe(2);
  });

  it('SHOP_DAILY_PURCHASE_CAP vaut 12000 en nombre', async () => {
    const result = await sql<{ value: unknown }>`
      select value from game_config where key = 'SHOP_DAILY_PURCHASE_CAP'
    `.execute(db);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.value).toBe(12000);
  });
});
