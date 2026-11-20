import type { PackKey } from './packs';

/** Demande de session de paiement : aucune référence à un prestataire concret. */
export interface CheckoutInput {
  readonly userId: string;
  readonly packKey: PackKey;
  readonly successUrl: string;
  readonly cancelUrl: string;
}

export interface CheckoutSession {
  readonly id: string;
  readonly url: string;
}

export interface PurchaseCompletedEvent {
  readonly kind: 'PURCHASE_COMPLETED';
  readonly sessionId: string;
  readonly userId: string;
  readonly packKey: PackKey;
  readonly amountTotal: number | null;
  readonly currency: string | null;
}

export interface PurchaseRefundedEvent {
  readonly kind: 'PURCHASE_REFUNDED';
  readonly sessionId: string;
  readonly paymentIntentId: string;
  readonly packKey: PackKey | null;
  readonly amountCents: number;
  readonly amountRefundedCents: number;
  readonly originalAmountCents: number;
  readonly currency: string | null;
}

export type PaymentEvent = PurchaseCompletedEvent | PurchaseRefundedEvent;

/** Contrat minimal d'un prestataire de paiement, injectable dans les tests. */
export interface PaymentProvider {
  isEnabled(): boolean;
  createCheckoutSession(input: CheckoutInput): Promise<CheckoutSession>;
  verifyWebhook(rawBody: string, signature: string | null): Promise<PaymentEvent | null>;
}

export class ShopDisabledError extends Error {
  constructor(message = 'La boutique est désactivée : aucune clé de paiement configurée.') {
    super(message);
    this.name = 'ShopDisabledError';
  }
}

export class WebhookSignatureError extends Error {
  constructor(message = 'Signature de webhook invalide.') {
    super(message);
    this.name = 'WebhookSignatureError';
  }
}
