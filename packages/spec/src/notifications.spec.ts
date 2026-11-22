import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { app } from '@hexamap/api/app';
import { assertNotificationKind, emitNotification } from '@hexamap/api/services/notifications';
import { createDb, type NotificationTable, runMigrations, sql } from '@hexamap/db';
import {
  isNotificationKind,
  NOTIFICATION_KINDS,
  type NotificationKind,
  notificationDedupeKey,
} from '@hexamap/shared';

const db = createDb(process.env.DATABASE_URL ?? '');

const baseUrl = 'http://localhost:3000';
const origin = 'http://localhost:5174';

const prefix = crypto.randomUUID().slice(0, 8);
const createdUserIds: string[] = [];

interface NotificationItemBody {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
  createdAt: string;
  readAt: string | null;
}

interface NotificationListBody {
  items: NotificationItemBody[];
  nextCursor: string | null;
  unread: number;
}

interface NotificationCountBody {
  unread: number;
}

interface MarkReadBody {
  item: NotificationItemBody;
  unread: number;
}

interface MarkAllBody {
  marked: number;
  unread: number;
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

async function signUp(label: string): Promise<{ cookie: string; userId: string; pseudo: string }> {
  const pseudo = `${prefix}-${label}-${crypto.randomUUID().slice(0, 4)}`;
  const email = `spec-${prefix}-${crypto.randomUUID()}@hexamap.test`;
  const res = await app.handle(
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
  expect(res.status).toBeGreaterThanOrEqual(200);
  expect(res.status).toBeLessThan(300);
  const body = (await res.json()) as { user: { id: string } };
  const cookie = extractSessionCookie(res);
  createdUserIds.push(body.user.id);
  return { cookie, userId: body.user.id, pseudo };
}

async function authFetch(path: string, init: RequestInit = {}, cookie?: string): Promise<Response> {
  const headers = new Headers(init.headers);
  if (!headers.has('origin')) headers.set('origin', origin);
  if (cookie) headers.set('cookie', cookie);
  return app.handle(new Request(`${baseUrl}${path}`, { ...init, headers }));
}

function jsonBody(init: { method: string; body: unknown }): RequestInit {
  return {
    method: init.method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(init.body),
  };
}

async function listNotifications(cookie: string, query = ''): Promise<Response> {
  return authFetch(`/api/v1/notifications${query}`, {}, cookie);
}

async function listBody(cookie: string, query = ''): Promise<NotificationListBody> {
  const res = await listNotifications(cookie, query);
  expect(res.status).toBe(200);
  return (await res.json()) as NotificationListBody;
}

async function unreadCount(cookie: string): Promise<number> {
  const res = await authFetch('/api/v1/notifications/unread-count', {}, cookie);
  expect(res.status).toBe(200);
  return ((await res.json()) as NotificationCountBody).unread;
}

async function markRead(cookie: string, id: string): Promise<Response> {
  return authFetch(`/api/v1/notifications/${id}/read`, { method: 'POST' }, cookie);
}

async function markAllRead(cookie: string): Promise<Response> {
  return authFetch('/api/v1/notifications/read-all', { method: 'POST' }, cookie);
}

async function devInsert(input: {
  userId: string;
  kind: NotificationKind;
  dedupeKey: string;
  payload?: Record<string, unknown>;
  createdAt?: Date;
  readAt?: Date | null;
}): Promise<string> {
  const row = await db
    .insertInto('notifications')
    .values({
      user_id: input.userId,
      kind: input.kind,
      dedupe_key: input.dedupeKey,
      payload: input.payload ?? {},
      read_at: input.readAt ?? null,
      ...(input.createdAt ? { created_at: input.createdAt } : {}),
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return row.id;
}

async function devInsertAt(input: {
  userId: string;
  dedupeKey: string;
  ts: string;
}): Promise<string> {
  const row = await db
    .insertInto('notifications')
    .values({
      user_id: input.userId,
      kind: 'ACHIEVEMENT',
      dedupe_key: input.dedupeKey,
      payload: {},
      created_at: sql<Date>`${input.ts}::timestamptz`,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return row.id;
}

async function rowsFor(userId: string): Promise<Array<{ id: string; dedupe_key: string }>> {
  return db
    .selectFrom('notifications')
    .select(['id', 'dedupe_key'])
    .where('user_id', '=', userId)
    .execute();
}

beforeAll(async () => {
  await runMigrations(db);
});

afterAll(async () => {
  if (createdUserIds.length > 0) {
    // `notifications` porte `on delete cascade` : supprimer l'utilisateur suffit.
    await db.deleteFrom('user').where('id', 'in', createdUserIds).execute();
  }
  await db.destroy();
});

/**
 * Preuve de parité à la compilation : une phase 40 qui ajouterait un `kind` à
 * `packages/shared/src/notifications.ts` sans le répercuter sur
 * `packages/db/src/schema.ts` — ou l'inverse — casse le build ici, puisque l'un
 * des deux sens du `extends` devient `never`.
 */
type DbKind = NotificationTable['kind'];
type KindsMatch = DbKind extends NotificationKind
  ? NotificationKind extends DbKind
    ? true
    : never
  : never;
const kindsMatch: KindsMatch = true;

describe('Phase 39 — Le Guichet (base §4.10)', () => {
  it('0 — le type Kysely et la liste partagée portent exactement les mêmes kind', () => {
    expect(kindsMatch).toBe(true);
    expect(NOTIFICATION_KINDS).toHaveLength(9);
  });

  it('1 — notificationDedupeKey construit <kind>:<référence> pour les neuf types', () => {
    expect(notificationDedupeKey('ACHIEVEMENT', 'abc')).toBe('ACHIEVEMENT:abc');
    expect(notificationDedupeKey('MARKET_SOLD', 'l-1')).toBe('MARKET_SOLD:l-1');
    expect(notificationDedupeKey('FRIEND_REQUEST', 'u-1')).toBe('FRIEND_REQUEST:u-1');

    for (const kind of NOTIFICATION_KINDS) {
      expect(notificationDedupeKey(kind, 'ref')).toBe(`${kind}:ref`);
    }
  });

  it('2 — un kind hors liste est refusé et n’écrit aucune ligne', async () => {
    expect(isNotificationKind('NOPE')).toBe(false);
    expect(isNotificationKind(null)).toBe(false);
    expect(isNotificationKind(42)).toBe(false);
    expect(() => assertNotificationKind('NOPE')).toThrow();

    const u = await signUp('kind');
    await expect(
      emitNotification(db, { userId: u.userId, kind: 'NOPE', ref: 'x', payload: {} }),
    ).rejects.toThrow();

    expect(await rowsFor(u.userId)).toHaveLength(0);
  });

  it('3 — un rejeu identique n’écrit qu’une ligne, une autre référence en écrit une seconde', async () => {
    const u = await signUp('replay');

    await emitNotification(db, {
      userId: u.userId,
      kind: 'MARKET_BOUGHT',
      ref: 'ref-1',
      payload: { listingId: 'ref-1', price: 500 },
    });
    await emitNotification(db, {
      userId: u.userId,
      kind: 'MARKET_BOUGHT',
      ref: 'ref-1',
      payload: { listingId: 'ref-1', price: 500 },
    });

    let rows = await rowsFor(u.userId);
    expect(rows, 'Deux émissions identiques ne doivent laisser qu’une ligne.').toHaveLength(1);
    expect(rows[0]?.dedupe_key).toBe('MARKET_BOUGHT:ref-1');

    // Le `payload` jsonb part en objet et revient en objet (jamais une chaîne).
    const stored = await db
      .selectFrom('notifications')
      .select('payload')
      .where('user_id', '=', u.userId)
      .executeTakeFirstOrThrow();
    expect(stored.payload).toEqual({ listingId: 'ref-1', price: 500 });

    await emitNotification(db, {
      userId: u.userId,
      kind: 'MARKET_BOUGHT',
      ref: 'ref-2',
      payload: { listingId: 'ref-2', price: 700 },
    });
    rows = await rowsFor(u.userId);
    expect(rows).toHaveLength(2);
  });

  it('4 — GET /notifications rend { items, nextCursor, unread } sans dedupe_key, payload intact', async () => {
    const u = await signUp('list');
    const now = Date.now();
    await devInsert({
      userId: u.userId,
      kind: 'ACHIEVEMENT',
      dedupeKey: 'ACHIEVEMENT:first_ticket',
      payload: { key: 'first_ticket', payout: 100 },
      createdAt: new Date(now - 2000),
    });
    await devInsert({
      userId: u.userId,
      kind: 'MARKET_BOUGHT',
      dedupeKey: 'MARKET_BOUGHT:list-1',
      payload: { listingId: 'list-1', price: 800, pseudo: 'Acheteur' },
      createdAt: new Date(now - 1000),
    });

    const body = await listBody(u.cookie);
    expect(body.unread).toBe(2);
    expect(body.items).toHaveLength(2);
    expect(body.nextCursor).toBeNull();

    // Tri newest first : la seconde insertion (la plus récente) passe devant.
    expect(body.items[0]?.kind).toBe('MARKET_BOUGHT');
    expect(body.items[1]?.kind).toBe('ACHIEVEMENT');

    for (const item of body.items) {
      expect(item).not.toHaveProperty('dedupe_key');
      expect(typeof item.createdAt).toBe('string');
      expect(Number.isNaN(Date.parse(item.createdAt))).toBe(false);
    }
    expect(body.items[0]?.payload.pseudo).toBe('Acheteur');
    expect(body.items[1]?.payload.payout).toBe(100);

    const anonymous = await listNotifications('');
    expect(anonymous.status).toBe(401);
  });

  it('5 — la pagination par curseur suit (created_at, id) et refuse un curseur invalide', async () => {
    const u = await signUp('page');
    const now = Date.now();
    await devInsert({
      userId: u.userId,
      kind: 'ACHIEVEMENT',
      dedupeKey: 'ACHIEVEMENT:p1',
      payload: { n: 1 },
      createdAt: new Date(now - 3000),
    });
    await devInsert({
      userId: u.userId,
      kind: 'ACHIEVEMENT',
      dedupeKey: 'ACHIEVEMENT:p2',
      payload: { n: 2 },
      createdAt: new Date(now - 2000),
    });
    await devInsert({
      userId: u.userId,
      kind: 'ACHIEVEMENT',
      dedupeKey: 'ACHIEVEMENT:p3',
      payload: { n: 3 },
      createdAt: new Date(now - 1000),
    });

    const first = await listBody(u.cookie, '?limit=2');
    expect(first.items.map((item) => item.payload.n)).toEqual([3, 2]);
    expect(typeof first.nextCursor).toBe('string');

    const cursor = encodeURIComponent(first.nextCursor ?? '');
    const second = await listBody(u.cookie, `?limit=2&cursor=${cursor}`);
    expect(second.items.map((item) => item.payload.n)).toEqual([1]);
    expect(second.nextCursor).toBeNull();

    const garbage = await listNotifications(u.cookie, '?cursor=pas-un-curseur');
    expect(garbage.status).toBe(422);
    expect(((await garbage.json()) as ErrorBody).code).toBe('NOTIFICATION_CURSOR_INVALID');

    // Deux chemins de 500 réfutés : un identifiant de 36 tirets passait l'ancienne
    // regex avant de casser le cast `::uuid`, et `1e21` produisait une `Invalid Date`.
    const invalidCursors = [
      '------------------------------------',
      `2026-01-01T00:00:00.000000|${'-'.repeat(36)}`,
      '1e21|00000000-0000-0000-0000-000000000000',
      '2026-02-31T00:00:00.000000|00000000-0000-0000-0000-000000000000',
      '2026-01-01T00:00:00.000|00000000-0000-0000-0000-000000000000',
      '',
    ];
    for (const invalid of invalidCursors) {
      const res = await listNotifications(u.cookie, `?cursor=${encodeURIComponent(invalid)}`);
      expect(res.status, `Un curseur invalide doit répondre 422, pas 500 : ${invalid}`).toBe(422);
      expect(((await res.json()) as ErrorBody).code).toBe('NOTIFICATION_CURSOR_INVALID');
    }
  });

  it('6 — compteur, marquage idempotent, tout-marqué et 404 hors périmètre', async () => {
    const u = await signUp('read');
    const other = await signUp('read-other');
    const firstId = await devInsert({
      userId: u.userId,
      kind: 'ACHIEVEMENT',
      dedupeKey: 'ACHIEVEMENT:r1',
      payload: { n: 1 },
    });
    await devInsert({
      userId: u.userId,
      kind: 'ACHIEVEMENT',
      dedupeKey: 'ACHIEVEMENT:r2',
      payload: { n: 2 },
    });

    expect(await unreadCount(u.cookie)).toBe(2);

    const read = await markRead(u.cookie, firstId);
    expect(read.status).toBe(200);
    const readBody = (await read.json()) as MarkReadBody;
    expect(readBody.unread).toBe(1);
    expect(readBody.item.readAt).not.toBeNull();

    const again = await markRead(u.cookie, firstId);
    expect(again.status, 'Marquer lu deux fois reste un succès.').toBe(200);
    expect(((await again.json()) as MarkReadBody).unread).toBe(1);

    const all = await markAllRead(u.cookie);
    expect(all.status).toBe(200);
    const allBody = (await all.json()) as MarkAllBody;
    expect(allBody.marked).toBe(1);
    expect(allBody.unread).toBe(0);
    expect(await unreadCount(u.cookie)).toBe(0);

    const foreign = await markRead(other.cookie, firstId);
    expect(foreign.status).toBe(404);
    expect(((await foreign.json()) as ErrorBody).code).toBe('NOTIFICATION_NOT_FOUND');

    const missing = await markRead(u.cookie, crypto.randomUUID());
    expect(missing.status).toBe(404);
    expect(((await missing.json()) as ErrorBody).code).toBe('NOTIFICATION_NOT_FOUND');
  });

  it('7 — la purge à 90 jours ne supprime que la ligne échue, à la lecture', async () => {
    const u = await signUp('purge');
    const day = 24 * 60 * 60 * 1000;
    const expiredId = await devInsert({
      userId: u.userId,
      kind: 'ACHIEVEMENT',
      dedupeKey: 'ACHIEVEMENT:old',
      createdAt: new Date(Date.now() - 91 * day),
    });
    const freshId = await devInsert({
      userId: u.userId,
      kind: 'ACHIEVEMENT',
      dedupeKey: 'ACHIEVEMENT:fresh',
      createdAt: new Date(Date.now() - 89 * day),
    });

    const body = await listBody(u.cookie);
    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.id).toBe(freshId);

    const remaining = await rowsFor(u.userId);
    expect(remaining.map((row) => row.id)).toEqual([freshId]);
    expect(remaining.some((row) => row.id === expiredId)).toBe(false);
  });

  it('8 — une demande d’ami émet FRIEND_REQUEST, l’acceptation émet FRIEND_ACCEPTED', async () => {
    const a = await signUp('friend-a');
    const b = await signUp('friend-b');

    const sent = await authFetch(
      '/api/v1/friends/requests',
      jsonBody({ method: 'POST', body: { pseudo: b.pseudo } }),
      a.cookie,
    );
    expect(sent.status, 'Une demande d’ami valide doit être créée (201).').toBe(201);

    const fromB = await listBody(b.cookie);
    const request = fromB.items.find((item) => item.kind === 'FRIEND_REQUEST');
    expect(request, 'Le destinataire doit recevoir une demande.').toBeDefined();
    expect(request?.payload.playerId).toBe(a.userId);

    const stored = await db
      .selectFrom('notifications')
      .select('dedupe_key')
      .where('user_id', '=', b.userId)
      .where('kind', '=', 'FRIEND_REQUEST')
      .executeTakeFirstOrThrow();
    expect(stored.dedupe_key).toBe(`FRIEND_REQUEST:${a.userId}`);

    const accepted = await authFetch(
      `/api/v1/friends/requests/${a.userId}/accept`,
      { method: 'POST' },
      b.cookie,
    );
    expect(accepted.status).toBe(200);

    const fromA = await listBody(a.cookie);
    const acceptedNotification = fromA.items.find((item) => item.kind === 'FRIEND_ACCEPTED');
    expect(acceptedNotification, 'Le demandeur doit apprendre l’acceptation.').toBeDefined();
    expect(acceptedNotification?.payload.playerId).toBe(b.userId);
  });

  it('9 — deux notifications de la même milliseconde sont toutes deux paginées', async () => {
    const u = await signUp('micros');
    const iso = new Date(Date.now() - 60_000).toISOString().slice(0, 19);
    const olderId = await devInsertAt({
      userId: u.userId,
      dedupeKey: 'ACHIEVEMENT:micro-1',
      ts: `${iso}.000001`,
    });
    const newerId = await devInsertAt({
      userId: u.userId,
      dedupeKey: 'ACHIEVEMENT:micro-2',
      ts: `${iso}.000002`,
    });

    const first = await listBody(u.cookie, '?limit=1');
    expect(first.items.map((item) => item.id)).toEqual([newerId]);
    // Le curseur porte la microseconde exacte lue en base, pas une milliseconde.
    expect(first.nextCursor).toContain('.000002');

    const second = await listBody(
      u.cookie,
      `?limit=1&cursor=${encodeURIComponent(first.nextCursor ?? '')}`,
    );
    expect(
      second.items.map((item) => item.id),
      'Aucune ligne ne doit être sautée.',
    ).toEqual([olderId]);
    expect(second.nextCursor).toBeNull();
  });
});
