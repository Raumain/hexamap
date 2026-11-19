import type { Database, FriendshipStatus } from '@hexamap/db';
import { type ExpressionBuilder, type Kysely, sql } from 'kysely';

export type FriendErrorCode =
  | 'SELF_FRIENDSHIP'
  | 'PLAYER_NOT_FOUND'
  | 'FRIENDSHIP_EXISTS'
  | 'FRIENDSHIP_BLOCKED'
  | 'FRIEND_REQUEST_REOPEN_TOO_SOON'
  | 'FRIEND_REQUEST_NOT_CANCELLABLE'
  | 'FRIENDSHIP_DECLINED'
  | 'FRIENDSHIP_NOT_FOUND'
  | 'FRIEND_REQUEST_CAP_REACHED'
  | 'SELF_BLOCK';

export interface FriendEntry {
  id: string;
  status: FriendshipStatus;
  createdAt: string;
  player: { id: string; pseudo: string | null };
}

export interface FriendLists {
  friends: FriendEntry[];
  incoming: FriendEntry[];
  outgoing: FriendEntry[];
}

export type FriendResult<T> = { ok: true; value: T } | { ok: false; code: FriendErrorCode };

export interface PlayerRef {
  id: string;
  pseudo: string | null;
}

interface FriendshipRow {
  requester_id: string;
  addressee_id: string;
  status: FriendshipStatus;
  created_at: Date;
}

interface FriendshipPairRow extends FriendshipRow {
  responded_at: Date | null;
}

/**
 * La seule règle de paire du service : une relation appartient à la paire, quel que
 * soit le sens de la demande. Toute lecture ou écriture symétrique passe par ici.
 */
export function pairCondition(
  eb: ExpressionBuilder<Database, 'friendships'>,
  a: string,
  b: string,
) {
  return eb.or([
    eb.and([eb('requester_id', '=', a), eb('addressee_id', '=', b)]),
    eb.and([eb('requester_id', '=', b), eb('addressee_id', '=', a)]),
  ]);
}

/** Le pendant de `pairCondition` pour le blocage, qui est lui aussi symétrique. */
export function blockCondition(eb: ExpressionBuilder<Database, 'blocks'>, a: string, b: string) {
  return eb.or([
    eb.and([eb('blocker_id', '=', a), eb('blocked_id', '=', b)]),
    eb.and([eb('blocker_id', '=', b), eb('blocked_id', '=', a)]),
  ]);
}

export async function readGameConfigNumber(db: Kysely<Database>, key: string): Promise<number> {
  const row = await db
    .selectFrom('game_config')
    .select('value')
    .where('key', '=', key)
    .executeTakeFirst();

  if (!row) {
    throw new Error(`game_config : clé ${key} absente.`);
  }

  if (typeof row.value !== 'number' || !Number.isFinite(row.value)) {
    throw new Error(`game_config : clé ${key} n'est pas un nombre.`);
  }

  return row.value;
}

export async function findPlayerByPseudo(
  db: Kysely<Database>,
  pseudo: string,
): Promise<PlayerRef | null> {
  const rows = await db
    .selectFrom('user')
    .select(['id', 'pseudo'])
    .where(sql<boolean>`lower(pseudo) = lower(${pseudo})`)
    .limit(2)
    .execute();

  if (rows.length !== 1) return null;
  return rows[0] ?? null;
}

export async function isBlockedBetween(
  db: Kysely<Database>,
  a: string,
  b: string,
): Promise<boolean> {
  const row = await db
    .selectFrom('blocks')
    .select('blocker_id')
    .where((eb) => blockCondition(eb, a, b))
    .limit(1)
    .executeTakeFirst();

  return row !== undefined;
}

function toEntry(row: FriendshipRow, other: PlayerRef): FriendEntry {
  return {
    id: other.id,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    player: { id: other.id, pseudo: other.pseudo },
  };
}

async function readPairRow(
  db: Kysely<Database>,
  a: string,
  b: string,
  options: { forUpdate?: boolean } = {},
): Promise<FriendshipPairRow | undefined> {
  const base = db
    .selectFrom('friendships')
    .select(['requester_id', 'addressee_id', 'status', 'created_at', 'responded_at'])
    .where((eb) => pairCondition(eb, a, b))
    .limit(1);

  return options.forUpdate ? base.forUpdate().executeTakeFirst() : base.executeTakeFirst();
}

async function readPlayer(db: Kysely<Database>, id: string): Promise<PlayerRef | undefined> {
  return db.selectFrom('user').select(['id', 'pseudo']).where('id', '=', id).executeTakeFirst();
}

async function isOverDailyCap(
  db: Kysely<Database>,
  userId: string,
  extra: number,
): Promise<boolean> {
  const cap = await readGameConfigNumber(db, 'FRIEND_REQUEST_DAILY_CAP');
  const sentToday = await db
    .selectFrom('friendships')
    .select(db.fn.countAll<string>().as('total'))
    .where('requester_id', '=', userId)
    .where(sql<boolean>`created_at >= date_trunc('day', now())`)
    .executeTakeFirstOrThrow();

  return Number(sentToday.total) + extra > cap;
}

async function wasCreatedToday(
  db: Kysely<Database>,
  requesterId: string,
  addresseeId: string,
): Promise<boolean> {
  const row = await db
    .selectFrom('friendships')
    .select(sql<boolean>`created_at >= date_trunc('day', now())`.as('today'))
    .where('requester_id', '=', requesterId)
    .where('addressee_id', '=', addresseeId)
    .executeTakeFirst();

  return row?.today === true;
}

export async function listFriends(db: Kysely<Database>, userId: string): Promise<FriendLists> {
  const rows = await db
    .selectFrom('friendships')
    .select(['requester_id', 'addressee_id', 'status', 'created_at'])
    .where((eb) => eb.or([eb('requester_id', '=', userId), eb('addressee_id', '=', userId)]))
    .where('status', 'in', ['PENDING', 'ACCEPTED'])
    .orderBy('created_at', 'desc')
    .execute();

  const otherIds = [
    ...new Set(
      rows.map((row) => (row.requester_id === userId ? row.addressee_id : row.requester_id)),
    ),
  ];
  const players =
    otherIds.length > 0
      ? await db.selectFrom('user').select(['id', 'pseudo']).where('id', 'in', otherIds).execute()
      : [];
  const byId = new Map(players.map((player) => [player.id, player]));

  const lists: FriendLists = { friends: [], incoming: [], outgoing: [] };
  for (const row of rows) {
    const otherId = row.requester_id === userId ? row.addressee_id : row.requester_id;
    const other = byId.get(otherId);
    if (!other) continue;

    const entry = toEntry(row, other);
    if (row.status === 'ACCEPTED') {
      lists.friends.push(entry);
    } else if (row.requester_id === userId) {
      lists.outgoing.push(entry);
    } else {
      lists.incoming.push(entry);
    }
  }

  return lists;
}

type SentRequest = FriendResult<{ request: FriendEntry; created: boolean }>;

export async function sendRequest(
  db: Kysely<Database>,
  userId: string,
  targetId: string,
): Promise<SentRequest> {
  if (userId === targetId) {
    return { ok: false, code: 'SELF_FRIENDSHIP' };
  }

  // Une seule transaction : relecture verrouillée, blocage, plafond et écriture.
  return db.transaction().execute(async (trx): Promise<SentRequest> => {
    const target = await readPlayer(trx, targetId);
    if (!target) {
      return { ok: false, code: 'PLAYER_NOT_FOUND' };
    }

    if (await isBlockedBetween(trx, userId, targetId)) {
      return { ok: false, code: 'FRIENDSHIP_BLOCKED' };
    }

    const existing = await readPairRow(trx, userId, targetId, { forUpdate: true });

    if (existing) {
      if (existing.status === 'ACCEPTED') {
        return { ok: false, code: 'FRIENDSHIP_EXISTS' };
      }

      if (existing.status === 'PENDING') {
        if (existing.requester_id === userId) {
          return { ok: true, value: { request: toEntry(existing, target), created: false } };
        }

        // Demande inversée en attente : deux consentements valent acceptation mutuelle.
        const accepted = await trx
          .updateTable('friendships')
          .set({ status: 'ACCEPTED', responded_at: new Date() })
          .where('requester_id', '=', targetId)
          .where('addressee_id', '=', userId)
          .where('status', '=', 'PENDING')
          .returning(['requester_id', 'addressee_id', 'status', 'created_at'])
          .executeTakeFirst();

        if (!accepted) {
          const current = await readPairRow(trx, userId, targetId);
          if (current?.status === 'ACCEPTED') {
            return { ok: true, value: { request: toEntry(current, target), created: false } };
          }
          return { ok: false, code: 'FRIENDSHIP_NOT_FOUND' };
        }

        return { ok: true, value: { request: toEntry(accepted, target), created: false } };
      }

      // Ligne DECLINED : seul le demandeur d'origine peut la rouvrir, après le délai.
      // Tout autre appelant reçoit un refus définitif — « réessayez plus tard » lui
      // mentirait, il ne pourra jamais rouvrir cette demande.
      if (existing.requester_id !== userId) {
        return { ok: false, code: 'FRIENDSHIP_DECLINED' };
      }

      const reopenMs = await readGameConfigNumber(trx, 'FRIEND_REQUEST_REOPEN_MS');
      const respondedAt = existing.responded_at?.getTime() ?? Number.NEGATIVE_INFINITY;
      if (respondedAt + reopenMs > Date.now()) {
        return { ok: false, code: 'FRIEND_REQUEST_REOPEN_TOO_SOON' };
      }

      // Une réouverture est une demande envoyée : le plafond s'y applique aussi.
      const counted = (await wasCreatedToday(trx, userId, targetId)) ? 0 : 1;
      if (await isOverDailyCap(trx, userId, counted)) {
        return { ok: false, code: 'FRIEND_REQUEST_CAP_REACHED' };
      }

      const reopened = await trx
        .updateTable('friendships')
        .set({ status: 'PENDING', responded_at: null })
        .where('requester_id', '=', userId)
        .where('addressee_id', '=', targetId)
        .where('status', '=', 'DECLINED')
        .returning(['requester_id', 'addressee_id', 'status', 'created_at'])
        .executeTakeFirst();

      if (!reopened) {
        const current = await readPairRow(trx, userId, targetId);
        if (current?.status === 'ACCEPTED') {
          return { ok: false, code: 'FRIENDSHIP_EXISTS' };
        }
        return { ok: false, code: 'FRIENDSHIP_NOT_FOUND' };
      }

      return { ok: true, value: { request: toEntry(reopened, target), created: false } };
    }

    if (await isOverDailyCap(trx, userId, 1)) {
      return { ok: false, code: 'FRIEND_REQUEST_CAP_REACHED' };
    }

    // `on conflict do nothing` couvre l'index de paire : une insertion concurrente
    // ne lève jamais 23505 et ne laisse pas la transaction en erreur.
    const inserted = await trx
      .insertInto('friendships')
      .values({ requester_id: userId, addressee_id: targetId })
      .onConflict((oc) => oc.doNothing())
      .returning(['requester_id', 'addressee_id', 'status', 'created_at'])
      .executeTakeFirst();

    if (inserted) {
      return { ok: true, value: { request: toEntry(inserted, target), created: true } };
    }

    const current = await readPairRow(trx, userId, targetId);
    if (!current) {
      return { ok: false, code: 'FRIENDSHIP_NOT_FOUND' };
    }
    if (current.status === 'ACCEPTED') {
      return { ok: false, code: 'FRIENDSHIP_EXISTS' };
    }
    if (current.status === 'PENDING') {
      return { ok: true, value: { request: toEntry(current, target), created: false } };
    }
    if (current.requester_id !== userId) {
      return { ok: false, code: 'FRIENDSHIP_DECLINED' };
    }
    return { ok: false, code: 'FRIEND_REQUEST_REOPEN_TOO_SOON' };
  });
}

async function respondTo(
  db: Kysely<Database>,
  userId: string,
  otherId: string,
  status: 'ACCEPTED' | 'DECLINED',
): Promise<FriendResult<{ request: FriendEntry }>> {
  const other = await readPlayer(db, otherId);
  if (!other) {
    return { ok: false, code: 'FRIENDSHIP_NOT_FOUND' };
  }

  const row = await db
    .updateTable('friendships')
    .set({ status, responded_at: new Date() })
    .where('requester_id', '=', otherId)
    .where('addressee_id', '=', userId)
    .where('status', '=', 'PENDING')
    .returning(['requester_id', 'addressee_id', 'status', 'created_at'])
    .executeTakeFirst();

  if (!row) {
    return { ok: false, code: 'FRIENDSHIP_NOT_FOUND' };
  }

  return { ok: true, value: { request: toEntry(row, other) } };
}

export function acceptRequest(
  db: Kysely<Database>,
  userId: string,
  otherId: string,
): Promise<FriendResult<{ request: FriendEntry }>> {
  return respondTo(db, userId, otherId, 'ACCEPTED');
}

export function declineRequest(
  db: Kysely<Database>,
  userId: string,
  otherId: string,
): Promise<FriendResult<{ request: FriendEntry }>> {
  return respondTo(db, userId, otherId, 'DECLINED');
}

/**
 * ACCEPTED se retire, PENDING s'annule côté demandeur seulement, DECLINED ne se
 * supprime pas : c'est ce qui empêche un DELETE de contourner le délai de réouverture.
 */
export async function removeFriend(
  db: Kysely<Database>,
  userId: string,
  otherId: string,
): Promise<FriendResult<{ removed: true }>> {
  return db.transaction().execute(async (trx): Promise<FriendResult<{ removed: true }>> => {
    const existing = await readPairRow(trx, userId, otherId, { forUpdate: true });

    if (!existing || existing.status === 'DECLINED') {
      return { ok: false, code: 'FRIENDSHIP_NOT_FOUND' };
    }

    if (existing.status === 'PENDING' && existing.addressee_id === userId) {
      return { ok: false, code: 'FRIEND_REQUEST_NOT_CANCELLABLE' };
    }

    const deleted = await trx
      .deleteFrom('friendships')
      .where((eb) => pairCondition(eb, userId, otherId))
      .where('status', 'in', ['PENDING', 'ACCEPTED'])
      .executeTakeFirst();

    if (deleted.numDeletedRows === 0n) {
      return { ok: false, code: 'FRIENDSHIP_NOT_FOUND' };
    }

    return { ok: true, value: { removed: true } };
  });
}

export async function blockPlayer(
  db: Kysely<Database>,
  userId: string,
  targetId: string,
): Promise<FriendResult<{ blocked: true }>> {
  if (userId === targetId) {
    return { ok: false, code: 'SELF_BLOCK' };
  }

  const target = await readPlayer(db, targetId);
  if (!target) {
    return { ok: false, code: 'PLAYER_NOT_FOUND' };
  }

  await db.transaction().execute(async (trx) => {
    await trx
      .insertInto('blocks')
      .values({ blocker_id: userId, blocked_id: targetId })
      .onConflict((oc) => oc.columns(['blocker_id', 'blocked_id']).doNothing())
      .execute();

    await trx
      .deleteFrom('friendships')
      .where((eb) => pairCondition(eb, userId, targetId))
      .execute();
  });

  return { ok: true, value: { blocked: true } };
}
