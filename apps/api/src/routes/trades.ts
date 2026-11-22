import { Elysia, t } from 'elysia';
import { db } from '../db';
import { HttpError } from '../lib/http-error';
import { authPlugin } from '../middleware/auth';
import type { TradeOfferView } from '../services/trade';
import {
  acceptTrade,
  cancelTrade,
  declineTrade,
  expireOffersForUser,
  loadOffers,
  proposeTrade,
  type TradeBox,
} from '../services/trade';

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

const statusSchema = t.Union([
  t.Literal('PENDING'),
  t.Literal('ACCEPTED'),
  t.Literal('DECLINED'),
  t.Literal('CANCELLED'),
  t.Literal('EXPIRED'),
]);

const partySchema = t.Object(
  { id: t.String(), pseudo: t.Union([t.String(), t.Null()]) },
  { additionalProperties: false },
);

const tradeCardSchema = t.Object(
  {
    id: t.String(),
    category: categorySchema,
    refCode: t.String(),
    nom: t.String(),
    blasonUrl: t.Union([t.String(), t.Null()]),
    blasonCredit: t.Union([t.String(), t.Null()]),
    rarity: raritySchema,
    score: t.Integer(),
  },
  { additionalProperties: false },
);

const tradeOfferSchema = t.Object(
  {
    id: t.String(),
    status: statusSchema,
    createdAt: t.String(),
    respondedAt: t.Union([t.String(), t.Null()]),
    expiresAt: t.String(),
    proposer: partySchema,
    receiver: partySchema,
    offeredCard: tradeCardSchema,
    requestedCard: tradeCardSchema,
  },
  { additionalProperties: false },
);

const errorSchema = t.Object(
  { code: t.String(), message: t.String() },
  { additionalProperties: false },
);

const unauthorized = { code: 'UNAUTHORIZED', message: 'Non authentifié' };

const offerPath = t.Object({ id: t.String({ format: 'uuid' }) });

function toBody(offer: TradeOfferView) {
  return { offer };
}

export const tradeRoutes = new Elysia({ name: 'routes.trades', prefix: '/trades' })
  .use(authPlugin)
  .get(
    '/',
    async ({ user, query, set }) => {
      if (!user) {
        set.status = 401;
        return unauthorized;
      }

      // L'expiration tourne à la lecture : aucun ordonnanceur n'existe, et
      // l'offre morte doit libérer sa carte avant que la liste ne s'affiche.
      await expireOffersForUser(db, user.id);

      const box: TradeBox = query.box === 'sent' ? 'sent' : 'received';
      const offers = await loadOffers(db, user.id, box, query.limit ?? 50);
      return { offers };
    },
    {
      query: t.Object({
        box: t.Optional(t.Union([t.Literal('received'), t.Literal('sent')])),
        limit: t.Optional(t.Integer({ minimum: 1, maximum: 100 })),
      }),
      response: {
        200: t.Object({ offers: t.Array(tradeOfferSchema) }, { additionalProperties: false }),
        401: errorSchema,
      },
    },
  )
  .post(
    '/',
    async ({ user, body, set }) => {
      if (!user) {
        set.status = 401;
        return unauthorized;
      }

      try {
        await expireOffersForUser(db, user.id);
        const offer = await proposeTrade(user.id, body);
        set.status = 201;
        return toBody(offer);
      } catch (error) {
        if (error instanceof HttpError) {
          set.status = error.status;
          return { code: error.code, message: error.message };
        }
        throw error;
      }
    },
    {
      body: t.Object(
        {
          offeredCardId: t.String({ format: 'uuid' }),
          requestedCardId: t.String({ format: 'uuid' }),
        },
        { additionalProperties: false },
      ),
      response: {
        201: t.Object({ offer: tradeOfferSchema }, { additionalProperties: false }),
        400: errorSchema,
        401: errorSchema,
        403: errorSchema,
        404: errorSchema,
        409: errorSchema,
      },
    },
  )
  .post(
    '/:id/accept',
    async ({ user, params, set }) => {
      if (!user) {
        set.status = 401;
        return unauthorized;
      }

      try {
        await expireOffersForUser(db, user.id);
        const offer = await acceptTrade(user.id, params.id);
        return toBody(offer);
      } catch (error) {
        if (error instanceof HttpError) {
          set.status = error.status;
          return { code: error.code, message: error.message };
        }
        throw error;
      }
    },
    {
      params: offerPath,
      response: {
        200: t.Object({ offer: tradeOfferSchema }, { additionalProperties: false }),
        401: errorSchema,
        403: errorSchema,
        404: errorSchema,
        409: errorSchema,
      },
    },
  )
  .post(
    '/:id/decline',
    async ({ user, params, set }) => {
      if (!user) {
        set.status = 401;
        return unauthorized;
      }

      try {
        await expireOffersForUser(db, user.id);
        const offer = await declineTrade(user.id, params.id);
        return toBody(offer);
      } catch (error) {
        if (error instanceof HttpError) {
          set.status = error.status;
          return { code: error.code, message: error.message };
        }
        throw error;
      }
    },
    {
      params: offerPath,
      response: {
        200: t.Object({ offer: tradeOfferSchema }, { additionalProperties: false }),
        401: errorSchema,
        403: errorSchema,
        404: errorSchema,
        409: errorSchema,
      },
    },
  )
  .post(
    '/:id/cancel',
    async ({ user, params, set }) => {
      if (!user) {
        set.status = 401;
        return unauthorized;
      }

      try {
        await expireOffersForUser(db, user.id);
        const offer = await cancelTrade(user.id, params.id);
        return toBody(offer);
      } catch (error) {
        if (error instanceof HttpError) {
          set.status = error.status;
          return { code: error.code, message: error.message };
        }
        throw error;
      }
    },
    {
      params: offerPath,
      response: {
        200: t.Object({ offer: tradeOfferSchema }, { additionalProperties: false }),
        401: errorSchema,
        403: errorSchema,
        404: errorSchema,
        409: errorSchema,
      },
    },
  );
