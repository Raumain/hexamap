import {
  type PackKey,
  type PaymentEvent,
  type PaymentProvider,
  type PurchaseCompletedEvent,
  packByKey,
  ShopDisabledError,
  WebhookSignatureError,
} from '@hexamap/shared';
import { Elysia, t } from 'elysia';
import { sql } from 'kysely';
import { db } from '../db';
import { env } from '../env';
import { HttpError } from '../lib/http-error';
import { authPlugin } from '../middleware/auth';

const errorSchema = t.Object(
  { code: t.String(), message: t.String() },
  { additionalProperties: false },
);

const unauthorized = { code: 'UNAUTHORIZED', message: 'Non authentifié' };

const shopClosedMessage = 'La boutique est fermée : aucune clé de paiement configurée.';

const packKeySchema = t.Union([
  t.Literal('PACK_500'),
  t.Literal('PACK_1200'),
  t.Literal('PACK_2500'),
  t.Literal('PACK_6000'),
]);

const checkoutSchema = t.Object({ url: t.String() }, { additionalProperties: false });

const orderSchema = t.Object(
  {
    id: t.String(),
    status: t.Union([t.Literal('PENDING'), t.Literal('CREDITED')]),
    ecus: t.Union([t.Integer(), t.Null()]),
  },
  { additionalProperties: false },
);

const webhookAck = t.Object({ received: t.Boolean() }, { additionalProperties: false });

/**
 * Crédite l'achat d'un pack, une seule fois par session.
 * L'index partiel `currency_ledger_purchase_uniq` porte l'idempotence : un rejeu
 * n'insère aucune ligne et n'incrémente donc pas le solde.
 */
async function creditPurchase(event: PurchaseCompletedEvent): Promise<void> {
  await db.transaction().execute(async (trx) => {
    const user = await trx
      .selectFrom('user')
      .select(['id'])
      .where('id', '=', event.userId)
      .forUpdate()
      .executeTakeFirst();

    if (!user) {
      console.warn(`[shop] utilisateur inconnu pour la session ${event.sessionId}`);
      return;
    }

    const pack = packByKey(event.packKey);
    if (!pack) return;

    const inserted = await trx
      .insertInto('currency_ledger')
      .values({
        user_id: user.id,
        delta: pack.ecus,
        reason: `PURCHASE:${event.sessionId}`,
      })
      .onConflict((oc) => oc.doNothing())
      .returning('id')
      .executeTakeFirst();

    if (!inserted) return;

    await trx
      .updateTable('user')
      .set({ currency: sql<number>`coalesce(currency, 0) + ${pack.ecus}` })
      .where('id', '=', user.id)
      .execute();
  });
}

async function applyPaymentEvent(event: PaymentEvent): Promise<void> {
  // Les remboursements relèvent d'une phase ultérieure : rien n'est écrit ici.
  if (event.kind !== 'PURCHASE_COMPLETED') return;
  await creditPurchase(event);
}

export function shopCheckoutRoutes(provider: PaymentProvider) {
  return new Elysia({ name: 'routes.shop.checkout', prefix: '/shop' })
    .use(authPlugin)
    .post(
      '/checkout',
      async ({ user, body, set }) => {
        if (!user) {
          set.status = 401;
          return unauthorized;
        }

        try {
          if (!provider.isEnabled()) {
            throw new HttpError(503, 'SHOP_DISABLED', shopClosedMessage);
          }

          const origin = new URL(env.FRONTEND_URL ?? env.APP_URL).origin;
          const packKey: PackKey = body.packKey;
          const session = await provider.createCheckoutSession({
            userId: user.id,
            packKey,
            successUrl: `${origin}/boutique?session_id={CHECKOUT_SESSION_ID}`,
            cancelUrl: `${origin}/boutique`,
          });

          return { url: session.url };
        } catch (error) {
          if (error instanceof HttpError) {
            set.status = error.status;
            return { code: error.code, message: error.message };
          }
          if (error instanceof ShopDisabledError) {
            set.status = 503;
            return { code: 'SHOP_DISABLED', message: error.message };
          }
          throw error;
        }
      },
      {
        body: t.Object({ packKey: packKeySchema }, { additionalProperties: false }),
        response: {
          200: checkoutSchema,
          400: errorSchema,
          401: errorSchema,
          503: errorSchema,
        },
      },
    )
    .get(
      '/orders/:id',
      async ({ user, params, set }) => {
        if (!user) {
          set.status = 401;
          return unauthorized;
        }

        const row = await db
          .selectFrom('currency_ledger')
          .select(['user_id', 'delta'])
          .where('reason', '=', `PURCHASE:${params.id}`)
          .executeTakeFirst();

        if (row && row.user_id !== user.id) {
          set.status = 404;
          return { code: 'ORDER_NOT_FOUND', message: 'Commande introuvable.' };
        }

        if (!row) {
          return { id: params.id, status: 'PENDING' as const, ecus: null };
        }

        return { id: params.id, status: 'CREDITED' as const, ecus: row.delta };
      },
      {
        params: t.Object({ id: t.String() }, { additionalProperties: false }),
        response: {
          200: orderSchema,
          401: errorSchema,
          404: errorSchema,
        },
      },
    );
}

export function shopWebhookRoutes(provider: PaymentProvider) {
  return (
    new Elysia({ name: 'routes.shop.webhook', prefix: '/shop' })
      // Le corps brut est indispensable à la vérification de signature : le parseur
      // par défaut consommerait le flux et réécrirait les octets signés.
      .onParse({ as: 'scoped' }, ({ request }) => {
        if (new URL(request.url).pathname !== '/api/v1/shop/webhook') return undefined;
        return request.text();
      })
      .post(
        '/webhook',
        async ({ body, request, set }) => {
          try {
            if (!provider.isEnabled()) {
              set.status = 503;
              return { code: 'SHOP_DISABLED', message: shopClosedMessage };
            }

            const rawBody = typeof body === 'string' ? body : '';
            const event = await provider.verifyWebhook(
              rawBody,
              request.headers.get('stripe-signature'),
            );

            if (event) await applyPaymentEvent(event);

            return { received: true };
          } catch (error) {
            if (error instanceof WebhookSignatureError) {
              set.status = 400;
              return { code: 'INVALID_SIGNATURE', message: error.message };
            }
            if (error instanceof ShopDisabledError) {
              set.status = 503;
              return { code: 'SHOP_DISABLED', message: error.message };
            }
            throw error;
          }
        },
        {
          body: t.String(),
          response: {
            200: webhookAck,
            400: errorSchema,
            503: errorSchema,
          },
        },
      )
  );
}
