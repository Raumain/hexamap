import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { app } from '@hexamap/api/app';
import { createDb, runMigrations } from '@hexamap/db';
import type { Category } from '@hexamap/shared';

const db = createDb(process.env.DATABASE_URL ?? '');

const baseUrl = 'http://localhost:3000';
const origin = 'http://localhost:5174';

// --- état du seed (préfixe unique par exécution pour ne jamais entrer en collision) ---
const prefix = crypto.randomUUID().slice(0, 8);
const seeded = {
  regionCode: `${prefix}-84`,
  departementCode: `${prefix}-69`,
  communeCode: `${prefix}-69123`,
  odonymeId: '',
};
const createdUserIds: string[] = [];

interface ListingBody {
  id: string;
  price: number;
  status: string;
  createdAt: string;
  soldAt: string | null;
  buyerId: string | null;
  seller: { id: string; pseudo: string | null };
  card: {
    id: string;
    category: string;
    refCode: string;
    nom: string;
    rarity: string;
    score: number;
  };
}

function extractSessionCookie(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(';')[0])
    .join('; ');
}

async function signUp(): Promise<{ cookie: string; userId: string }> {
  const email = `spec-${prefix}-${crypto.randomUUID()}@hexamap.test`;
  const res = await app.handle(
    new Request(`${baseUrl}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin },
      body: JSON.stringify({
        email,
        password: 'motdepasse-123',
        name: 'Spec',
        pseudo: `${prefix}-spec-${crypto.randomUUID().slice(0, 6)}`,
      }),
    }),
  );
  expect(res.status).toBeGreaterThanOrEqual(200);
  expect(res.status).toBeLessThan(300);
  const body = (await res.json()) as { user: { id: string } };
  const cookie = extractSessionCookie(res);
  createdUserIds.push(body.user.id);
  return { cookie, userId: body.user.id };
}

async function authFetch(path: string, init: RequestInit = {}, cookie?: string): Promise<Response> {
  const headers = new Headers(init.headers);
  if (!headers.has('origin')) headers.set('origin', origin);
  if (cookie) headers.set('cookie', cookie);
  return app.handle(new Request(`${baseUrl}${path}`, { ...init, headers }));
}

/** Référentiel cohérent pour que `resolveCardNoms` résolve les noms. */
async function seedReference(): Promise<void> {
  await db
    .insertInto('ref_regions')
    .values({ code: seeded.regionCode, nom: `Région ${prefix}` })
    .execute();

  await db
    .insertInto('ref_departements')
    .values({
      code: seeded.departementCode,
      nom: `Département ${prefix}`,
      code_region: seeded.regionCode,
      population: 1_000_000,
    })
    .execute();

  await db
    .insertInto('ref_communes')
    .values({
      code_insee: seeded.communeCode,
      nom: `Commune ${prefix}`,
      code_departement: seeded.departementCode,
      code_region: seeded.regionCode,
      population: 10_000,
      rarete: 'COMMUNE',
      score_base: 100,
    })
    .execute();

  const odonyme = await db
    .insertInto('ref_odonymes')
    .values({
      nom_normalise: `${prefix}-rue-42`.toLowerCase(),
      nom_affichage: `Rue ${prefix}`,
      nb_communes: 1,
      rarete: 'COMMUNE',
      score_base: 100,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  seeded.odonymeId = String(odonyme.id);

  await db
    .insertInto('commune_odonymes')
    .values({ code_insee: seeded.communeCode, odonyme_id: seeded.odonymeId })
    .execute();
}

function refCodeFor(category: Category): string {
  switch (category) {
    case 'REGION':
      return seeded.regionCode;
    case 'DEPARTEMENT':
      return seeded.departementCode;
    case 'COMMUNE':
      return seeded.communeCode;
    case 'RUE':
      return seeded.odonymeId;
  }
}

async function insertCard(
  userId: string,
  category: Category,
  score: number,
  locked = false,
): Promise<string> {
  const row = await db
    .insertInto('user_cards')
    .values({
      user_id: userId,
      category,
      ref_code: refCodeFor(category),
      rarity: 'COMMUNE',
      score,
      locked,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return row.id;
}

/** Fixture de test : fixe le solde d'un utilisateur sans passer par le grand-livre. */
async function setBalance(userId: string, amount: number): Promise<void> {
  await db.updateTable('user').set({ currency: amount }).where('id', '=', userId).execute();
}

async function readBalance(userId: string): Promise<number> {
  const row = await db
    .selectFrom('user')
    .select('currency')
    .where('id', '=', userId)
    .executeTakeFirstOrThrow();
  return row.currency ?? 0;
}

async function readCard(cardId: string): Promise<{
  id: string;
  user_id: string;
  locked: boolean;
  source: string;
}> {
  return db
    .selectFrom('user_cards')
    .select(['id', 'user_id', 'locked', 'source'])
    .where('id', '=', cardId)
    .executeTakeFirstOrThrow();
}

async function readListing(listingId: string): Promise<{
  id: string;
  seller_id: string;
  user_card_id: string;
  price: number;
  status: string;
  buyer_id: string | null;
  sold_at: Date | null;
}> {
  return db
    .selectFrom('market_listings')
    .select(['id', 'seller_id', 'user_card_id', 'price', 'status', 'buyer_id', 'sold_at'])
    .where('id', '=', listingId)
    .executeTakeFirstOrThrow();
}

async function postListing(cookie: string, userCardId: string, price: number): Promise<Response> {
  return authFetch(
    '/api/v1/market/listings',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userCardId, price }),
    },
    cookie,
  );
}

async function buy(cookie: string, listingId: string): Promise<Response> {
  return authFetch(`/api/v1/market/listings/${listingId}/buy`, { method: 'POST' }, cookie);
}

async function cancelListing(cookie: string, listingId: string): Promise<Response> {
  return authFetch(`/api/v1/market/listings/${listingId}`, { method: 'DELETE' }, cookie);
}

async function listingIdFromResponse(res: Response): Promise<string> {
  const body = (await res.json()) as { listing: ListingBody };
  return body.listing.id;
}

beforeAll(async () => {
  await runMigrations(db);
  await seedReference();
});

afterAll(async () => {
  if (seeded.odonymeId !== '') {
    await db.deleteFrom('commune_odonymes').where('odonyme_id', '=', seeded.odonymeId).execute();
    await db.deleteFrom('ref_odonymes').where('id', '=', seeded.odonymeId).execute();
  }
  await db.deleteFrom('ref_communes').where('code_insee', '=', seeded.communeCode).execute();
  await db.deleteFrom('ref_departements').where('code', '=', seeded.departementCode).execute();
  await db.deleteFrom('ref_regions').where('code', '=', seeded.regionCode).execute();
  if (createdUserIds.length > 0) {
    await db.deleteFrom('user').where('id', 'in', createdUserIds).execute();
  }
  await db.destroy();
});

describe('Phase 9 — marché V1 (GDD §3.D / architecture §4.2)', () => {
  it('les routes du marché renvoient 401 sans cookie', async () => {
    const id = crypto.randomUUID();

    const getRes = await authFetch('/api/v1/market/listings');
    expect(getRes.status).toBe(401);
    expect(((await getRes.json()) as { code: string }).code).toBe('UNAUTHORIZED');

    const postRes = await authFetch('/api/v1/market/listings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userCardId: crypto.randomUUID(), price: 100 }),
    });
    expect(postRes.status).toBe(401);
    expect(((await postRes.json()) as { code: string }).code).toBe('UNAUTHORIZED');

    const buyRes = await authFetch(`/api/v1/market/listings/${id}/buy`, { method: 'POST' });
    expect(buyRes.status).toBe(401);
    expect(((await buyRes.json()) as { code: string }).code).toBe('UNAUTHORIZED');

    const deleteRes = await authFetch(`/api/v1/market/listings/${id}`, { method: 'DELETE' });
    expect(deleteRes.status).toBe(401);
    expect(((await deleteRes.json()) as { code: string }).code).toBe('UNAUTHORIZED');
  });

  it('mettre une carte en vente verrouille la carte et crée une annonce OPEN au prix demandé', async () => {
    const { cookie, userId } = await signUp();
    const cardId = await insertCard(userId, 'REGION', 200);

    const res = await postListing(cookie, cardId, 150);
    expect(res.status).toBe(201);
    const body = (await res.json()) as { listing: ListingBody };
    expect(body.listing.status).toBe('OPEN');
    expect(body.listing.price).toBe(150);
    expect(body.listing.seller.id).toBe(userId);
    expect(body.listing.card.id).toBe(cardId);

    const card = await readCard(cardId);
    expect(card.locked).toBe(true);

    const listing = await readListing(body.listing.id);
    expect(listing.status).toBe('OPEN');
    expect(listing.price).toBe(150);
    expect(listing.user_card_id).toBe(cardId);
    expect(listing.seller_id).toBe(userId);
  });

  it('mettre en vente une carte verrouillée renvoie 409 CARD_LOCKED sans créer d’annonce', async () => {
    const { cookie, userId } = await signUp();
    const cardId = await insertCard(userId, 'REGION', 200, true);

    const res = await postListing(cookie, cardId, 150);
    expect(res.status).toBe(409);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('CARD_LOCKED');

    const count = await db
      .selectFrom('market_listings')
      .select(db.fn.countAll().as('total'))
      .where('user_card_id', '=', cardId)
      .executeTakeFirstOrThrow();
    expect(Number(count.total)).toBe(0);
  });

  it('mettre en vente la carte d’un autre utilisateur renvoie 404 CARD_NOT_FOUND', async () => {
    const owner = await signUp();
    const intruder = await signUp();
    const cardId = await insertCard(owner.userId, 'REGION', 200);

    const res = await postListing(intruder.cookie, cardId, 150);
    expect(res.status).toBe(404);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('CARD_NOT_FOUND');

    const count = await db
      .selectFrom('market_listings')
      .select(db.fn.countAll().as('total'))
      .where('user_card_id', '=', cardId)
      .executeTakeFirstOrThrow();
    expect(Number(count.total)).toBe(0);
  });

  it('annuler l’annonce d’un autre renvoie 403 NOT_LISTING_OWNER ; la sienne passe CANCELLED et déverrouille', async () => {
    const seller = await signUp();
    const intruder = await signUp();
    const cardId = await insertCard(seller.userId, 'REGION', 200);
    const listingId = await listingIdFromResponse(await postListing(seller.cookie, cardId, 150));

    const foreign = await cancelListing(intruder.cookie, listingId);
    expect(foreign.status).toBe(403);
    expect(((await foreign.json()) as { code: string }).code).toBe('NOT_LISTING_OWNER');
    expect((await readListing(listingId)).status).toBe('OPEN');
    expect((await readCard(cardId)).locked).toBe(true);

    const own = await cancelListing(seller.cookie, listingId);
    expect(own.status).toBe(200);
    const body = (await own.json()) as { listing: ListingBody };
    expect(body.listing.status).toBe('CANCELLED');
    expect((await readListing(listingId)).status).toBe('CANCELLED');
    expect((await readCard(cardId)).locked).toBe(false);
  });

  it('une carte annulée peut être remise en vente (index unique partiel OPEN)', async () => {
    const { cookie, userId } = await signUp();
    const cardId = await insertCard(userId, 'REGION', 200);

    const first = await postListing(cookie, cardId, 100);
    expect(first.status).toBe(201);
    const firstId = await listingIdFromResponse(first);
    const cancel = await cancelListing(cookie, firstId);
    expect(cancel.status).toBe(200);

    const second = await postListing(cookie, cardId, 120);
    expect(second.status).toBe(201);
    const body = (await second.json()) as { listing: ListingBody };
    expect(body.listing.status).toBe('OPEN');

    // Deux lignes existent : une CANCELLED, une OPEN.
    const rows = await db
      .selectFrom('market_listings')
      .select(['id', 'status'])
      .where('user_card_id', '=', cardId)
      .execute();
    expect(rows).toHaveLength(2);
    expect(rows.filter((r) => r.status === 'OPEN')).toHaveLength(1);
    expect(rows.filter((r) => r.status === 'CANCELLED')).toHaveLength(1);
  });

  it('acheter sa propre annonce renvoie 403 CANNOT_BUY_OWN_CARD sans déplacer d’argent', async () => {
    const { cookie, userId } = await signUp();
    await setBalance(userId, 1000);
    const cardId = await insertCard(userId, 'REGION', 200);
    const listingId = await listingIdFromResponse(await postListing(cookie, cardId, 100));

    const res = await buy(cookie, listingId);
    expect(res.status).toBe(403);
    expect(((await res.json()) as { code: string }).code).toBe('CANNOT_BUY_OWN_CARD');

    expect(await readBalance(userId)).toBe(1000);
    expect((await readListing(listingId)).status).toBe('OPEN');
    expect((await readCard(cardId)).user_id).toBe(userId);

    const ledger = await db
      .selectFrom('currency_ledger')
      .select(db.fn.countAll().as('total'))
      .where('user_id', '=', userId)
      .executeTakeFirstOrThrow();
    expect(Number(ledger.total)).toBe(0);
  });

  it('acheter avec un solde insuffisant renvoie 409 INSUFFICIENT_FUNDS sans rien changer', async () => {
    const seller = await signUp();
    const buyer = await signUp();
    await setBalance(buyer.userId, 50);
    await setBalance(seller.userId, 0);
    const cardId = await insertCard(seller.userId, 'REGION', 200);
    const listingId = await listingIdFromResponse(await postListing(seller.cookie, cardId, 100));

    const res = await buy(buyer.cookie, listingId);
    expect(res.status).toBe(409);
    expect(((await res.json()) as { code: string }).code).toBe('INSUFFICIENT_FUNDS');

    expect(await readBalance(buyer.userId)).toBe(50);
    expect(await readBalance(seller.userId)).toBe(0);
    expect((await readListing(listingId)).status).toBe('OPEN');
    expect((await readCard(cardId)).user_id).toBe(seller.userId);
    expect((await readCard(cardId)).locked).toBe(true);
  });

  it('un achat réussi débite l’acheteur, crédite le vendeur, trace 2 lignes de grand-livre et transfère la carte', async () => {
    const seller = await signUp();
    const buyer = await signUp();
    await setBalance(buyer.userId, 500);
    await setBalance(seller.userId, 0);
    const cardId = await insertCard(seller.userId, 'REGION', 200);
    const listingId = await listingIdFromResponse(await postListing(seller.cookie, cardId, 120));

    const res = await buy(buyer.cookie, listingId);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { listing: ListingBody; balance: number };
    expect(body.balance).toBe(380);
    expect(body.listing.status).toBe('SOLD');
    expect(body.listing.buyerId).toBe(buyer.userId);
    expect(body.listing.soldAt).not.toBeNull();

    expect(await readBalance(buyer.userId)).toBe(380);
    expect(await readBalance(seller.userId)).toBe(120);

    const ledger = await db
      .selectFrom('currency_ledger')
      .select(['user_id', 'delta', 'reason'])
      .where('user_id', 'in', [buyer.userId, seller.userId])
      .where('reason', 'in', ['MARKET_BUY', 'MARKET_SELL'])
      .execute();
    expect(ledger).toHaveLength(2);
    expect(
      ledger.find(
        (r) => r.user_id === buyer.userId && r.reason === 'MARKET_BUY' && r.delta === -120,
      ),
    ).toBeDefined();
    expect(
      ledger.find(
        (r) => r.user_id === seller.userId && r.reason === 'MARKET_SELL' && r.delta === 120,
      ),
    ).toBeDefined();

    const card = await readCard(cardId);
    expect(card.user_id).toBe(buyer.userId);
    expect(card.locked).toBe(false);
    expect(card.source).toBe('MARKET');

    const listing = await readListing(listingId);
    expect(listing.status).toBe('SOLD');
    expect(listing.buyer_id).toBe(buyer.userId);
    expect(listing.sold_at).not.toBeNull();
  });

  it('preuve du .forUpdate() — deux acheteurs simultanés : exactement un 200 et un 409, un seul transfert', async () => {
    const seller = await signUp();
    const buyerA = await signUp();
    const buyerB = await signUp();
    await setBalance(buyerA.userId, 500);
    await setBalance(buyerB.userId, 500);
    await setBalance(seller.userId, 0);
    const cardId = await insertCard(seller.userId, 'REGION', 200);
    const listingId = await listingIdFromResponse(await postListing(seller.cookie, cardId, 100));

    const before =
      (await readBalance(buyerA.userId)) +
      (await readBalance(buyerB.userId)) +
      (await readBalance(seller.userId));

    const [resA, resB] = await Promise.all([
      buy(buyerA.cookie, listingId),
      buy(buyerB.cookie, listingId),
    ]);

    const statuses = [resA.status, resB.status].sort((a, b) => a - b);
    expect(statuses).toEqual([200, 409]);

    const aWon = resA.status === 200;
    const winner = aWon ? buyerA : buyerB;
    const loser = aWon ? buyerB : buyerA;

    const loserRes = aWon ? resB : resA;
    expect(((await loserRes.json()) as { code: string }).code).toBe('LISTING_NOT_OPEN');

    // Un seul achat tracé pour le prix convenu.
    const buyLedger = await db
      .selectFrom('currency_ledger')
      .select(['user_id', 'delta', 'reason'])
      .where('user_id', 'in', [buyerA.userId, buyerB.userId])
      .where('reason', '=', 'MARKET_BUY')
      .where('delta', '=', -100)
      .execute();
    expect(buyLedger).toHaveLength(1);
    expect(buyLedger[0]?.user_id).toBe(winner.userId);

    const sellLedger = await db
      .selectFrom('currency_ledger')
      .select(['user_id', 'delta', 'reason'])
      .where('user_id', '=', seller.userId)
      .where('reason', '=', 'MARKET_SELL')
      .where('delta', '=', 100)
      .execute();
    expect(sellLedger).toHaveLength(1);

    // La carte a exactement un propriétaire parmi les deux acheteurs.
    const card = await readCard(cardId);
    expect(card.user_id).toBe(winner.userId);

    // Le perdant n'a rien dépensé.
    expect(await readBalance(winner.userId)).toBe(400);
    expect(await readBalance(loser.userId)).toBe(500);

    // La monnaie totale est conservée.
    const after =
      (await readBalance(buyerA.userId)) +
      (await readBalance(buyerB.userId)) +
      (await readBalance(seller.userId));
    expect(after).toBe(before);

    // L'annonce est SOLD pour l'acheteur gagnant.
    const listing = await readListing(listingId);
    expect(listing.status).toBe('SOLD');
    expect(listing.buyer_id).toBe(winner.userId);
  });

  it('GET /listings ne renvoie que les annonces OPEN ; GET /listings/mine renvoie tous les statuts du seul appelant', async () => {
    const sellerA = await signUp();
    const sellerB = await signUp();
    const buyer = await signUp();
    await setBalance(buyer.userId, 1000);

    // Vendeur A : une OPEN, une CANCELLED, une SOLD.
    const openCard = await insertCard(sellerA.userId, 'REGION', 200);
    const openListingId = await listingIdFromResponse(
      await postListing(sellerA.cookie, openCard, 100),
    );

    const cancelledCard = await insertCard(sellerA.userId, 'REGION', 200);
    const cancelledListingId = await listingIdFromResponse(
      await postListing(sellerA.cookie, cancelledCard, 100),
    );
    await cancelListing(sellerA.cookie, cancelledListingId);

    const soldCard = await insertCard(sellerA.userId, 'REGION', 200);
    const soldListingId = await listingIdFromResponse(
      await postListing(sellerA.cookie, soldCard, 100),
    );
    await buy(buyer.cookie, soldListingId);

    // Vendeur B : une OPEN.
    await insertCard(sellerB.userId, 'REGION', 200);
    const bCard = await insertCard(sellerB.userId, 'REGION', 200);
    await postListing(sellerB.cookie, bCard, 100);

    // Marché public : uniquement OPEN, toutes catégories confondues.
    const publicRes = await authFetch('/api/v1/market/listings', {}, buyer.cookie);
    expect(publicRes.status).toBe(200);
    const publicBody = (await publicRes.json()) as { items: ListingBody[]; total: number };
    expect(publicBody.items.every((i) => i.status === 'OPEN')).toBe(true);
    const publicIds = publicBody.items.map((i) => i.id);
    expect(publicIds).toContain(openListingId);
    expect(publicIds).not.toContain(cancelledListingId);
    expect(publicIds).not.toContain(soldListingId);
    expect(publicBody.total).toBe(publicBody.items.length);

    // Mes annonces : les 3 statuts du vendeur A, jamais celles du vendeur B.
    const mineRes = await authFetch('/api/v1/market/listings/mine', {}, sellerA.cookie);
    expect(mineRes.status).toBe(200);
    const mineBody = (await mineRes.json()) as { items: ListingBody[]; total: number };
    expect(mineBody.total).toBe(3);
    expect(mineBody.items).toHaveLength(3);
    expect(mineBody.items.every((i) => i.seller.id === sellerA.userId)).toBe(true);
    const mineStatuses = mineBody.items.map((i) => i.status).sort();
    expect(mineStatuses).toEqual(['CANCELLED', 'OPEN', 'SOLD']);
  });
});
