import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { app } from '@hexamap/api/app';
import { loadPlayerProfile } from '@hexamap/api/services/profile';
import { type CardCategory, createDb, type Rarity, runMigrations, sql } from '@hexamap/db';

const db = createDb(process.env.DATABASE_URL ?? '');

const baseUrl = 'http://localhost:3000';
const origin = 'http://localhost:5174';
const prefix = crypto.randomUUID().slice(0, 8);
const createdUserIds: string[] = [];

interface SignUpResult {
  cookie: string;
  userId: string;
}

interface CompletenessRow {
  category: string;
  owned: number;
  total: number;
}

interface PlayerBestTableauSlotBody {
  category: string;
  refCode: string;
  rarity: string;
  score: number;
  nom: string;
  blasonUrl: string | null;
}

interface PlayerBody {
  id: string;
  pseudo: string;
  displayName: string;
  memberSince: string;
  bio: string | null;
  cardsOwned: number;
  completeness: CompletenessRow[];
  bestTableau: {
    id: string;
    name: string;
    score: number;
    multiplier: number;
    links: number;
    slots: (PlayerBestTableauSlotBody | null)[];
  } | null;
  achievements: string[];
  openListings: number;
  friendCount: number;
  friendState: string | null;
}

function extractSessionCookie(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(';')[0])
    .join('; ');
}

async function signUpRaw(pseudo: string): Promise<Response> {
  const email = `spec-${prefix}-${crypto.randomUUID()}@hexamap.test`;
  return app.handle(
    new Request(`${baseUrl}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin },
      body: JSON.stringify({
        email,
        password: 'motdepasse-123',
        name: 'Spec',
        pseudo,
      }),
    }),
  );
}

async function signUp(
  pseudo = `${prefix}-${crypto.randomUUID().slice(0, 6)}`,
): Promise<SignUpResult> {
  const res = await signUpRaw(pseudo);
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

async function insertCards(
  userId: string,
  category: 'REGION' | 'DEPARTEMENT',
  codes: string[],
): Promise<void> {
  for (const code of codes) {
    await sql`insert into user_cards (user_id, category, ref_code, rarity, score)
      values (${userId}, ${category}, ${code}, 'COMMUNE', 200)`.execute(db);
  }
}

/** Insère une carte et rend son identifiant, pour composer un tableau. */
async function insertCard(
  userId: string,
  category: CardCategory,
  refCode: string,
  rarity: Rarity,
  score: number,
): Promise<string> {
  const row = await db
    .insertInto('user_cards')
    .values({ user_id: userId, category, ref_code: refCode, rarity, score })
    .returning('id')
    .executeTakeFirstOrThrow();
  return row.id;
}

/** Insère un tableau ; un emplacement absent reste `null` (tableau troué). */
async function insertTableau(
  userId: string,
  cards: Partial<Record<CardCategory, string>>,
): Promise<string> {
  const row = await db
    .insertInto('tableaux')
    .values({
      user_id: userId,
      name: 'Tableau Spécimen',
      region_card_id: cards.REGION ?? null,
      departement_card_id: cards.DEPARTEMENT ?? null,
      commune_card_id: cards.COMMUNE ?? null,
      rue_card_id: cards.RUE ?? null,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return row.id;
}

/** Toutes les clés d'un JSON, objets et tableaux parcourus, en minuscules. */
function collectKeys(value: unknown, acc: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, acc);
    return acc;
  }
  if (value !== null && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      acc.push(key.toLowerCase());
      collectKeys(child, acc);
    }
  }
  return acc;
}

const FORBIDDEN_KEYS = [
  'email',
  'currency',
  'session',
  'account',
  'locked',
  'grid',
  'treasure_index',
  'userid',
];

/** Référentiel préfixé semé pour les quatre planches, et nettoyé avant les comptes. */
let odonymeId = '';
/** Identifiants des deux joueurs à tableau, capturés pour le cas de la requête unique. */
let completeTableauUserId: string | null = null;
let holeTableauUserId: string | null = null;

beforeAll(async () => {
  await runMigrations(db);

  await db
    .insertInto('ref_regions')
    .values({
      code: `${prefix}-R1`,
      nom: 'Région Spécimen',
      blason_url: '/blasons/regions/x.svg',
      contour_url: null,
      blason_credit: 'CC0 · Spec · Wikimedia Commons',
    })
    .execute();

  await db
    .insertInto('ref_departements')
    .values({
      code: `${prefix}-D1`,
      nom: 'Département Spécimen',
      code_region: `${prefix}-R1`,
      population: 1000,
      blason_url: '/blasons/departements/x.svg',
      contour_url: null,
      blason_credit: 'CC0 · Spec · Wikimedia Commons',
    })
    .execute();

  await db
    .insertInto('ref_communes')
    .values({
      code_insee: `${prefix}-C1`,
      nom: 'Commune Spécimen',
      code_departement: `${prefix}-D1`,
      code_region: `${prefix}-R1`,
      population: 5000,
      rarete: 'RARE',
      score_base: 900,
      blason_url: null,
      contour_url: '/blasons/contours/communes/x.svg',
      blason_credit: null,
    })
    .execute();

  const odonyme = await db
    .insertInto('ref_odonymes')
    .values({
      nom_normalise: `${prefix}-rue-specimen`,
      nom_affichage: 'Rue Spécimen',
      nb_communes: 10,
      rarete: 'EPIQUE',
      score_base: 1500,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  odonymeId = odonyme.id;

  await db
    .insertInto('commune_odonymes')
    .values({ code_insee: `${prefix}-C1`, odonyme_id: odonymeId })
    .execute();
});

afterAll(async () => {
  // Le référentiel part avant les comptes : les cartes le citent, même sans clé étrangère.
  await db.deleteFrom('commune_odonymes').where('code_insee', '=', `${prefix}-C1`).execute();
  await db
    .deleteFrom('ref_odonymes')
    .where('nom_normalise', '=', `${prefix}-rue-specimen`)
    .execute();
  await db.deleteFrom('ref_communes').where('code_insee', '=', `${prefix}-C1`).execute();
  await db.deleteFrom('ref_departements').where('code', '=', `${prefix}-D1`).execute();
  await db.deleteFrom('ref_regions').where('code', '=', `${prefix}-R1`).execute();

  if (createdUserIds.length > 0) {
    await db.deleteFrom('user').where('id', 'in', createdUserIds).execute();
  }
  await db.destroy();
});

describe('Profil §2.9 — la vitrine publique', () => {
  it('Profil §2.9 — la projection ne contient aucun champ interdit', async () => {
    const owner = await signUp();
    const viewer = await signUp();
    await insertCards(owner.userId, 'REGION', [`${prefix}-proj-84`]);

    const res = await authFetch(`/api/v1/players/${owner.userId}`, {}, viewer.cookie);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { player: PlayerBody };
    expect(body.player.id).toBe(owner.userId);

    const keys = collectKeys(body);
    for (const forbidden of FORBIDDEN_KEYS) {
      expect(keys).not.toContain(forbidden);
    }
  });

  it('Profil §2.9 — une vitrine privée répond 404, jamais 403', async () => {
    const owner = await signUp();
    const viewer = await signUp();

    const patch = await authFetch(
      '/api/v1/profile',
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ profilePublic: false }),
      },
      owner.cookie,
    );
    expect(patch.status).toBe(200);

    const hidden = await authFetch(`/api/v1/players/${owner.userId}`, {}, viewer.cookie);
    expect(hidden.status).toBe(404);
    const hiddenBody = (await hidden.json()) as { code: string };
    expect(hiddenBody.code).toBe('PLAYER_NOT_FOUND');

    const self = await authFetch(`/api/v1/players/${owner.userId}`, {}, owner.cookie);
    expect(self.status).toBe(200);
  });

  it('Profil §2.9 — la complétude par catégorie est exacte', async () => {
    const owner = await signUp();
    const viewer = await signUp();
    await insertCards(owner.userId, 'REGION', [`${prefix}-a-84`, `${prefix}-b-84`]);
    await insertCards(owner.userId, 'DEPARTEMENT', [
      `${prefix}-a-69`,
      `${prefix}-b-69`,
      `${prefix}-c-69`,
    ]);

    const res = await authFetch(`/api/v1/players/${owner.userId}`, {}, viewer.cookie);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { player: PlayerBody };

    const region = body.player.completeness.find((row) => row.category === 'REGION');
    expect(region?.owned).toBe(2);
    expect(region?.total).toBe(18);

    const departement = body.player.completeness.find((row) => row.category === 'DEPARTEMENT');
    expect(departement?.owned).toBe(3);
    expect(departement?.total).toBe(101);
  });

  it('Profil §2.9 — deux pseudos identiques à la casse près sont refusés', async () => {
    const suffix = crypto.randomUUID().slice(0, 8);
    const first = await signUpRaw(`Pseudo-${suffix}`);
    expect(first.status).toBeGreaterThanOrEqual(200);
    expect(first.status).toBeLessThan(300);
    const created = (await first.json()) as { user: { id: string } };
    createdUserIds.push(created.user.id);

    const second = await signUpRaw(`pseudo-${suffix}`);
    expect(second.status).toBeGreaterThanOrEqual(400);
    expect(second.status).toBeLessThan(500);
  });

  it('Profil §2.9 — un pseudo hors de 3 à 24 caractères est refusé', async () => {
    const tooShort = await signUpRaw('ab');
    expect(tooShort.status).toBeGreaterThanOrEqual(400);
    expect(tooShort.status).toBeLessThan(500);

    const tooLong = await signUpRaw('a'.repeat(25));
    expect(tooLong.status).toBeGreaterThanOrEqual(400);
    expect(tooLong.status).toBeLessThan(500);
  });

  it('Profil §2.9 — un identifiant inconnu répond 404', async () => {
    const viewer = await signUp();
    const res = await authFetch(`/api/v1/players/${crypto.randomUUID()}`, {}, viewer.cookie);
    expect(res.status).toBe(404);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('PLAYER_NOT_FOUND');
  });

  it('Profil §2.9 — le propriétaire règle sa bio et sa visibilité', async () => {
    const owner = await signUp();
    const viewer = await signUp();

    const patch = await authFetch(
      '/api/v1/profile',
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ bio: 'Cartographe du dimanche' }),
      },
      owner.cookie,
    );
    expect(patch.status).toBe(200);

    const res = await authFetch(`/api/v1/players/${owner.userId}`, {}, viewer.cookie);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { player: PlayerBody };
    expect(body.player.bio).toBe('Cartographe du dimanche');
  });

  it('Profil §2.9 — le meilleur tableau expose ses quatre planches', async () => {
    const owner = await signUp();
    const viewer = await signUp();

    const regionCard = await insertCard(owner.userId, 'REGION', `${prefix}-R1`, 'RARE', 750);
    const departementCard = await insertCard(
      owner.userId,
      'DEPARTEMENT',
      `${prefix}-D1`,
      'EPIQUE',
      1250,
    );
    const communeCard = await insertCard(owner.userId, 'COMMUNE', `${prefix}-C1`, 'RARE', 900);
    const rueCard = await insertCard(owner.userId, 'RUE', odonymeId, 'EPIQUE', 1500);
    completeTableauUserId = owner.userId;
    await insertTableau(owner.userId, {
      REGION: regionCard,
      DEPARTEMENT: departementCard,
      COMMUNE: communeCard,
      RUE: rueCard,
    });

    const res = await authFetch(`/api/v1/players/${owner.userId}`, {}, viewer.cookie);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { player: PlayerBody };
    const best = body.player.bestTableau;
    expect(best).not.toBeNull();
    if (!best) throw new Error('le meilleur tableau devrait être rendu');

    expect(best.slots).toHaveLength(4);
    expect(best.slots.map((slot) => slot?.category)).toEqual([
      'REGION',
      'DEPARTEMENT',
      'COMMUNE',
      'RUE',
    ]);
    for (const slot of best.slots) {
      expect(slot).not.toBeNull();
      expect(typeof slot?.rarity).toBe('string');
      expect(slot?.rarity).not.toBe('');
      expect(typeof slot?.score).toBe('number');
      expect(slot?.refCode).not.toBe('');
    }
    expect(best.slots[0]?.nom).toBe('Région Spécimen');
    expect(best.slots[2]?.nom).toBe('Commune Spécimen');
    expect(best.slots[3]?.nom).toBe('Rue Spécimen');
    expect(best.slots[0]?.blasonUrl).toBe('/blasons/regions/x.svg');
    // La commune n'a pas de blason : `blasonOf` replie sur le contour.
    expect(best.slots[2]?.blasonUrl).toBe('/blasons/contours/communes/x.svg');
    // Une rue ne porte aucune image.
    expect(best.slots[3]?.blasonUrl).toBeNull();
  });

  it('Profil §2.9 — un tableau troué rend quatre positions dont des nulles', async () => {
    const owner = await signUp();
    const viewer = await signUp();

    const communeCard = await insertCard(owner.userId, 'COMMUNE', `${prefix}-C1`, 'RARE', 900);
    holeTableauUserId = owner.userId;
    await insertTableau(owner.userId, { COMMUNE: communeCard });

    const res = await authFetch(`/api/v1/players/${owner.userId}`, {}, viewer.cookie);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { player: PlayerBody };
    const best = body.player.bestTableau;
    expect(best).not.toBeNull();
    if (!best) throw new Error('un tableau troué reste un tableau');

    expect(best.slots).toHaveLength(4);
    expect(best.slots[0]).toBeNull();
    expect(best.slots[1]).toBeNull();
    expect(best.slots[2]?.nom).toBe('Commune Spécimen');
    expect(best.slots[3]).toBeNull();
  });

  it('Profil §2.9 — sans tableau, le meilleur tableau reste nul', async () => {
    const owner = await signUp();
    const viewer = await signUp();

    const res = await authFetch(`/api/v1/players/${owner.userId}`, {}, viewer.cookie);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { player: PlayerBody };
    expect(body.player.bestTableau).toBeNull();
  });

  it('Profil §2.9 — la planche ne porte aucune donnée privée', async () => {
    expect(completeTableauUserId).not.toBeNull();
    if (!completeTableauUserId) {
      throw new Error('le cas des quatre planches doit avoir semé son joueur');
    }
    const viewer = await signUp();

    const res = await authFetch(`/api/v1/players/${completeTableauUserId}`, {}, viewer.cookie);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { player: PlayerBody };
    // Le cas historique tourne sur un joueur sans tableau : ici `slots` est peuplé.
    expect(body.player.bestTableau?.slots).toHaveLength(4);

    const keys = collectKeys(body);
    for (const forbidden of FORBIDDEN_KEYS) {
      expect(keys).not.toContain(forbidden);
    }
    for (const extra of ['balance', 'token', 'role']) {
      expect(keys).not.toContain(extra);
    }
  });

  it('Profil §2.9 — les quatre emplacements coûtent une seule instruction', async () => {
    expect(completeTableauUserId).not.toBeNull();
    expect(holeTableauUserId).not.toBeNull();
    if (!completeTableauUserId || !holeTableauUserId) {
      throw new Error('les deux joueurs à tableau doivent être semés par les cas précédents');
    }

    const statements: string[] = [];
    const loggedDb = createDb(process.env.DATABASE_URL ?? '', {
      log: (event) => {
        if (event.level === 'query') statements.push(event.query.sql);
      },
    });

    try {
      const complete = await loadPlayerProfile(loggedDb, completeTableauUserId, null);
      expect(complete?.bestTableau?.slots).toHaveLength(4);
      const completeCount = statements.filter((statement) =>
        statement.includes('showcase_slots'),
      ).length;
      expect(completeCount).toBe(1);

      // Un tableau à une carte coûte exactement la même instruction : il n'y a
      // pas de requête par emplacement.
      statements.length = 0;
      const holed = await loadPlayerProfile(loggedDb, holeTableauUserId, null);
      expect(holed?.bestTableau).not.toBeNull();
      const holedCount = statements.filter((statement) =>
        statement.includes('showcase_slots'),
      ).length;
      expect(holedCount).toBe(1);
    } finally {
      await loggedDb.destroy();
    }
  });
});
