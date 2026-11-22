import { Elysia, t } from 'elysia';
import { db } from '../db';
import { HttpError } from '../lib/http-error';
import { authPlugin } from '../middleware/auth';
import {
  countUnread,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationRow,
  purgeExpiredNotifications,
} from '../services/notifications';

const errorSchema = t.Object(
  { code: t.String(), message: t.String() },
  { additionalProperties: false },
);

const unauthorized = { code: 'UNAUTHORIZED', message: 'Non authentifié' };

const notificationItemSchema = t.Object(
  {
    id: t.String(),
    kind: t.String(),
    payload: t.Record(t.String(), t.Unknown()),
    createdAt: t.String(),
    readAt: t.Union([t.String(), t.Null()]),
  },
  { additionalProperties: false },
);

/** `payload` est un `jsonb` typé `unknown` : on ne le rend que s'il est un objet. */
function payloadOf(value: unknown): Record<string, unknown> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

/** Sérialise les dates explicitement : aucune coercion implicite d'un `Date`. */
function toItem(row: NotificationRow) {
  return {
    id: row.id,
    kind: row.kind,
    payload: payloadOf(row.payload),
    createdAt: row.createdAt.toISOString(),
    readAt: row.readAt ? row.readAt.toISOString() : null,
  };
}

export const notificationRoutes = new Elysia({
  name: 'routes.notifications',
  prefix: '/notifications',
})
  .use(authPlugin)
  .get(
    '/',
    async ({ user, query, set }) => {
      if (!user) {
        set.status = 401;
        return unauthorized;
      }

      try {
        // Balayage à 90 jours avant la lecture, borné à ce compte. Deux
        // instructions : aucune transaction n'est nécessaire.
        await purgeExpiredNotifications(db, user.id);
        const page = await listNotifications(db, user.id, {
          limit: query.limit ?? 30,
          cursor: query.cursor ?? null,
        });
        const unread = await countUnread(db, user.id);

        return { items: page.items.map(toItem), nextCursor: page.nextCursor, unread };
      } catch (error) {
        if (error instanceof HttpError) {
          set.status = error.status;
          return { code: error.code, message: error.message };
        }
        throw error;
      }
    },
    {
      query: t.Object({
        limit: t.Optional(t.Integer({ minimum: 1, maximum: 100 })),
        cursor: t.Optional(t.String()),
      }),
      response: {
        200: t.Object(
          {
            items: t.Array(notificationItemSchema),
            nextCursor: t.Union([t.String(), t.Null()]),
            unread: t.Integer(),
          },
          { additionalProperties: false },
        ),
        401: errorSchema,
        422: errorSchema,
        500: errorSchema,
      },
    },
  )
  .get(
    '/unread-count',
    async ({ user, set }) => {
      if (!user) {
        set.status = 401;
        return unauthorized;
      }

      return { unread: await countUnread(db, user.id) };
    },
    {
      response: {
        200: t.Object({ unread: t.Integer() }, { additionalProperties: false }),
        401: errorSchema,
      },
    },
  )
  .post(
    '/:id/read',
    async ({ user, params, set }) => {
      if (!user) {
        set.status = 401;
        return unauthorized;
      }

      const item = await markNotificationRead(db, user.id, params.id);
      if (!item) {
        set.status = 404;
        return { code: 'NOTIFICATION_NOT_FOUND', message: 'Notification introuvable.' };
      }

      return { item: toItem(item), unread: await countUnread(db, user.id) };
    },
    {
      params: t.Object({ id: t.String({ format: 'uuid' }) }),
      response: {
        200: t.Object(
          { item: notificationItemSchema, unread: t.Integer() },
          { additionalProperties: false },
        ),
        401: errorSchema,
        404: errorSchema,
      },
    },
  )
  .post(
    '/read-all',
    async ({ user, set }) => {
      if (!user) {
        set.status = 401;
        return unauthorized;
      }

      const marked = await markAllNotificationsRead(db, user.id);
      return { marked, unread: await countUnread(db, user.id) };
    },
    {
      response: {
        200: t.Object(
          { marked: t.Integer(), unread: t.Integer() },
          { additionalProperties: false },
        ),
        401: errorSchema,
      },
    },
  );
