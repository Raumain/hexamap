import { type IsoWeek, PALMARES_LIMIT_DEFAULT, PALMARES_LIMIT_MAX } from '@hexamap/shared';
import { Elysia, t } from 'elysia';
import { HttpError } from '../lib/http-error';
import { authPlugin } from '../middleware/auth';
import { loadPalmares } from '../services/palmares';

const errorSchema = t.Object(
  { code: t.String(), message: t.String() },
  { additionalProperties: false },
);

const unauthorized = { code: 'UNAUTHORIZED', message: 'Non authentifié' };

const categorySchema = t.Union([
  t.Literal('REGION'),
  t.Literal('DEPARTEMENT'),
  t.Literal('COMMUNE'),
  t.Literal('RUE'),
]);

const raritySchema = t.Union([
  t.Literal('COMMUNE'),
  t.Literal('INHABITUELLE'),
  t.Literal('RARE'),
  t.Literal('EPIQUE'),
  t.Literal('LEGENDAIRE'),
  t.Literal('MYTHIQUE'),
]);

const palmaresCardSchema = t.Object(
  {
    cardId: t.String(),
    category: categorySchema,
    refCode: t.String(),
    nom: t.String(),
    rarity: raritySchema,
    score: t.Integer(),
    blasonUrl: t.Union([t.String(), t.Null()]),
    blasonCredit: t.Union([t.String(), t.Null()]),
  },
  { additionalProperties: false },
);

const palmaresEntrySchema = t.Object(
  {
    rank: t.Integer(),
    tableauId: t.String(),
    name: t.String(),
    score: t.Integer(),
    createdAt: t.String(),
    yours: t.Boolean(),
    player: t.Object(
      { id: t.String(), pseudo: t.String(), profilePublic: t.Boolean() },
      { additionalProperties: false },
    ),
    cards: t.Array(palmaresCardSchema),
  },
  { additionalProperties: false },
);

/**
 * Le classement d'une semaine ISO, servi depuis `tableaux.score` figé.
 *
 * `422` n'est **pas** dans la table `response` : il vient de la validation de
 * `query` par Elysia (`limit` hors `1..100`), avant tout accès à la base, et
 * `packages/spec/src/palmares.spec.ts` le fige.
 */
export const palmaresRoutes = new Elysia({ name: 'routes.palmares', prefix: '/palmares' })
  .use(authPlugin)
  .get(
    '/',
    async ({ user, query, set }) => {
      if (!user) {
        set.status = 401;
        return unauthorized;
      }

      const hasYear = query.year !== undefined;
      const hasWeek = query.week !== undefined;
      if (hasYear !== hasWeek) {
        set.status = 400;
        return {
          code: 'PALMARES_INVALID_WEEK',
          message: 'Indiquez l’année et la semaine, ou ni l’une ni l’autre.',
        };
      }

      let isoWeek: IsoWeek | null = null;
      if (query.year !== undefined && query.week !== undefined) {
        isoWeek = { year: query.year, week: query.week };
      }

      try {
        return await loadPalmares(isoWeek, query.limit ?? PALMARES_LIMIT_DEFAULT, user.id);
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
        year: t.Optional(t.Integer({ minimum: 1970, maximum: 2999 })),
        week: t.Optional(t.Integer({ minimum: 1, maximum: 53 })),
        limit: t.Optional(t.Integer({ minimum: 1, maximum: PALMARES_LIMIT_MAX })),
      }),
      response: {
        200: t.Object(
          {
            week: t.String(),
            weekStart: t.String(),
            weekEnd: t.String(),
            current: t.Boolean(),
            total: t.Integer(),
            items: t.Array(palmaresEntrySchema),
          },
          { additionalProperties: false },
        ),
        400: errorSchema,
        401: errorSchema,
      },
    },
  );
