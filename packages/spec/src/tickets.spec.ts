import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { app } from '@hexamap/api/app';
import { createDb, runMigrations } from '@hexamap/db';
import { CATEGORY, type Category, RARITY, type Rarity } from '@hexamap/shared';

const db = createDb(process.env.DATABASE_URL ?? '');

const baseUrl = 'http://localhost:3000';
const origin = 'http://localhost:5174';

type CellKind = 'CARD' | 'TREASURE' | 'TWIN' | 'STATION' | 'BELVEDERE' | 'RENOVATION';

interface MaskedCard {
  category: Category;
  refCode: string;
  rarity: Rarity;
  score: number;
  nom: string;
}

interface MaskedCell {
  index: number;
  revealed: boolean;
  distance: number | null;
  kind: CellKind | null;
  nom: string | null;
  card: MaskedCard | null;
}

interface MaskedTicket {
  id: string;
  status: 'ACTIVE' | 'EXHAUSTED' | 'EXPIRED';
  scrapesRemaining: number;
  renovationPending: boolean;
  createdAt: string;
  expiresAt: string | null;
  cells: MaskedCell[];
  treasureFound: boolean;
}

interface CardItem {
  id: string;
  category: Category;
  refCode: string;
  nom: string;
  rarity: Rarity;
  score: number;
  acquiredAt: string;
  source: 'TICKET' | 'MARKET' | 'REWARD';
  locked: boolean;
}

interface ScratchBody {
  ticket: MaskedTicket;
  revealed: MaskedCell[];
  effects: string[];
}

interface StatsBody {
  total: number;
  byRarity: { rarity: Rarity; count: number }[];
  byCategory: { category: Category; count: number }[];
}

// --- état du seed (préfixe unique par exécution pour ne jamais entrer en collision) ---
const prefix = crypto.randomUUID().slice(0, 8);
const seeded = {
  regionCodes: [] as string[],
  deptCodes: [] as string[],
  communeCodes: [] as string[],
  odonymeIds: [] as string[],
};
const createdUserIds: string[] = [];

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
        pseudo: `${prefix}-spec`,
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

async function createTicket(cookie: string): Promise<MaskedTicket> {
  const res = await authFetch('/api/v1/tickets', { method: 'POST' }, cookie);
  expect(res.status).toBe(201);
  const body = (await res.json()) as { ticket: MaskedTicket };
  return body.ticket;
}

async function scratch(cookie: string, ticketId: string, cellIndex: number): Promise<Response> {
  return authFetch(
    `/api/v1/tickets/${ticketId}/scratch`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cellIndex }),
    },
    cookie,
  );
}

/** Lit la grille stockée côté serveur (réservé à la mise en place des tests). */
function parseGrid(value: unknown): { kind: string }[] {
  if (!Array.isArray(value)) return [];
  return value as { kind: string }[];
}

async function countReveals(ticketId: string): Promise<number> {
  const row = await db
    .selectFrom('ticket_reveals')
    .select(db.fn.countAll().as('total'))
    .where('ticket_id', '=', ticketId)
    .executeTakeFirstOrThrow();
  return Number(row.total);
}

/**
 * Jeu de référence cohérent, préfixé, suffisant pour tous les chemins de tirage :
 * - 2 régions, 2 départements (avec population) ;
 * - 12 communes réparties sur les 2 départements, couvrant les 6 raretés (2 par rareté) ;
 * - 12 odonymes couvrant les 6 raretés ;
 * - liens commune_odonymes : chaque commune « pépite » (RARE+) est reliée à des odonymes
 *   jumelables (INHABITUELLE/RARE), et chaque odonyme « pépite » est relié à des communes
 *   jumelables, de sorte que les tirages de jumeaux réussissent quelle que soit la Pépite.
 */
async function seedReference(): Promise<void> {
  const region1 = `${prefix}-R1`;
  const region2 = `${prefix}-R2`;
  const dept1 = `${prefix}-D1`;
  const dept2 = `${prefix}-D2`;
  seeded.regionCodes = [region1, region2];
  seeded.deptCodes = [dept1, dept2];

  await db
    .insertInto('ref_regions')
    .values([
      { code: region1, nom: `Région ${prefix} A` },
      { code: region2, nom: `Région ${prefix} B` },
    ])
    .execute();

  await db
    .insertInto('ref_departements')
    .values([
      { code: dept1, nom: `Département ${prefix} A`, code_region: region1, population: 1_000_000 },
      { code: dept2, nom: `Département ${prefix} B`, code_region: region2, population: 500_000 },
    ])
    .execute();

  const communes = RARITY.flatMap((rarete, ri) =>
    [0, 1].map((d) => ({
      code_insee: `${prefix}-C-${rarete}-${d}`,
      nom: `${prefix} Commune ${rarete} ${d}`,
      code_departement: d === 0 ? dept1 : dept2,
      code_region: d === 0 ? region1 : region2,
      population: 1_000_000 - ri * 100_000 - d * 50_000,
      rarete,
      score_base: 100 + ri * 50,
    })),
  );
  seeded.communeCodes = communes.map((c) => c.code_insee);
  await db.insertInto('ref_communes').values(communes).execute();

  const odonymes = RARITY.flatMap((rarete, ri) =>
    [0, 1].map((d) => ({
      nom_normalise: `${prefix}-rue-${rarete}-${d}`.toLowerCase(),
      nom_affichage: `${prefix} Rue ${rarete} ${d}`,
      nb_communes: 1,
      rarete,
      score_base: 100 + ri * 50,
    })),
  );
  const odonymeRows = await db
    .insertInto('ref_odonymes')
    .values(odonymes)
    .returning(['id', 'rarete'])
    .execute();
  seeded.odonymeIds = odonymeRows.map((o) => o.id);

  const odonymesByRarity = new Map<Rarity, string[]>();
  for (const o of odonymeRows) {
    const list = odonymesByRarity.get(o.rarete) ?? [];
    list.push(o.id);
    odonymesByRarity.set(o.rarete, list);
  }

  const twinOdonymes = [
    ...(odonymesByRarity.get('INHABITUELLE') ?? []),
    ...(odonymesByRarity.get('RARE') ?? []),
  ];
  const treasureOdonymes = [
    ...(odonymesByRarity.get('RARE') ?? []),
    ...(odonymesByRarity.get('EPIQUE') ?? []),
    ...(odonymesByRarity.get('LEGENDAIRE') ?? []),
    ...(odonymesByRarity.get('MYTHIQUE') ?? []),
  ];

  const treasureCommunes = communes.filter((c) =>
    (['RARE', 'EPIQUE', 'LEGENDAIRE', 'MYTHIQUE'] as Rarity[]).includes(c.rarete),
  );
  const twinCommunes = communes.filter((c) => c.rarete === 'INHABITUELLE' || c.rarete === 'RARE');

  const links = new Map<string, { code_insee: string; odonyme_id: string }>();
  for (const c of treasureCommunes) {
    for (const oid of twinOdonymes) {
      links.set(`${c.code_insee}|${oid}`, { code_insee: c.code_insee, odonyme_id: oid });
    }
  }
  for (const c of twinCommunes) {
    for (const oid of treasureOdonymes) {
      links.set(`${c.code_insee}|${oid}`, { code_insee: c.code_insee, odonyme_id: oid });
    }
  }
  if (links.size > 0) {
    await db
      .insertInto('commune_odonymes')
      .values([...links.values()])
      .execute();
  }
}

beforeAll(async () => {
  await runMigrations(db);
  await seedReference();
});

afterAll(async () => {
  if (seeded.odonymeIds.length > 0) {
    await db.deleteFrom('commune_odonymes').where('odonyme_id', 'in', seeded.odonymeIds).execute();
    await db.deleteFrom('ref_odonymes').where('id', 'in', seeded.odonymeIds).execute();
  }
  if (seeded.communeCodes.length > 0) {
    await db.deleteFrom('ref_communes').where('code_insee', 'in', seeded.communeCodes).execute();
  }
  if (seeded.deptCodes.length > 0) {
    await db.deleteFrom('ref_departements').where('code', 'in', seeded.deptCodes).execute();
  }
  if (seeded.regionCodes.length > 0) {
    await db.deleteFrom('ref_regions').where('code', 'in', seeded.regionCodes).execute();
  }
  if (createdUserIds.length > 0) {
    await db.deleteFrom('user').where('id', 'in', createdUserIds).execute();
  }
  await db.destroy();
});

describe('Phase 5 — tickets, collection, référentiels', () => {
  it('Archi §4.2 — les routes protégées renvoient 401 sans cookie', async () => {
    const status = async (path: string, init: RequestInit = {}) =>
      (await authFetch(path, init)).status;

    expect(await status('/api/v1/tickets/current')).toBe(401);
    expect(await status('/api/v1/tickets', { method: 'POST' })).toBe(401);
    expect(
      await status(`/api/v1/tickets/${crypto.randomUUID()}/scratch`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ cellIndex: 0 }),
      }),
    ).toBe(401);
    expect(await status('/api/v1/cards')).toBe(401);
    expect(await status('/api/v1/collection/stats')).toBe(401);
    expect(await status('/api/v1/ref/regions')).toBe(401);
  });

  it('GDD §2.6 — POST /api/v1/tickets crée un ticket 4×4 avec un pré-grattage gratuit', async () => {
    const { cookie } = await signUp();
    const ticket = await createTicket(cookie);

    expect(ticket.cells.length).toBe(16);
    expect(ticket.scrapesRemaining).toBe(4);
    expect(ticket.status).toBe('ACTIVE');
    expect(ticket.treasureFound).toBe(false);

    const revealed = ticket.cells.filter((c) => c.revealed);
    expect(revealed.length).toBe(1);
    expect(revealed[0]?.kind).toBe('CARD');
  });

  it('GDD §2.6 — la réponse ne fuit jamais grid ni treasure_index', async () => {
    const { cookie } = await signUp();

    const created = await authFetch('/api/v1/tickets', { method: 'POST' }, cookie);
    expect(created.status).toBe(201);
    const rawCreated = await created.text();
    expect(rawCreated).not.toContain('treasure_index');
    expect(rawCreated).not.toContain('"grid"');
    expect(rawCreated).not.toContain('grid:');
    const createdBody = JSON.parse(rawCreated) as { ticket: MaskedTicket };
    expect(createdBody.ticket.treasureFound).toBe(false);

    const currentRes = await authFetch('/api/v1/tickets/current', {}, cookie);
    expect(currentRes.status).toBe(200);
    const rawCurrent = await currentRes.text();
    expect(rawCurrent).not.toContain('treasure_index');
    expect(rawCurrent).not.toContain('"grid"');
    expect(rawCurrent).not.toContain('grid:');
    const currentBody = JSON.parse(rawCurrent) as { ticket: MaskedTicket };

    let revealedCount = 0;
    for (const cell of currentBody.ticket.cells) {
      if (cell.revealed) {
        revealedCount += 1;
      } else {
        expect(cell.kind).toBeNull();
        expect(cell.card).toBeNull();
        expect(cell.nom).toBeNull();
        expect(cell.distance).toBeNull();
      }
    }
    expect(revealedCount).toBe(1);
  });

  it('GDD §2.6 — grid et treasure_index existent côté serveur (masquage, pas absence)', async () => {
    const { cookie } = await signUp();
    const ticket = await createTicket(cookie);

    const row = await db
      .selectFrom('tickets')
      .select(['grid', 'treasure_index'])
      .where('id', '=', ticket.id)
      .executeTakeFirstOrThrow();
    expect(Array.isArray(row.grid)).toBe(true);
    if (Array.isArray(row.grid)) {
      expect(row.grid.length).toBe(16);
    }
    expect(row.treasure_index).toBeGreaterThanOrEqual(0);
    expect(row.treasure_index).toBeLessThanOrEqual(15);
  });

  it('Plan §5.5 — un second POST /api/v1/tickets renvoie 409 TICKET_ALREADY_ACTIVE', async () => {
    const { cookie } = await signUp();
    await createTicket(cookie);

    const res = await authFetch('/api/v1/tickets', { method: 'POST' }, cookie);
    expect(res.status).toBe(409);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('TICKET_ALREADY_ACTIVE');
  });

  it('Plan §5.5 — gratter une case la révèle et décrémente scrapesRemaining', async () => {
    const { cookie } = await signUp();
    const ticket = await createTicket(cookie);
    const before = ticket.scrapesRemaining;

    const target = ticket.cells.find((c) => !c.revealed);
    expect(target).toBeDefined();
    if (!target) throw new Error('aucune case non révélée');

    const res = await scratch(cookie, ticket.id, target.index);
    expect(res.status).toBe(200);
    // Anti-triche : la réponse brute du grattage ne doit jamais fuiter
    // `treasure_index` ni `grid` (comme sur POST /tickets et /current).
    const raw = await res.text();
    expect(raw).not.toContain('treasure_index');
    expect(raw).not.toContain('"grid"');
    expect(raw).not.toContain('grid:');
    const body = JSON.parse(raw) as ScratchBody;
    expect(body.revealed.length).toBeGreaterThanOrEqual(1);

    const updated = body.ticket.cells.find((c) => c.index === target.index);
    expect(updated?.revealed).toBe(true);

    // Un grattage coûte 1 ; chaque STATION révélée (y compris cascade belvédère) en rend 2.
    const stationCount = body.revealed.filter((c) => c.kind === 'STATION').length;
    expect(body.ticket.scrapesRemaining).toBe(before - 1 + stationCount * 2);

    const primary = body.revealed[0];
    if (primary === undefined) throw new Error('aucune case révélée');
    if (primary.kind === 'STATION') {
      expect(body.ticket.scrapesRemaining).toBe(before + 1);
    }
  });

  it('Plan §5.6 — regratter la même case renvoie 409 CELL_ALREADY_REVEALED sans décrémenter', async () => {
    const { cookie } = await signUp();
    const ticket = await createTicket(cookie);

    const target = ticket.cells.find((c) => !c.revealed);
    if (!target) throw new Error('aucune case non révélée');
    const first = await scratch(cookie, ticket.id, target.index);
    expect(first.status).toBe(200);

    const beforeRow = await db
      .selectFrom('tickets')
      .select(['scrapes_remaining'])
      .where('id', '=', ticket.id)
      .executeTakeFirstOrThrow();

    const second = await scratch(cookie, ticket.id, target.index);
    expect(second.status).toBe(409);
    const body = (await second.json()) as { code: string };
    expect(body.code).toBe('CELL_ALREADY_REVEALED');

    const afterRow = await db
      .selectFrom('tickets')
      .select(['scrapes_remaining'])
      .where('id', '=', ticket.id)
      .executeTakeFirstOrThrow();
    expect(afterRow.scrapes_remaining).toBe(beforeRow.scrapes_remaining);
  });

  it('Plan §5.5 — grattage borné : indices hors grille → 422, id inconnu ou étranger → 404', async () => {
    const { cookie } = await signUp();
    const ticket = await createTicket(cookie);
    const other = await signUp();
    const otherTicket = await createTicket(other.cookie);

    for (const bad of [16, -1]) {
      const res = await scratch(cookie, ticket.id, bad);
      expect(res.status).toBe(422);
    }

    const unknown = await scratch(cookie, crypto.randomUUID(), 0);
    expect(unknown.status).toBe(404);
    const unknownBody = (await unknown.json()) as { code: string };
    expect(unknownBody.code).toBe('TICKET_NOT_FOUND');

    const foreign = await scratch(cookie, otherTicket.id, 0);
    expect(foreign.status).toBe(404);
    const foreignBody = (await foreign.json()) as { code: string };
    expect(foreignBody.code).toBe('TICKET_NOT_FOUND');
  });

  it('Plan §5.6 — deux grattages concurrents avec 1 coup restant : un seul réussit', async () => {
    const { cookie } = await signUp();
    const ticket = await createTicket(cookie);

    await db
      .updateTable('tickets')
      .set({ scrapes_remaining: 1 })
      .where('id', '=', ticket.id)
      .execute();

    // Choisir deux cases sûres (ni STATION ni BELVEDERE) pour que le gagnant épuise le ticket.
    const row = await db
      .selectFrom('tickets')
      .select(['grid'])
      .where('id', '=', ticket.id)
      .executeTakeFirstOrThrow();
    const grid = parseGrid(row.grid);
    const alreadyRevealed = new Set(ticket.cells.filter((c) => c.revealed).map((c) => c.index));
    const safe = grid
      .map((cell, i) => ({ cell, i }))
      .filter(
        ({ cell, i }) =>
          !alreadyRevealed.has(i) && ['CARD', 'TWIN', 'TREASURE', 'RENOVATION'].includes(cell.kind),
      )
      .map(({ i }) => i);
    expect(safe.length).toBeGreaterThanOrEqual(2);
    const first = safe[0];
    const second = safe[1];
    if (first === undefined || second === undefined) throw new Error('pas assez de cases sûres');

    const revealsBefore = await countReveals(ticket.id);

    const [r1, r2] = await Promise.all([
      scratch(cookie, ticket.id, first),
      scratch(cookie, ticket.id, second),
    ]);
    expect([r1.status, r2.status].sort((a, b) => a - b)).toEqual([200, 409]);

    const after = await db
      .selectFrom('tickets')
      .select(['status', 'scrapes_remaining'])
      .where('id', '=', ticket.id)
      .executeTakeFirstOrThrow();
    expect(after.status).toBe('EXHAUSTED');
    expect(after.scrapes_remaining).toBe(0);
    expect(await countReveals(ticket.id)).toBe(revealsBefore + 1);
  });

  it('Plan §5.5 — un ticket épuisé disparaît du current et un nouveau peut être créé', async () => {
    const { cookie } = await signUp();
    const ticket = await createTicket(cookie);

    let current = ticket;
    for (let step = 0; step < 20 && current.status === 'ACTIVE'; step++) {
      const target = current.cells.find((c) => !c.revealed);
      if (!target) break;
      const res = await scratch(cookie, current.id, target.index);
      if (res.status !== 200) break;
      current = ((await res.json()) as ScratchBody).ticket;
    }
    expect(current.status).toBe('EXHAUSTED');

    const currentRes = await authFetch('/api/v1/tickets/current', {}, cookie);
    expect(currentRes.status).toBe(404);
    const currentBody = (await currentRes.json()) as { code: string };
    expect(currentBody.code).toBe('NO_ACTIVE_TICKET');

    const newTicket = await createTicket(cookie);
    expect(newTicket.status).toBe('ACTIVE');
    expect(newTicket.id).not.toBe(ticket.id);
  });

  it('Archi §4.2 — GET /api/v1/cards liste les cartes et respecte les filtres', async () => {
    const { cookie } = await signUp();
    const ticket = await createTicket(cookie);

    let current = ticket;
    for (let step = 0; step < 3 && current.status === 'ACTIVE'; step++) {
      const target = current.cells.find((c) => !c.revealed);
      if (!target) break;
      const res = await scratch(cookie, current.id, target.index);
      if (res.status !== 200) break;
      current = ((await res.json()) as ScratchBody).ticket;
    }

    const res = await authFetch('/api/v1/cards', {}, cookie);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: CardItem[]; total: number };
    expect(body.items.length).toBeGreaterThanOrEqual(1);
    expect(body.total).toBe(body.items.length);
    for (const item of body.items) {
      expect(item.id).toBeTypeOf('string');
      expect(item.category).toBeTypeOf('string');
      expect(item.refCode).toBeTypeOf('string');
      expect(item.nom).toBeTypeOf('string');
      expect(item.rarity).toBeTypeOf('string');
      expect(item.score).toBeTypeOf('number');
      expect(item.acquiredAt).toBeTypeOf('string');
      expect(item.source).toBeTypeOf('string');
      expect(item.locked).toBe(false);
    }

    const rareRes = await authFetch('/api/v1/cards?rarity=RARE', {}, cookie);
    const rare = (await rareRes.json()) as { items: CardItem[]; total: number };
    expect(rare.items.every((i) => i.rarity === 'RARE')).toBe(true);
    expect(rare.total).toBeLessThanOrEqual(body.total);

    const communeRes = await authFetch('/api/v1/cards?category=COMMUNE', {}, cookie);
    const commune = (await communeRes.json()) as { items: CardItem[]; total: number };
    expect(commune.items.every((i) => i.category === 'COMMUNE')).toBe(true);
    expect(commune.total).toBeLessThanOrEqual(body.total);
  });

  it('Archi §4.2 — GET /api/v1/collection/stats renvoie des totaux cohérents', async () => {
    const { cookie } = await signUp();
    await createTicket(cookie);

    const cardsRes = await authFetch('/api/v1/cards', {}, cookie);
    const cards = (await cardsRes.json()) as { items: CardItem[]; total: number };

    const res = await authFetch('/api/v1/collection/stats', {}, cookie);
    expect(res.status).toBe(200);
    const stats = (await res.json()) as StatsBody;

    expect(stats.total).toBe(cards.total);
    expect(stats.byRarity.map((r) => r.rarity)).toEqual([...RARITY]);
    expect(stats.byRarity.reduce((sum, r) => sum + r.count, 0)).toBe(stats.total);
    expect(stats.byCategory.map((c) => c.category)).toEqual([...CATEGORY]);
    expect(stats.byCategory.reduce((sum, c) => sum + c.count, 0)).toBe(stats.total);
  });

  it('Archi §4.2 — les référentiels sont servis avec limite et filtrage', async () => {
    const { cookie } = await signUp();

    const regionsRes = await authFetch('/api/v1/ref/regions', {}, cookie);
    expect(regionsRes.status).toBe(200);
    const regions = (await regionsRes.json()) as { items: { code: string; nom: string }[] };
    for (const code of seeded.regionCodes) {
      expect(regions.items.some((r) => r.code === code)).toBe(true);
    }

    const limit = 3;
    const communesRes = await authFetch(
      `/api/v1/ref/communes?q=${prefix}&limit=${limit}`,
      {},
      cookie,
    );
    expect(communesRes.status).toBe(200);
    const communes = (await communesRes.json()) as { items: { codeInsee: string }[] };
    expect(communes.items.length).toBeGreaterThanOrEqual(1);
    expect(communes.items.length).toBeLessThanOrEqual(limit);

    const odonymesRes = await authFetch(
      `/api/v1/ref/odonymes?q=${prefix}&limit=${limit}`,
      {},
      cookie,
    );
    expect(odonymesRes.status).toBe(200);
    const odonymes = (await odonymesRes.json()) as { items: { id: string }[] };
    expect(odonymes.items.length).toBeGreaterThanOrEqual(1);
    expect(odonymes.items.length).toBeLessThanOrEqual(limit);

    const overCommune = await authFetch('/api/v1/ref/communes?limit=500', {}, cookie);
    expect(overCommune.status).toBe(422);
    const overOdonyme = await authFetch('/api/v1/ref/odonymes?limit=500', {}, cookie);
    expect(overOdonyme.status).toBe(422);
  });

  it('Plan §5.6 — effets de grattage : invariants et effets conditionnels', async () => {
    const { cookie } = await signUp();
    const ticket = await createTicket(cookie);

    let current = ticket;
    let minScrapes = current.scrapesRemaining;
    let sawScrapesAdded = false;

    for (let step = 0; step < 16 && current.status === 'ACTIVE'; step++) {
      const target = current.cells.find((c) => !c.revealed);
      if (!target) break;
      const res = await scratch(cookie, current.id, target.index);
      expect(res.status).toBe(200);
      const body = (await res.json()) as ScratchBody;
      current = body.ticket;
      minScrapes = Math.min(minScrapes, current.scrapesRemaining);

      if (body.effects.includes('SCRAPES_ADDED')) sawScrapesAdded = true;
      if (body.effects.includes('ADJACENT_REVEALED')) {
        expect(body.revealed.length).toBeGreaterThan(1);
      }
      for (const cell of body.revealed) {
        if (cell.kind === 'RENOVATION') {
          expect(body.effects).toContain('RENOVATION_PENDING');
          expect(body.ticket.renovationPending).toBe(true);
        }
      }
    }

    // Invariants : jamais négatif, distances bornées, masquage des cases non révélées.
    expect(minScrapes).toBeGreaterThanOrEqual(0);
    for (const cell of current.cells) {
      if (cell.revealed) {
        expect(cell.distance).not.toBeNull();
        if (cell.distance !== null) {
          expect(cell.distance).toBeGreaterThanOrEqual(0);
          expect(cell.distance).toBeLessThanOrEqual(6);
        }
      } else {
        expect(cell.distance).toBeNull();
        expect(cell.kind).toBeNull();
        expect(cell.card).toBeNull();
      }
    }

    // treasureFound vrai ssi une case TREASURE a été révélée.
    const sawTreasure = current.cells.some((c) => c.revealed && c.kind === 'TREASURE');
    expect(current.treasureFound).toBe(sawTreasure);

    // Si une STATION a été révélée, l'effet SCRAPES_ADDED a forcément été émis.
    const sawStation = current.cells.some((c) => c.revealed && c.kind === 'STATION');
    if (sawStation) {
      expect(sawScrapesAdded).toBe(true);
    }
  });
});
