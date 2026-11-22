import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { app } from '@hexamap/api/app';
import { createDb, runMigrations } from '@hexamap/db';
import {
  CRAFT_THRESHOLD,
  CRAFT_TRANSITIONS,
  craftedScore,
  craftGroupKey,
  EDITION_SCORE,
  isCraftableRarity,
  nextCraftRarity,
  RARITY,
  type Rarity,
} from '@hexamap/shared';

const db = createDb(process.env.DATABASE_URL ?? '');

const baseUrl = 'http://localhost:3000';
const origin = 'http://localhost:5174';

const prefix = crypto.randomUUID().slice(0, 8);
const createdUserIds: string[] = [];

interface Player {
  cookie: string;
  userId: string;
}

interface ErrorBody {
  code: string;
  message: string;
}

interface CraftedCardBody {
  id: string;
  category: string;
  refCode: string;
  nom: string;
  rarity: string;
  score: number;
  acquiredAt: string;
  source: string;
  locked: boolean;
  blasonUrl: string | null;
  blasonCredit: string | null;
}

interface CraftBody {
  craftedCard: CraftedCardBody;
  consumed: number;
}

function extractSessionCookie(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(';')[0])
    .join('; ');
}

async function signUp(label: string): Promise<Player> {
  // Pseudo borné à 3–24 caractères (§2.9) : le libellé reste dans l'adresse.
  const pseudo = `${prefix}-${crypto.randomUUID().slice(0, 4)}`;
  const email = `spec-${prefix}-${label}-${crypto.randomUUID()}@hexamap.test`;
  const res = await app.handle(
    new Request(`${baseUrl}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin },
      body: JSON.stringify({ email, password: 'motdepasse-123', name: 'Spec', pseudo }),
    }),
  );
  expect(res.status).toBeGreaterThanOrEqual(200);
  expect(res.status).toBeLessThan(300);

  const body = (await res.json()) as { user: { id: string } };
  createdUserIds.push(body.user.id);
  return { cookie: extractSessionCookie(res), userId: body.user.id };
}

async function authFetch(path: string, init: RequestInit = {}, cookie?: string): Promise<Response> {
  const headers = new Headers(init.headers);
  if (!headers.has('origin')) headers.set('origin', origin);
  if (cookie) headers.set('cookie', cookie);
  return app.handle(new Request(`${baseUrl}${path}`, { ...init, headers }));
}

async function createCard(
  userId: string,
  refCode: string,
  rarity: Rarity = 'RARE',
  category: 'REGION' | 'DEPARTEMENT' | 'COMMUNE' | 'RUE' = 'COMMUNE',
): Promise<string> {
  const inserted = await db
    .insertInto('user_cards')
    .values({
      user_id: userId,
      category,
      ref_code: refCode,
      rarity,
      score: EDITION_SCORE[rarity],
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return inserted.id;
}

function craft(player: Player, body: Record<string, unknown>): Promise<Response> {
  return authFetch(
    '/api/v1/cards/craft',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    },
    player.cookie,
  );
}

async function groupRows(
  userId: string,
  refCode: string,
  rarity: Rarity,
): Promise<Array<{ id: string; score: number; source: string }>> {
  return db
    .selectFrom('user_cards')
    .select(['id', 'score', 'source'])
    .where('user_id', '=', userId)
    .where('category', '=', 'COMMUNE')
    .where('ref_code', '=', refCode)
    .where('rarity', '=', rarity)
    .execute();
}

beforeAll(async () => {
  await runMigrations(db);
});

afterAll(async () => {
  if (createdUserIds.length > 0) {
    await db.deleteFrom('user').where('id', 'in', createdUserIds).execute();
  }
  await db.destroy();
});

describe('Phase 41 — la règle de fusion (pure)', () => {
  it('les cinq transitions sont exactement palier + 1', () => {
    expect(CRAFT_TRANSITIONS.COMMUNE).toBe('INHABITUELLE');
    expect(CRAFT_TRANSITIONS.INHABITUELLE).toBe('RARE');
    expect(CRAFT_TRANSITIONS.RARE).toBe('EPIQUE');
    expect(CRAFT_TRANSITIONS.EPIQUE).toBe('LEGENDAIRE');
    expect(CRAFT_TRANSITIONS.LEGENDAIRE).toBeNull();
  });

  it('MYTHIQUE ne peut jamais être produit', () => {
    expect(nextCraftRarity('LEGENDAIRE')).toBeNull();
    expect(nextCraftRarity('MYTHIQUE')).toBeNull();
    expect(isCraftableRarity('LEGENDAIRE')).toBe(false);
    expect(isCraftableRarity('MYTHIQUE')).toBe(false);
    expect(RARITY.some((rarity) => nextCraftRarity(rarity) === 'MYTHIQUE')).toBe(false);
  });

  it('aucun palier n’est sauté et l’ordre est complet', () => {
    let current: Rarity = 'COMMUNE';
    const visited: Rarity[] = [current];
    let next = nextCraftRarity(current);
    while (next !== null) {
      visited.push(next);
      current = next;
      next = nextCraftRarity(current);
    }
    expect(visited).toEqual(['COMMUNE', 'INHABITUELLE', 'RARE', 'EPIQUE', 'LEGENDAIRE']);
  });

  it('le score produit est celui du palier atteint', () => {
    for (const rarity of RARITY) {
      expect(craftedScore(rarity)).toBe(EDITION_SCORE[rarity]);
    }
  });

  it('le seuil est de trois exemplaires', () => {
    expect(CRAFT_THRESHOLD).toBe(3);
  });

  it('la clé de groupe distingue catégorie, référence et rareté', () => {
    expect(craftGroupKey({ category: 'COMMUNE', refCode: 'X', rarity: 'RARE' })).toBe(
      'COMMUNE:X:RARE',
    );
    expect(craftGroupKey({ category: 'COMMUNE', refCode: 'X', rarity: 'EPIQUE' })).not.toBe(
      craftGroupKey({ category: 'COMMUNE', refCode: 'X', rarity: 'RARE' }),
    );
  });
});

describe('Phase 41 — la fusion (API)', () => {
  it('trois doublons donnent une carte du palier supérieur et consomment le groupe', async () => {
    const player = await signUp('craft-ok');
    const ref = `${prefix}-C-OK`;
    await createCard(player.userId, ref, 'RARE');
    await createCard(player.userId, ref, 'RARE');
    await createCard(player.userId, ref, 'RARE');

    const response = await craft(player, { category: 'COMMUNE', refCode: ref, rarity: 'RARE' });
    expect(response.status).toBe(201);

    const body = (await response.json()) as CraftBody;
    expect(body.consumed).toBe(3);
    expect(body.craftedCard.rarity).toBe('EPIQUE');
    expect(body.craftedCard.score).toBe(EDITION_SCORE.EPIQUE);
    expect(body.craftedCard.source).toBe('CRAFT');
    expect(body.craftedCard.category).toBe('COMMUNE');
    expect(body.craftedCard.refCode).toBe(ref);

    const rare = await groupRows(player.userId, ref, 'RARE');
    const epique = await groupRows(player.userId, ref, 'EPIQUE');
    expect(rare).toHaveLength(0);
    expect(epique).toHaveLength(1);
    expect(epique[0]?.source).toBe('CRAFT');
    expect(epique[0]?.score).toBe(EDITION_SCORE.EPIQUE);
  });

  it('une fusion rejouée ne produit pas de seconde carte', async () => {
    const player = await signUp('craft-replay');
    const ref = `${prefix}-C-REPLAY`;
    await createCard(player.userId, ref, 'RARE');
    await createCard(player.userId, ref, 'RARE');
    await createCard(player.userId, ref, 'RARE');

    expect(
      (await craft(player, { category: 'COMMUNE', refCode: ref, rarity: 'RARE' })).status,
    ).toBe(201);
    const replay = await craft(player, { category: 'COMMUNE', refCode: ref, rarity: 'RARE' });
    expect(replay.status).toBe(409);
    expect(((await replay.json()) as ErrorBody).code).toBe('CRAFT_NOT_ENOUGH');

    expect(await groupRows(player.userId, ref, 'RARE')).toHaveLength(0);
    expect(await groupRows(player.userId, ref, 'EPIQUE')).toHaveLength(1);
  });

  it('deux exemplaires ne suffisent pas', async () => {
    const player = await signUp('craft-not-enough');
    const ref = `${prefix}-C-FEW`;
    await createCard(player.userId, ref, 'RARE');
    await createCard(player.userId, ref, 'RARE');

    const response = await craft(player, { category: 'COMMUNE', refCode: ref, rarity: 'RARE' });
    expect(response.status).toBe(409);
    expect(((await response.json()) as ErrorBody).code).toBe('CRAFT_NOT_ENOUGH');
    expect(await groupRows(player.userId, ref, 'RARE')).toHaveLength(2);
  });

  it('LEGENDAIRE est le plafond : CRAFT_CEILING et aucune carte touchée', async () => {
    const player = await signUp('craft-ceiling');
    const ref = `${prefix}-C-CEIL`;
    await createCard(player.userId, ref, 'LEGENDAIRE');
    await createCard(player.userId, ref, 'LEGENDAIRE');
    await createCard(player.userId, ref, 'LEGENDAIRE');

    const response = await craft(player, {
      category: 'COMMUNE',
      refCode: ref,
      rarity: 'LEGENDAIRE',
    });
    expect(response.status).toBe(409);
    expect(((await response.json()) as ErrorBody).code).toBe('CRAFT_CEILING');
    expect(await groupRows(player.userId, ref, 'LEGENDAIRE')).toHaveLength(3);
  });

  it('un groupe MYTHIQUE est refusé : aucun MYTHIQUE ne sort', async () => {
    const player = await signUp('craft-mythique');
    const ref = `${prefix}-C-MYTH`;
    await createCard(player.userId, ref, 'MYTHIQUE');
    await createCard(player.userId, ref, 'MYTHIQUE');
    await createCard(player.userId, ref, 'MYTHIQUE');

    const response = await craft(player, { category: 'COMMUNE', refCode: ref, rarity: 'MYTHIQUE' });
    expect(response.status).toBe(409);
    expect(((await response.json()) as ErrorBody).code).toBe('CRAFT_CEILING');
    expect(await groupRows(player.userId, ref, 'MYTHIQUE')).toHaveLength(3);
  });

  it('un groupe de six reste une seule fusion : six consommés, une carte', async () => {
    const player = await signUp('craft-six');
    const ref = `${prefix}-C-SIX`;
    for (let index = 0; index < 6; index += 1) {
      await createCard(player.userId, ref, 'RARE');
    }

    const response = await craft(player, { category: 'COMMUNE', refCode: ref, rarity: 'RARE' });
    expect(response.status).toBe(201);
    expect(((await response.json()) as CraftBody).consumed).toBe(6);
    expect(await groupRows(player.userId, ref, 'RARE')).toHaveLength(0);
    expect(await groupRows(player.userId, ref, 'EPIQUE')).toHaveLength(1);
  });

  it('seul le groupe visé est consommé, pas les autres raretés de la même référence', async () => {
    const player = await signUp('craft-group');
    const ref = `${prefix}-C-GROUP`;
    await createCard(player.userId, ref, 'RARE');
    await createCard(player.userId, ref, 'RARE');
    await createCard(player.userId, ref, 'RARE');
    await createCard(player.userId, ref, 'EPIQUE');

    const response = await craft(player, { category: 'COMMUNE', refCode: ref, rarity: 'RARE' });
    expect(response.status).toBe(201);
    expect(await groupRows(player.userId, ref, 'RARE')).toHaveLength(0);
    expect(await groupRows(player.userId, ref, 'EPIQUE')).toHaveLength(2);
  });

  it('une carte en vente ouverte est refusée : CARD_ENGAGED', async () => {
    const player = await signUp('craft-listing');
    const ref = `${prefix}-C-LIST`;
    const first = await createCard(player.userId, ref, 'RARE');
    await createCard(player.userId, ref, 'RARE');
    await createCard(player.userId, ref, 'RARE');
    await db
      .insertInto('market_listings')
      .values({ seller_id: player.userId, user_card_id: first, price: 10 })
      .execute();

    const response = await craft(player, { category: 'COMMUNE', refCode: ref, rarity: 'RARE' });
    expect(response.status).toBe(409);
    expect(((await response.json()) as ErrorBody).code).toBe('CARD_ENGAGED');
    expect(await groupRows(player.userId, ref, 'RARE')).toHaveLength(3);
  });

  it('une carte d’un tableau est refusée : CARD_ENGAGED', async () => {
    const player = await signUp('craft-tableau');
    const ref = `${prefix}-C-TAB`;
    const first = await createCard(player.userId, ref, 'RARE');
    await createCard(player.userId, ref, 'RARE');
    await createCard(player.userId, ref, 'RARE');
    await db
      .insertInto('tableaux')
      .values({ user_id: player.userId, name: 'Spec', commune_card_id: first })
      .execute();

    const response = await craft(player, { category: 'COMMUNE', refCode: ref, rarity: 'RARE' });
    expect(response.status).toBe(409);
    expect(((await response.json()) as ErrorBody).code).toBe('CARD_ENGAGED');
    expect(await groupRows(player.userId, ref, 'RARE')).toHaveLength(3);
  });

  it('une carte engagée dans un troc ouvert est refusée : CARD_ENGAGED', async () => {
    const alice = await signUp('craft-trade-a');
    const bob = await signUp('craft-trade-b');
    const ref = `${prefix}-C-TRADE`;
    const first = await createCard(alice.userId, ref, 'RARE');
    await createCard(alice.userId, ref, 'RARE');
    await createCard(alice.userId, ref, 'RARE');
    const requested = await createCard(bob.userId, `${prefix}-C-TRADE-B`, 'RARE');

    const proposal = await authFetch(
      '/api/v1/trades',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ offeredCardId: first, requestedCardId: requested }),
      },
      alice.cookie,
    );
    expect(proposal.status).toBe(201);

    const response = await craft(alice, { category: 'COMMUNE', refCode: ref, rarity: 'RARE' });
    expect(response.status).toBe(409);
    expect(((await response.json()) as ErrorBody).code).toBe('CARD_ENGAGED');
    expect(await groupRows(alice.userId, ref, 'RARE')).toHaveLength(3);
  });

  it('la fusion d’un autre joueur ne touche pas mes cartes', async () => {
    const alice = await signUp('craft-owner-a');
    const bob = await signUp('craft-owner-b');
    const ref = `${prefix}-C-SHARED`;
    await createCard(bob.userId, ref, 'RARE');
    await createCard(bob.userId, ref, 'RARE');
    await createCard(bob.userId, ref, 'RARE');

    const response = await craft(alice, { category: 'COMMUNE', refCode: ref, rarity: 'RARE' });
    expect(response.status).toBe(409);
    expect(((await response.json()) as ErrorBody).code).toBe('CRAFT_NOT_ENOUGH');
    expect(await groupRows(bob.userId, ref, 'RARE')).toHaveLength(3);
  });

  it('une requête non authentifiée est refusée', async () => {
    const response = await authFetch('/api/v1/cards/craft', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ category: 'COMMUNE', refCode: `${prefix}-C-ANON`, rarity: 'RARE' }),
    });
    expect(response.status).toBe(401);
  });
});
