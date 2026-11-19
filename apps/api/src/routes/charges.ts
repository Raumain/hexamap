import { Elysia, t } from 'elysia';
import { db } from '../db';
import { HttpError } from '../lib/http-error';
import { authPlugin } from '../middleware/auth';
import { readCharges } from '../services/charges';

const errorSchema = t.Object(
  { code: t.String(), message: t.String() },
  { additionalProperties: false },
);

const unauthorized = { code: 'UNAUTHORIZED', message: 'Non authentifié' };

const chargeSnapshotSchema = t.Object(
  {
    charges: t.Integer(),
    cap: t.Integer(),
    nextChargeAt: t.Union([t.String(), t.Null()]),
    regenMs: t.Integer(),
  },
  { additionalProperties: false },
);

export const chargeRoutes = new Elysia({ name: 'routes.charges', prefix: '/charges' })
  .use(authPlugin)
  .get(
    '/',
    async ({ user, set }) => {
      if (!user) {
        set.status = 401;
        return unauthorized;
      }

      try {
        const charges = await readCharges(db, user.id);
        return {
          charges: charges.charges,
          cap: charges.cap,
          nextChargeAt: charges.nextChargeAt === null ? null : charges.nextChargeAt.toISOString(),
          regenMs: charges.regenMs,
        };
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
        200: chargeSnapshotSchema,
        401: errorSchema,
        503: errorSchema,
      },
    },
  );
