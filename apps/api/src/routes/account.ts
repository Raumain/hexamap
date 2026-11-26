import { Elysia, t } from 'elysia';
import { accountDeletionEnabled } from '../lib/account-switch';
import { HttpError } from '../lib/http-error';
import { authPlugin } from '../middleware/auth';
import {
  buildAccountExport,
  changePassword,
  deleteAccount,
  requestEmailChange,
  updatePseudo,
} from '../services/account';

const errorSchema = t.Object(
  { code: t.String(), message: t.String() },
  { additionalProperties: false },
);

const unauthorized = { code: 'UNAUTHORIZED', message: 'Non authentifié' };

const nullableString = t.Union([t.String(), t.Null()]);

const pseudoResponseSchema = t.Object({ pseudo: t.String() }, { additionalProperties: false });

const emailResponseSchema = t.Object(
  { pending: t.Literal(true), email: t.String() },
  { additionalProperties: false },
);

const passwordResponseSchema = t.Object(
  { status: t.Literal(true) },
  { additionalProperties: false },
);

const cardExportSchema = t.Object(
  {
    id: t.String(),
    category: t.String(),
    refCode: t.String(),
    rarity: t.String(),
    score: t.Number(),
    acquiredAt: t.String(),
    source: t.String(),
  },
  { additionalProperties: false },
);

const tableauExportSchema = t.Object(
  {
    id: t.String(),
    name: t.String(),
    regionCardId: nullableString,
    departementCardId: nullableString,
    communeCardId: nullableString,
    rueCardId: nullableString,
    createdAt: t.String(),
  },
  { additionalProperties: false },
);

const achievementExportSchema = t.Object(
  { key: t.String(), unlockedAt: t.String() },
  { additionalProperties: false },
);

const ledgerExportSchema = t.Object(
  { delta: t.Number(), reason: t.String(), createdAt: t.String() },
  { additionalProperties: false },
);

const friendshipExportSchema = t.Object(
  {
    requesterId: t.String(),
    addresseeId: t.String(),
    status: t.String(),
    createdAt: t.String(),
    respondedAt: nullableString,
  },
  { additionalProperties: false },
);

const profileExportSchema = t.Object(
  {
    exportedAt: t.String(),
    id: t.String(),
    pseudo: nullableString,
    name: t.String(),
    email: t.String(),
    emailVerified: t.Boolean(),
    createdAt: t.String(),
    bio: nullableString,
    profilePublic: t.Boolean(),
  },
  { additionalProperties: false },
);

const accountExportSchema = t.Object(
  {
    achievements: t.Array(achievementExportSchema),
    cards: t.Array(cardExportSchema),
    friendships: t.Array(friendshipExportSchema),
    ledger: t.Array(ledgerExportSchema),
    profile: profileExportSchema,
    tableaux: t.Array(tableauExportSchema),
  },
  { additionalProperties: false },
);

const deletionResponseSchema = t.Object(
  {
    deleted: t.Literal(true),
    cascade: t.Record(t.String(), t.Number()),
  },
  { additionalProperties: false },
);

const capabilitiesSchema = t.Object(
  { deletion: t.Boolean(), emailVerification: t.Boolean() },
  { additionalProperties: false },
);

/** Traduit une erreur applicative en réponse `{ code, message }` typée. */
function failure(error: unknown): { code: string; message: string } {
  if (error instanceof HttpError) {
    return { code: error.code, message: error.message };
  }
  throw error;
}

function failureStatus(error: unknown): number {
  return error instanceof HttpError ? error.status : 500;
}

export const accountRoutes = new Elysia({ name: 'routes.account' })
  .use(authPlugin)
  .patch(
    '/account/pseudo',
    async ({ user, body, set }) => {
      if (!user) {
        set.status = 401;
        return unauthorized;
      }

      try {
        return await updatePseudo(user.id, body.pseudo);
      } catch (error) {
        set.status = failureStatus(error);
        return failure(error);
      }
    },
    {
      body: t.Object({ pseudo: t.String() }, { additionalProperties: false }),
      response: {
        200: pseudoResponseSchema,
        401: errorSchema,
        409: errorSchema,
        422: errorSchema,
      },
    },
  )
  .post(
    '/account/email',
    async ({ user, body, set, request }) => {
      if (!user) {
        set.status = 401;
        return unauthorized;
      }

      try {
        return await requestEmailChange(request.headers, user.id, body.newEmail);
      } catch (error) {
        set.status = failureStatus(error);
        return failure(error);
      }
    },
    {
      body: t.Object(
        { newEmail: t.String({ minLength: 3, maxLength: 254 }) },
        {
          additionalProperties: false,
        },
      ),
      response: {
        200: emailResponseSchema,
        400: errorSchema,
        401: errorSchema,
        503: errorSchema,
      },
    },
  )
  .post(
    '/account/password',
    async ({ user, body, set, request }) => {
      if (!user) {
        set.status = 401;
        return unauthorized;
      }

      try {
        return await changePassword(request.headers, body);
      } catch (error) {
        set.status = failureStatus(error);
        return failure(error);
      }
    },
    {
      body: t.Object(
        {
          currentPassword: t.Optional(t.String()),
          newPassword: t.String({ minLength: 1 }),
        },
        { additionalProperties: false },
      ),
      response: {
        200: passwordResponseSchema,
        400: errorSchema,
        401: errorSchema,
      },
    },
  )
  .get(
    '/account/capabilities',
    ({ user, set }) => {
      if (!user) {
        set.status = 401;
        return unauthorized;
      }

      // R-001 : aucune confirmation d'adresse n'est demandée au joueur. La clé
      // reste dans la charge utile — un écran ne doit pas apprendre son absence
      // par un champ manquant — mais elle est éteinte pour de bon : aucun
      // transport de courriel n'existe, `MAIL_OUTBOX_DIR` n'étant qu'un témoin
      // d'écriture pour le banc. Elle vaut donc `false`, toujours.
      return { deletion: accountDeletionEnabled(), emailVerification: false };
    },
    {
      response: {
        200: capabilitiesSchema,
        401: errorSchema,
      },
    },
  )
  .get(
    '/account/export',
    async ({ user, set }) => {
      if (!user) {
        set.status = 401;
        return unauthorized;
      }

      const exported = await buildAccountExport(user.id);
      set.headers['content-disposition'] = 'attachment; filename="hexamap-compte.json"';
      set.headers['cache-control'] = 'private, no-store';
      return exported;
    },
    {
      response: {
        200: accountExportSchema,
        401: errorSchema,
      },
    },
  )
  .delete(
    '/account',
    async ({ user, body, set, request }) => {
      if (!user) {
        set.status = 401;
        return unauthorized;
      }

      try {
        return await deleteAccount(
          user.id,
          { password: body.password, confirmation: body.confirmation },
          request.headers,
        );
      } catch (error) {
        set.status = failureStatus(error);
        return failure(error);
      }
    },
    {
      body: t.Object(
        {
          password: t.String({ minLength: 1 }),
          confirmation: t.String({ minLength: 1 }),
        },
        { additionalProperties: false },
      ),
      response: {
        200: deletionResponseSchema,
        400: errorSchema,
        401: errorSchema,
        500: errorSchema,
        503: errorSchema,
      },
    },
  );
