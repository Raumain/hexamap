import { Elysia, t } from 'elysia';
import { db } from '../db';
import { HttpError } from '../lib/http-error';
import { pushEnabled, vapidConfig } from '../lib/vapid';
import { authPlugin } from '../middleware/auth';
import {
  readPushPreferences,
  subscribe,
  unsubscribe,
  writePushPreferences,
} from '../services/push';

const errorSchema = t.Object(
  { code: t.String(), message: t.String() },
  { additionalProperties: false },
);

const unauthorized = { code: 'UNAUTHORIZED', message: 'Non authentifié' };

const configSchema = t.Object(
  { enabled: t.Boolean(), publicKey: t.Union([t.String(), t.Null()]) },
  { additionalProperties: false },
);

const preferencesSchema = t.Object(
  {
    // Les bornes sont validées **ici** : la table les borne aussi (`check between
    // 0 and 23`), mais une violation de contrainte remonterait en `500` alors que
    // la faute est dans le corps de la requête.
    quietStart: t.Integer({ minimum: 0, maximum: 23 }),
    quietEnd: t.Integer({ minimum: 0, maximum: 23 }),
  },
  { additionalProperties: false },
);

const subscribeBodySchema = t.Object(
  {
    endpoint: t.String({ minLength: 1 }),
    keys: t.Object(
      { p256dh: t.String({ minLength: 1 }), auth: t.String({ minLength: 1 }) },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
);

const endpointBodySchema = t.Object(
  { endpoint: t.String({ minLength: 1 }) },
  { additionalProperties: false },
);

const subscribedSchema = t.Object({ subscribed: t.Boolean() }, { additionalProperties: false });

/** La seule bascule qui compte est celle de l'opérateur : la paire VAPID. */
function disabledPayload(): { code: string; message: string } {
  return {
    code: 'PUSH_DISABLED',
    message: "La Sonnette n'est pas configurée sur ce serveur.",
  };
}

export const pushRoutes = new Elysia({ name: 'routes.push', prefix: '/push' })
  .use(authPlugin)
  .get(
    '/config',
    ({ user, set }) => {
      if (!user) {
        set.status = 401;
        return unauthorized;
      }

      const vapid = vapidConfig();

      // La clé publique n'est pas un secret : c'est elle que le navigateur passe à
      // `pushManager.subscribe`. La privée ne sort jamais d'ici.
      return { enabled: vapid !== null, publicKey: vapid?.publicKey ?? null };
    },
    {
      response: {
        200: configSchema,
        401: errorSchema,
      },
    },
  )
  .post(
    '/subscription',
    async ({ user, body, set }) => {
      if (!user) {
        set.status = 401;
        return unauthorized;
      }

      if (!pushEnabled()) {
        set.status = 503;
        return disabledPayload();
      }

      try {
        await subscribe(db, user.id, {
          endpoint: body.endpoint,
          p256dh: body.keys.p256dh,
          auth: body.keys.auth,
        });
        set.status = 201;
        return { subscribed: true };
      } catch (error) {
        if (error instanceof HttpError) {
          set.status = error.status;
          return { code: error.code, message: error.message };
        }
        throw error;
      }
    },
    {
      body: subscribeBodySchema,
      response: {
        201: subscribedSchema,
        400: errorSchema,
        401: errorSchema,
        503: errorSchema,
      },
    },
  )
  .delete(
    '/subscription',
    async ({ user, body, set }) => {
      if (!user) {
        set.status = 401;
        return unauthorized;
      }

      try {
        await unsubscribe(db, user.id, body.endpoint);
        return { subscribed: false };
      } catch (error) {
        if (error instanceof HttpError) {
          set.status = error.status;
          return { code: error.code, message: error.message };
        }
        throw error;
      }
    },
    {
      body: endpointBodySchema,
      response: {
        200: subscribedSchema,
        401: errorSchema,
      },
    },
  )
  .get(
    '/preferences',
    async ({ user, set }) => {
      if (!user) {
        set.status = 401;
        return unauthorized;
      }

      try {
        return await readPushPreferences(db, user.id);
      } catch (error) {
        if (error instanceof HttpError) {
          set.status = error.status;
          return { code: error.code, message: error.message };
        }
        throw error;
      }
    },
    {
      response: {
        200: preferencesSchema,
        401: errorSchema,
      },
    },
  )
  .put(
    '/preferences',
    async ({ user, body, set }) => {
      if (!user) {
        set.status = 401;
        return unauthorized;
      }

      try {
        await writePushPreferences(db, user.id, {
          quietStart: body.quietStart,
          quietEnd: body.quietEnd,
        });
        return await readPushPreferences(db, user.id);
      } catch (error) {
        if (error instanceof HttpError) {
          set.status = error.status;
          return { code: error.code, message: error.message };
        }
        throw error;
      }
    },
    {
      body: preferencesSchema,
      response: {
        200: preferencesSchema,
        401: errorSchema,
        422: errorSchema,
      },
    },
  );
