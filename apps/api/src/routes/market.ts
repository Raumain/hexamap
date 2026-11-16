import type { CardCategory, MarketStatus, Rarity } from '@hexamap/db';
import { Elysia, t } from 'elysia';
import { db } from '../db';
import { HttpError } from '../lib/http-error';
import { authPlugin } from '../middleware/auth';
import { cardNomKey, type Executor, resolveCardNoms } from '../services/draw';

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

const statusSchema = t.Union([t.Literal('OPEN'), t.Literal('SOLD'), t.Literal('CANCELLED')]);

const sellerSchema = t.Object(
  { id: t.String(), pseudo: t.Union([t.String(), t.Null()]) },
  { additionalProperties: false },
);

const marketCardSchema = t.Object(
  {
    id: t.String(),
    category: categorySchema,
    refCode: t.String(),
    nom: t.String(),
    rarity: raritySchema,
    score: t.Integer(),
  },
  { additionalProperties: false },
);

const listingSchema = t.Object(
  {
    id: t.String(),
    price: t.Integer(),
    status: statusSchema,
    createdAt: t.String(),
    soldAt: t.Union([t.String(), t.Null()]),
    buyerId: t.Union([t.String(), t.Null()]),
    seller: sellerSchema,
    card: marketCardSchema,
  },
  { additionalProperties: false },
);

const errorSchema = t.Object(
  { code: t.String(), message: t.String() },
  { additionalProperties: false },
);

const unauthorized = { code: 'UNAUTHORIZED', message: 'Non authentifié' };

/** Ligne d'annonce jointe à son vendeur et à sa carte. */
interface ListingRow {
  id: string;
  price: number;
  status: MarketStatus;
  createdAt: Date;
  soldAt: Date | null;
  buyerId: string | null;
  sellerId: string;
  sellerPseudo: string | null;
  cardId: string;
  cardCategory: CardCategory;
  cardRefCode: string;
  cardRarity: Rarity;
  cardScore: number;
}

const LISTING_SELECT = [
  'ml.id as id',
  'ml.price as price',
  'ml.status as status',
  'ml.created_at as createdAt',
  'ml.sold_at as soldAt',
  'ml.buyer_id as buyerId',
  'seller.id as sellerId',
  'seller.pseudo as sellerPseudo',
  'uc.id as cardId',
  'uc.category as cardCategory',
  'uc.ref_code as cardRefCode',
  'uc.rarity as cardRarity',
  'uc.score as cardScore',
] as const;

/** Projette une ligne jointe vers la forme publique `listingSchema`. */
function toListing(row: ListingRow, nom: string) {
  return {
    id: row.id,
    price: row.price,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    soldAt: row.soldAt?.toISOString() ?? null,
    buyerId: row.buyerId,
    seller: { id: row.sellerId, pseudo: row.sellerPseudo },
    card: {
      id: row.cardId,
      category: row.cardCategory,
      refCode: row.cardRefCode,
      nom,
      rarity: row.cardRarity,
      score: row.cardScore,
    },
  };
}

/** Relit une annonce jointe (vendeur + carte) et résout son nom d'affichage. */
async function fetchListing(exec: Executor, listingId: string) {
  const row = await exec
    .selectFrom('market_listings as ml')
    .innerJoin('user as seller', 'seller.id', 'ml.seller_id')
    .innerJoin('user_cards as uc', 'uc.id', 'ml.user_card_id')
    .select([...LISTING_SELECT])
    .where('ml.id', '=', listingId)
    .executeTakeFirst();

  if (!row) return null;

  const noms = await resolveCardNoms(exec, [
    { category: row.cardCategory, ref_code: row.cardRefCode },
  ]);

  return toListing(row, noms.get(cardNomKey(row.cardCategory, row.cardRefCode)) ?? '');
}

interface ListFilters {
  onlyOpen: boolean;
  sellerId?: string;
  category?: CardCategory;
  rarity?: Rarity;
  limit: number;
  offset: number;
}

/** Page d'annonces jointe (vendeur + carte) avec total sur les mêmes filtres. */
async function queryListings(exec: Executor, filters: ListFilters) {
  let page = exec
    .selectFrom('market_listings as ml')
    .innerJoin('user as seller', 'seller.id', 'ml.seller_id')
    .innerJoin('user_cards as uc', 'uc.id', 'ml.user_card_id');

  let count = exec
    .selectFrom('market_listings as ml')
    .innerJoin('user_cards as uc', 'uc.id', 'ml.user_card_id');

  if (filters.onlyOpen) {
    page = page.where('ml.status', '=', 'OPEN');
    count = count.where('ml.status', '=', 'OPEN');
  }
  if (filters.sellerId !== undefined) {
    page = page.where('ml.seller_id', '=', filters.sellerId);
    count = count.where('ml.seller_id', '=', filters.sellerId);
  }
  if (filters.category !== undefined) {
    page = page.where('uc.category', '=', filters.category);
    count = count.where('uc.category', '=', filters.category);
  }
  if (filters.rarity !== undefined) {
    page = page.where('uc.rarity', '=', filters.rarity);
    count = count.where('uc.rarity', '=', filters.rarity);
  }

  const rows = await page
    .select([...LISTING_SELECT])
    .orderBy('ml.created_at', 'desc')
    .limit(filters.limit)
    .offset(filters.offset)
    .execute();

  const countRow = await count.select(exec.fn.countAll().as('total')).executeTakeFirstOrThrow();

  const noms = await resolveCardNoms(
    exec,
    rows.map((r) => ({ category: r.cardCategory, ref_code: r.cardRefCode })),
  );

  return {
    items: rows.map((r) => toListing(r, noms.get(cardNomKey(r.cardCategory, r.cardRefCode)) ?? '')),
    total: Number(countRow.total),
  };
}

export const marketRoutes = new Elysia({ name: 'routes.market', prefix: '/market' })
  .use(authPlugin)
  .get(
    '/listings',
    async ({ user, query, set }) => {
      if (!user) {
        set.status = 401;
        return unauthorized;
      }

      const { items, total } = await queryListings(db, {
        onlyOpen: true,
        category: query.category,
        rarity: query.rarity,
        limit: query.limit ?? 20,
        offset: query.offset ?? 0,
      });

      return { items, total };
    },
    {
      query: t.Object({
        category: t.Optional(categorySchema),
        rarity: t.Optional(raritySchema),
        limit: t.Optional(t.Integer({ minimum: 1, maximum: 100 })),
        offset: t.Optional(t.Integer({ minimum: 0 })),
      }),
      response: {
        200: t.Object(
          { items: t.Array(listingSchema), total: t.Integer() },
          { additionalProperties: false },
        ),
        401: errorSchema,
      },
    },
  )
  .get(
    '/listings/mine',
    async ({ user, query, set }) => {
      if (!user) {
        set.status = 401;
        return unauthorized;
      }

      const { items, total } = await queryListings(db, {
        onlyOpen: false,
        sellerId: user.id,
        limit: query.limit ?? 20,
        offset: query.offset ?? 0,
      });

      return { items, total };
    },
    {
      query: t.Object({
        limit: t.Optional(t.Integer({ minimum: 1, maximum: 100 })),
        offset: t.Optional(t.Integer({ minimum: 0 })),
      }),
      response: {
        200: t.Object(
          { items: t.Array(listingSchema), total: t.Integer() },
          { additionalProperties: false },
        ),
        401: errorSchema,
      },
    },
  )
  .post(
    '/listings',
    async ({ user, body, set }) => {
      if (!user) {
        set.status = 401;
        return unauthorized;
      }

      try {
        const listingId = await db.transaction().execute(async (trx) => {
          const card = await trx
            .selectFrom('user_cards')
            .selectAll()
            .where('id', '=', body.userCardId)
            .where('user_id', '=', user.id)
            .forUpdate()
            .executeTakeFirst();

          if (!card) {
            throw new HttpError(404, 'CARD_NOT_FOUND', 'Carte introuvable.');
          }

          if (card.locked) {
            throw new HttpError(
              409,
              'CARD_LOCKED',
              'Cette carte est déjà verrouillée (vente en cours ou tableau).',
            );
          }

          const alreadyListed = await trx
            .selectFrom('market_listings')
            .select('id')
            .where('user_card_id', '=', body.userCardId)
            .where('status', '=', 'OPEN')
            .executeTakeFirst();

          if (alreadyListed) {
            throw new HttpError(409, 'CARD_ALREADY_LISTED', 'Cette carte est déjà en vente.');
          }

          const inserted = await trx
            .insertInto('market_listings')
            .values({ seller_id: user.id, user_card_id: body.userCardId, price: body.price })
            .returning('id')
            .executeTakeFirstOrThrow();

          await trx
            .updateTable('user_cards')
            .set({ locked: true })
            .where('id', '=', card.id)
            .execute();

          return inserted.id;
        });

        const listing = await fetchListing(db, listingId);
        if (!listing) {
          throw new HttpError(404, 'LISTING_NOT_FOUND', 'Annonce introuvable.');
        }

        set.status = 201;
        return { listing };
      } catch (error) {
        if (error instanceof HttpError) {
          set.status = error.status;
          return { code: error.code, message: error.message };
        }
        throw error;
      }
    },
    {
      body: t.Object({
        userCardId: t.String({ format: 'uuid' }),
        price: t.Integer({ minimum: 1, maximum: 1_000_000 }),
      }),
      response: {
        201: t.Object({ listing: listingSchema }, { additionalProperties: false }),
        400: errorSchema,
        401: errorSchema,
        404: errorSchema,
        409: errorSchema,
      },
    },
  )
  .post(
    '/listings/:id/buy',
    async ({ user, params, set }) => {
      if (!user) {
        set.status = 401;
        return unauthorized;
      }

      try {
        const result = await db.transaction().execute(async (trx) => {
          const listing = await trx
            .selectFrom('market_listings')
            .selectAll()
            .where('id', '=', params.id)
            .forUpdate()
            .executeTakeFirst();

          if (!listing) {
            throw new HttpError(404, 'LISTING_NOT_FOUND', 'Annonce introuvable.');
          }

          if (listing.status !== 'OPEN') {
            throw new HttpError(409, 'LISTING_NOT_OPEN', "Cette annonce n'est plus disponible.");
          }

          if (listing.seller_id === user.id) {
            throw new HttpError(
              403,
              'CANNOT_BUY_OWN_CARD',
              'Vous ne pouvez pas acheter votre propre carte.',
            );
          }

          // Verrou déterministe des deux portefeuilles (ordre par id) pour éviter
          // tout interblocage entre deux achats croisés.
          const lockedUsers = await trx
            .selectFrom('user')
            .select(['id', 'currency'])
            .where('id', 'in', [user.id, listing.seller_id])
            .orderBy('id')
            .forUpdate()
            .execute();

          const buyer = lockedUsers.find((u) => u.id === user.id);
          const seller = lockedUsers.find((u) => u.id === listing.seller_id);
          if (!buyer || !seller) {
            throw new HttpError(404, 'USER_NOT_FOUND', 'Utilisateur introuvable.');
          }

          const balance = buyer.currency ?? 0;
          if (balance < listing.price) {
            throw new HttpError(409, 'INSUFFICIENT_FUNDS', 'Solde insuffisant pour cet achat.');
          }

          const card = await trx
            .selectFrom('user_cards')
            .selectAll()
            .where('id', '=', listing.user_card_id)
            .forUpdate()
            .executeTakeFirst();

          if (!card) {
            throw new HttpError(404, 'CARD_NOT_FOUND', 'Carte introuvable.');
          }

          if (card.user_id !== listing.seller_id) {
            throw new HttpError(
              409,
              'CARD_OWNERSHIP_MISMATCH',
              "La carte n'appartient plus au vendeur.",
            );
          }

          await trx
            .updateTable('user')
            .set({ currency: balance - listing.price })
            .where('id', '=', buyer.id)
            .execute();

          await trx
            .updateTable('user')
            .set({ currency: (seller.currency ?? 0) + listing.price })
            .where('id', '=', seller.id)
            .execute();

          // Toute mutation de `currency` est doublée d'une ligne de grand-livre,
          // dans la même transaction.
          await trx
            .insertInto('currency_ledger')
            .values([
              { user_id: buyer.id, delta: -listing.price, reason: 'MARKET_BUY' },
              { user_id: seller.id, delta: listing.price, reason: 'MARKET_SELL' },
            ])
            .execute();

          await trx
            .updateTable('user_cards')
            .set({ user_id: buyer.id, locked: false, source: 'MARKET' })
            .where('id', '=', card.id)
            .execute();

          await trx
            .updateTable('market_listings')
            .set({ status: 'SOLD', buyer_id: buyer.id, sold_at: new Date() })
            .where('id', '=', listing.id)
            .execute();

          return { price: listing.price, balanceAfter: balance - listing.price };
        });

        const listing = await fetchListing(db, params.id);
        if (!listing) {
          throw new HttpError(404, 'LISTING_NOT_FOUND', 'Annonce introuvable.');
        }

        return { listing, balance: result.balanceAfter };
      } catch (error) {
        if (error instanceof HttpError) {
          set.status = error.status;
          return { code: error.code, message: error.message };
        }
        throw error;
      }
    },
    {
      params: t.Object({ id: t.String({ format: 'uuid' }) }),
      response: {
        200: t.Object(
          { listing: listingSchema, balance: t.Integer() },
          { additionalProperties: false },
        ),
        401: errorSchema,
        403: errorSchema,
        404: errorSchema,
        409: errorSchema,
      },
    },
  )
  .delete(
    '/listings/:id',
    async ({ user, params, set }) => {
      if (!user) {
        set.status = 401;
        return unauthorized;
      }

      try {
        await db.transaction().execute(async (trx) => {
          const listing = await trx
            .selectFrom('market_listings')
            .selectAll()
            .where('id', '=', params.id)
            .forUpdate()
            .executeTakeFirst();

          if (!listing) {
            throw new HttpError(404, 'LISTING_NOT_FOUND', 'Annonce introuvable.');
          }

          if (listing.status !== 'OPEN') {
            throw new HttpError(409, 'LISTING_NOT_OPEN', "Cette annonce n'est plus disponible.");
          }

          if (listing.seller_id !== user.id) {
            throw new HttpError(
              403,
              'NOT_LISTING_OWNER',
              "Vous n'êtes pas le vendeur de cette annonce.",
            );
          }

          await trx
            .updateTable('market_listings')
            .set({ status: 'CANCELLED' })
            .where('id', '=', listing.id)
            .execute();

          // Déverrouille la carte seulement si elle appartient toujours au vendeur.
          await trx
            .updateTable('user_cards')
            .set({ locked: false })
            .where('id', '=', listing.user_card_id)
            .where('user_id', '=', user.id)
            .execute();
        });

        const listing = await fetchListing(db, params.id);
        if (!listing) {
          throw new HttpError(404, 'LISTING_NOT_FOUND', 'Annonce introuvable.');
        }

        return { listing };
      } catch (error) {
        if (error instanceof HttpError) {
          set.status = error.status;
          return { code: error.code, message: error.message };
        }
        throw error;
      }
    },
    {
      params: t.Object({ id: t.String({ format: 'uuid' }) }),
      response: {
        200: t.Object({ listing: listingSchema }, { additionalProperties: false }),
        401: errorSchema,
        403: errorSchema,
        404: errorSchema,
        409: errorSchema,
      },
    },
  );
