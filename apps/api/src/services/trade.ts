import type { CardCategory, Database, Rarity, TradeStatus } from '@hexamap/db';
import { assertTradeStatus, isOpenTrade, tradeExpiresAt } from '@hexamap/shared';
import type { Transaction } from 'kysely';
import { db } from '../db';
import { HttpError } from '../lib/http-error';
import {
  type CardAssets,
  cardNomKey,
  type Executor,
  resolveCardAssets,
  resolveCardNoms,
} from './draw';
import { pairCondition } from './friends';
import { emitNotification } from './notifications';

/** Carte telle qu'une offre la rend : assez pour dessiner une planche, rien de plus. */
export interface TradeCardView {
  id: string;
  category: CardCategory;
  refCode: string;
  nom: string;
  blasonUrl: string | null;
  blasonCredit: string | null;
  rarity: Rarity;
  score: number;
}

/** Une offre complète : les deux camps, les deux cartes, les deux horodatages. */
export interface TradeOfferView {
  id: string;
  status: TradeStatus;
  createdAt: string;
  respondedAt: string | null;
  expiresAt: string;
  proposer: { id: string; pseudo: string | null };
  receiver: { id: string; pseudo: string | null };
  offeredCard: TradeCardView;
  requestedCard: TradeCardView;
}

interface TradeRow {
  id: string;
  status: string;
  createdAt: Date;
  respondedAt: Date | null;
  expiresAt: Date;
  proposerId: string;
  proposerPseudo: string | null;
  receiverId: string;
  receiverPseudo: string | null;
  offeredId: string;
  offeredCategory: CardCategory;
  offeredRefCode: string;
  offeredRarity: Rarity;
  offeredScore: number;
  requestedId: string;
  requestedCategory: CardCategory;
  requestedRefCode: string;
  requestedRarity: Rarity;
  requestedScore: number;
}

const OFFER_SELECT = [
  't.id as id',
  't.status as status',
  't.created_at as createdAt',
  't.responded_at as respondedAt',
  't.expires_at as expiresAt',
  't.proposer_id as proposerId',
  'proposer.pseudo as proposerPseudo',
  't.receiver_id as receiverId',
  'receiver.pseudo as receiverPseudo',
  'offered.id as offeredId',
  'offered.category as offeredCategory',
  'offered.ref_code as offeredRefCode',
  'offered.rarity as offeredRarity',
  'offered.score as offeredScore',
  'requested.id as requestedId',
  'requested.category as requestedCategory',
  'requested.ref_code as requestedRefCode',
  'requested.rarity as requestedRarity',
  'requested.score as requestedScore',
] as const;

function offersBase(exec: Executor) {
  return exec
    .selectFrom('trade_offers as t')
    .innerJoin('user as proposer', 'proposer.id', 't.proposer_id')
    .innerJoin('user as receiver', 'receiver.id', 't.receiver_id')
    .innerJoin('user_cards as offered', 'offered.id', 't.offered_card_id')
    .innerJoin('user_cards as requested', 'requested.id', 't.requested_card_id');
}

function toCard(
  id: string,
  category: CardCategory,
  refCode: string,
  rarity: Rarity,
  score: number,
  noms: Map<string, string>,
  assets: Map<string, CardAssets>,
): TradeCardView {
  const key = cardNomKey(category, refCode);
  const asset = assets.get(key);
  return {
    id,
    category,
    refCode,
    nom: noms.get(key) ?? '',
    blasonUrl: asset?.blasonUrl ?? null,
    blasonCredit: asset?.blasonCredit ?? null,
    rarity,
    score,
  };
}

async function toOffers(exec: Executor, rows: TradeRow[]): Promise<TradeOfferView[]> {
  if (rows.length === 0) return [];

  const entries = rows.flatMap((row) => [
    { category: row.offeredCategory, ref_code: row.offeredRefCode },
    { category: row.requestedCategory, ref_code: row.requestedRefCode },
  ]);
  const noms = await resolveCardNoms(exec, entries);
  const assets = await resolveCardAssets(exec, entries);

  return rows.map((row) => {
    assertTradeStatus(row.status);
    return {
      id: row.id,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      respondedAt: row.respondedAt?.toISOString() ?? null,
      expiresAt: row.expiresAt.toISOString(),
      proposer: { id: row.proposerId, pseudo: row.proposerPseudo },
      receiver: { id: row.receiverId, pseudo: row.receiverPseudo },
      offeredCard: toCard(
        row.offeredId,
        row.offeredCategory,
        row.offeredRefCode,
        row.offeredRarity,
        row.offeredScore,
        noms,
        assets,
      ),
      requestedCard: toCard(
        row.requestedId,
        row.requestedCategory,
        row.requestedRefCode,
        row.requestedRarity,
        row.requestedScore,
        noms,
        assets,
      ),
    };
  });
}

export type TradeBox = 'received' | 'sent';

/** Offres d'une boîte, ouvertes d'abord, puis les plus récentes. */
export async function loadOffers(
  exec: Executor,
  userId: string,
  box: TradeBox,
  limit = 50,
): Promise<TradeOfferView[]> {
  const column = box === 'received' ? 't.receiver_id' : 't.proposer_id';
  const rows = await offersBase(exec)
    .select([...OFFER_SELECT])
    .where(column, '=', userId)
    .orderBy('t.created_at', 'desc')
    .limit(limit)
    .execute();
  return toOffers(exec, rows);
}

export async function loadOffer(exec: Executor, offerId: string): Promise<TradeOfferView | null> {
  const row = await offersBase(exec)
    .select([...OFFER_SELECT])
    .where('t.id', '=', offerId)
    .executeTakeFirst();
  if (!row) return null;
  const [offer] = await toOffers(exec, [row]);
  return offer ?? null;
}

/** Forme d'une carte d'ami : la même planche qu'une carte engagée dans une offre. */
export type FriendTradeCard = TradeCardView;

/**
 * La collection **troquable** d'un ami : déverrouillée, et libre de toute offre
 * `PENDING`, dans les deux sens. Seule une amitié `ACCEPTED` l'ouvre — c'est la
 * surface de découverte du troc, la vitrine publique ne la rend jamais.
 *
 * L'expiration paresseuse n'est pas rejouée ici : la liste lit `PENDING` comme
 * les index partiels qui portent l'exclusivité, et le balayage appartient aux
 * surfaces de troc des deux joueurs (aucun ordonnanceur n'existe).
 */
export async function loadFriendTradeCards(
  exec: Executor,
  viewerId: string,
  friendId: string,
): Promise<FriendTradeCard[]> {
  if (viewerId === friendId) {
    throw new HttpError(400, 'FRIEND_SELF', 'Votre propre collection se lit au Cadastre, pas ici.');
  }

  const friend = await exec
    .selectFrom('user')
    .select('id')
    .where('id', '=', friendId)
    .executeTakeFirst();
  if (!friend) {
    throw new HttpError(404, 'USER_NOT_FOUND', 'Ce joueur est introuvable.');
  }

  const relation = await exec
    .selectFrom('friendships')
    .select('status')
    .where((eb) => pairCondition(eb, viewerId, friendId))
    .executeTakeFirst();
  if (relation?.status !== 'ACCEPTED') {
    throw new HttpError(
      403,
      'FRIEND_REQUIRED',
      "Seule une amitié acceptée ouvre la collection d'un joueur.",
    );
  }

  const rows = await exec
    .selectFrom('user_cards')
    .select(['id', 'category', 'ref_code', 'rarity', 'score'])
    .where('user_id', '=', friendId)
    .where('locked', '=', false)
    .orderBy('score', 'desc')
    .orderBy('acquired_at', 'desc')
    .orderBy('id', 'asc')
    .limit(50)
    .execute();

  const busy = new Set<string>();
  const ids = rows.map((row) => row.id);
  if (ids.length > 0) {
    const offers = await exec
      .selectFrom('trade_offers')
      .select(['offered_card_id', 'requested_card_id'])
      .where('status', '=', 'PENDING')
      .where((eb) => eb.or([eb('offered_card_id', 'in', ids), eb('requested_card_id', 'in', ids)]))
      .execute();
    for (const offer of offers) {
      busy.add(offer.offered_card_id);
      busy.add(offer.requested_card_id);
    }
  }

  const free = rows.filter((row) => !busy.has(row.id));
  if (free.length === 0) return [];

  const entries = free.map((row) => ({ category: row.category, ref_code: row.ref_code }));
  const noms = await resolveCardNoms(exec, entries);
  const assets = await resolveCardAssets(exec, entries);

  return free.map((row) =>
    toCard(row.id, row.category, row.ref_code, row.rarity, row.score, noms, assets),
  );
}

/**
 * Une offre dont l'une des cartes est engagée, dans n'importe quel sens.
 * Sert à la proposition (refus) et à la garde du marché.
 */
export async function findOpenOfferForCard(
  exec: Executor,
  cardId: string,
): Promise<{ id: string } | null> {
  const row = await exec
    .selectFrom('trade_offers')
    .select('id')
    .where('status', '=', 'PENDING')
    .where((eb) =>
      eb.or([eb('offered_card_id', '=', cardId), eb('requested_card_id', '=', cardId)]),
    )
    .executeTakeFirst();
  return row ?? null;
}

/**
 * Expiration paresseuse, bornée à l'utilisateur. Aucun ordonnanceur n'existe :
 * la lecture des offres, la proposition, l'acceptation et la mise en vente d'une
 * carte la font tourner. `responded_at` date le constat, comme il date un refus.
 */
export async function expireOffersForUser(
  exec: Executor,
  userId: string,
  now: Date = new Date(),
): Promise<number> {
  const expired = await exec
    .updateTable('trade_offers')
    .set({ status: 'EXPIRED', responded_at: now })
    .where('status', '=', 'PENDING')
    .where('expires_at', '<=', now)
    .where((eb) => eb.or([eb('proposer_id', '=', userId), eb('receiver_id', '=', userId)]))
    .returning(['id', 'proposer_id', 'receiver_id'])
    .execute();

  for (const offer of expired) {
    for (const target of [offer.proposer_id, offer.receiver_id]) {
      await emitNotification(exec, {
        userId: target,
        kind: 'TRADE_EXPIRED',
        ref: offer.id,
        payload: { offerId: offer.id },
      });
    }
  }

  return expired.length;
}

/** `23505` est le code PostgreSQL d'une violation d'unicité. */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { code?: unknown }).code === '23505'
  );
}

async function readPseudo(exec: Executor, userId: string): Promise<string | null> {
  const row = await exec
    .selectFrom('user')
    .select('pseudo')
    .where('id', '=', userId)
    .executeTakeFirst();
  return row?.pseudo ?? null;
}

export interface ProposeTradeInput {
  offeredCardId: string;
  requestedCardId: string;
}

/** Propose une carte contre une autre, sous verrou des deux cartes. */
export async function proposeTrade(
  userId: string,
  input: ProposeTradeInput,
): Promise<TradeOfferView> {
  if (input.offeredCardId === input.requestedCardId) {
    throw new HttpError(
      400,
      'TRADE_SELF_OFFER',
      'Une carte ne peut pas être échangée contre elle-même.',
    );
  }

  let offerId: string;
  try {
    offerId = await db.transaction().execute(async (trx) => {
      const cards = await trx
        .selectFrom('user_cards')
        .selectAll()
        .where('id', 'in', [input.offeredCardId, input.requestedCardId])
        .orderBy('id')
        .forUpdate()
        .execute();

      const offered = cards.find((card) => card.id === input.offeredCardId);
      const requested = cards.find((card) => card.id === input.requestedCardId);

      if (!offered || !requested) {
        throw new HttpError(404, 'CARD_NOT_FOUND', 'Carte introuvable.');
      }
      if (offered.user_id !== userId) {
        throw new HttpError(403, 'CARD_NOT_OWNED', 'Cette carte ne vous appartient pas.');
      }
      if (requested.user_id === userId) {
        throw new HttpError(
          400,
          'TRADE_SELF_OFFER',
          'Vous ne pouvez pas vous échanger une carte à vous-même.',
        );
      }
      if (offered.locked || requested.locked) {
        throw new HttpError(
          409,
          'CARD_LOCKED',
          "L'une des cartes est verrouillée par une vente en cours.",
        );
      }

      const busy = await findOpenOfferForCard(trx, offered.id);
      if (busy) {
        throw new HttpError(
          409,
          'CARD_ALREADY_IN_TRADE',
          "Cette carte est déjà engagée dans une offre d'échange.",
        );
      }
      const busyRequested = await findOpenOfferForCard(trx, requested.id);
      if (busyRequested) {
        throw new HttpError(
          409,
          'CARD_ALREADY_IN_TRADE',
          'Cette carte est déjà demandée par une autre offre.',
        );
      }

      const inserted = await trx
        .insertInto('trade_offers')
        .values({
          proposer_id: userId,
          receiver_id: requested.user_id,
          offered_card_id: offered.id,
          requested_card_id: requested.id,
          expires_at: tradeExpiresAt(new Date()),
        })
        .returning('id')
        .executeTakeFirstOrThrow();

      await emitNotification(trx, {
        userId: requested.user_id,
        kind: 'TRADE_OFFER',
        ref: inserted.id,
        payload: {
          offerId: inserted.id,
          playerId: userId,
          pseudo: await readPseudo(trx, userId),
        },
      });

      return inserted.id;
    });
  } catch (error) {
    // Les index partiels portent l'exclusivité ; deux propositions simultanées
    // sur la même carte sont arbitrées par la base, pas par la lecture ci-dessus.
    if (isUniqueViolation(error)) {
      throw new HttpError(
        409,
        'CARD_ALREADY_IN_TRADE',
        "Cette carte est déjà engagée dans une offre d'échange.",
      );
    }
    throw error;
  }

  const offer = await loadOffer(db, offerId);
  if (!offer) throw new HttpError(404, 'TRADE_OFFER_NOT_FOUND', "Offre d'échange introuvable.");
  return offer;
}

interface LockedOffer {
  id: string;
  proposer_id: string;
  receiver_id: string;
  offered_card_id: string;
  requested_card_id: string;
  status: TradeStatus;
  expires_at: Date;
}

async function lockPendingOffer(
  trx: Transaction<Database>,
  offerId: string,
  userId: string,
  role: 'receiver' | 'proposer',
): Promise<LockedOffer> {
  const offer = await trx
    .selectFrom('trade_offers')
    .selectAll()
    .where('id', '=', offerId)
    .forUpdate()
    .executeTakeFirst();

  if (!offer) {
    throw new HttpError(404, 'TRADE_OFFER_NOT_FOUND', "Offre d'échange introuvable.");
  }

  assertTradeStatus(offer.status);

  const expected = role === 'receiver' ? offer.receiver_id : offer.proposer_id;
  if (expected !== userId) {
    throw new HttpError(
      403,
      role === 'receiver' ? 'NOT_TRADE_RECEIVER' : 'NOT_TRADE_PROPOSER',
      role === 'receiver'
        ? "Vous n'êtes pas le destinataire de cette offre."
        : "Vous n'êtes pas l'auteur de cette offre.",
    );
  }

  if (!isOpenTrade(offer.status)) {
    throw new HttpError(409, 'TRADE_OFFER_NOT_PENDING', "Cette offre n'est plus en attente.");
  }

  return { ...offer, status: offer.status };
}

/** Verrouille les deux cartes dans l'ordre de leur identifiant, puis les relit. */
async function lockOfferCards(trx: Transaction<Database>, offer: LockedOffer) {
  const cards = await trx
    .selectFrom('user_cards')
    .selectAll()
    .where('id', 'in', [offer.offered_card_id, offer.requested_card_id])
    .orderBy('id')
    .forUpdate()
    .execute();

  const offered = cards.find((card) => card.id === offer.offered_card_id);
  const requested = cards.find((card) => card.id === offer.requested_card_id);

  if (!offered || !requested) {
    throw new HttpError(409, 'TRADE_CARD_MOVED', "L'une des cartes n'existe plus.");
  }
  return { offered, requested };
}

/**
 * Accepte une offre : transfert des deux cartes, statut, notifications, dans une
 * seule transaction. Une seconde acceptation trouve `ACCEPTED` et répond 409.
 */
export async function acceptTrade(userId: string, offerId: string): Promise<TradeOfferView> {
  await db.transaction().execute(async (trx) => {
    const offer = await lockPendingOffer(trx, offerId, userId, 'receiver');

    if (offer.expires_at.getTime() <= Date.now()) {
      throw new HttpError(409, 'TRADE_OFFER_EXPIRED', 'Cette offre a expiré.');
    }

    const { offered, requested } = await lockOfferCards(trx, offer);

    if (offered.user_id !== offer.proposer_id || requested.user_id !== offer.receiver_id) {
      throw new HttpError(
        409,
        'TRADE_CARD_MOVED',
        "L'une des cartes a changé de main depuis la proposition.",
      );
    }
    if (offered.locked || requested.locked) {
      throw new HttpError(
        409,
        'CARD_LOCKED',
        "L'une des cartes est verrouillée par une vente en cours.",
      );
    }

    await trx
      .updateTable('user_cards')
      .set({ user_id: offer.receiver_id })
      .where('id', '=', offered.id)
      .execute();

    await trx
      .updateTable('user_cards')
      .set({ user_id: offer.proposer_id })
      .where('id', '=', requested.id)
      .execute();

    await trx
      .updateTable('trade_offers')
      .set({ status: 'ACCEPTED', responded_at: new Date() })
      .where('id', '=', offer.id)
      .execute();

    for (const target of [offer.proposer_id, offer.receiver_id]) {
      await emitNotification(trx, {
        userId: target,
        kind: 'TRADE_ACCEPTED',
        ref: offer.id,
        payload: { offerId: offer.id },
      });
    }
  });

  const offer = await loadOffer(db, offerId);
  if (!offer) throw new HttpError(404, 'TRADE_OFFER_NOT_FOUND', "Offre d'échange introuvable.");
  return offer;
}

/** Refuse une offre : le proposant l'apprend, les cartes ne bougent pas. */
export async function declineTrade(userId: string, offerId: string): Promise<TradeOfferView> {
  await db.transaction().execute(async (trx) => {
    const offer = await lockPendingOffer(trx, offerId, userId, 'receiver');

    await trx
      .updateTable('trade_offers')
      .set({ status: 'DECLINED', responded_at: new Date() })
      .where('id', '=', offer.id)
      .execute();

    await emitNotification(trx, {
      userId: offer.proposer_id,
      kind: 'TRADE_DECLINED',
      ref: offer.id,
      payload: { offerId: offer.id },
    });
  });

  const offer = await loadOffer(db, offerId);
  if (!offer) throw new HttpError(404, 'TRADE_OFFER_NOT_FOUND', "Offre d'échange introuvable.");
  return offer;
}

/**
 * Annule une offre : seul l'auteur le peut. Le destinataire est prévenu par
 * `TRADE_DECLINED` avec `withdrawn`, faute d'un cinquième `kind` au contrat.
 */
export async function cancelTrade(userId: string, offerId: string): Promise<TradeOfferView> {
  await db.transaction().execute(async (trx) => {
    const offer = await lockPendingOffer(trx, offerId, userId, 'proposer');

    await trx
      .updateTable('trade_offers')
      .set({ status: 'CANCELLED', responded_at: new Date() })
      .where('id', '=', offer.id)
      .execute();

    await emitNotification(trx, {
      userId: offer.receiver_id,
      kind: 'TRADE_DECLINED',
      ref: offer.id,
      payload: { offerId: offer.id, withdrawn: true },
    });
  });

  const offer = await loadOffer(db, offerId);
  if (!offer) throw new HttpError(404, 'TRADE_OFFER_NOT_FOUND', "Offre d'échange introuvable.");
  return offer;
}
