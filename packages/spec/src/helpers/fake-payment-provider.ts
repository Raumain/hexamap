import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type {
  CheckoutInput,
  CheckoutSession,
  PackKey,
  PaymentEvent,
  PaymentProvider,
} from '@hexamap/shared';
import { ShopDisabledError, WebhookSignatureError } from '@hexamap/shared';

export const FAKE_WEBHOOK_SECRET = 'whsec_spec_boutique';

export class FakePaymentProvider implements PaymentProvider {
  readonly sessions = new Map<string, { userId: string; packKey: PackKey }>();
  enabled: boolean;

  constructor(options: { enabled?: boolean } = {}) {
    this.enabled = options.enabled ?? true;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async createCheckoutSession(input: CheckoutInput): Promise<CheckoutSession> {
    if (!this.enabled) throw new ShopDisabledError();
    const id = `cs_test_${randomUUID()}`;
    this.sessions.set(id, { userId: input.userId, packKey: input.packKey });
    return { id, url: `https://checkout.stripe.test/${id}` };
  }

  /** Signature HMAC-SHA256 du corps brut, en hexadécimal. */
  sign(rawBody: string): string {
    return createHmac('sha256', FAKE_WEBHOOK_SECRET).update(rawBody).digest('hex');
  }

  async verifyWebhook(rawBody: string, signature: string | null): Promise<PaymentEvent | null> {
    if (!this.enabled) throw new ShopDisabledError();
    if (!signature) throw new WebhookSignatureError('Signature absente.');
    const expected = this.sign(rawBody);
    const given = Buffer.from(signature, 'utf8');
    const wanted = Buffer.from(expected, 'utf8');
    if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) {
      throw new WebhookSignatureError();
    }
    const payload = JSON.parse(rawBody) as {
      type?: string;
      sessionId?: string;
      amountTotal?: number;
      currency?: string;
    };
    if (payload.type !== 'checkout.session.completed' || !payload.sessionId) return null;
    const session = this.sessions.get(payload.sessionId);
    if (!session) return null;
    return {
      kind: 'PURCHASE_COMPLETED',
      sessionId: payload.sessionId,
      userId: session.userId,
      packKey: session.packKey,
      amountTotal: payload.amountTotal ?? null,
      currency: payload.currency ?? null,
    };
  }
}
