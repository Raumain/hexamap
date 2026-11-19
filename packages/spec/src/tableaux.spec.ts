import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { app } from '@hexamap/api/app';
import { createDb, runMigrations } from '@hexamap/db';
import { alignmentMultiplier, type Category, tableauScore } from '@hexamap/shared';

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

// Scores choisis pour le chemin heureux. La parité de score est vérifiée par
// `tableauScore` (jamais recopiée en dur) : total = (200+400+900+1000) * 5.
const SCORES = { region: 200, departement: 400, commune: 900, rue: 1000 };
const EXPECTED_TOTAL = tableauScore(SCORES, 3);

interface CardSet {
  region: string;
  departement: string;
  commune: string;
  rue: string;
}

interface TableauSlotCard {
  id: string;
  category: Category;
  refCode: string;
  nom: string;
  rarity: string;
  score: number;
  locked: boolean;
  slot: string;
}

interface AlignmentBody {
  links: number;
  multiplier: number;
  breakdown: { key: string; valid: boolean; label: string }[];
}

interface CreatedTableau {
  id: string;
  name: string;
  createdAt: string;
  cards: {
    region: TableauSlotCard;
    departement: TableauSlotCard;
    commune: TableauSlotCard;
    rue: TableauSlotCard;
  };
  alignment: AlignmentBody;
  total: number;
}

interface PreviewBody {
  geography: Record<string, unknown>;
  alignment: AlignmentBody;
  total: number | null;
  complete: boolean;
}

interface TableauListItem {
  id: string;
  name: string;
  createdAt: string;
  complete: boolean;
  total: number;
  alignment: AlignmentBody;
  cards: {
    region: TableauSlotCard | null;
    departement: TableauSlotCard | null;
    commune: TableauSlotCard | null;
    rue: TableauSlotCard | null;
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

/** Référentiel cohérent : une chaîne région → département → commune → odonyme
 *  reliée, de sorte que les 3 liens de l'alignement soient valides. */
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

async function insertCardSet(userId: string): Promise<CardSet> {
  const [region, departement, commune, rue] = await Promise.all([
    insertCard(userId, 'REGION', SCORES.region),
    insertCard(userId, 'DEPARTEMENT', SCORES.departement),
    insertCard(userId, 'COMMUNE', SCORES.commune),
    insertCard(userId, 'RUE', SCORES.rue),
  ]);
  return { region, departement, commune, rue };
}

async function countTableaux(userId?: string): Promise<number> {
  if (userId) {
    const row = await db
      .selectFrom('tableaux')
      .select(db.fn.countAll().as('total'))
      .where('user_id', '=', userId)
      .executeTakeFirstOrThrow();
    return Number(row.total);
  }
  const row = await db
    .selectFrom('tableaux')
    .select(db.fn.countAll().as('total'))
    .executeTakeFirstOrThrow();
  return Number(row.total);
}

async function postTableau(cookie: string, cards: CardSet, name?: string): Promise<Response> {
  const body: Record<string, unknown> = {
    regionCardId: cards.region,
    departementCardId: cards.departement,
    communeCardId: cards.commune,
    rueCardId: cards.rue,
  };
  if (name !== undefined) body.name = name;
  return authFetch(
    '/api/v1/tableaux',
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) },
    cookie,
  );
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

describe('Phase 8 — tableaux (GDD §3.C / architecture §2.5)', () => {
  it('GDD §3.C — POST /api/v1/tableaux sans cookie renvoie 401 sans rien insérer', async () => {
    const before = await countTableaux();
    const res = await authFetch('/api/v1/tableaux', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        regionCardId: crypto.randomUUID(),
        departementCardId: crypto.randomUUID(),
        communeCardId: crypto.randomUUID(),
        rueCardId: crypto.randomUUID(),
      }),
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('UNAUTHORIZED');
    expect(await countTableaux()).toBe(before);
  });

  it('Archi §2.5 — un id appartenant à un autre utilisateur renvoie 403 CARD_NOT_OWNED', async () => {
    const owner = await signUp();
    const intruder = await signUp();
    const set = await insertCardSet(owner.userId);
    const foreignRue = await insertCard(intruder.userId, 'RUE', SCORES.rue);

    const before = await countTableaux(owner.userId);

    const res = await postTableau(owner.cookie, { ...set, rue: foreignRue });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('CARD_NOT_OWNED');

    expect(await countTableaux(owner.userId)).toBe(before);
    expect(await countTableaux(intruder.userId)).toBe(0);
  });

  it('Archi §2.5 — une carte verrouillée appartenant à l’utilisateur renvoie 403', async () => {
    const { cookie, userId } = await signUp();
    const region = await insertCard(userId, 'REGION', SCORES.region);
    const departement = await insertCard(userId, 'DEPARTEMENT', SCORES.departement);
    const commune = await insertCard(userId, 'COMMUNE', SCORES.commune);
    const rue = await insertCard(userId, 'RUE', SCORES.rue, true);

    const before = await countTableaux(userId);

    const res = await postTableau(cookie, { region, departement, commune, rue });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('CARD_NOT_OWNED');
    expect(await countTableaux(userId)).toBe(before);
  });

  it('GDD §3.C — une carte COMMUNE passée dans le slot REGION renvoie 400 INVALID_CARD_SET', async () => {
    const { cookie, userId } = await signUp();
    const departement = await insertCard(userId, 'DEPARTEMENT', SCORES.departement);
    const communeA = await insertCard(userId, 'COMMUNE', SCORES.commune);
    const communeB = await insertCard(userId, 'COMMUNE', SCORES.commune);
    const rue = await insertCard(userId, 'RUE', SCORES.rue);

    const before = await countTableaux(userId);

    const res = await postTableau(cookie, {
      region: communeB,
      departement,
      commune: communeA,
      rue,
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('INVALID_CARD_SET');
    expect(await countTableaux(userId)).toBe(before);
  });

  it('GDD §3.C — des ids dupliqués renvoient 400 INVALID_CARD_SET', async () => {
    const { cookie, userId } = await signUp();
    const set = await insertCardSet(userId);

    const before = await countTableaux(userId);

    const res = await postTableau(cookie, {
      region: set.region,
      departement: set.region,
      commune: set.commune,
      rue: set.rue,
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('INVALID_CARD_SET');
    expect(await countTableaux(userId)).toBe(before);
  });

  it('GDD §3.C — POST /api/v1/tableaux crée un tableau dont le score respecte tableauScore', async () => {
    const { cookie, userId } = await signUp();
    const set = await insertCardSet(userId);

    const res = await postTableau(cookie, set, 'Mon beau tableau');
    expect(res.status).toBe(201);

    const body = (await res.json()) as { tableau: CreatedTableau };
    const { tableau } = body;
    expect(tableau.name).toBe('Mon beau tableau');
    expect(tableau.cards.region.id).toBe(set.region);
    expect(tableau.cards.departement.id).toBe(set.departement);
    expect(tableau.cards.commune.id).toBe(set.commune);
    expect(tableau.cards.rue.id).toBe(set.rue);

    expect(tableau.alignment.links).toBe(3);
    expect(tableau.alignment.multiplier).toBe(5);
    expect(tableau.total).toBe(EXPECTED_TOTAL);

    const row = await db
      .selectFrom('tableaux')
      .select(['region_card_id', 'departement_card_id', 'commune_card_id', 'rue_card_id'])
      .where('user_id', '=', userId)
      .executeTakeFirstOrThrow();
    expect(row.region_card_id).toBe(set.region);
    expect(row.departement_card_id).toBe(set.departement);
    expect(row.commune_card_id).toBe(set.commune);
    expect(row.rue_card_id).toBe(set.rue);
  });

  it('GDD §3.C — rejouer le même POST renvoie 409 CARD_IN_USE sans dupliquer', async () => {
    const { cookie, userId } = await signUp();
    const set = await insertCardSet(userId);

    const first = await postTableau(cookie, set);
    expect(first.status).toBe(201);

    const second = await postTableau(cookie, set);
    expect(second.status).toBe(409);
    const body = (await second.json()) as { code: string };
    expect(body.code).toBe('CARD_IN_USE');

    expect(await countTableaux(userId)).toBe(1);
  });

  it('GDD §3.C — GET preview avec 2 cartes renvoie complete=false et total=null', async () => {
    const { cookie, userId } = await signUp();
    const region = await insertCard(userId, 'REGION', SCORES.region);
    const departement = await insertCard(userId, 'DEPARTEMENT', SCORES.departement);

    const res = await authFetch(
      `/api/v1/tableaux/preview?regionCardId=${region}&departementCardId=${departement}`,
      {},
      cookie,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as PreviewBody;
    expect(body.complete).toBe(false);
    expect(body.total).toBeNull();
    expect(body.alignment.links).toBe(1);
    expect(body.alignment.links).toBeLessThan(3);
  });

  it('GDD §3.C — GET preview avec les 4 cartes renvoie le score aligné', async () => {
    const { cookie, userId } = await signUp();
    const set = await insertCardSet(userId);

    const query = [
      `regionCardId=${set.region}`,
      `departementCardId=${set.departement}`,
      `communeCardId=${set.commune}`,
      `rueCardId=${set.rue}`,
    ].join('&');

    const res = await authFetch(`/api/v1/tableaux/preview?${query}`, {}, cookie);
    expect(res.status).toBe(200);
    const body = (await res.json()) as PreviewBody;
    expect(body.complete).toBe(true);
    expect(body.alignment.links).toBe(3);
    expect(body.alignment.multiplier).toBe(5);
    expect(body.total).toBe(EXPECTED_TOTAL);
  });

  it('Archi §2.5 — GET preview avec une carte d’un autre utilisateur renvoie 403', async () => {
    const owner = await signUp();
    const intruder = await signUp();
    const region = await insertCard(owner.userId, 'REGION', SCORES.region);
    const foreign = await insertCard(intruder.userId, 'DEPARTEMENT', SCORES.departement);

    const res = await authFetch(
      `/api/v1/tableaux/preview?regionCardId=${region}&departementCardId=${foreign}`,
      {},
      owner.cookie,
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('CARD_NOT_OWNED');
  });

  it('GDD §3.C — GET /api/v1/tableaux sans cookie renvoie 401', async () => {
    const res = await authFetch('/api/v1/tableaux');
    expect(res.status).toBe(401);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('UNAUTHORIZED');
  });

  it('GDD §3.C — GET /api/v1/tableaux sans tableau renvoie une liste vide', async () => {
    const { cookie } = await signUp();
    const res = await authFetch('/api/v1/tableaux', {}, cookie);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: TableauListItem[] };
    expect(body.items).toEqual([]);
  });

  it('GDD §3.C — GET /api/v1/tableaux liste les tableaux triés par total décroissant', async () => {
    const { cookie, userId } = await signUp();

    // Set complet : la chaîne référentielle rend les 3 liens valides.
    const setA = await insertCardSet(userId);

    // Set cassé : une région sans référence casse le lien region→département.
    const regionB = (
      await db
        .insertInto('user_cards')
        .values({
          user_id: userId,
          category: 'REGION',
          ref_code: `${prefix}-region-inconnue`,
          rarity: 'COMMUNE',
          score: SCORES.region,
          locked: false,
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    const departementB = await insertCard(userId, 'DEPARTEMENT', SCORES.departement);
    const communeB = await insertCard(userId, 'COMMUNE', SCORES.commune);
    const rueB = await insertCard(userId, 'RUE', SCORES.rue);

    const resA = await postTableau(cookie, setA, 'Tableau complet');
    expect(resA.status).toBe(201);
    const resB = await postTableau(
      cookie,
      { region: regionB, departement: departementB, commune: communeB, rue: rueB },
      'Tableau cassé',
    );
    expect(resB.status).toBe(201);

    const res = await authFetch('/api/v1/tableaux', {}, cookie);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: TableauListItem[] };
    expect(body.items).toHaveLength(2);

    // Tri par total décroissant.
    const totals = body.items.map((item) => item.total);
    expect([...totals].sort((a, b) => b - a)).toEqual(totals);

    const [first, second] = body.items;
    if (first === undefined || second === undefined) {
      throw new Error('attendu deux tableaux dans la liste');
    }

    // Le tableau complet (3 liens) précède le tableau cassé (2 liens).
    expect(first.name).toBe('Tableau complet');
    expect(first.alignment.links).toBe(3);
    expect(second.name).toBe('Tableau cassé');
    expect(second.alignment.links).toBe(2);

    // Score et multiplicateur dérivés uniquement de @hexamap/shared.
    for (const item of [first, second]) {
      expect(item.total).toBe(tableauScore(SCORES, item.alignment.links));
      expect(item.alignment.multiplier).toBe(alignmentMultiplier(item.alignment.links));
      expect(item.complete).toBe(true);
    }
  });

  it('Archi §2.5 — GET /api/v1/tableaux ne renvoie jamais les tableaux d’un autre utilisateur', async () => {
    const owner = await signUp();
    const intruder = await signUp();

    const ownerSet = await insertCardSet(owner.userId);
    const intruderSet = await insertCardSet(intruder.userId);

    const resOwner = await postTableau(owner.cookie, ownerSet, 'Tableau du propriétaire');
    expect(resOwner.status).toBe(201);
    const resIntruder = await postTableau(intruder.cookie, intruderSet, 'Tableau de l’intrus');
    expect(resIntruder.status).toBe(201);

    const res = await authFetch('/api/v1/tableaux', {}, owner.cookie);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: TableauListItem[] };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.name).toBe('Tableau du propriétaire');
  });

  it('Archi §2.5 — un tableau partiel est listé sans crasher (complete=false)', async () => {
    const { cookie, userId } = await signUp();
    const region = await insertCard(userId, 'REGION', SCORES.region);

    await db
      .insertInto('tableaux')
      .values({
        user_id: userId,
        name: 'Tableau partiel',
        region_card_id: region,
        departement_card_id: null,
        commune_card_id: null,
        rue_card_id: null,
      })
      .execute();

    const res = await authFetch('/api/v1/tableaux', {}, cookie);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: TableauListItem[] };
    expect(body.items).toHaveLength(1);

    const item = body.items[0];
    if (item === undefined) {
      throw new Error('attendu un tableau dans la liste');
    }

    expect(item.complete).toBe(false);
    expect(item.cards.region).not.toBeNull();
    expect(item.cards.departement).toBeNull();
    expect(item.cards.commune).toBeNull();
    expect(item.cards.rue).toBeNull();
  });
});
