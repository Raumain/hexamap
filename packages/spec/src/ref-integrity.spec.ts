import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import {
  createDb,
  orphanUserCards,
  pruneUnreferencedReferenceRows,
  runMigrations,
  sql,
} from '@hexamap/db';
import { FRENCH_REGION_CODES, isFrenchRegionCode } from '@hexamap/shared';

const db = createDb(process.env.DATABASE_URL ?? '');

const prefix = crypto.randomUUID().slice(0, 8);
const regionCited = `${prefix}-R-CITED`;
const regionStale = `${prefix}-R-STALE`;

const createdUserIds: string[] = [];
const createdRegionCodes: string[] = [];

async function insertUser(pseudoSuffix: string): Promise<string> {
  const id = `${prefix}-user-${pseudoSuffix}`;
  await db
    .insertInto('user')
    .values({
      id,
      name: 'Spec Intégrité',
      email: `${prefix}-${pseudoSuffix}@hexamap.test`,
      emailVerified: true,
      pseudo: `${prefix}-${pseudoSuffix}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .execute();
  createdUserIds.push(id);
  return id;
}

async function insertRegion(code: string, nom: string): Promise<void> {
  await db.insertInto('ref_regions').values({ code, nom }).execute();
  createdRegionCodes.push(code);
}

async function insertCard(
  userId: string,
  category: 'REGION' | 'COMMUNE',
  refCode: string,
): Promise<string> {
  const row = await db
    .insertInto('user_cards')
    .values({ user_id: userId, category, ref_code: refCode, rarity: 'COMMUNE', score: 200 })
    .returning('id')
    .executeTakeFirstOrThrow();
  return row.id;
}

/**
 * Tente le vidage dans une transaction : Postgres sait annuler un `TRUNCATE`,
 * donc une exécution **rouge** (avant migration) ne détruit pas le référentiel
 * des autres fichiers de spec.
 *
 * Les cinq tables sont listées ensemble, comme le fait l'import : `ref_regions`
 * est référencée par `ref_departements`, donc un vidage partiel est refusé par
 * PostgreSQL lui-même (`0A000`) avant toute garde applicative.
 *
 * Rend `'23503'` quand la garde a fait son travail, `'VIDAGE_ACCEPTE'` sinon.
 */
async function attemptTruncateReference(): Promise<string> {
  try {
    await db.transaction().execute(async (trx) => {
      await sql`
        truncate table commune_odonymes, ref_odonymes, ref_communes, ref_departements, ref_regions
      `.execute(trx);
      throw new Error('VIDAGE_ACCEPTE');
    });
  } catch (error) {
    const code = (error as { code?: string }).code;
    return code ?? (error instanceof Error ? error.message : String(error));
  }

  return 'VIDAGE_ACCEPTE';
}

beforeAll(async () => {
  await runMigrations(db);
  await insertRegion(regionCited, `Région ${prefix} citée`);
});

afterAll(async () => {
  if (createdUserIds.length > 0) {
    await db.deleteFrom('user').where('id', 'in', createdUserIds).execute();
  }
  if (createdRegionCodes.length > 0) {
    await db.deleteFrom('ref_regions').where('code', 'in', createdRegionCodes).execute();
  }
  await db.destroy();
});

describe('BUG-002 — une collection ne survit jamais à la disparition de son référentiel', () => {
  it('refuse de vider une table de référentiel qu’une carte cite encore', async () => {
    const userId = await insertUser('cite');
    await insertCard(userId, 'REGION', regionCited);

    const outcome = await attemptTruncateReference();

    expect(
      outcome,
      'Le vidage d’une table citée doit lever une violation de clé étrangère (23503).',
    ).toBe('23503');
  });

  it('nomme les cartes dont le référentiel n’existe pas', async () => {
    const userId = await insertUser('orpheline');
    const orphanCode = `${prefix}-R-ABSENTE`;
    const cardId = await insertCard(userId, 'REGION', orphanCode);

    const orphans = await orphanUserCards(db);

    expect(
      orphans.some((orphan) => orphan.id === cardId),
      'orphan_user_cards() doit rendre visible la carte sans référentiel.',
    ).toBe(true);
    expect(orphans.find((orphan) => orphan.id === cardId)?.ref_code).toBe(orphanCode);
  });

  it('élague une ligne périmée mais conserve celle qu’une carte cite', async () => {
    const userId = await insertUser('elagage');
    await insertCard(userId, 'REGION', regionCited);
    await insertRegion(regionStale, `Région ${prefix} périmée`);

    // Tout le reste du référentiel est « vu » : seules les deux lignes du cas
    // sont candidates à l'élagage.
    const existing = await db.selectFrom('ref_regions').select('code').execute();
    const keep = existing
      .map((row) => row.code)
      .filter((code) => code !== regionStale && code !== regionCited);

    const result = await pruneUnreferencedReferenceRows(db, 'REGION', keep);

    expect(result.deleted, 'La ligne non citée doit disparaître.').toBe(1);
    expect(
      result.preserved,
      'La ligne citée doit être conservée malgré son absence de `keep`.',
    ).toBe(1);

    const remaining = await db
      .selectFrom('ref_regions')
      .select('code')
      .where('code', 'in', [regionCited, regionStale])
      .execute();
    expect(remaining.map((row) => row.code)).toEqual([regionCited]);
  });
});

describe('BUG-003 — un code de région non français est refusé à l’import', () => {
  it('accepte exactement les dix-huit régions officielles', async () => {
    expect(FRENCH_REGION_CODES).toHaveLength(18);

    for (const code of FRENCH_REGION_CODES) {
      expect(isFrenchRegionCode(code), `${code} est un code officiel.`).toBe(true);
    }
  });

  it('refuse une valeur inventée, y compris celle qui a rendu BUG-001 invisible', async () => {
    const rejected = ['99', '2A', 'R1', 'E2E-R1', `${prefix}-R1`, '', '53 ', '53\n'];

    for (const code of rejected) {
      expect(isFrenchRegionCode(code), `« ${code} » n’est pas un code de région.`).toBe(false);
    }
  });
});
