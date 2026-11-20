import {
  type CheckoutSession,
  type PackKey,
  type PaymentEvent,
  type PaymentProvider,
  type PurchaseCompletedEvent,
  type PurchaseRefundedEvent,
  packByKey,
  ShopDisabledError,
  ShopProviderError,
  WebhookSignatureError,
} from '@hexamap/shared';
import { Elysia, t } from 'elysia';
import { sql } from 'kysely';
import { db } from '../db';
import { env } from '../env';
import { HttpError } from '../lib/http-error';
import { authPlugin } from '../middleware/auth';
import { readShopConfig } from '../services/config';
import { dailyCapReached, refundEcus } from '../services/shop';

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
 * Traduit une erreur du prestataire de paiement en `ShopProviderError`.
 * Seuls `code` et `type` sont journalisés : la clé secrète ne sort jamais d'ici,
 * et l'erreur d'origine n'est pas recopiée dans la réponse.
 */
function toProviderError(error: unknown): ShopProviderError {
  if (error instanceof ShopProviderError) return error;
  if (error && typeof error === 'object') {
    const code = 'code' in error && typeof error.code === 'string' ? error.code : null;
    const type = 'type' in error && typeof error.type === 'string' ? error.type : null;
    console.error(`[shop] erreur du prestataire — type=${type ?? '?'} code=${code ?? '?'}`);
    return new ShopProviderError(code, type);
  }
  console.error('[shop] erreur du prestataire sans détail exploitable');
  return new ShopProviderError();
}

/**
 * Crédite l'achat d'un pack, une seule fois par session.
 * L'index partiel `currency_ledger_purchase_uniq` porte l'idempotence : un rejeu
 * n'insère aucune ligne et n'incrémente donc pas le solde.
 */
async function creditPurchase(event: PurchaseCompletedEvent): Promise<void> {
  // Seul un paiement encaissé crédite. `checkout.session.completed` peut arriver
  // avec `payment_status: 'unpaid'` sur un moyen de paiement différé : la
  // session est terminée, l'argent n'est pas là. La garde vaut pour tout
  // prestataire, donc elle vit ici et non dans l'adaptateur Stripe.
  if (event.paymentStatus !== 'paid') {
    console.warn(
      `[shop] session non payée ignorée : ${event.sessionId} (statut ${event.paymentStatus ?? 'inconnu'})`,
    );
    return;
  }

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

/**
 * Écrit la contrepartie négative d'un remboursement Stripe.
 *
 * Le propriétaire vient de la ligne `PURCHASE:<session>` du grand-livre, jamais
 * d'un identifiant fourni par le prestataire : c'est la seule source qui prouve
 * que l'achat a réellement été crédité. Le rejeu est absorbé par
 * `alreadyRefunded` (somme des lignes `PURCHASE_REFUND:<session>` déjà écrites),
 * puisque l'index partiel ne couvre pas ce motif.
 */
async function refundPurchase(event: PurchaseRefundedEvent): Promise<void> {
  await db.transaction().execute(async (trx) => {
    const purchase = await trx
      .selectFrom('currency_ledger')
      .select(['user_id', 'delta'])
      .where('reason', '=', `PURCHASE:${event.sessionId}`)
      .executeTakeFirst();

    if (!purchase) {
      console.warn(`[shop] remboursement d’une session inconnue: ${event.sessionId}`);
      return;
    }

    const user = await trx
      .selectFrom('user')
      .select(['id', 'currency'])
      .where('id', '=', purchase.user_id)
      .forUpdate()
      .executeTakeFirst();

    if (!user) {
      console.warn(`[shop] utilisateur inconnu pour la session ${event.sessionId}`);
      return;
    }

    const refunded = await trx
      .selectFrom('currency_ledger')
      .select(sql<string>`coalesce(sum(delta), 0)::text`.as('total'))
      .where('user_id', '=', user.id)
      .where('reason', '=', `PURCHASE_REFUND:${event.sessionId}`)
      .executeTakeFirst();

    const alreadyRefunded = -Number(refunded?.total ?? '0');

    const toReverse = refundEcus({
      originalEcus: purchase.delta,
      alreadyRefunded,
      amountRefundedCents: event.amountRefundedCents,
      originalAmountCents: event.originalAmountCents,
    });

    if (toReverse === 0) return;

    await trx
      .insertInto('currency_ledger')
      .values({
        user_id: user.id,
        delta: -toReverse,
        reason: `PURCHASE_REFUND:${event.sessionId}`,
      })
      .execute();

    const balance = user.currency ?? 0;
    let currency = balance - toReverse;
    if (currency < 0) {
      console.warn(
        `[shop] SHOP_REFUND_NEGATIVE — solde insuffisant pour ${event.sessionId} : solde ${balance}, remboursement ${toReverse}`,
      );
      currency = 0;
    }

    await trx.updateTable('user').set({ currency }).where('id', '=', user.id).execute();
  });
}

async function applyPaymentEvent(event: PaymentEvent): Promise<void> {
  if (event.kind === 'PURCHASE_COMPLETED') {
    await creditPurchase(event);
    return;
  }
  await refundPurchase(event);
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
          const pack = packByKey(packKey);

          // Garde d'entrée : elle précède l'aller-retour Stripe, hors transaction.
          // Un paiement déjà effectué reste crédité par le webhook.
          if (pack) {
            const purchased = await db
              .selectFrom('currency_ledger')
              .select(sql<string>`coalesce(sum(delta), 0)::text`.as('total'))
              .where('user_id', '=', user.id)
              .where('reason', 'like', 'PURCHASE:%')
              .where(
                sql<boolean>`created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc'`,
              )
              .executeTakeFirst();

            const { dailyPurchaseCap } = await readShopConfig(db);

            if (
              dailyCapReached({
                purchasedToday: Number(purchased?.total ?? '0'),
                packEcus: pack.ecus,
                cap: dailyPurchaseCap,
              })
            ) {
              set.status = 429;
              return {
                code: 'SHOP_DAILY_CAP_REACHED',
                message: 'Plafond quotidien d’écus atteint : réessayez demain.',
              };
            }
          }

          let session: CheckoutSession;
          try {
            session = await provider.createCheckoutSession({
              userId: user.id,
              packKey,
              successUrl: `${origin}/boutique/succes?session_id={CHECKOUT_SESSION_ID}`,
              cancelUrl: `${origin}/boutique`,
            });
          } catch (error) {
            // Une clé absente reste une boutique fermée (503), pas une panne.
            if (error instanceof ShopDisabledError) throw error;
            throw toProviderError(error);
          }

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
          // Panne du prestataire (prix inconnu, clé révoquée, devise refusée) :
          // ce n'est pas une erreur du serveur, donc pas un 500 générique.
          if (error instanceof ShopProviderError) {
            set.status = 502;
            return { code: 'SHOP_PROVIDER_ERROR', message: error.message };
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
          429: errorSchema,
          502: errorSchema,
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
  return new Elysia({ name: 'routes.shop.webhook', prefix: '/shop' }).post(
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
      // `parse: 'text'` garde le corps brut : le parseur JSON par défaut
      // consommerait le flux et invaliderait la signature Stripe.
      parse: 'text',
      body: t.String(),
      response: {
        200: webhookAck,
        400: errorSchema,
        503: errorSchema,
      },
    },
  );
}
