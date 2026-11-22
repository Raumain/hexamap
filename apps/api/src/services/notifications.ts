import type { Database, NotificationKind } from '@hexamap/db';
import { isNotificationKind, notificationDedupeKey } from '@hexamap/shared';
import { type Kysely, sql, type Transaction } from 'kysely';
import { HttpError } from '../lib/http-error';

export type NotificationExecutor = Kysely<Database> | Transaction<Database>;

export interface NotificationRow {
  id: string;
  kind: string;
  payload: unknown;
  createdAt: Date;
  readAt: Date | null;
}

/**
 * `kind` est une liste fermée **validée dans le code** : aucune contrainte
 * `CHECK` ne la porte en base (base §4.10). Cette garde est le seul point qui
 * refuse un type inconnu avant l'écriture.
 */
export function assertNotificationKind(value: unknown): asserts value is NotificationKind {
  if (!isNotificationKind(value)) {
    throw new HttpError(500, 'NOTIFICATION_KIND_UNKNOWN', 'Type de notification inconnu.');
  }
}

/**
 * Écrit une notification dans la transaction de l'opération métier qui la
 * provoque — jamais une connexion neuve. Une erreur remonte et annule l'affaire.
 * L'idempotence est portée par l'index unique `(user_id, dedupe_key)`, jamais par
 * un `SELECT` préalable : deux émissions simultanées n'écrivent qu'une ligne.
 */
export async function emitNotification(
  exec: NotificationExecutor,
  input: { userId: string; kind: string; ref: string; payload: Record<string, unknown> },
): Promise<void> {
  assertNotificationKind(input.kind);

  await exec
    .insertInto('notifications')
    .values({
      user_id: input.userId,
      kind: input.kind,
      dedupe_key: notificationDedupeKey(input.kind, input.ref),
      payload: input.payload,
    })
    .onConflict((oc) => oc.columns(['user_id', 'dedupe_key']).doNothing())
    .execute();
}

/**
 * Balayage à la lecture de la salle, borné à l'utilisateur qui lit. Le seuil de
 * rétention est écrit en SQL : l'horloge qui fait foi est celle de PostgreSQL,
 * jamais celle du process API.
 */
export async function purgeExpiredNotifications(
  exec: NotificationExecutor,
  userId: string,
): Promise<number> {
  const result = await exec
    .deleteFrom('notifications')
    .where('user_id', '=', userId)
    .where(sql<boolean>`created_at < now() - interval '90 days'`)
    .executeTakeFirst();

  return Number(result.numDeletedRows);
}

function invalidCursor(): HttpError {
  return new HttpError(422, 'NOTIFICATION_CURSOR_INVALID', 'Curseur de pagination invalide.');
}

const CURSOR_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{6})\|([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/;

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    return leap ? 29 : 28;
  }
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
}

/**
 * Curseur keyset `"<horodatage UTC à la microseconde>|<uuid>"`.
 *
 * La validation est **structurelle** : aucune `Date` n'est construite, donc
 * aucune valeur absurde ne peut atteindre `pg` ni le cast `::timestamp`. Un
 * curseur qui ne correspond pas exactement — longueur, chiffres, tirets,
 * microsecondes manquantes, `1e21`, chaîne vide — répond 422 avant la base.
 */
function decodeCursor(cursor: string): { timestamp: string; id: string } {
  if (!CURSOR_PATTERN.test(cursor)) throw invalidCursor();

  // Positions fixes : la regex a déjà prouvé la forme exacte.
  const year = Number(cursor.slice(0, 4));
  const month = Number(cursor.slice(5, 7));
  const day = Number(cursor.slice(8, 10));
  const hour = Number(cursor.slice(11, 13));
  const minute = Number(cursor.slice(14, 16));
  const second = Number(cursor.slice(17, 19));

  const inRange =
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= daysInMonth(year, month) &&
    hour <= 23 &&
    minute <= 59 &&
    second <= 59;
  if (!inRange) throw invalidCursor();

  return { timestamp: cursor.slice(0, 26), id: cursor.slice(27).toLowerCase() };
}

/**
 * Page de notifications du joueur, du plus récent au plus ancien. Keyset sur
 * `(created_at, id)` : le curseur porte la microseconde exacte lue en base, donc
 * deux notifications de la même milliseconde ne se sautent ni ne se dupliquent,
 * contrairement à un `OFFSET` et à un curseur tronqué à la milliseconde.
 */
export async function listNotifications(
  exec: NotificationExecutor,
  userId: string,
  options: { limit: number; cursor: string | null },
): Promise<{ items: NotificationRow[]; nextCursor: string | null }> {
  let query = exec
    .selectFrom('notifications')
    .select([
      'id',
      'kind',
      'payload',
      'created_at',
      'read_at',
      sql<string>`to_char(created_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.US')`.as(
        'created_at_key',
      ),
    ])
    .where('user_id', '=', userId);

  if (options.cursor !== null) {
    const cursor = decodeCursor(options.cursor);
    query = query.where(
      sql<boolean>`(created_at, id) < (${cursor.timestamp}::timestamp at time zone 'utc', ${cursor.id}::uuid)`,
    );
  }

  const rows = await query
    .orderBy('created_at', 'desc')
    .orderBy('id', 'desc')
    .limit(options.limit + 1)
    .execute();

  const hasMore = rows.length > options.limit;
  const page = hasMore ? rows.slice(0, options.limit) : rows;
  const items: NotificationRow[] = page.map((row) => ({
    id: row.id,
    kind: row.kind,
    payload: row.payload,
    createdAt: row.created_at,
    readAt: row.read_at,
  }));
  const last = page.at(-1);

  return {
    items,
    nextCursor: hasMore && last ? `${last.created_at_key}|${last.id}` : null,
  };
}

/**
 * Compteur de la pastille. La salle purge à la lecture ; ce compteur-ci
 * n'écrit jamais, il ignore simplement ce que la purge supprimerait, pour que
 * la cloche et la salle ne divergent jamais.
 */
export async function countUnread(exec: NotificationExecutor, userId: string): Promise<number> {
  const row = await exec
    .selectFrom('notifications')
    .select(exec.fn.countAll<string>().as('total'))
    .where('user_id', '=', userId)
    .where('read_at', 'is', null)
    .where(sql<boolean>`created_at >= now() - interval '90 days'`)
    .executeTakeFirstOrThrow();

  return Number(row.total);
}

/**
 * Marque une notification lue. `coalesce` rend l'appel idempotent : la seconde
 * lecture conserve la date du premier marquage. `null` = absente ou d'un autre
 * compte, indistinctement (404).
 */
export async function markNotificationRead(
  exec: NotificationExecutor,
  userId: string,
  id: string,
): Promise<NotificationRow | null> {
  const row = await exec
    .updateTable('notifications')
    .set({ read_at: sql<Date>`coalesce(read_at, now())` })
    .where('id', '=', id)
    .where('user_id', '=', userId)
    .returning(['id', 'kind', 'payload', 'created_at', 'read_at'])
    .executeTakeFirst();

  if (!row) return null;

  return {
    id: row.id,
    kind: row.kind,
    payload: row.payload,
    createdAt: row.created_at,
    readAt: row.read_at,
  };
}

export async function markAllNotificationsRead(
  exec: NotificationExecutor,
  userId: string,
): Promise<number> {
  const result = await exec
    .updateTable('notifications')
    .set({ read_at: sql<Date>`now()` })
    .where('user_id', '=', userId)
    .where('read_at', 'is', null)
    .executeTakeFirst();

  return Number(result.numUpdatedRows);
}
