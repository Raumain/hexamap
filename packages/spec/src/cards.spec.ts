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
  communePopulation: 10_000,
  communeLatitude: 45.764043,
  communeLongitude: 4.835659,
  departementPopulation: 1_000_000,
  nbCommunes: 3,
  regionNom: `Région ${prefix}`,
  departementNom: `Département ${prefix}`,
  communeNom: `Commune ${prefix}`,
  rueNom: `Rue ${prefix}`,
};
const createdUserIds: string[] = [];

interface CardDetailBody {
  population: number | null;
  nbCommunes: number | null;
  latitude: number | null;
  longitude: number | null;
  codeDepartement: string | null;
  nomDepartement: string | null;
  codeRegion: string | null;
  nomRegion: string | null;
}

interface CardBody {
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
  owner: { id: string; pseudo: string | null };
  detail: CardDetailBody;
  listing: { id: string; price: number; status: string; createdAt: string } | null;
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

/** Référentiel cohérent pour que `resolveCardNoms` et `resolveCardDetail` répondent. */
async function seedReference(): Promise<void> {
  await db
    .insertInto('ref_regions')
    .values({ code: seeded.regionCode, nom: seeded.regionNom })
    .execute();

  await db
    .insertInto('ref_departements')
    .values({
      code: seeded.departementCode,
      nom: seeded.departementNom,
      code_region: seeded.regionCode,
      population: seeded.departementPopulation,
    })
    .execute();

  await db
    .insertInto('ref_communes')
    .values({
      code_insee: seeded.communeCode,
      nom: seeded.communeNom,
      code_departement: seeded.departementCode,
      code_region: seeded.regionCode,
      population: seeded.communePopulation,
      latitude: seeded.communeLatitude,
      longitude: seeded.communeLongitude,
      rarete: 'COMMUNE',
      score_base: 100,
    })
    .execute();

  const odonyme = await db
    .insertInto('ref_odonymes')
    .values({
      nom_normalise: `${prefix}-rue-42`.toLowerCase(),
      nom_affichage: seeded.rueNom,
      nb_communes: seeded.nbCommunes,
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
  rarity: 'COMMUNE' | 'INHABITUELLE' | 'RARE' | 'EPIQUE' | 'LEGENDAIRE' | 'MYTHIQUE' = 'COMMUNE',
): Promise<string> {
  const row = await db
    .insertInto('user_cards')
    .values({
      user_id: userId,
      category,
      ref_code: refCodeFor(category),
      rarity,
      score,
      locked: false,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return row.id;
}

async function insertOpenListing(sellerId: string, cardId: string, price: number): Promise<string> {
  const row = await db
    .insertInto('market_listings')
    .values({ seller_id: sellerId, user_card_id: cardId, price })
    .returning('id')
    .executeTakeFirstOrThrow();
  return row.id;
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

describe('Phase 15 — fiche de carte (GDD §2.1 / Archi §4.2)', () => {
  it('Archi §4.2 — GET /cards/:id sans cookie renvoie 401 UNAUTHORIZED', async () => {
    const res = await authFetch(`/api/v1/cards/${crypto.randomUUID()}`);
    expect(res.status).toBe(401);
    expect(((await res.json()) as { code: string }).code).toBe('UNAUTHORIZED');
  });

  it('GDD §2.1 — un identifiant inconnu renvoie 404 CARD_NOT_FOUND', async () => {
    const { cookie } = await signUp();
    const res = await authFetch(`/api/v1/cards/${crypto.randomUUID()}`, {}, cookie);
    expect(res.status).toBe(404);
    expect(((await res.json()) as { code: string }).code).toBe('CARD_NOT_FOUND');
  });

  it('GDD §2.2 — la fiche d’une commune expose population, coordonnées et parents', async () => {
    const { cookie, userId } = await signUp();
    const cardId = await insertCard(userId, 'COMMUNE', 1_600);

    const res = await authFetch(`/api/v1/cards/${cardId}`, {}, cookie);
    expect(res.status).toBe(200);
    const { card } = (await res.json()) as { card: CardBody };

    expect(card.id).toBe(cardId);
    expect(card.category).toBe('COMMUNE');
    expect(card.refCode).toBe(seeded.communeCode);
    expect(card.nom).toBe(seeded.communeNom);
    expect(card.score).toBe(1_600);
    expect(card.rarity).toBe('COMMUNE');
    expect(typeof card.acquiredAt).toBe('string');
    expect(card.locked).toBe(false);
    expect(card.listing).toBeNull();
    expect(card.owner.id).toBe(userId);

    expect(card.detail.population).toBe(seeded.communePopulation);
    expect(card.detail.codeDepartement).toBe(seeded.departementCode);
    expect(card.detail.nomDepartement).toBe(seeded.departementNom);
    expect(card.detail.codeRegion).toBe(seeded.regionCode);
    expect(card.detail.nomRegion).toBe(seeded.regionNom);
    expect(card.detail.latitude).toBe(seeded.communeLatitude);
    expect(card.detail.longitude).toBe(seeded.communeLongitude);
    expect(card.detail.nbCommunes).toBeNull();
  });

  it('GDD §2.7 — la fiche d’une rue expose le nombre de communes et aucun parent', async () => {
    const { cookie, userId } = await signUp();
    const cardId = await insertCard(userId, 'RUE', 3_000);

    const res = await authFetch(`/api/v1/cards/${cardId}`, {}, cookie);
    expect(res.status).toBe(200);
    const { card } = (await res.json()) as { card: CardBody };

    expect(card.nom).toBe(seeded.rueNom);
    expect(card.refCode).toBe(seeded.odonymeId);
    expect(card.detail.nbCommunes).toBe(seeded.nbCommunes);
    expect(card.detail.population).toBeNull();
    expect(card.detail.latitude).toBeNull();
    expect(card.detail.longitude).toBeNull();
    expect(card.detail.codeDepartement).toBeNull();
    expect(card.detail.nomDepartement).toBeNull();
    expect(card.detail.codeRegion).toBeNull();
    expect(card.detail.nomRegion).toBeNull();
  });

  it('GDD §2.1 — la fiche d’une région n’a aucun détail', async () => {
    const { cookie, userId } = await signUp();
    const cardId = await insertCard(userId, 'REGION', 750);

    const res = await authFetch(`/api/v1/cards/${cardId}`, {}, cookie);
    expect(res.status).toBe(200);
    const { card } = (await res.json()) as { card: CardBody };

    expect(card.nom).toBe(seeded.regionNom);
    expect(card.detail).toEqual({
      population: null,
      nbCommunes: null,
      latitude: null,
      longitude: null,
      codeDepartement: null,
      nomDepartement: null,
      codeRegion: null,
      nomRegion: null,
    });
  });

  it('Archi §4.2 — la carte d’un autre sans annonce ouverte renvoie 403 CARD_NOT_VISIBLE', async () => {
    const owner = await signUp();
    const intruder = await signUp();
    const cardId = await insertCard(owner.userId, 'COMMUNE', 1_600);

    const res = await authFetch(`/api/v1/cards/${cardId}`, {}, intruder.cookie);
    expect(res.status).toBe(403);
    expect(((await res.json()) as { code: string }).code).toBe('CARD_NOT_VISIBLE');
  });

  it('Archi §4.2 — la carte d’un autre en vente reste consultable avec son annonce', async () => {
    const owner = await signUp();
    const visitor = await signUp();
    const cardId = await insertCard(owner.userId, 'COMMUNE', 1_600);
    const listingId = await insertOpenListing(owner.userId, cardId, 250);

    const res = await authFetch(`/api/v1/cards/${cardId}`, {}, visitor.cookie);
    expect(res.status).toBe(200);
    const { card } = (await res.json()) as { card: CardBody };

    expect(card.owner.id).toBe(owner.userId);
    expect(card.listing).not.toBeNull();
    expect(card.listing?.id).toBe(listingId);
    expect(card.listing?.price).toBe(250);
    expect(card.listing?.status).toBe('OPEN');
    expect(typeof card.listing?.createdAt).toBe('string');
    expect(card.detail.population).toBe(seeded.communePopulation);
  });
});
