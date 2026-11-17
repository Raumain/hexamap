import { CATEGORY, RARITY } from '@hexamap/shared';
import { Elysia, t } from 'elysia';
import { db } from '../db';
import { authPlugin } from '../middleware/auth';
import { cardNomKey, resolveCardAssets, resolveCardNoms } from '../services/draw';

const raritySchema = t.Union([
  t.Literal('COMMUNE'),
  t.Literal('INHABITUELLE'),
  t.Literal('RARE'),
  t.Literal('EPIQUE'),
  t.Literal('LEGENDAIRE'),
  t.Literal('MYTHIQUE'),
]);

const categorySchema = t.Union([
  t.Literal('REGION'),
  t.Literal('DEPARTEMENT'),
  t.Literal('COMMUNE'),
  t.Literal('RUE'),
]);

const cardSchema = t.Object(
  {
    id: t.String(),
    category: categorySchema,
    refCode: t.String(),
    nom: t.String(),
    blasonUrl: t.Union([t.String(), t.Null()]),
    blasonCredit: t.Union([t.String(), t.Null()]),
    rarity: raritySchema,
    score: t.Integer(),
    acquiredAt: t.String(),
    source: t.Union([t.Literal('TICKET'), t.Literal('MARKET'), t.Literal('REWARD')]),
    locked: t.Boolean(),
  },
  { additionalProperties: false },
);

const rarityCountSchema = t.Object(
  { rarity: raritySchema, count: t.Integer() },
  { additionalProperties: false },
);
const categoryCountSchema = t.Object(
  { category: categorySchema, count: t.Integer() },
  { additionalProperties: false },
);

const statsSchema = t.Object(
  {
    total: t.Integer(),
    byRarity: t.Array(rarityCountSchema),
    byCategory: t.Array(categoryCountSchema),
  },
  { additionalProperties: false },
);

const errorSchema = t.Object(
  { code: t.String(), message: t.String() },
  { additionalProperties: false },
);

const unauthorized = { code: 'UNAUTHORIZED', message: 'Non authentifié' };

export const cardRoutes = new Elysia({ name: 'routes.cards' })
  .use(authPlugin)
  .get(
    '/cards',
    async ({ user, query, set }) => {
      if (!user) {
        set.status = 401;
        return unauthorized;
      }

      const limit = Math.min(Math.max(query.limit ?? 20, 1), 5000);
      const offset = query.offset ?? 0;

      let builder = db.selectFrom('user_cards').where('user_id', '=', user.id);
      if (query.category) {
        builder = builder.where('category', '=', query.category);
      }
      if (query.rarity) {
        builder = builder.where('rarity', '=', query.rarity);
      }

      const totalRow = await builder.select(db.fn.countAll().as('total')).executeTakeFirstOrThrow();
      const total = Number(totalRow.total);

      const rows = await builder
        .select([
          'id',
          'category',
          'ref_code',
          'rarity',
          'score',
          'acquired_at',
          'source',
          'locked',
        ])
        .orderBy('acquired_at', 'desc')
        .limit(limit)
        .offset(offset)
        .execute();

      const noms = await resolveCardNoms(db, rows);
      const assets = await resolveCardAssets(db, rows);

      const items = rows.map((r) => {
        const asset = assets.get(cardNomKey(r.category, r.ref_code));
        return {
          id: r.id,
          category: r.category,
          refCode: r.ref_code,
          nom: noms.get(cardNomKey(r.category, r.ref_code)) ?? '',
          blasonUrl: asset?.blasonUrl ?? null,
          blasonCredit: asset?.blasonCredit ?? null,
          rarity: r.rarity,
          score: r.score,
          acquiredAt: r.acquired_at.toISOString(),
          source: r.source,
          locked: r.locked,
        };
      });

      return { items, total };
    },
    {
      query: t.Object({
        category: t.Optional(categorySchema),
        rarity: t.Optional(raritySchema),
        limit: t.Optional(t.Integer({ minimum: 1, maximum: 5000 })),
        offset: t.Optional(t.Integer({ minimum: 0 })),
      }),
      response: {
        200: t.Object(
          { items: t.Array(cardSchema), total: t.Integer() },
          { additionalProperties: false },
        ),
        401: errorSchema,
      },
    },
  )
  .get(
    '/collection/stats',
    async ({ user, set }) => {
      if (!user) {
        set.status = 401;
        return unauthorized;
      }

      const rows = await db
        .selectFrom('user_cards')
        .select(['category', 'rarity'])
        .where('user_id', '=', user.id)
        .execute();

      const total = rows.length;
      const byRarity = RARITY.map((rarity) => ({
        rarity,
        count: rows.filter((r) => r.rarity === rarity).length,
      }));
      const byCategory = CATEGORY.map((category) => ({
        category,
        count: rows.filter((r) => r.category === category).length,
      }));

      return { total, byRarity, byCategory };
    },
    {
      response: {
        200: statsSchema,
        401: errorSchema,
      },
    },
  );
