import { Elysia, t } from 'elysia';
import { db } from '../db';
import { authPlugin } from '../middleware/auth';

const profileSchema = t.Object(
  {
    pseudo: t.Union([t.String(), t.Null()]),
    bio: t.Union([t.String(), t.Null()]),
    profilePublic: t.Boolean(),
  },
  { additionalProperties: false },
);

const errorSchema = t.Object(
  { code: t.String(), message: t.String() },
  { additionalProperties: false },
);

// `authPlugin` rend déjà le 401 ; le garde garde le type de `user` sûr.
const unauthorized = { code: 'UNAUTHORIZED', message: 'Non authentifié' };

/**
 * Réglages de la vitrine : biographie et visibilité. Le pseudo n'est pas
 * modifiable ici — il reste l'identité Better Auth, validée à l'inscription.
 */
export const profileRoutes = new Elysia({ name: 'routes.profile' }).use(authPlugin).patch(
  '/profile',
  async ({ user, body, set }) => {
    if (!user) {
      set.status = 401;
      return unauthorized;
    }

    const bio =
      body.bio === undefined ? undefined : body.bio === null ? null : body.bio.trim() || null;

    await db
      .insertInto('user_profiles')
      .values({
        user_id: user.id,
        bio: bio ?? null,
        profile_public: body.profilePublic ?? true,
      })
      .onConflict((oc) =>
        oc.column('user_id').doUpdateSet({
          updated_at: new Date(),
          ...(bio === undefined ? {} : { bio }),
          ...(body.profilePublic === undefined ? {} : { profile_public: body.profilePublic }),
        }),
      )
      .execute();

    const row = await db
      .selectFrom('user_profiles')
      .select(['bio', 'profile_public'])
      .where('user_id', '=', user.id)
      .executeTakeFirst();

    return {
      profile: {
        pseudo: user.pseudo,
        bio: row?.bio ?? null,
        profilePublic: row?.profile_public ?? true,
      },
    };
  },
  {
    body: t.Object(
      {
        bio: t.Optional(t.Union([t.String({ maxLength: 280 }), t.Null()])),
        profilePublic: t.Optional(t.Boolean()),
      },
      { additionalProperties: false },
    ),
    response: {
      200: t.Object({ profile: profileSchema }, { additionalProperties: false }),
      401: errorSchema,
    },
  },
);
