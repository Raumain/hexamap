import { Elysia, t } from 'elysia';
import { db } from '../db';
import { authPlugin } from '../middleware/auth';
import {
  acceptRequest,
  blockPlayer,
  declineRequest,
  type FriendErrorCode,
  findPlayerByPseudo,
  listFriends,
  removeFriend,
  sendRequest,
} from '../services/friends';

const friendshipStatusSchema = t.Union([
  t.Literal('PENDING'),
  t.Literal('ACCEPTED'),
  t.Literal('DECLINED'),
]);

const playerSchema = t.Object(
  { id: t.String(), pseudo: t.Union([t.String(), t.Null()]) },
  { additionalProperties: false },
);

const friendEntrySchema = t.Object(
  {
    id: t.String(),
    status: friendshipStatusSchema,
    createdAt: t.String(),
    player: playerSchema,
  },
  { additionalProperties: false },
);

const friendListSchema = t.Object(
  {
    friends: t.Array(friendEntrySchema),
    incoming: t.Array(friendEntrySchema),
    outgoing: t.Array(friendEntrySchema),
  },
  { additionalProperties: false },
);

const requestResponseSchema = t.Object(
  { request: friendEntrySchema },
  { additionalProperties: false },
);

const removedSchema = t.Object({ removed: t.Literal(true) }, { additionalProperties: false });
const blockedSchema = t.Object({ blocked: t.Literal(true) }, { additionalProperties: false });

const errorSchema = t.Object(
  { code: t.String(), message: t.String() },
  { additionalProperties: false },
);

const unauthorized = { code: 'UNAUTHORIZED', message: 'Non authentifié' };

const ERROR_STATUS: Record<FriendErrorCode, 400 | 404 | 409 | 429> = {
  SELF_FRIENDSHIP: 400,
  PLAYER_NOT_FOUND: 404,
  FRIENDSHIP_EXISTS: 409,
  FRIENDSHIP_BLOCKED: 409,
  FRIEND_REQUEST_REOPEN_TOO_SOON: 409,
  FRIEND_REQUEST_NOT_CANCELLABLE: 409,
  FRIENDSHIP_DECLINED: 409,
  FRIENDSHIP_NOT_FOUND: 404,
  FRIEND_REQUEST_CAP_REACHED: 429,
  SELF_BLOCK: 400,
};

const ERROR_MESSAGES: Record<FriendErrorCode, string> = {
  SELF_FRIENDSHIP: 'Vous ne pouvez pas vous ajouter vous-même.',
  PLAYER_NOT_FOUND: 'Ce joueur est introuvable.',
  FRIENDSHIP_EXISTS: 'Vous êtes déjà amis avec ce joueur.',
  FRIENDSHIP_BLOCKED: 'Cette relation est indisponible.',
  FRIEND_REQUEST_REOPEN_TOO_SOON: 'Cette demande a été déclinée récemment. Réessayez plus tard.',
  FRIEND_REQUEST_NOT_CANCELLABLE: "Une demande reçue se refuse, elle ne s'annule pas.",
  FRIENDSHIP_DECLINED: 'Cette demande a été refusée.',
  FRIENDSHIP_NOT_FOUND: 'Aucune relation avec ce joueur.',
  FRIEND_REQUEST_CAP_REACHED: 'Vous avez atteint le nombre de demandes du jour.',
  SELF_BLOCK: 'Vous ne pouvez pas vous bloquer vous-même.',
};

function failure(code: FriendErrorCode): { code: string; message: string } {
  return { code, message: ERROR_MESSAGES[code] };
}

export const friendRoutes = new Elysia({ name: 'routes.friends' })
  .use(authPlugin)
  .get(
    '/friends',
    async ({ user, set }) => {
      if (!user) {
        set.status = 401;
        return unauthorized;
      }
      return listFriends(db, user.id);
    },
    {
      response: {
        200: friendListSchema,
        401: errorSchema,
      },
    },
  )
  .post(
    '/friends/requests',
    async ({ user, body, set }) => {
      if (!user) {
        set.status = 401;
        return unauthorized;
      }

      const pseudo = body.pseudo.trim();
      if (pseudo.length === 0) {
        set.status = 404;
        return failure('PLAYER_NOT_FOUND');
      }

      const target = await findPlayerByPseudo(db, pseudo);
      if (!target) {
        set.status = 404;
        return failure('PLAYER_NOT_FOUND');
      }

      const result = await sendRequest(db, user.id, target.id);
      if (!result.ok) {
        set.status = ERROR_STATUS[result.code];
        return failure(result.code);
      }

      set.status = result.value.created ? 201 : 200;
      return { request: result.value.request };
    },
    {
      body: t.Object({ pseudo: t.String({ minLength: 1, maxLength: 24 }) }),
      response: {
        200: requestResponseSchema,
        201: requestResponseSchema,
        400: errorSchema,
        401: errorSchema,
        404: errorSchema,
        409: errorSchema,
        429: errorSchema,
      },
    },
  )
  .post(
    '/friends/requests/:id/accept',
    async ({ user, params, set }) => {
      if (!user) {
        set.status = 401;
        return unauthorized;
      }

      const result = await acceptRequest(db, user.id, params.id);
      if (!result.ok) {
        set.status = ERROR_STATUS[result.code];
        return failure(result.code);
      }

      return { request: result.value.request };
    },
    {
      params: t.Object({ id: t.String({ minLength: 1 }) }),
      response: {
        200: requestResponseSchema,
        401: errorSchema,
        404: errorSchema,
      },
    },
  )
  .post(
    '/friends/requests/:id/decline',
    async ({ user, params, set }) => {
      if (!user) {
        set.status = 401;
        return unauthorized;
      }

      const result = await declineRequest(db, user.id, params.id);
      if (!result.ok) {
        set.status = ERROR_STATUS[result.code];
        return failure(result.code);
      }

      return { request: result.value.request };
    },
    {
      params: t.Object({ id: t.String({ minLength: 1 }) }),
      response: {
        200: requestResponseSchema,
        401: errorSchema,
        404: errorSchema,
      },
    },
  )
  .delete(
    '/friends/:id',
    async ({ user, params, set }) => {
      if (!user) {
        set.status = 401;
        return unauthorized;
      }

      const result = await removeFriend(db, user.id, params.id);
      if (!result.ok) {
        set.status = ERROR_STATUS[result.code];
        return failure(result.code);
      }

      return result.value;
    },
    {
      params: t.Object({ id: t.String({ minLength: 1 }) }),
      response: {
        200: removedSchema,
        401: errorSchema,
        404: errorSchema,
        409: errorSchema,
      },
    },
  )
  .post(
    '/blocks',
    async ({ user, body, set }) => {
      if (!user) {
        set.status = 401;
        return unauthorized;
      }

      const result = await blockPlayer(db, user.id, body.userId);
      if (!result.ok) {
        set.status = ERROR_STATUS[result.code];
        return failure(result.code);
      }

      set.status = 201;
      return result.value;
    },
    {
      body: t.Object({ userId: t.String({ minLength: 1 }) }),
      response: {
        201: blockedSchema,
        400: errorSchema,
        401: errorSchema,
        404: errorSchema,
      },
    },
  );
