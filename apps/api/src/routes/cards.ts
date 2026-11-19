import { CATEGORY, RARITY } from '@hexamap/shared';
import { Elysia, t } from 'elysia';
import { db } from '../db';
import { authPlugin } from '../middleware/auth';
import { resolveCardDetail } from '../services/card-detail';
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

const ownerSchema = t.Object(
  { id: t.String(), pseudo: t.Union([t.String(), t.Null()]) },
  { additionalProperties: false },
);

const detailSchema = t.Object(
  {
    population: t.Union([t.Integer(), t.Null()]),
    nbCommunes: t.Union([t.Integer(), t.Null()]),
    latitude: t.Union([t.Number(), t.Null()]),
    longitude: t.Union([t.Number(), t.Null()]),
    codeDepartement: t.Union([t.String(), t.Null()]),
    nomDepartement: t.Union([t.String(), t.Null()]),
    codeRegion: t.Union([t.String(), t.Null()]),
    nomRegion: t.Union([t.String(), t.Null()]),
  },
  { additionalProperties: false },
);

const marketStatusSchema = t.Union([t.Literal('OPEN'), t.Literal('SOLD'), t.Literal('CANCELLED')]);

const listingSummarySchema = t.Object(
  {
    id: t.String(),
    price: t.Integer(),
    status: marketStatusSchema,
    createdAt: t.String(),
  },
  { additionalProperties: false },
);

const cardDetailSchema = t.Object(
  {
    card: t.Object(
      {
        id: t.String(),
        category: categorySchema,
        refCode: t.String(),
        nom: t.String(),
        rarity: raritySchema,
        score: t.Integer(),
        acquiredAt: t.String(),
        source: t.Union([t.Literal('TICKET'), t.Literal('MARKET'), t.Literal('REWARD')]),
        locked: t.Boolean(),
        blasonUrl: t.Union([t.String(), t.Null()]),
        blasonCredit: t.Union([t.String(), t.Null()]),
        owner: ownerSchema,
        detail: detailSchema,
        listing: t.Union([listingSummarySchema, t.Null()]),
      },
      { additionalProperties: false },
    ),
  },
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
  )
  .get(
    '/cards/:id',
    async ({ user, params, set }) => {
      if (!user) {
        set.status = 401;
        return unauthorized;
      }

      const card = await db
        .selectFrom('user_cards')
        .select([
          'id',
          'user_id',
          'category',
          'ref_code',
          'rarity',
          'score',
          'acquired_at',
          'source',
          'locked',
        ])
        .where('id', '=', params.id)
        .executeTakeFirst();

      if (!card) {
        set.status = 404;
        return { code: 'CARD_NOT_FOUND', message: 'Carte introuvable.' };
      }

      const listing = await db
        .selectFrom('market_listings')
        .select(['id', 'price', 'status', 'created_at'])
        .where('user_card_id', '=', card.id)
        .where('status', '=', 'OPEN')
        .executeTakeFirst();

      // Une carte n'est exposée qu'à son propriétaire ou tant qu'elle est en vente.
      if (card.user_id !== user.id && !listing) {
        set.status = 403;
        return { code: 'CARD_NOT_VISIBLE', message: "Cette carte n'est pas exposée." };
      }

      const refs = [{ category: card.category, ref_code: card.ref_code }];
      const key = cardNomKey(card.category, card.ref_code);

      const [owner, detail, noms, assets] = await Promise.all([
        db
          .selectFrom('user')
          .select(['id', 'pseudo'])
          .where('id', '=', card.user_id)
          .executeTakeFirst(),
        resolveCardDetail(db, card.category, card.ref_code),
        resolveCardNoms(db, refs),
        resolveCardAssets(db, refs),
      ]);

      const asset = assets.get(key);

      return {
        card: {
          id: card.id,
          category: card.category,
          refCode: card.ref_code,
          nom: noms.get(key) ?? '',
          rarity: card.rarity,
          score: card.score,
          acquiredAt: card.acquired_at.toISOString(),
          source: card.source,
          locked: card.locked,
          blasonUrl: asset?.blasonUrl ?? null,
          blasonCredit: asset?.blasonCredit ?? null,
          owner: { id: owner?.id ?? card.user_id, pseudo: owner?.pseudo ?? null },
          detail,
          listing: listing
            ? {
                id: listing.id,
                price: listing.price,
                status: listing.status,
                createdAt: listing.created_at.toISOString(),
              }
            : null,
        },
      };
    },
    {
      params: t.Object({ id: t.String({ format: 'uuid' }) }),
      response: {
        200: cardDetailSchema,
        401: errorSchema,
        403: errorSchema,
        404: errorSchema,
      },
    },
  );
