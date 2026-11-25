import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { app } from '@hexamap/api/app';
import { createDb, runMigrations } from '@hexamap/db';
import { POSTAL_CODE_PATTERN, principalPostalCode } from '@hexamap/shared';

// Phase 55 — I-002, « trier les cartes par code postal ».
//
// `geo.api.gouv.fr` publie `codesPostaux` en tableau, dans un ordre qui n'est pas
// documenté par l'API, et ne désigne aucun code comme « principal ». La règle du
// produit est donc : le **premier** code à cinq chiffres non vide du tableau, et
// rien d'autre. Aucun tri, aucune préférence pour un code plus petit : l'ordre de
// la source est conservé, pour qu'un réimport ne fasse pas changer la valeur d'une
// carte déjà possédée.
describe('Phase 55 — le code postal principal', () => {
  it('un code à cinq chiffres est accepté tel quel', () => {
    expect(principalPostalCode(['75001'])).toBe('75001');
  });

  it('le premier code valide gagne, dans l’ordre de la source', () => {
    expect(principalPostalCode(['13001', '13002', '13003'])).toBe('13001');
    expect(principalPostalCode(['69123', '69001'])).toBe('69123');
  });

  it('les entrées qui ne sont pas des codes à cinq chiffres sont ignorées', () => {
    expect(principalPostalCode(['', '750', '750011', 'abcde', '75001'])).toBe('75001');
  });

  it('les entrées non textuelles sont ignorées', () => {
    expect(principalPostalCode([75001, null, undefined, { code: '75001' }, '01000'])).toBe('01000');
  });

  it('un tableau vide, absent ou d’une autre forme rend null', () => {
    expect(principalPostalCode([])).toBeNull();
    expect(principalPostalCode(undefined)).toBeNull();
    expect(principalPostalCode(null)).toBeNull();
    expect(principalPostalCode('75001')).toBeNull();
    expect(principalPostalCode({ 0: '75001' })).toBeNull();
  });

  it('un tableau sans aucun code valide rend null', () => {
    expect(principalPostalCode(['750', 'abcde', ''])).toBeNull();
  });

  it('aucun code ne se convertit : un entier ou une chaîne vide ne valent pas un code', () => {
    expect(principalPostalCode([96800])).toBeNull();
  });

  it('le motif verrouille exactement cinq chiffres', () => {
    expect(POSTAL_CODE_PATTERN.test('01000')).toBe(true);
    expect(POSTAL_CODE_PATTERN.test('2A004')).toBe(false);
    expect(POSTAL_CODE_PATTERN.test('7500')).toBe(false);
    expect(POSTAL_CODE_PATTERN.test('750011')).toBe(false);
    expect(POSTAL_CODE_PATTERN.test(' 75001')).toBe(false);
  });
});

// --- la route : `GET /api/v1/cards` porte `codePostal` -----------------------

const db = createDb(process.env.DATABASE_URL ?? '');
const baseUrl = 'http://localhost:3000';
const origin = 'http://localhost:5174';
const prefix = crypto.randomUUID().slice(0, 8);

const seeded = {
  regionCode: `${prefix}-R1`,
  departementCode: `${prefix}-D1`,
  communeCode: `${prefix}-C1`,
  communeSansCode: `${prefix}-C2`,
  codePostal: '13100',
};

const createdUserIds: string[] = [];

interface CardBody {
  category: string;
  refCode: string;
  codePostal: string | null;
}

function extractSessionCookie(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(';')[0])
    .join('; ');
}

async function signUp(): Promise<{ cookie: string; userId: string }> {
  const email = `spec-postal-${prefix}-${crypto.randomUUID()}@hexamap.test`;
  const res = await app.handle(
    new Request(`${baseUrl}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin },
      body: JSON.stringify({
        email,
        password: 'motdepasse-123',
        name: 'Spec',
        pseudo: `postal-${prefix}-${crypto.randomUUID().slice(0, 6)}`,
      }),
    }),
  );
  expect(res.status).toBeGreaterThanOrEqual(200);
  expect(res.status).toBeLessThan(300);
  const body = (await res.json()) as { user: { id: string } };
  createdUserIds.push(body.user.id);
  return { cookie: extractSessionCookie(res), userId: body.user.id };
}

async function authFetch(path: string, cookie: string): Promise<Response> {
  return app.handle(new Request(`${baseUrl}${path}`, { headers: { origin, cookie } }));
}

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
    .values([
      {
        code_insee: seeded.communeCode,
        nom: `Commune ${prefix}`,
        code_departement: seeded.departementCode,
        code_region: seeded.regionCode,
        population: 10_000,
        rarete: 'COMMUNE',
        score_base: 1_600,
        code_postal: seeded.codePostal,
      },
      {
        code_insee: seeded.communeSansCode,
        nom: `Commune sans code ${prefix}`,
        code_departement: seeded.departementCode,
        code_region: seeded.regionCode,
        population: 500,
        rarete: 'COMMUNE',
        score_base: 300,
      },
    ])
    .execute();
}

async function insertCard(
  userId: string,
  category: 'REGION' | 'COMMUNE',
  refCode: string,
): Promise<void> {
  await db
    .insertInto('user_cards')
    .values({ user_id: userId, category, ref_code: refCode, rarity: 'COMMUNE', score: 100 })
    .execute();
}

beforeAll(async () => {
  await runMigrations(db);
  await seedReference();
});

afterAll(async () => {
  await db
    .deleteFrom('ref_communes')
    .where('code_insee', 'in', [seeded.communeCode, seeded.communeSansCode])
    .execute();
  await db.deleteFrom('ref_departements').where('code', '=', seeded.departementCode).execute();
  await db.deleteFrom('ref_regions').where('code', '=', seeded.regionCode).execute();
  if (createdUserIds.length > 0) {
    await db.deleteFrom('user').where('id', 'in', createdUserIds).execute();
  }
  await db.destroy();
});

describe('Phase 55 — GET /api/v1/cards porte le code postal', () => {
  it('rend le code postal d’une commune et null pour les trois autres catégories', async () => {
    const { cookie, userId } = await signUp();
    await insertCard(userId, 'REGION', seeded.regionCode);
    await insertCard(userId, 'COMMUNE', seeded.communeCode);

    const res = await authFetch('/api/v1/cards?limit=100', cookie);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: CardBody[] };

    const region = body.items.find((item) => item.category === 'REGION');
    const commune = body.items.find((item) => item.category === 'COMMUNE');

    expect(region, 'La carte Région est absente de la réponse').toBeDefined();
    expect(commune, 'La carte Commune est absente de la réponse').toBeDefined();
    expect(commune?.codePostal).toBe(seeded.codePostal);
    expect(region?.codePostal).toBeNull();
  });

  it('rend null pour une commune dont le référentiel n’a pas de code', async () => {
    const { cookie, userId } = await signUp();
    await insertCard(userId, 'COMMUNE', seeded.communeSansCode);

    const res = await authFetch('/api/v1/cards?limit=100', cookie);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: CardBody[] };

    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.codePostal).toBeNull();
  });
});
