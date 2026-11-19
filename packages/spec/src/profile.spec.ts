import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { app } from '@hexamap/api/app';
import { createDb, runMigrations, sql } from '@hexamap/db';

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

beforeAll(async () => {
  await runMigrations(db);
});

afterAll(async () => {
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
});
