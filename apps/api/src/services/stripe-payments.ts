import {
  type CheckoutInput,
  type CheckoutSession,
  PACK_KEYS,
  type PaymentEvent,
  type PaymentProvider,
  packByKey,
  ShopDisabledError,
  WebhookSignatureError,
} from '@hexamap/shared';
import Stripe from 'stripe';

export { ShopDisabledError, WebhookSignatureError };

let client: Stripe | null = null;

function stripeClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) throw new ShopDisabledError();
  client ??= new Stripe(secretKey);
  return client;
}

/** Une variable absente et une variable vide sont la même chose : la boutique est fermée. */
function configured(name: string): string | null {
  const value = process.env[name]?.trim();
  if (!value) return null;
  return value;
}

function isEnabled(): boolean {
  if (!configured('STRIPE_SECRET_KEY')) return false;
  if (!configured('STRIPE_WEBHOOK_SECRET')) return false;
  for (const key of PACK_KEYS) {
    const pack = packByKey(key);
    if (!pack || !configured(pack.stripePriceEnv)) return false;
  }
  return true;
}

async function createCheckoutSession(input: CheckoutInput): Promise<CheckoutSession> {
  const pack = packByKey(input.packKey);
  const priceId = pack ? configured(pack.stripePriceEnv) : null;
  if (!pack || !priceId) throw new ShopDisabledError();

  const stripe = stripeClient();
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{ price: priceId, quantity: 1 }],
    client_reference_id: input.userId,
    metadata: { userId: input.userId, packKey: pack.key },
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
  });

  if (!session.url) throw new Error('Session de paiement sans URL.');
  return { id: session.id, url: session.url };
}

async function verifyWebhook(
  rawBody: string,
  signature: string | null,
): Promise<PaymentEvent | null> {
  const webhookSecret = configured('STRIPE_WEBHOOK_SECRET');
  if (!webhookSecret) throw new ShopDisabledError();
  if (!signature) throw new WebhookSignatureError('Signature absente.');

  const stripe = stripeClient();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    throw new WebhookSignatureError();
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const packKey = PACK_KEYS.find((key) => key === session.metadata?.packKey);
    // Un pack inconnu ne peut rien créditer : l'appelant répond 200 sans écrire.
    if (!packKey) return null;
    const userId = session.metadata?.userId ?? session.client_reference_id;
    if (!userId) return null;
    return {
      kind: 'PURCHASE_COMPLETED',
      sessionId: session.id,
      userId,
      packKey,
      amountTotal: session.amount_total ?? null,
      currency: session.currency ?? null,
    };
  }

  if (event.type === 'charge.refunded') {
    const charge = event.data.object;
    const intent = charge.payment_intent;
    const paymentIntentId = typeof intent === 'string' ? intent : intent?.id;
    if (!paymentIntentId) return null;
    const sessions = await stripe.checkout.sessions.list({
      payment_intent: paymentIntentId,
      limit: 1,
    });
    const session = sessions.data[0];
    if (!session) return null;
    const packKey = PACK_KEYS.find((key) => key === session.metadata?.packKey) ?? null;
    const amountRefundedCents = charge.amount_refunded ?? 0;
    return {
      kind: 'PURCHASE_REFUNDED',
      sessionId: session.id,
      paymentIntentId,
      packKey,
      // Le détail des remboursements n'est pas développé dans l'événement :
      // `amount_refunded` est le cumul, jamais un appel réseau supplémentaire.
      amountCents: amountRefundedCents,
      amountRefundedCents,
      originalAmountCents:
        session.amount_total ?? (packKey ? packByKey(packKey)?.priceCents : undefined) ?? 0,
      currency: charge.currency ?? session.currency ?? null,
    };
  }

  return null;
}

export const stripePaymentProvider: PaymentProvider = {
  isEnabled,
  createCheckoutSession,
  verifyWebhook,
};
