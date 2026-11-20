import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { app } from '@hexamap/api/app';
import { createDb, runMigrations } from '@hexamap/db';
import {
  ACHIEVEMENT_FAMILIES,
  ACHIEVEMENT_FAMILY_LABELS,
  ACHIEVEMENT_METRICS,
  ACHIEVEMENT_PAYOUT_TOTAL,
  ACHIEVEMENTS,
  type AchievementMetrics,
  achievementProgress,
  achievementsByFamily,
  countAcceptedFriends,
  newlyEarned,
} from '@hexamap/shared';

function emptyMetrics(): AchievementMetrics {
  return Object.fromEntries(
    ACHIEVEMENT_METRICS.map((metric) => [metric, null]),
  ) as AchievementMetrics;
}

const CATALOGUE = [
  ['SCRATCH_FIRST_TICKET', 1, 25],
  ['SCRATCH_TICKETS_10', 10, 25],
  ['SCRATCH_TICKETS_50', 50, 45],
  ['SCRATCH_TICKETS_100', 100, 90],
  ['SCRATCH_TICKETS_500', 500, 225],
  ['SCRATCH_TICKETS_1000', 1000, 455],
  ['SCRATCH_FIRST_PEPITE', 1, 25],
  ['SCRATCH_PEPITES_10', 10, 70],
  ['SCRATCH_MYTHIQUE', 1, 180],
  ['COLLECTION_CARDS_10', 10, 25],
  ['COLLECTION_CARDS_50', 50, 45],
  ['COLLECTION_CARDS_100', 100, 110],
  ['COLLECTION_CARDS_500', 500, 365],
  ['COLLECTION_REGIONS_18', 18, 275],
  ['COLLECTION_DEPARTEMENTS_101', 101, 1260],
  ['COLLECTION_SIX_RARITIES', 6, 135],
  ['COLLECTION_UNIQUE_RUE', 1, 225],
  ['TABLEAU_FIRST', 1, 25],
  ['TABLEAU_MULTIPLIER_15', 15, 25],
  ['TABLEAU_MULTIPLIER_25', 25, 45],
  ['TABLEAU_MULTIPLIER_50', 50, 135],
  ['TABLEAU_SCORE_5000', 5000, 45],
  ['TABLEAU_SCORE_10000', 10000, 135],
  ['TABLEAU_SCORE_15000', 15000, 365],
  ['MARKET_FIRST_SALE', 1, 25],
  ['MARKET_FIRST_PURCHASE', 1, 25],
  ['MARKET_SALES_10', 10, 45],
  ['MARKET_SALES_100', 100, 275],
  ['MARKET_ECUS_EARNED_10000', 10000, 180],
  ['MARKET_PURCHASE_1000', 1000, 25],
  ['SOCIAL_FIRST_FRIEND', 1, 25],
  ['SOCIAL_FRIENDS_10', 10, 45],
  ['SOCIAL_FRIENDS_50', 50, 180],
  ['SOCIAL_FRIENDS_100', 100, 455],
  ['SOCIAL_PROFILE_COMPLETE', 1, 25],
  ['ATTENDANCE_7_DAYS', 7, 65],
  ['ATTENDANCE_30_DAYS', 30, 275],
] as const;

describe('ROADMAP §2 (phase 27) — le catalogue compte trente-sept médailles', () => {
  it('expose exactement 37 entrées', () => {
    expect(ACHIEVEMENTS).toHaveLength(37);
  });

  it('verse un total de 6 000 écus', () => {
    expect(ACHIEVEMENT_PAYOUT_TOTAL).toBe(6000);
  });
});

describe('ROADMAP §2 (phase 27) — aucune clé ne se répète', () => {
  it('rend chaque clé unique', () => {
    const keys = ACHIEVEMENTS.map((achievement) => achievement.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('ROADMAP §2 (phase 27) — seuils et montants sont des entiers positifs', () => {
  it('refuse un montant nul ou négatif', () => {
    for (const achievement of ACHIEVEMENTS) {
      expect(Number.isInteger(achievement.payout)).toBe(true);
      expect(achievement.payout).toBeGreaterThan(0);
    }
  });

  it('refuse un seuil nul ou négatif', () => {
    for (const achievement of ACHIEVEMENTS) {
      expect(Number.isInteger(achievement.threshold)).toBe(true);
      expect(achievement.threshold).toBeGreaterThan(0);
    }
  });
});

describe('ROADMAP §2 (phase 27) — les six familles portent au moins une médaille', () => {
  it('déclare les six familles avec leur libellé français', () => {
    expect(ACHIEVEMENT_FAMILIES).toHaveLength(6);
    expect(Object.keys(ACHIEVEMENT_FAMILY_LABELS).sort()).toEqual([...ACHIEVEMENT_FAMILIES].sort());
  });

  it('regroupe les médailles par famille, dans l’ordre des familles', () => {
    const groups = achievementsByFamily();
    expect(groups.map((group) => group.family)).toEqual([...ACHIEVEMENT_FAMILIES]);
    for (const group of groups) {
      expect(group.achievements.length).toBeGreaterThan(0);
      expect(group.label).toBe(ACHIEVEMENT_FAMILY_LABELS[group.family]);
      for (const achievement of group.achievements) {
        expect(achievement.family).toBe(group.family);
      }
    }
  });
});

describe('ROADMAP §2 (phase 27) — le catalogue reprend les montants exacts', () => {
  const cases: ReadonlyArray<readonly [string, number, number]> = CATALOGUE;

  for (const [key, threshold, payout] of cases) {
    it(`retrouve ${key} à ${threshold} / ${payout}`, () => {
      const achievement = ACHIEVEMENTS.find((candidate) => candidate.key === key);
      expect(achievement).toBeDefined();
      expect(achievement?.threshold).toBe(threshold);
      expect(achievement?.payout).toBe(payout);
    });
  }

  it('ne contient aucune clé hors catalogue', () => {
    const expected = new Set<string>(CATALOGUE.map(([key]) => key));
    for (const achievement of ACHIEVEMENTS) {
      expect(expected.has(achievement.key)).toBe(true);
    }
  });
});

describe('ROADMAP §2 (phase 27) — newlyEarned débloque au seuil atteint', () => {
  it('rend SCRATCH_FIRST_TICKET quand ticketsScratched vaut 1', () => {
    const metrics: AchievementMetrics = { ...emptyMetrics(), ticketsScratched: 1 };
    const earned = newlyEarned(metrics, new Set());
    expect(earned.map((achievement) => achievement.key)).toEqual(['SCRATCH_FIRST_TICKET']);
  });

  it('ne rend jamais une médaille déjà débloquée', () => {
    const metrics: AchievementMetrics = { ...emptyMetrics(), ticketsScratched: 1 };
    const earned = newlyEarned(metrics, new Set(['SCRATCH_FIRST_TICKET']));
    expect(earned).toEqual([]);
  });

  it('ne rend jamais une médaille sociale quand la métrique vaut null', () => {
    const metrics: AchievementMetrics = { ...emptyMetrics(), friendsAccepted: null };
    const earned = newlyEarned(metrics, new Set());
    expect(earned).toEqual([]);
  });
});

describe('ROADMAP §2 (phase 27) — achievementProgress propage null', () => {
  it('rend la valeur de la métrique de chaque médaille', () => {
    const metrics: AchievementMetrics = { ...emptyMetrics(), ticketsScratched: 5 };
    const progress = achievementProgress(metrics);
    expect(progress.SCRATCH_FIRST_TICKET).toBe(5);
    expect(progress.SCRATCH_TICKETS_10).toBe(5);
    expect(progress.SOCIAL_FIRST_FRIEND).toBeNull();
  });
});

describe('Archi §2.9 — countAcceptedFriends ne compte que les amitiés acceptées', () => {
  it('rend 0 pour un compte sans relation', () => {
    expect(countAcceptedFriends([])).toBe(0);
  });

  it('ignore PENDING et DECLINED et rend le nombre d’amitiés ACCEPTED', () => {
    expect(countAcceptedFriends(['PENDING', 'ACCEPTED', 'DECLINED', 'ACCEPTED'])).toBe(2);
  });
});

// --- cas d'intégration : le robinet, l'idempotence, l'achat ---

const db = createDb(process.env.DATABASE_URL ?? '');

const baseUrl = 'http://localhost:3000';
const origin = 'http://localhost:5174';

const prefix = crypto.randomUUID().slice(0, 8);
const createdUserIds: string[] = [];

const PAYOUTS_KEY = 'ACHIEVEMENT_PAYOUTS_ENABLED';
const FIRST_TICKET_KEY = 'SCRATCH_FIRST_TICKET';
const FIRST_TICKET_REASON = `ACHIEVEMENT:${FIRST_TICKET_KEY}`;
const FIRST_TICKET_PAYOUT = 25;
const FIRST_PEPITE_PAYOUT = 25;

interface AchievementsBody {
  payoutsEnabled: boolean;
  total: number;
  achievements: {
    key: string;
    payout: number;
    progress: number | null;
    earnedAt: string | null;
  }[];
}

interface Account {
  cookie: string;
  userId: string;
}

function extractSessionCookie(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(';')[0])
    .join('; ');
}

async function signUp(): Promise<Account> {
  const email = `spec-${prefix}-${crypto.randomUUID()}@hexamap.test`;
  const res = await app.handle(
    new Request(`${baseUrl}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin },
      body: JSON.stringify({
        email,
        password: 'motdepasse-123',
        name: 'Spec',
        pseudo: `${prefix}-${crypto.randomUUID().slice(0, 8)}`,
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

async function getAchievements(cookie: string): Promise<AchievementsBody> {
  const res = await authFetch('/api/v1/achievements', {}, cookie);
  expect(res.status).toBe(200);
  return (await res.json()) as AchievementsBody;
}

/**
 * Sème directement un ticket ACTIVE déjà révélé une fois : la métrique
 * `ticketsScratched` compte les tickets distincts portant au moins une
 * révélation, donc `SCRATCH_FIRST_TICKET` devient médaillable. La case révélée
 * n'est pas la Pépite, pour ne pas débloquer d'autre médaille.
 */
async function seedScratchedTicket(userId: string): Promise<void> {
  const ticket = await db
    .insertInto('tickets')
    .values({ user_id: userId, grid: [], treasure_index: 0, status: 'ACTIVE' })
    .returning('id')
    .executeTakeFirstOrThrow();

  await db
    .insertInto('ticket_reveals')
    .values({ ticket_id: ticket.id, cell_index: 1, distance: 1 })
    .execute();
}

async function insertCard(userId: string, score: number): Promise<string> {
  const row = await db
    .insertInto('user_cards')
    .values({
      user_id: userId,
      category: 'COMMUNE',
      ref_code: `${prefix}-${crypto.randomUUID().slice(0, 8)}`,
      rarity: 'COMMUNE',
      score,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return row.id;
}

async function countAchievements(userId: string, key: string): Promise<number> {
  const row = await db
    .selectFrom('user_achievements')
    .select((eb) => eb.fn.countAll().as('total'))
    .where('user_id', '=', userId)
    .where('achievement_key', '=', key)
    .executeTakeFirstOrThrow();
  return Number(row.total);
}

async function countLedger(userId: string, reason: string): Promise<number> {
  const row = await db
    .selectFrom('currency_ledger')
    .select((eb) => eb.fn.countAll().as('total'))
    .where('user_id', '=', userId)
    .where('reason', '=', reason)
    .executeTakeFirstOrThrow();
  return Number(row.total);
}

async function countLedgerForUser(userId: string): Promise<number> {
  const row = await db
    .selectFrom('currency_ledger')
    .select((eb) => eb.fn.countAll().as('total'))
    .where('user_id', '=', userId)
    .executeTakeFirstOrThrow();
  return Number(row.total);
}

async function readBalance(userId: string): Promise<number> {
  const row = await db
    .selectFrom('user')
    .select('currency')
    .where('id', '=', userId)
    .executeTakeFirstOrThrow();
  return row.currency ?? 0;
}

async function setPayoutsEnabled(enabled: boolean): Promise<void> {
  await db
    .updateTable('game_config')
    .set({ value: enabled })
    .where('key', '=', PAYOUTS_KEY)
    .execute();
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

describe('ROADMAP §2 (phase 27) — le versement des médailles', () => {
  beforeAll(async () => {
    await runMigrations(db);
  });

  afterAll(async () => {
    if (createdUserIds.length > 0) {
      await db.deleteFrom('user').where('id', 'in', createdUserIds).execute();
    }
    await db.destroy();
  });

  it('un compte neuf verse 0 écu', async () => {
    const account = await signUp();

    const view = await getAchievements(account.cookie);
    expect(view.total).toBe(0);
    expect(view.payoutsEnabled).toBe(true);
    expect(view.achievements.find((entry) => entry.key === FIRST_TICKET_KEY)?.earnedAt).toBeNull();

    expect(await readBalance(account.userId)).toBe(0);
    expect(await countLedgerForUser(account.userId)).toBe(0);
  });

  it('une médaille paie une seule fois', async () => {
    const account = await signUp();
    await seedScratchedTicket(account.userId);

    const first = await getAchievements(account.cookie);
    const second = await getAchievements(account.cookie);

    const earned = (view: AchievementsBody) =>
      view.achievements.find((entry) => entry.key === FIRST_TICKET_KEY);
    const firstEarnedAt = earned(first)?.earnedAt ?? null;
    expect(firstEarnedAt).not.toBeNull();
    expect(earned(second)?.earnedAt).toBe(firstEarnedAt);
    expect(first.total).toBe(FIRST_TICKET_PAYOUT);
    expect(second.total).toBe(FIRST_TICKET_PAYOUT);

    expect(await countAchievements(account.userId, FIRST_TICKET_KEY)).toBe(1);
    expect(await countLedger(account.userId, FIRST_TICKET_REASON)).toBe(1);
    expect(await readBalance(account.userId)).toBe(FIRST_TICKET_PAYOUT);
  });

  it('deux évaluations concurrentes ne paient qu’une fois', async () => {
    const account = await signUp();
    await seedScratchedTicket(account.userId);

    const [left, right] = await Promise.all([
      getAchievements(account.cookie),
      getAchievements(account.cookie),
    ]);

    expect(left.total).toBe(FIRST_TICKET_PAYOUT);
    expect(right.total).toBe(FIRST_TICKET_PAYOUT);
    expect(await countAchievements(account.userId, FIRST_TICKET_KEY)).toBe(1);
    expect(await countLedger(account.userId, FIRST_TICKET_REASON)).toBe(1);
    expect(await readBalance(account.userId)).toBe(FIRST_TICKET_PAYOUT);
  });

  it('l’interrupteur à false suspend le versement', async () => {
    const account = await signUp();
    await seedScratchedTicket(account.userId);

    try {
      await setPayoutsEnabled(false);

      const view = await getAchievements(account.cookie);
      expect(view.payoutsEnabled).toBe(false);
      expect(view.total).toBe(0);
      expect(
        view.achievements.find((entry) => entry.key === FIRST_TICKET_KEY)?.earnedAt,
      ).toBeNull();

      expect(await countAchievements(account.userId, FIRST_TICKET_KEY)).toBe(0);
      expect(await countLedgerForUser(account.userId)).toBe(0);
      expect(await readBalance(account.userId)).toBe(0);
    } finally {
      await setPayoutsEnabled(true);
    }

    const resumed = await getAchievements(account.cookie);
    expect(resumed.total).toBe(FIRST_TICKET_PAYOUT);
    expect(await countLedger(account.userId, FIRST_TICKET_REASON)).toBe(1);
    expect(await readBalance(account.userId)).toBe(FIRST_TICKET_PAYOUT);
  });

  it('un joueur avec une médaille peut acheter', async () => {
    const seller = await signUp();
    const sellerCardId = await insertCard(seller.userId, 100);

    const listingRes = await postListing(seller.cookie, sellerCardId, 25);
    expect(listingRes.status).toBe(201);
    const listing = (await listingRes.json()) as { listing: { id: string } };

    const buyer = await signUp();
    await seedScratchedTicket(buyer.userId);
    const view = await getAchievements(buyer.cookie);
    expect(view.total).toBe(FIRST_TICKET_PAYOUT);
    expect(await readBalance(buyer.userId)).toBe(FIRST_TICKET_PAYOUT);

    const buyRes = await authFetch(
      `/api/v1/market/listings/${listing.listing.id}/buy`,
      { method: 'POST' },
      buyer.cookie,
    );
    expect(buyRes.status).toBe(200);

    const card = await db
      .selectFrom('user_cards')
      .select(['user_id'])
      .where('id', '=', sellerCardId)
      .executeTakeFirstOrThrow();
    expect(card.user_id).toBe(buyer.userId);

    const sold = await db
      .selectFrom('market_listings')
      .select(['status', 'buyer_id'])
      .where('id', '=', listing.listing.id)
      .executeTakeFirstOrThrow();
    expect(sold.status).toBe('SOLD');
    expect(sold.buyer_id).toBe(buyer.userId);

    expect(await readBalance(buyer.userId)).toBe(0);
  });

  it('compte les tickets distincts, pas les cases révélées', async () => {
    const account = await signUp();

    const ticket = await db
      .insertInto('tickets')
      .values({ user_id: account.userId, grid: [], treasure_index: 0, status: 'ACTIVE' })
      .returning('id')
      .executeTakeFirstOrThrow();

    await db
      .insertInto('ticket_reveals')
      .values([
        { ticket_id: ticket.id, cell_index: 1, distance: 1 },
        { ticket_id: ticket.id, cell_index: 2, distance: 2 },
      ])
      .execute();

    const view = await getAchievements(account.cookie);
    const entry = (key: string) => view.achievements.find((candidate) => candidate.key === key);

    expect(entry(FIRST_TICKET_KEY)?.earnedAt).not.toBeNull();
    expect(entry('SCRATCH_TICKETS_10')?.progress).toBe(1);
    expect(entry('SCRATCH_TICKETS_10')?.earnedAt).toBeNull();
    expect(await countAchievements(account.userId, FIRST_TICKET_KEY)).toBe(1);
    expect(await countLedger(account.userId, FIRST_TICKET_REASON)).toBe(1);
    expect(await readBalance(account.userId)).toBe(FIRST_TICKET_PAYOUT);
  });

  it('verse la première Pépite avec le premier ticket', async () => {
    const account = await signUp();

    const ticket = await db
      .insertInto('tickets')
      .values({ user_id: account.userId, grid: [], treasure_index: 5, status: 'ACTIVE' })
      .returning('id')
      .executeTakeFirstOrThrow();

    await db
      .insertInto('ticket_reveals')
      .values({ ticket_id: ticket.id, cell_index: 5, distance: 0 })
      .execute();

    const view = await getAchievements(account.cookie);
    const entry = (key: string) => view.achievements.find((candidate) => candidate.key === key);

    expect(entry(FIRST_TICKET_KEY)?.earnedAt).not.toBeNull();
    expect(entry('SCRATCH_FIRST_PEPITE')?.earnedAt).not.toBeNull();
    expect(entry('SCRATCH_FIRST_PEPITE')?.progress).toBe(1);
    expect(view.total).toBe(FIRST_TICKET_PAYOUT + FIRST_PEPITE_PAYOUT);

    const ledger = await db
      .selectFrom('currency_ledger')
      .select(['reason', 'delta'])
      .where('user_id', '=', account.userId)
      .execute();
    expect(ledger).toHaveLength(2);
    expect(ledger.map((row) => row.reason).sort()).toEqual([
      'ACHIEVEMENT:SCRATCH_FIRST_PEPITE',
      'ACHIEVEMENT:SCRATCH_FIRST_TICKET',
    ]);
    expect(ledger.reduce((sum, row) => sum + row.delta, 0)).toBe(
      FIRST_TICKET_PAYOUT + FIRST_PEPITE_PAYOUT,
    );

    expect(await readBalance(account.userId)).toBe(FIRST_TICKET_PAYOUT + FIRST_PEPITE_PAYOUT);
  });

  it('distingue les ventes des achats', async () => {
    const seller = await signUp();
    const sellerCardId = await insertCard(seller.userId, 100);

    const listingRes = await postListing(seller.cookie, sellerCardId, 25);
    expect(listingRes.status).toBe(201);
    const listing = (await listingRes.json()) as { listing: { id: string } };

    const buyer = await signUp();
    await seedScratchedTicket(buyer.userId);

    // Le GET verse la médaille du premier ticket : l'acheteur dispose de 25 écus,
    // soit exactement le prix de l'annonce.
    const wallet = await getAchievements(buyer.cookie);
    expect(wallet.total).toBe(FIRST_TICKET_PAYOUT);
    expect(await readBalance(buyer.userId)).toBe(FIRST_TICKET_PAYOUT);

    const buyRes = await authFetch(
      `/api/v1/market/listings/${listing.listing.id}/buy`,
      { method: 'POST' },
      buyer.cookie,
    );
    expect(buyRes.status).toBe(200);

    // Le GET verse : 25 écus de vente + 25 de première vente chez le vendeur,
    // 25 de premier achat chez l'acheteur après avoir payé 25.
    const sellerView = await getAchievements(seller.cookie);
    const buyerView = await getAchievements(buyer.cookie);

    const entry = (view: AchievementsBody, key: string) =>
      view.achievements.find((candidate) => candidate.key === key);

    expect(entry(sellerView, 'MARKET_FIRST_SALE')?.progress).toBe(1);
    expect(entry(sellerView, 'MARKET_FIRST_SALE')?.earnedAt).not.toBeNull();
    expect(entry(sellerView, 'MARKET_FIRST_PURCHASE')?.progress).toBe(0);
    expect(entry(sellerView, 'MARKET_FIRST_PURCHASE')?.earnedAt).toBeNull();
    expect(sellerView.total).toBe(25);
    expect(await readBalance(seller.userId)).toBe(50);

    expect(entry(buyerView, 'MARKET_FIRST_PURCHASE')?.progress).toBe(1);
    expect(entry(buyerView, 'MARKET_FIRST_PURCHASE')?.earnedAt).not.toBeNull();
    expect(entry(buyerView, 'MARKET_FIRST_SALE')?.progress).toBe(0);
    expect(entry(buyerView, 'MARKET_FIRST_SALE')?.earnedAt).toBeNull();
    expect(buyerView.total).toBe(FIRST_TICKET_PAYOUT + 25);
    expect(await readBalance(buyer.userId)).toBe(25);

    expect(await countAchievements(seller.userId, 'MARKET_FIRST_PURCHASE')).toBe(0);
    expect(await countAchievements(buyer.userId, 'MARKET_FIRST_SALE')).toBe(0);
  });
});
