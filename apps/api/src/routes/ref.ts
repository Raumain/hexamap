import { Elysia, t } from 'elysia';
import { db } from '../db';
import { authPlugin } from '../middleware/auth';

const raritySchema = t.Union([
  t.Literal('COMMUNE'),
  t.Literal('INHABITUELLE'),
  t.Literal('RARE'),
  t.Literal('EPIQUE'),
  t.Literal('LEGENDAIRE'),
  t.Literal('MYTHIQUE'),
]);

const regionSchema = t.Object({ code: t.String(), nom: t.String() });

const departementSchema = t.Object({
  code: t.String(),
  nom: t.String(),
  codeRegion: t.String(),
});

const communeSchema = t.Object({
  codeInsee: t.String(),
  nom: t.String(),
  codeDepartement: t.String(),
  codeRegion: t.String(),
  population: t.Integer(),
  rarete: raritySchema,
});

const odonymeSchema = t.Object({
  id: t.String(),
  nom: t.String(),
  nbCommunes: t.Integer(),
  rarete: raritySchema,
});

export const refRoutes = new Elysia({ name: 'routes.ref', prefix: '/ref' })
  .use(authPlugin)
  .get(
    '/regions',
    async () => {
      const rows = await db
        .selectFrom('ref_regions')
        .select(['code', 'nom'])
        .orderBy('nom')
        .execute();
      return { items: rows };
    },
    { response: { 200: t.Object({ items: t.Array(regionSchema) }) } },
  )
  .get(
    '/departements',
    async ({ query }) => {
      let builder = db.selectFrom('ref_departements').select(['code', 'nom', 'code_region']);
      if (query.region) {
        builder = builder.where('code_region', '=', query.region);
      }
      const rows = await builder.orderBy('nom').execute();
      return {
        items: rows.map((r) => ({ code: r.code, nom: r.nom, codeRegion: r.code_region })),
      };
    },
    {
      query: t.Object({ region: t.Optional(t.String()) }),
      response: { 200: t.Object({ items: t.Array(departementSchema) }) },
    },
  )
  .get(
    '/communes',
    async ({ query }) => {
      const limit = Math.min(query.limit ?? 20, 50);
      let builder = db
        .selectFrom('ref_communes')
        .select(['code_insee', 'nom', 'code_departement', 'code_region', 'population', 'rarete']);
      if (query.q) {
        builder = builder.where('nom', 'ilike', `%${query.q}%`);
      }
      if (query.departement) {
        builder = builder.where('code_departement', '=', query.departement);
      }
      const rows = await builder.orderBy('population', 'desc').limit(limit).execute();
      return {
        items: rows.map((r) => ({
          codeInsee: r.code_insee,
          nom: r.nom,
          codeDepartement: r.code_departement,
          codeRegion: r.code_region,
          population: r.population,
          rarete: r.rarete,
        })),
      };
    },
    {
      query: t.Object({
        q: t.Optional(t.String()),
        departement: t.Optional(t.String()),
        limit: t.Optional(t.Integer({ minimum: 1, maximum: 50 })),
      }),
      response: { 200: t.Object({ items: t.Array(communeSchema) }) },
    },
  )
  .get(
    '/odonymes',
    async ({ query }) => {
      const limit = Math.min(query.limit ?? 20, 50);
      let builder = db
        .selectFrom('ref_odonymes')
        .select(['id', 'nom_affichage', 'nb_communes', 'rarete']);
      if (query.q) {
        builder = builder.where('nom_normalise', 'ilike', `%${query.q}%`);
      }
      const rows = await builder.orderBy('nb_communes', 'desc').limit(limit).execute();
      return {
        items: rows.map((r) => ({
          id: r.id,
          nom: r.nom_affichage,
          nbCommunes: r.nb_communes,
          rarete: r.rarete,
        })),
      };
    },
    {
      query: t.Object({
        q: t.Optional(t.String()),
        limit: t.Optional(t.Integer({ minimum: 1, maximum: 50 })),
      }),
      response: { 200: t.Object({ items: t.Array(odonymeSchema) }) },
    },
  );
