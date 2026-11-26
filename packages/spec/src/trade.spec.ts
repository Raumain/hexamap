import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { app } from '@hexamap/api/app';
import { createDb, type NotificationKind, runMigrations } from '@hexamap/db';
import {
  assertTradeStatus,
  canTransitionTrade,
  isOpenTrade,
  isTradeStatus,
  TRADE_OFFER_TTL_MS,
  TRADE_STATUSES,
  tradeExpiresAt,
} from '@hexamap/shared';

const db = createDb(process.env.DATABASE_URL ?? '');

const baseUrl = 'http://localhost:3000';
const origin = 'http://localhost:5174';

const prefix = crypto.randomUUID().slice(0, 8);
const createdUserIds: string[] = [];

interface Player {
  cookie: string;
  userId: string;
  pseudo: string;
}

interface OfferBody {
  offer: {
    id: string;
    status: string;
    proposer: { id: string; pseudo: string | null };
    receiver: { id: string; pseudo: string | null };
    offeredCard: { id: string; category: string; nom: string; score: number };
    requestedCard: { id: string; category: string; nom: string; score: number };
  };
}

interface OfferListBody {
  offers: Array<{ id: string; status: string }>;
}

interface ErrorBody {
  code: string;
  message: string;
}

function extractSessionCookie(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(';')[0])
    .join('; ');
}

async function signUp(label: string): Promise<Player> {
  const pseudo = `${prefix}-${label}-${crypto.randomUUID().slice(0, 4)}`;
  const email = `spec-${prefix}-${crypto.randomUUID()}@hexamap.test`;
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
  return { cookie: extractSessionCookie(res), userId: body.user.id, pseudo };
}

async function authFetch(path: string, init: RequestInit = {}, cookie?: string): Promise<Response> {
  const headers = new Headers(init.headers);
  if (!headers.has('origin')) headers.set('origin', origin);
  if (cookie) headers.set('cookie', cookie);
  return app.handle(new Request(`${baseUrl}${path}`, { ...init, headers }));
}

async function createCard(
  userId: string,
  category: 'REGION' | 'DEPARTEMENT' | 'COMMUNE' | 'RUE',
  refCode: string,
  options: { rarity?: 'RARE' | 'EPIQUE' | 'COMMUNE'; score?: number; locked?: boolean } = {},
): Promise<string> {
  const inserted = await db
    .insertInto('user_cards')
    .values({
      user_id: userId,
      category,
      ref_code: refCode,
      rarity: options.rarity ?? 'RARE',
      score: options.score ?? 750,
      locked: options.locked ?? false,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return inserted.id;
}

async function propose(
  proposer: Player,
  offeredCardId: string,
  requestedCardId: string,
): Promise<Response> {
  return authFetch(
    '/api/v1/trades',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ offeredCardId, requestedCardId }),
    },
    proposer.cookie,
  );
}

async function accept(player: Player, offerId: string): Promise<Response> {
  return authFetch(`/api/v1/trades/${offerId}/accept`, { method: 'POST' }, player.cookie);
}

interface FriendCardsBody {
  cards: Array<{
    id: string;
    category: string;
    refCode: string;
    rarity: string;
    score: number;
    nom: string;
    blasonUrl: string | null;
    blasonCredit: string | null;
  }>;
}

async function befriend(
  requester: Player,
  addressee: Player,
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' = 'ACCEPTED',
): Promise<void> {
  await db
    .insertInto('friendships')
    .values({ requester_id: requester.userId, addressee_id: addressee.userId, status })
    .execute();
}

async function friendCards(viewer: Player, friendId: string): Promise<Response> {
  return authFetch(`/api/v1/trades/friends/${friendId}/cards`, {}, viewer.cookie);
}

async function cardOwner(cardId: string): Promise<string | null> {
  const row = await db
    .selectFrom('user_cards')
    .select('user_id')
    .where('id', '=', cardId)
    .executeTakeFirst();
  return row?.user_id ?? null;
}

async function notificationsOf(userId: string, kind: NotificationKind) {
  return db
    .selectFrom('notifications')
    .selectAll()
    .where('user_id', '=', userId)
    .where('kind', '=', kind)
    .execute();
}

/** Deux joueurs neufs et une offre acceptée d'avance quand le cas en a besoin. */
async function twoPlayers(): Promise<{ alice: Player; bob: Player }> {
  const alice = await signUp('alice');
  const bob = await signUp('bob');
  return { alice, bob };
}

beforeAll(async () => {
  await runMigrations(db);
});

afterAll(async () => {
  if (createdUserIds.length > 0) {
    // `trade_offers`, `user_cards`, `market_listings` et `notifications`
    // portent `on delete cascade` : supprimer l'utilisateur suffit.
    await db.deleteFrom('user').where('id', 'in', createdUserIds).execute();
  }
  await db.destroy();
});

describe('Troc — machine à états', () => {
  it('les cinq statuts sont connus, un statut forgé est refusé', () => {
    expect(TRADE_STATUSES).toEqual(['PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED', 'EXPIRED']);

    for (const status of TRADE_STATUSES) {
      expect(isTradeStatus(status)).toBe(true);
    }

    expect(isTradeStatus('SOLD')).toBe(false);
    expect(isTradeStatus('')).toBe(false);
    expect(isTradeStatus(null)).toBe(false);
    expect(isTradeStatus(42)).toBe(false);
    expect(() => assertTradeStatus('ARCHIVED')).toThrow();
    expect(() => assertTradeStatus('PENDING')).not.toThrow();
  });

  it('seul PENDING change d’état, et jamais vers PENDING', () => {
    for (const to of ['ACCEPTED', 'DECLINED', 'CANCELLED', 'EXPIRED'] as const) {
      expect(canTransitionTrade('PENDING', to)).toBe(true);
    }
    expect(canTransitionTrade('PENDING', 'PENDING')).toBe(false);

    for (const from of ['ACCEPTED', 'DECLINED', 'CANCELLED', 'EXPIRED'] as const) {
      for (const to of TRADE_STATUSES) {
        expect(canTransitionTrade(from, to)).toBe(false);
      }
    }
  });

  it('une offre vit sept jours, sans dérive d’horloge', () => {
    expect(TRADE_OFFER_TTL_MS).toBe(7 * 24 * 60 * 60 * 1000);

    const from = new Date('2026-01-01T00:00:00.000Z');
    expect(tradeExpiresAt(from).toISOString()).toBe('2026-01-08T00:00:00.000Z');
    expect(from.toISOString()).toBe('2026-01-01T00:00:00.000Z');

    expect(isOpenTrade('PENDING')).toBe(true);
    expect(isOpenTrade('EXPIRED')).toBe(false);
  });
});

describe('Troc — proposition', () => {
  it('engage les deux cartes, sort les deux boîtes et prévient le destinataire', async () => {
    const { alice, bob } = await twoPlayers();
    const offered = await createCard(alice.userId, 'REGION', `${prefix}-R1`);
    const requested = await createCard(bob.userId, 'COMMUNE', `${prefix}-C1`, { score: 1600 });

    const res = await propose(alice, offered, requested);
    expect(res.status).toBe(201);
    const body = (await res.json()) as OfferBody;

    expect(body.offer.status).toBe('PENDING');
    expect(body.offer.proposer.id).toBe(alice.userId);
    expect(body.offer.receiver.id).toBe(bob.userId);
    expect(body.offer.offeredCard.id).toBe(offered);
    expect(body.offer.requestedCard.id).toBe(requested);
    expect(body.offer.offeredCard.nom).toBeString();

    const received = (await (
      await authFetch('/api/v1/trades?box=received', {}, bob.cookie)
    ).json()) as OfferListBody;
    expect(received.offers.map((offer) => offer.id)).toContain(body.offer.id);

    const sent = (await (
      await authFetch('/api/v1/trades?box=sent', {}, alice.cookie)
    ).json()) as OfferListBody;
    expect(sent.offers.map((offer) => offer.id)).toContain(body.offer.id);

    const aliceReceived = (await (
      await authFetch('/api/v1/trades?box=received', {}, alice.cookie)
    ).json()) as OfferListBody;
    expect(aliceReceived.offers.map((offer) => offer.id)).not.toContain(body.offer.id);

    const notices = await notificationsOf(bob.userId, 'TRADE_OFFER');
    expect(notices).toHaveLength(1);
    expect(notices[0]?.dedupe_key).toBe(`TRADE_OFFER:${body.offer.id}`);
  });

  it('refuse une carte contre elle-même', async () => {
    const { alice } = await twoPlayers();
    const card = await createCard(alice.userId, 'REGION', `${prefix}-R2`);

    const res = await propose(alice, card, card);
    expect(res.status).toBe(400);
    expect(((await res.json()) as ErrorBody).code).toBe('TRADE_SELF_OFFER');
  });

  it('refuse une carte que le proposant ne possède pas', async () => {
    const { alice, bob } = await twoPlayers();
    const bobCard = await createCard(bob.userId, 'REGION', `${prefix}-R3`);
    const bobOther = await createCard(bob.userId, 'REGION', `${prefix}-R4`);

    const res = await propose(alice, bobCard, bobOther);
    expect(res.status).toBe(403);
    expect(((await res.json()) as ErrorBody).code).toBe('CARD_NOT_OWNED');
  });

  it('refuse une carte verrouillée par une vente', async () => {
    const { alice, bob } = await twoPlayers();
    const offered = await createCard(alice.userId, 'REGION', `${prefix}-R5`, { locked: true });
    const requested = await createCard(bob.userId, 'REGION', `${prefix}-R6`);

    const res = await propose(alice, offered, requested);
    expect(res.status).toBe(409);
    expect(((await res.json()) as ErrorBody).code).toBe('CARD_LOCKED');
  });

  it('refuse une carte déjà engagée, dans les deux sens', async () => {
    const { alice, bob } = await twoPlayers();
    const carol = await signUp('carol');

    const aliceCard = await createCard(alice.userId, 'REGION', `${prefix}-R7`);
    const bobCard = await createCard(bob.userId, 'REGION', `${prefix}-R8`);
    const carolCard = await createCard(carol.userId, 'REGION', `${prefix}-R9`);

    expect((await propose(alice, aliceCard, bobCard)).status).toBe(201);

    // La même carte offerte une seconde fois.
    expect((await propose(alice, aliceCard, carolCard)).status).toBe(409);
    expect(((await (await propose(alice, aliceCard, carolCard)).json()) as ErrorBody).code).toBe(
      'CARD_ALREADY_IN_TRADE',
    );

    // La carte demandée, réclamée par une autre offre.
    expect((await propose(carol, carolCard, bobCard)).status).toBe(409);
  });
});

describe('Troc — acceptation', () => {
  it('transfère les deux cartes, accepte et prévient les deux camps', async () => {
    const { alice, bob } = await twoPlayers();
    const offered = await createCard(alice.userId, 'REGION', `${prefix}-R10`);
    const requested = await createCard(bob.userId, 'COMMUNE', `${prefix}-C10`);

    const created = (await (await propose(alice, offered, requested)).json()) as OfferBody;
    const res = await accept(bob, created.offer.id);
    expect(res.status).toBe(200);
    expect(((await res.json()) as OfferBody).offer.status).toBe('ACCEPTED');

    expect(await cardOwner(offered)).toBe(bob.userId);
    expect(await cardOwner(requested)).toBe(alice.userId);

    // `locked` reste réservé à la vente : le troc ne le pose jamais.
    const moved = await db
      .selectFrom('user_cards')
      .select(['locked'])
      .where('id', '=', offered)
      .executeTakeFirstOrThrow();
    expect(moved.locked).toBe(false);

    expect(await notificationsOf(alice.userId, 'TRADE_ACCEPTED')).toHaveLength(1);
    expect(await notificationsOf(bob.userId, 'TRADE_ACCEPTED')).toHaveLength(1);
  });

  it('une seconde acceptation répond 409 et ne bouge aucune carte', async () => {
    const { alice, bob } = await twoPlayers();
    const offered = await createCard(alice.userId, 'REGION', `${prefix}-R11`);
    const requested = await createCard(bob.userId, 'REGION', `${prefix}-R12`);

    const created = (await (await propose(alice, offered, requested)).json()) as OfferBody;

    expect((await accept(bob, created.offer.id)).status).toBe(200);

    const second = await accept(bob, created.offer.id);
    expect(second.status).toBe(409);
    expect(((await second.json()) as ErrorBody).code).toBe('TRADE_OFFER_NOT_PENDING');

    expect(await cardOwner(offered)).toBe(bob.userId);
    expect(await cardOwner(requested)).toBe(alice.userId);
  });

  it('un tiers ne peut ni accepter ni refuser', async () => {
    const { alice, bob } = await twoPlayers();
    const carol = await signUp('carol');
    const offered = await createCard(alice.userId, 'REGION', `${prefix}-R13`);
    const requested = await createCard(bob.userId, 'REGION', `${prefix}-R14`);

    const created = (await (await propose(alice, offered, requested)).json()) as OfferBody;

    const refused = await accept(carol, created.offer.id);
    expect(refused.status).toBe(403);
    expect(((await refused.json()) as ErrorBody).code).toBe('NOT_TRADE_RECEIVER');

    const decline = await authFetch(
      `/api/v1/trades/${created.offer.id}/decline`,
      { method: 'POST' },
      carol.cookie,
    );
    expect(decline.status).toBe(403);
    expect(((await decline.json()) as ErrorBody).code).toBe('NOT_TRADE_RECEIVER');

    expect(await cardOwner(offered)).toBe(alice.userId);
  });

  it('le destinataire refuse, l’auteur est prévenu, les cartes restent', async () => {
    const { alice, bob } = await twoPlayers();
    const offered = await createCard(alice.userId, 'REGION', `${prefix}-R15`);
    const requested = await createCard(bob.userId, 'REGION', `${prefix}-R16`);

    const created = (await (await propose(alice, offered, requested)).json()) as OfferBody;

    const res = await authFetch(
      `/api/v1/trades/${created.offer.id}/decline`,
      { method: 'POST' },
      bob.cookie,
    );
    expect(res.status).toBe(200);
    expect(((await res.json()) as OfferBody).offer.status).toBe('DECLINED');

    expect(await cardOwner(offered)).toBe(alice.userId);
    expect(await cardOwner(requested)).toBe(bob.userId);
    expect(await notificationsOf(alice.userId, 'TRADE_DECLINED')).toHaveLength(1);

    // Une offre refusée ne s'accepte plus.
    expect((await accept(bob, created.offer.id)).status).toBe(409);
  });

  it('seul l’auteur annule, et le destinataire l’apprend', async () => {
    const { alice, bob } = await twoPlayers();
    const offered = await createCard(alice.userId, 'REGION', `${prefix}-R17`);
    const requested = await createCard(bob.userId, 'REGION', `${prefix}-R18`);

    const created = (await (await propose(alice, offered, requested)).json()) as OfferBody;

    const byReceiver = await authFetch(
      `/api/v1/trades/${created.offer.id}/cancel`,
      { method: 'POST' },
      bob.cookie,
    );
    expect(byReceiver.status).toBe(403);
    expect(((await byReceiver.json()) as ErrorBody).code).toBe('NOT_TRADE_PROPOSER');

    const res = await authFetch(
      `/api/v1/trades/${created.offer.id}/cancel`,
      { method: 'POST' },
      alice.cookie,
    );
    expect(res.status).toBe(200);
    expect(((await res.json()) as OfferBody).offer.status).toBe('CANCELLED');

    expect(await cardOwner(offered)).toBe(alice.userId);
    expect(await notificationsOf(bob.userId, 'TRADE_DECLINED')).toHaveLength(1);
  });
});

describe('Troc — expiration', () => {
  it('une offre expirée ne se refuse plus : le balayage passe avant la réponse', async () => {
    const { alice, bob } = await twoPlayers();
    const offered = await createCard(alice.userId, 'REGION', `${prefix}-R25`);
    const requested = await createCard(bob.userId, 'REGION', `${prefix}-R26`);

    const created = (await (await propose(alice, offered, requested)).json()) as OfferBody;

    await db
      .updateTable('trade_offers')
      .set({ expires_at: new Date(Date.now() - 60_000) })
      .where('id', '=', created.offer.id)
      .execute();

    const refusal = await authFetch(
      `/api/v1/trades/${created.offer.id}/decline`,
      { method: 'POST' },
      bob.cookie,
    );
    expect(refusal.status).toBe(409);
    expect(((await refusal.json()) as ErrorBody).code).toBe('TRADE_OFFER_NOT_PENDING');

    // Le statut est EXPIRED, jamais DECLINED : c'est l'expiration qui a tranché.
    const row = await db
      .selectFrom('trade_offers')
      .select('status')
      .where('id', '=', created.offer.id)
      .executeTakeFirstOrThrow();
    expect(row.status).toBe('EXPIRED');
  });

  it('une offre expirée libère ses cartes, le dit aux deux camps et se repropose', async () => {
    const { alice, bob } = await twoPlayers();
    const offered = await createCard(alice.userId, 'REGION', `${prefix}-R19`);
    const requested = await createCard(bob.userId, 'REGION', `${prefix}-R20`);

    const created = (await (await propose(alice, offered, requested)).json()) as OfferBody;

    await db
      .updateTable('trade_offers')
      .set({ expires_at: new Date(Date.now() - 60_000) })
      .where('id', '=', created.offer.id)
      .execute();

    // La lecture fait tourner le balayage : aucun ordonnanceur n'existe.
    const listed = (await (
      await authFetch('/api/v1/trades?box=received', {}, bob.cookie)
    ).json()) as OfferListBody;
    expect(listed.offers.find((offer) => offer.id === created.offer.id)?.status).toBe('EXPIRED');

    const expired = await db
      .selectFrom('trade_offers')
      .select(['status', 'responded_at'])
      .where('id', '=', created.offer.id)
      .executeTakeFirstOrThrow();
    expect(expired.status).toBe('EXPIRED');
    expect(expired.responded_at).not.toBeNull();

    expect(await notificationsOf(alice.userId, 'TRADE_EXPIRED')).toHaveLength(1);
    expect(await notificationsOf(bob.userId, 'TRADE_EXPIRED')).toHaveLength(1);

    // Les deux index partiels sont de nouveau libres.
    const retried = await propose(alice, offered, requested);
    expect(retried.status).toBe(201);

    // Accepter l'offre morte répond 409 : elle n'est plus en attente.
    expect((await accept(bob, created.offer.id)).status).toBe(409);
  });
});

describe('Troc — marché', () => {
  it('une carte engagée n’entre pas en vente et n’apparaît dans aucune annonce', async () => {
    const { alice, bob } = await twoPlayers();
    const offered = await createCard(alice.userId, 'REGION', `${prefix}-R21`);
    const requested = await createCard(bob.userId, 'REGION', `${prefix}-R22`);

    expect((await propose(alice, offered, requested)).status).toBe(201);

    const listing = await authFetch(
      '/api/v1/market/listings',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userCardId: offered, price: 10 }),
      },
      alice.cookie,
    );
    expect(listing.status).toBe(409);
    expect(((await listing.json()) as ErrorBody).code).toBe('CARD_IN_TRADE');

    const market = (await (await authFetch('/api/v1/market/listings', {}, bob.cookie)).json()) as {
      items: Array<{ card: { id: string } }>;
    };
    expect(market.items.map((item) => item.card.id)).not.toContain(offered);
  });

  it('une offre expirée ne bloque plus la vente de sa carte', async () => {
    const { alice, bob } = await twoPlayers();
    const offered = await createCard(alice.userId, 'REGION', `${prefix}-R23`);
    const requested = await createCard(bob.userId, 'REGION', `${prefix}-R24`);

    const created = (await (await propose(alice, offered, requested)).json()) as OfferBody;

    await db
      .updateTable('trade_offers')
      .set({ expires_at: new Date(Date.now() - 60_000) })
      .where('id', '=', created.offer.id)
      .execute();

    // Pas de lecture préalable : c'est la mise en vente elle-même qui balaie.
    const listing = await authFetch(
      '/api/v1/market/listings',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userCardId: offered, price: 25 }),
      },
      alice.cookie,
    );
    expect(listing.status).toBe(201);
  });
});

describe('Troc — cartes d’un ami', () => {
  it('un inconnu se voit refuser la collection', async () => {
    const { alice, bob } = await twoPlayers();
    await createCard(bob.userId, 'REGION', `${prefix}-R30`);

    const res = await friendCards(alice, bob.userId);
    expect(res.status).toBe(403);
    expect(((await res.json()) as ErrorBody).code).toBe('FRIEND_REQUIRED');
  });

  it('une demande en attente ou déclinée ne suffit pas', async () => {
    const { alice, bob } = await twoPlayers();
    await befriend(alice, bob, 'PENDING');

    const pending = await friendCards(alice, bob.userId);
    expect(pending.status).toBe(403);
    expect(((await pending.json()) as ErrorBody).code).toBe('FRIEND_REQUIRED');

    await db
      .updateTable('friendships')
      .set({ status: 'DECLINED' })
      .where('addressee_id', '=', bob.userId)
      .execute();

    const declined = await friendCards(alice, bob.userId);
    expect(declined.status).toBe(403);
    expect(((await declined.json()) as ErrorBody).code).toBe('FRIEND_REQUIRED');
  });

  it('un ami accepté ne montre que ses cartes libres, jamais verrouillées ni engagées', async () => {
    const { alice, bob } = await twoPlayers();
    await befriend(bob, alice, 'ACCEPTED');

    const free = await createCard(bob.userId, 'COMMUNE', `${prefix}-C30`, { score: 1600 });
    const locked = await createCard(bob.userId, 'COMMUNE', `${prefix}-C31`, { locked: true });
    const offeredInTrade = await createCard(bob.userId, 'COMMUNE', `${prefix}-C32`);
    const requestedInTrade = await createCard(bob.userId, 'COMMUNE', `${prefix}-C33`);

    const aliceCard = await createCard(alice.userId, 'REGION', `${prefix}-R31`);
    const aliceOther = await createCard(alice.userId, 'REGION', `${prefix}-R32`);

    // Bob offre `offeredInTrade` et Alice réclame `requestedInTrade` : les deux
    // index partiels sont occupés, dans les deux sens.
    expect((await propose(bob, offeredInTrade, aliceCard)).status).toBe(201);
    expect((await propose(alice, aliceOther, requestedInTrade)).status).toBe(201);

    const res = await friendCards(alice, bob.userId);
    expect(res.status).toBe(200);
    const body = (await res.json()) as FriendCardsBody;

    const ids = body.cards.map((card) => card.id);
    expect(ids).toContain(free);
    expect(ids).not.toContain(locked);
    expect(ids).not.toContain(offeredInTrade);
    expect(ids).not.toContain(requestedInTrade);

    const shown = body.cards.find((card) => card.id === free);
    expect(shown?.category).toBe('COMMUNE');
    expect(shown?.refCode).toBe(`${prefix}-C30`);
    expect(shown?.rarity).toBe('RARE');
    expect(shown?.score).toBe(1600);
    expect(shown?.nom).toBeString();
  });

  it('sa propre collection se lit au Cadastre, pas par cette route', async () => {
    const { alice } = await twoPlayers();

    const res = await friendCards(alice, alice.userId);
    expect(res.status).toBe(400);
    expect(((await res.json()) as ErrorBody).code).toBe('FRIEND_SELF');
  });

  it('un joueur disparu répond 404', async () => {
    const { alice } = await twoPlayers();

    const res = await friendCards(alice, crypto.randomUUID());
    expect(res.status).toBe(404);
    expect(((await res.json()) as ErrorBody).code).toBe('USER_NOT_FOUND');
  });
});
