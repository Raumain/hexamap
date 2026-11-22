import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { app } from '@hexamap/api/app';
import { createDb, runMigrations, sql } from '@hexamap/db';
import {
  type Category,
  type IsoWeek,
  isoWeekLabel,
  isoWeekOf,
  isoWeekRange,
  tableauScore,
} from '@hexamap/shared';

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

/** Scores du jeu de référence : la chaîne est complète, donc 3 liens valides. */
const SCORES = { region: 200, departement: 400, commune: 900, rue: 1000 };

interface CardSet {
  region: string;
  departement: string;
  commune: string;
  rue: string;
}

interface CreatedTableau {
  id: string;
  name: string;
  createdAt: string;
  total: number;
  alignment: { links: number; multiplier: number };
}

interface PalmaresItem {
  rank: number;
  tableauId: string;
  name: string;
  score: number;
  createdAt: string;
  yours: boolean;
  player: { id: string; pseudo: string; profilePublic: boolean };
  cards: { cardId: string; category: Category; nom: string }[];
}

interface PalmaresBody {
  week: string;
  weekStart: string;
  weekEnd: string;
  current: boolean;
  total: number;
  items: PalmaresItem[];
}

function requireRange(week: IsoWeek): { start: Date; end: Date } {
  const range = isoWeekRange(week);
  if (range === null) {
    throw new Error(`semaine attendue valide : ${isoWeekLabel(week)}`);
  }
  return range;
}

function extractSessionCookie(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(';')[0])
    .join('; ');
}

async function signUp(): Promise<{ cookie: string; userId: string }> {
  const email = `palmares-${prefix}-${crypto.randomUUID()}@hexamap.test`;
  const res = await app.handle(
    new Request(`${baseUrl}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin },
      body: JSON.stringify({
        email,
        password: 'motdepasse-123',
        name: 'Spec',
        pseudo: `${prefix}-p-${crypto.randomUUID().slice(0, 6)}`,
      }),
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

/** Une chaîne région → département → commune → odonyme reliée : les 3 liens sont valides. */
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
      nom_normalise: `${prefix}-rue-palmares`.toLowerCase(),
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

async function insertCard(userId: string, category: Category, score: number): Promise<string> {
  const row = await db
    .insertInto('user_cards')
    .values({
      user_id: userId,
      category,
      ref_code: refCodeFor(category),
      rarity: 'COMMUNE',
      score,
      locked: false,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return row.id;
}

async function insertCardSet(
  userId: string,
  scores: { region: number; departement: number; commune: number; rue: number } = SCORES,
): Promise<CardSet> {
  const [region, departement, commune, rue] = await Promise.all([
    insertCard(userId, 'REGION', scores.region),
    insertCard(userId, 'DEPARTEMENT', scores.departement),
    insertCard(userId, 'COMMUNE', scores.commune),
    insertCard(userId, 'RUE', scores.rue),
  ]);
  return { region, departement, commune, rue };
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

/** Soumet un tableau et rend son corps : le POST vaut 201, sinon la spec échoue ici. */
async function submitTableau(
  cookie: string,
  cards: CardSet,
  name?: string,
): Promise<CreatedTableau> {
  const res = await postTableau(cookie, cards, name);
  expect(res.status).toBe(201);
  const body = (await res.json()) as { tableau: CreatedTableau };
  return body.tableau;
}

async function getPalmares(cookie: string | undefined, query = ''): Promise<Response> {
  return authFetch(`/api/v1/palmares${query}`, {}, cookie);
}

async function readPalmares(res: Response): Promise<PalmaresBody> {
  expect(res.status).toBe(200);
  return (await res.json()) as PalmaresBody;
}

async function forceCreatedAt(tableauId: string, date: Date): Promise<void> {
  await db.updateTable('tableaux').set({ created_at: date }).where('id', '=', tableauId).execute();
}

/** `tableaux.score` est typé dans `packages/db/src/schema.ts` : lecture Kysely, pas de SQL brut. */
async function readTableauScore(tableauId: string): Promise<number> {
  const row = await db
    .selectFrom('tableaux')
    .select('score')
    .where('id', '=', tableauId)
    .executeTakeFirstOrThrow();
  return row.score;
}

function rankOf(body: PalmaresBody, tableauId: string): number | undefined {
  return body.items.find((item) => item.tableauId === tableauId)?.rank;
}

function idsOf(body: PalmaresBody): string[] {
  return body.items.map((item) => item.tableauId);
}

beforeAll(async () => {
  await runMigrations(db);
  await seedReference();
});

afterAll(async () => {
  if (createdUserIds.length > 0) {
    await db.deleteFrom('tableaux').where('user_id', 'in', createdUserIds).execute();
    await db.deleteFrom('user').where('id', 'in', createdUserIds).execute();
  }
  if (seeded.odonymeId !== '') {
    await db.deleteFrom('commune_odonymes').where('odonyme_id', '=', seeded.odonymeId).execute();
    await db.deleteFrom('ref_odonymes').where('id', '=', seeded.odonymeId).execute();
  }
  await db.deleteFrom('ref_communes').where('code_insee', '=', seeded.communeCode).execute();
  await db.deleteFrom('ref_departements').where('code', '=', seeded.departementCode).execute();
  await db.deleteFrom('ref_regions').where('code', '=', seeded.regionCode).execute();
  await db.destroy();
});

describe('Phase 42 — la semaine ISO (GDD §3.C / archi §2.5)', () => {
  it('Archi §2.5 — un dimanche soir appartient encore à sa semaine', () => {
    expect(isoWeekOf(new Date('2026-11-22T23:30:00Z'))).toEqual({ year: 2026, week: 47 });
  });

  it('Archi §2.5 — le lundi 00:00:00.000 ouvre la semaine, la seconde d’avant la ferme', () => {
    const sunday = isoWeekOf(new Date('2026-11-22T23:30:00Z'));
    expect(isoWeekOf(new Date('2026-11-16T00:00:00Z'))).toEqual(sunday);
    expect(isoWeekOf(new Date('2026-11-15T23:59:59.999Z'))).toEqual({ year: 2026, week: 46 });
  });

  it('Archi §2.5 — l’année ISO est celle du jeudi, pas celle du calendrier', () => {
    expect(isoWeekOf(new Date('2027-01-01T12:00:00Z'))).toEqual({ year: 2026, week: 53 });
  });

  it('Archi §2.5 — une semaine dure sept jours et finit au lundi suivant, exclu', () => {
    const range = requireRange({ year: 2026, week: 53 });
    expect(range.start.toISOString()).toBe('2026-12-28T00:00:00.000Z');
    expect(range.end.toISOString()).toBe('2027-01-04T00:00:00.000Z');
    expect(range.end.getTime() - range.start.getTime()).toBe(7 * 86_400_000);
    expect(isoWeekOf(range.start)).toEqual({ year: 2026, week: 53 });
    expect(isoWeekOf(new Date(range.end.getTime() - 1))).toEqual({ year: 2026, week: 53 });
  });

  it('Archi §2.5 — une semaine inexistante vaut null', () => {
    expect(isoWeekRange({ year: 2027, week: 53 })).toBeNull();
    expect(isoWeekRange({ year: 2026, week: 0 })).toBeNull();
    expect(isoWeekRange({ year: 2026, week: 54 })).toBeNull();
    expect(isoWeekRange({ year: 2026, week: 47.5 })).toBeNull();
  });

  it('Archi §2.5 — l’étiquette zero-pad la semaine sur deux chiffres', () => {
    expect(isoWeekLabel({ year: 2026, week: 5 })).toBe('2026-W05');
    expect(isoWeekLabel({ year: 2026, week: 47 })).toBe('2026-W47');
  });
});

describe('Phase 42 — le classement du Palmarès', () => {
  it('Archi §2.5 — GET /api/v1/palmares sans cookie renvoie 401 UNAUTHORIZED', async () => {
    const res = await getPalmares(undefined);
    expect(res.status).toBe(401);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('UNAUTHORIZED');
  });

  it('Archi §2.9 — chaque entrée dit si elle est à l’appelant et si sa vitrine est publique', async () => {
    const first = await signUp();
    const second = await signUp();
    const scores = { region: 210, departement: 410, commune: 910, rue: 1010 };
    const mine = await submitTableau(
      first.cookie,
      await insertCardSet(first.userId, scores),
      'Mien',
    );
    const other = await submitTableau(
      second.cookie,
      await insertCardSet(second.userId, scores),
      'Autre',
    );

    // Semaine passée et vide pour tout le reste de la suite : le classement ne
    // retient que ces deux lignes, quel que soit le parallélisme des 27 autres fichiers.
    const instant = new Date('2001-03-05T12:00:00.000Z');
    const target = isoWeekOf(instant);
    await forceCreatedAt(mine.id, instant);
    await forceCreatedAt(other.id, instant);
    const query = `?year=${target.year}&week=${target.week}`;

    const before = await readPalmares(await getPalmares(first.cookie, query));
    const mineItem = before.items.find((item) => item.tableauId === mine.id);
    const otherItem = before.items.find((item) => item.tableauId === other.id);
    expect(mineItem?.yours).toBe(true);
    expect(otherItem?.yours).toBe(false);
    expect(mineItem?.player.id).toBe(first.userId);
    expect(otherItem?.player.id).toBe(second.userId);
    // Aucune ligne `user_profiles` : `profile_public` vaut `true` par défaut.
    expect(mineItem?.player.profilePublic).toBe(true);
    expect(otherItem?.player.profilePublic).toBe(true);

    await db
      .insertInto('user_profiles')
      .values({ user_id: second.userId, profile_public: false })
      .execute();

    const after = await readPalmares(await getPalmares(first.cookie, query));
    expect(after.items.find((item) => item.tableauId === other.id)?.player.profilePublic).toBe(
      false,
    );
    expect(after.items.find((item) => item.tableauId === mine.id)?.player.profilePublic).toBe(true);
    expect(after.items.find((item) => item.tableauId === mine.id)?.yours).toBe(true);
    expect(after.items.find((item) => item.tableauId === other.id)?.yours).toBe(false);
  });

  it('GDD §3.C — la soumission fige le score dans tableaux.score', async () => {
    const { cookie, userId } = await signUp();
    const cards = await insertCardSet(userId);
    const tableau = await submitTableau(cookie, cards, 'Score figé');

    const stored = await readTableauScore(tableau.id);
    expect(stored).toBe(tableau.total);
    expect(stored).toBe(tableauScore(SCORES, 3));
    expect(tableau.total).toBeGreaterThan(0);

    const body = await readPalmares(await getPalmares(cookie));
    const item = body.items.find((entry) => entry.tableauId === tableau.id);
    expect(item).toBeDefined();
    expect(item?.score).toBe(tableau.total);
  });

  it('Archi §2.5 — le classement ne recalcule jamais : muter user_cards.score ne change pas le score classé', async () => {
    const { cookie, userId } = await signUp();
    const cards = await insertCardSet(userId, {
      region: 220,
      departement: 440,
      commune: 940,
      rue: 1040,
    });
    const tableau = await submitTableau(cookie, cards, 'Score intouchable');
    const frozen = tableau.total;
    expect(frozen).toBeGreaterThan(0);

    // Les quatre cartes sont ramenées à zéro : un recalcul rendrait 0.
    await db
      .updateTable('user_cards')
      .set({ score: 0 })
      .where('id', 'in', [cards.region, cards.departement, cards.commune, cards.rue])
      .execute();

    const body = await readPalmares(await getPalmares(cookie));
    const item = body.items.find((entry) => entry.tableauId === tableau.id);
    expect(item).toBeDefined();
    expect(item?.score).toBe(frozen);
    expect(await readTableauScore(tableau.id)).toBe(frozen);
  });

  it('Archi §2.5 — ex æquo : le tableau soumis le plus tôt passe devant', async () => {
    const first = await signUp();
    const second = await signUp();
    const scores = { region: 230, departement: 450, commune: 950, rue: 1050 };
    const tableauA = await submitTableau(
      first.cookie,
      await insertCardSet(first.userId, scores),
      'A',
    );
    const tableauB = await submitTableau(
      second.cookie,
      await insertCardSet(second.userId, scores),
      'B',
    );
    expect(tableauB.total).toBe(tableauA.total);

    const { start } = requireRange(isoWeekOf(new Date()));
    const submittedAt = new Date(start.getTime() + 3_600_000);
    await forceCreatedAt(tableauA.id, submittedAt);
    await forceCreatedAt(tableauB.id, new Date(submittedAt.getTime() + 60_000));

    const body = await readPalmares(await getPalmares(first.cookie));
    const rankA = rankOf(body, tableauA.id);
    const rankB = rankOf(body, tableauB.id);
    expect(rankA).toBeDefined();
    expect(rankB).toBeDefined();
    expect(rankA as number).toBeLessThan(rankB as number);

    const replay = await readPalmares(await getPalmares(first.cookie));
    expect(replay.items.map((item) => [item.rank, item.tableauId])).toEqual(
      body.items.map((item) => [item.rank, item.tableauId]),
    );
  });

  it('Archi §2.5 — ex æquo : à instant identique, l’id croissant départage', async () => {
    const first = await signUp();
    const second = await signUp();
    const scores = { region: 240, departement: 460, commune: 960, rue: 1060 };
    const tableauA = await submitTableau(
      first.cookie,
      await insertCardSet(first.userId, scores),
      'A',
    );
    const tableauB = await submitTableau(
      second.cookie,
      await insertCardSet(second.userId, scores),
      'B',
    );

    const { start } = requireRange(isoWeekOf(new Date()));
    const instant = new Date(start.getTime() + 7_200_000);
    await forceCreatedAt(tableauA.id, instant);
    await forceCreatedAt(tableauB.id, instant);

    const expected = [tableauA.id, tableauB.id].sort();
    const body = await readPalmares(await getPalmares(first.cookie));
    expect(idsOf(body).filter((id) => id === tableauA.id || id === tableauB.id)).toEqual(expected);

    const replay = await readPalmares(await getPalmares(first.cookie));
    expect(replay.items.map((item) => [item.rank, item.tableauId])).toEqual(
      body.items.map((item) => [item.rank, item.tableauId]),
    );
  });

  it('Archi §2.5 — la semaine demandée est respectée', async () => {
    const { cookie, userId } = await signUp();
    const scores = { region: 250, departement: 470, commune: 970, rue: 1070 };
    const tableau = await submitTableau(
      cookie,
      await insertCardSet(userId, scores),
      'Il y a deux semaines',
    );

    const current = requireRange(isoWeekOf(new Date()));
    const monday = new Date(current.start.getTime() - 14 * 86_400_000);
    await forceCreatedAt(tableau.id, monday);

    const target = isoWeekOf(monday);
    const currentBody = await readPalmares(await getPalmares(cookie));
    expect(idsOf(currentBody)).not.toContain(tableau.id);

    const past = await readPalmares(
      await getPalmares(cookie, `?year=${target.year}&week=${target.week}`),
    );
    expect(past.week).toBe(isoWeekLabel(target));
    expect(past.current).toBe(false);
    expect(idsOf(past)).toContain(tableau.id);
    expect(past.weekStart).toBe(requireRange(target).start.toISOString());
    expect(past.weekEnd).toBe(requireRange(target).end.toISOString());
    expect(rankOf(past, tableau.id)).toBe(1);
  });

  it('Archi §2.5 — les bornes sont UTC : dimanche 23:59:59.999 entre, lundi 00:00:00.000 sort', async () => {
    const { cookie, userId } = await signUp();
    const lastMoment = await submitTableau(
      cookie,
      await insertCardSet(userId, { region: 260, departement: 480, commune: 980, rue: 1080 }),
      'Dernier instant',
    );
    const nextMonday = await submitTableau(
      cookie,
      await insertCardSet(userId, { region: 270, departement: 490, commune: 990, rue: 1090 }),
      'Lundi suivant',
    );

    const current = isoWeekOf(new Date());
    const range = requireRange(current);
    await forceCreatedAt(lastMoment.id, new Date(range.end.getTime() - 1));
    await forceCreatedAt(nextMonday.id, range.end);

    const sunday = await readPalmares(await getPalmares(cookie));
    expect(sunday.week).toBe(isoWeekLabel(current));
    expect(sunday.current).toBe(true);
    expect(idsOf(sunday)).toContain(lastMoment.id);
    expect(idsOf(sunday)).not.toContain(nextMonday.id);

    const following = isoWeekOf(range.end);
    expect(following).not.toEqual(current);
    const monday = await readPalmares(
      await getPalmares(cookie, `?year=${following.year}&week=${following.week}`),
    );
    expect(monday.week).toBe(isoWeekLabel(following));
    expect(idsOf(monday)).toContain(nextMonday.id);
  });

  it('Archi §2.5 — limit est borné : 1 rend un seul tableau, 0 et 101 sont refusés', async () => {
    const { cookie, userId } = await signUp();
    await submitTableau(
      cookie,
      await insertCardSet(userId, { region: 280, departement: 500, commune: 1000, rue: 1100 }),
      'Pagination',
    );

    const one = await readPalmares(await getPalmares(cookie, '?limit=1'));
    expect(one.items).toHaveLength(1);
    expect(one.items[0]?.rank).toBe(1);

    // `limit` hors 1..100 est refusé par le schéma de la route : Elysia répond 422 avant toute lecture.
    for (const limit of ['0', '101']) {
      const res = await getPalmares(cookie, `?limit=${limit}`);
      expect(res.status).toBe(422);
    }
  });
});

describe('Phase 42 — les bornes de la semaine demandée', () => {
  it('Archi §2.5 — un seul des deux paramètres de semaine est refusé', async () => {
    const { cookie } = await signUp();
    const res = await getPalmares(cookie, '?year=2026');
    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('PALMARES_INVALID_WEEK');
  });

  it('Archi §2.5 — une semaine inexistante est refusée', async () => {
    const { cookie } = await signUp();
    const res = await getPalmares(cookie, '?year=2027&week=53');
    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('PALMARES_INVALID_WEEK');
  });
});

describe('Phase 42 — le contrat de données du Palmarès', () => {
  it('Archi §2.5 — tableaux.score existe et est not null', async () => {
    const result = await sql<{ is_nullable: string }>`
      select is_nullable
      from information_schema.columns
      where table_name = 'tableaux' and column_name = 'score'
    `.execute(db);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.is_nullable).toBe('NO');
  });

  /**
   * Le rétro-remplissage de `0019_tableau_score`, rejoué sur une base vivante.
   * C'est le SQL le plus risqué de la phase : il recopie la formule d'alignement
   * et joint quatre référentiels. Une carte orpheline ne doit ni le faire échouer
   * (`22P02`) ni lui faire perdre les liens restants.
   */
  it('Archi §2.5 — 0019 rétro-remplit la colonne rejouée sur une base vivante', async () => {
    const { userId } = await signUp();

    // La chaîne région → département → commune → rue du seed : trois liens valides.
    const chain = await insertCardSet(userId);
    const soloRegion = await db
      .insertInto('user_cards')
      .values({
        user_id: userId,
        category: 'REGION',
        ref_code: seeded.regionCode,
        rarity: 'COMMUNE',
        score: 900,
        locked: false,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    const orphanCard = await db
      .insertInto('user_cards')
      .values({
        user_id: userId,
        category: 'REGION',
        ref_code: `${prefix}-ORPHELIN`,
        rarity: 'COMMUNE',
        score: SCORES.region,
        locked: false,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    // Insertions directes : aucun score fourni, le défaut `0` de la colonne s'applique.
    const complete = await db
      .insertInto('tableaux')
      .values({
        user_id: userId,
        name: 'Chaîne complète',
        region_card_id: chain.region,
        departement_card_id: chain.departement,
        commune_card_id: chain.commune,
        rue_card_id: chain.rue,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    const partial = await db
      .insertInto('tableaux')
      .values({ user_id: userId, name: 'Région seule', region_card_id: soloRegion.id })
      .returning('id')
      .executeTakeFirstOrThrow();
    const orphan = await db
      .insertInto('tableaux')
      .values({
        user_id: userId,
        name: 'Région orpheline',
        region_card_id: orphanCard.id,
        departement_card_id: chain.departement,
        commune_card_id: chain.commune,
        rue_card_id: chain.rue,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    expect(await readTableauScore(complete.id)).toBe(0);
    expect(await readTableauScore(partial.id)).toBe(0);
    expect(await readTableauScore(orphan.id)).toBe(0);

    // Les attendus viennent de la formule partagée, jamais d'un littéral posé sans preuve.
    const expectedComplete = tableauScore(SCORES, 3);
    const expectedPartial = tableauScore({ region: 900, departement: 0, commune: 0, rue: 0 }, 0);
    const expectedOrphan = tableauScore(SCORES, 2);
    expect(expectedComplete).toBe(12_500);
    expect(expectedPartial).toBe(900);
    expect(expectedOrphan).toBe(6_250);

    try {
      await sql`alter table tableaux alter column score drop not null`.execute(db);
      for (const id of [complete.id, partial.id, orphan.id]) {
        await sql`update tableaux set score = null where id = ${id}::uuid`.execute(db);
      }

      // Rejeu réel : la ligne de `kysely_migration` est retirée, `runMigrations`
      // réapplique `0019_tableau_score` sur la base vivante.
      await sql`delete from kysely_migration where name = '0019_tableau_score'`.execute(db);
      await runMigrations(db);

      expect(await readTableauScore(complete.id)).toBe(expectedComplete);
      expect(await readTableauScore(partial.id)).toBe(expectedPartial);
      expect(await readTableauScore(orphan.id)).toBe(expectedOrphan);

      const column = await sql<{ is_nullable: string }>`
        select is_nullable
        from information_schema.columns
        where table_name = 'tableaux' and column_name = 'score'
      `.execute(db);
      expect(column.rows[0]?.is_nullable).toBe('NO');

      // Une fois figé, le score ne dépend plus des cartes : les ramener à zéro ne le bouge pas.
      await db
        .updateTable('user_cards')
        .set({ score: 0 })
        .where('id', 'in', [
          chain.region,
          chain.departement,
          chain.commune,
          chain.rue,
          soloRegion.id,
          orphanCard.id,
        ])
        .execute();
      expect(await readTableauScore(complete.id)).toBe(expectedComplete);
      expect(await readTableauScore(partial.id)).toBe(expectedPartial);
      expect(await readTableauScore(orphan.id)).toBe(expectedOrphan);
    } finally {
      // La colonne doit rester `not null` pour les 27 autres fichiers de la suite.
      const state = await sql<{ is_nullable: string }>`
        select is_nullable
        from information_schema.columns
        where table_name = 'tableaux' and column_name = 'score'
      `.execute(db);
      if (state.rows[0]?.is_nullable !== 'NO') {
        await sql`delete from kysely_migration where name = '0019_tableau_score'`.execute(db);
        await runMigrations(db);
      }
    }
  });
});
