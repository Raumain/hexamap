import type { AchievementFamily } from '@hexamap/shared';
import { Elysia, t } from 'elysia';
import { HttpError } from '../lib/http-error';
import { authPlugin } from '../middleware/auth';
import { evaluateAchievements } from '../services/achievements';

// Union fermée des six familles : une valeur hors liste est refusée par le
// schéma, pas seulement par le type TypeScript. La liste est vérifiée contre
// `AchievementFamily` ci-dessous, donc une famille ajoutée au domaine sans
// être ajoutée ici ne compile plus.
const FAMILY_LITERALS = [
  'SCRATCH',
  'COLLECTION',
  'TABLEAU',
  'MARKET',
  'SOCIAL',
  'ATTENDANCE',
] as const satisfies readonly AchievementFamily[];

type MissingFamily = Exclude<AchievementFamily, (typeof FAMILY_LITERALS)[number]>;
// Garde de compilation : une famille du domaine absente de la liste rend cette
// constante impossible à typer, donc le build échoue.
export const FAMILIES_COVER_DOMAIN: MissingFamily extends never ? true : never = true;

const familySchema = t.Union([
  t.Literal(FAMILY_LITERALS[0]),
  t.Literal(FAMILY_LITERALS[1]),
  t.Literal(FAMILY_LITERALS[2]),
  t.Literal(FAMILY_LITERALS[3]),
  t.Literal(FAMILY_LITERALS[4]),
  t.Literal(FAMILY_LITERALS[5]),
]);

const achievementSchema = t.Object(
  {
    key: t.String(),
    family: familySchema,
    label: t.String(),
    description: t.String(),
    payout: t.Number(),
    threshold: t.Number(),
    progress: t.Union([t.Number(), t.Null()]),
    earnedAt: t.Union([t.String(), t.Null()]),
  },
  { additionalProperties: false },
);

const achievementsViewSchema = t.Object(
  {
    payoutsEnabled: t.Boolean(),
    total: t.Number(),
    achievements: t.Array(achievementSchema),
  },
  { additionalProperties: false },
);

const errorSchema = t.Object(
  { code: t.String(), message: t.String() },
  { additionalProperties: false },
);

const unauthorized = { code: 'UNAUTHORIZED', message: 'Non authentifié' };

export const achievementRoutes = new Elysia({
  name: 'routes.achievements',
  prefix: '/achievements',
})
  .use(authPlugin)
  .get(
    '/',
    async ({ user, set }) => {
      if (!user) {
        set.status = 401;
        return unauthorized;
      }

      try {
        return await evaluateAchievements(user.id);
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
        200: achievementsViewSchema,
        401: errorSchema,
        503: errorSchema,
      },
    },
  );
