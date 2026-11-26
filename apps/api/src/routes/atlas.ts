import { Elysia, t } from 'elysia';
import { db } from '../db';
import { authPlugin } from '../middleware/auth';
import { loadAtlasDepartement, loadAtlasSummary } from '../services/atlas';

/**
 * Routes de l'atlas (salle L'Assemblage).
 *
 * Deux lectures, aucune écriture. Chaque champ du contrat est déclaré et chaque
 * objet est fermé : le typage Eden de la salle dépend du schéma, pas d'un cast.
 */

const pathDSchema = t.Union([t.String(), t.Null()]);

const regionSchema = t.Object(
  {
    code: t.String(),
    nom: t.String(),
    pathD: pathDSchema,
    viewBox: t.String(),
    hasRegionCard: t.Boolean(),
    communesOwned: t.Integer(),
    communesTotal: t.Integer(),
  },
  { additionalProperties: false },
);

const summaryDepartementSchema = t.Object(
  {
    code: t.String(),
    nom: t.String(),
    codeRegion: t.String(),
    pathD: pathDSchema,
    viewBox: t.String(),
    hasDepartementCard: t.Boolean(),
    communesOwned: t.Integer(),
    communesTotal: t.Integer(),
  },
  { additionalProperties: false },
);

const summarySchema = t.Object(
  {
    viewBox: t.String(),
    regions: t.Array(regionSchema),
    departements: t.Array(summaryDepartementSchema),
  },
  { additionalProperties: false },
);

const communeSchema = t.Object(
  {
    codeInsee: t.String(),
    nom: t.String(),
    pathD: pathDSchema,
    viewBox: t.String(),
    ownedCards: t.Integer(),
    hasCommuneCard: t.Boolean(),
  },
  { additionalProperties: false },
);

const departementDetailSchema = t.Object(
  {
    viewBox: t.String(),
    code: t.String(),
    nom: t.String(),
    communesOwned: t.Integer(),
    communesTotal: t.Integer(),
    communes: t.Array(communeSchema),
  },
  { additionalProperties: false },
);

const errorSchema = t.Object(
  { code: t.String(), message: t.String() },
  { additionalProperties: false },
);

const unauthorized = { code: 'UNAUTHORIZED', message: 'Non authentifié' };

const departementNotFound = {
  code: 'DEPARTEMENT_NOT_FOUND',
  message: 'Ce département est introuvable ou hors de la carte.',
};

export const atlasRoutes = new Elysia({ name: 'routes.atlas' })
  .use(authPlugin)
  .get(
    '/atlas/summary',
    async ({ user, status }) => {
      if (!user) return status(401, unauthorized);
      return loadAtlasSummary(db, user.id);
    },
    {
      response: {
        200: summarySchema,
        401: errorSchema,
      },
    },
  )
  .get(
    '/atlas/departements/:code',
    async ({ user, params, status }) => {
      if (!user) return status(401, unauthorized);
      const detail = await loadAtlasDepartement(db, params.code, user.id);
      if (!detail) return status(404, departementNotFound);
      return detail;
    },
    {
      params: t.Object({ code: t.String({ minLength: 1 }) }),
      response: {
        200: departementDetailSchema,
        401: errorSchema,
        404: errorSchema,
      },
    },
  );
