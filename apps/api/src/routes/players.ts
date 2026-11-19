import { Elysia, t } from 'elysia';
import { auth } from '../auth';
import { db } from '../db';
import { loadPlayerProfile } from '../services/profile';

const categorySchema = t.Union([
  t.Literal('REGION'),
  t.Literal('DEPARTEMENT'),
  t.Literal('COMMUNE'),
  t.Literal('RUE'),
]);

const completenessSchema = t.Object(
  { category: categorySchema, owned: t.Integer(), total: t.Integer() },
  { additionalProperties: false },
);

const bestTableauSchema = t.Object(
  {
    id: t.String(),
    name: t.String(),
    score: t.Integer(),
    multiplier: t.Number(),
    links: t.Integer(),
  },
  { additionalProperties: false },
);

const friendStateSchema = t.Union([
  t.Literal('SELF'),
  t.Literal('NONE'),
  t.Literal('PENDING_SENT'),
  t.Literal('PENDING_RECEIVED'),
  t.Literal('FRIENDS'),
  t.Null(),
]);

const playerSchema = t.Object(
  {
    id: t.String(),
    pseudo: t.String(),
    displayName: t.String(),
    memberSince: t.String(),
    bio: t.Union([t.String(), t.Null()]),
    cardsOwned: t.Integer(),
    completeness: t.Array(completenessSchema),
    bestTableau: t.Union([bestTableauSchema, t.Null()]),
    achievements: t.Array(t.String()),
    openListings: t.Integer(),
    friendCount: t.Integer(),
    friendState: friendStateSchema,
  },
  { additionalProperties: false },
);

const errorSchema = t.Object(
  { code: t.String(), message: t.String() },
  { additionalProperties: false },
);

// Même corps pour un compte inconnu, une vitrine privée et un blocage : un 403
// confirmerait l'existence du compte, ce que la vitrine privée cherche à éviter.
const playerNotFound = {
  code: 'PLAYER_NOT_FOUND',
  message: "Ce joueur n'a pas de vitrine publique.",
};

/**
 * Vitrine publique (`.docs/01-architecture.md` §2.9). La session est lue sans
 * `authPlugin` : la route est publique, la session ne sert qu'à distinguer le
 * propriétaire, les amis et un éventuel blocage.
 */
export const playerRoutes = new Elysia({ name: 'routes.players' })
  .derive(async ({ request }) => {
    const session = await auth.api.getSession({ headers: request.headers });
    return { viewerId: session?.user?.id ?? null };
  })
  .get(
    '/players/:id',
    async ({ params, viewerId, set }) => {
      const player = await loadPlayerProfile(db, params.id, viewerId);
      if (!player) {
        set.status = 404;
        return playerNotFound;
      }

      return { player };
    },
    {
      // L'identifiant d'un compte est le `text` généré par Better Auth, pas un
      // uuid : la seule contrainte vérifiable ici est qu'il est non vide.
      params: t.Object({ id: t.String({ minLength: 1 }) }),
      response: {
        200: t.Object({ player: playerSchema }, { additionalProperties: false }),
        // Une erreur de lecture remonte volontairement : elle ne doit jamais se
        // déguiser en `404 « pas de vitrine »`. Le statut est déclaré pour que
        // Eden le type au lieu de le deviner.
        500: errorSchema,
        404: errorSchema,
      },
    },
  );
