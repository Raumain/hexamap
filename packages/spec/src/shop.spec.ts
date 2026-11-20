import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createApp } from '@hexamap/api/app';
import { dailyCapReached, refundEcus } from '@hexamap/api/services/shop';
import { createDb, runMigrations } from '@hexamap/db';
import type { PackKey } from '@hexamap/shared';
import { FakePaymentProvider } from './helpers/fake-payment-provider';

const db = createDb(process.env.DATABASE_URL ?? '');

const baseUrl = 'http://localhost:3000';
const origin = 'http://localhost:5174';
const prefix = crypto.randomUUID().slice(0, 8);
const createdUserIds: string[] = [];

const fake = new FakePaymentProvider();
const app = createApp({ paymentProvider: fake, serveWeb: false });

function extractSessionCookie(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(';')[0])
    .join('; ');
}

async function signUp(): Promise<{ cookie: string; userId: string }> {
  const email = `spec-${prefix}-${crypto.randomUUID()}@hexamap.test`;
  const res = await app.handle(
    new Request(`${baseUrl}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin },
      body: JSON.stringify({
        email,
        password: 'motdepasse-123',
        name: 'Spec',
        pseudo: `${prefix}-spec-${crypto.randomUUID().slice(0, 6)}`,
      }),
    }),
  );
  expect(res.status).toBeGreaterThanOrEqual(200);
  expect(res.status).toBeLessThan(300);
  const body = (await res.json()) as { user: { id: string } };
  createdUserIds.push(body.user.id);
  return { cookie: extractSessionCookie(res), userId: body.user.id };
}

async function authFetch(path: string, init: RequestInit = {}, cookie?: string): Promise<Response> {
  const headers = new Headers(init.headers);
  if (!headers.has('origin')) headers.set('origin', origin);
  if (cookie) headers.set('cookie', cookie);
  return app.handle(new Request(`${baseUrl}${path}`, { ...init, headers }));
}

async function readBalance(userId: string): Promise<number> {
  const row = await db
    .selectFrom('user')
    .select('currency')
    .where('id', '=', userId)
    .executeTakeFirstOrThrow();
  return row.currency ?? 0;
}

async function ledgerRows(userId: string): Promise<{ reason: string; delta: number }[]> {
  return db
    .selectFrom('currency_ledger')
    .select(['reason', 'delta'])
    .where('user_id', '=', userId)
    .orderBy('id')
    .execute();
}

async function startCheckout(
  cookie: string,
  packKey: PackKey,
): Promise<{ url: string; sessionId: string }> {
  const res = await authFetch(
    '/api/v1/shop/checkout',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ packKey }),
    },
    cookie,
  );
  expect(res.status).toBe(200);
  const body = (await res.json()) as { url: string };
  expect(body.url.length).toBeGreaterThan(0);
  return { url: body.url, sessionId: body.url.split('/').pop() ?? '' };
}

async function postWebhook(rawBody: string, signature: string, target = app): Promise<Response> {
  return target.handle(
    new Request(`${baseUrl}/api/v1/shop/webhook`, {
      method: 'POST',
      headers: { 'content-type': 'text/plain', 'stripe-signature': signature, origin },
      body: rawBody,
    }),
  );
}

/** Ouvre un paiement puis livre son webhook : le compte est crédité une fois. */
async function completeCheckout(cookie: string, packKey: PackKey): Promise<{ sessionId: string }> {
  const { sessionId } = await startCheckout(cookie, packKey);
  const rawBody = JSON.stringify({
    type: 'checkout.session.completed',
    sessionId,
    amountTotal: 499,
    currency: 'eur',
  });
  const res = await postWebhook(rawBody, fake.sign(rawBody));
  expect(res.status).toBe(200);
  return { sessionId };
}

/** Forge un `charge.refunded` sans passer par une décision de remboursement réelle. */
async function sendRefund(
  sessionId: string,
  opts: { amountRefundedCents: number; originalAmountCents: number; amountCents?: number },
): Promise<Response> {
  const payload: Record<string, unknown> = {
    type: 'charge.refunded',
    sessionId,
    amountRefundedCents: opts.amountRefundedCents,
    originalAmountCents: opts.originalAmountCents,
  };
  if (opts.amountCents !== undefined) payload.amountCents = opts.amountCents;
  const rawBody = JSON.stringify(payload);
  return postWebhook(rawBody, fake.sign(rawBody));
}

beforeAll(async () => {
  await runMigrations(db);
});

afterAll(async () => {
  await db.deleteFrom('user').where('id', 'in', createdUserIds).execute();
  await db.destroy();
});

describe('boutique — checkout et crédit des écus', () => {
  it('sans clés de paiement, le checkout répond 503 SHOP_DISABLED', async () => {
    const closed = createApp({
      paymentProvider: new FakePaymentProvider({ enabled: false }),
      serveWeb: false,
    });
    const { cookie } = await signUp();

    const res = await closed.handle(
      new Request(`${baseUrl}/api/v1/shop/checkout`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin, cookie },
        body: JSON.stringify({ packKey: 'PACK_500' }),
      }),
    );

    expect(res.status).toBe(503);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('SHOP_DISABLED');
  });

  it('sans clés de paiement, le webhook répond 503 SHOP_DISABLED', async () => {
    const closed = createApp({
      paymentProvider: new FakePaymentProvider({ enabled: false }),
      serveWeb: false,
    });

    const res = await postWebhook('{"type":"checkout.session.completed"}', 'peu-importe', closed);

    expect(res.status).toBe(503);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('SHOP_DISABLED');
  });

  it('une panne du prestataire répond 502 SHOP_PROVIDER_ERROR sans écrire', async () => {
    const broken = new FakePaymentProvider();
    // Forme d'une erreur Stripe réelle : `code` et `type` sont ce que la route
    // journalise, jamais la clé.
    broken.checkoutFailure = Object.assign(new Error('No such price: price_inconnu'), {
      code: 'resource_missing',
      type: 'StripeInvalidRequestError',
    });
    const brokenApp = createApp({ paymentProvider: broken, serveWeb: false });
    const { cookie, userId } = await signUp();

    const res = await brokenApp.handle(
      new Request(`${baseUrl}/api/v1/shop/checkout`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin, cookie },
        body: JSON.stringify({ packKey: 'PACK_500' }),
      }),
    );

    expect(res.status).toBe(502);
    const body = (await res.json()) as { code: string; message: string };
    expect(body.code).toBe('SHOP_PROVIDER_ERROR');
    expect(body.message.length).toBeGreaterThan(0);
    expect(body.message).not.toContain('price_inconnu');
    expect(await ledgerRows(userId)).toHaveLength(0);
    expect(await readBalance(userId)).toBe(0);
  });

  it('le checkout rend une URL et n’écrit aucune ligne de grand-livre', async () => {
    const { cookie, userId } = await signUp();

    const { url } = await startCheckout(cookie, 'PACK_500');

    expect(url.startsWith('https://checkout.stripe.test/')).toBe(true);
    expect(await ledgerRows(userId)).toHaveLength(0);
  });

  it('un webhook signé sur le corps brut crédite une fois', async () => {
    const { cookie, userId } = await signUp();
    const { sessionId } = await startCheckout(cookie, 'PACK_500');

    const rawBody = `{ "type" : "checkout.session.completed",\n  "sessionId" : "${sessionId}", "amountTotal": 499, "currency": "eur" }`;
    const res = await postWebhook(rawBody, fake.sign(rawBody));

    expect(res.status).toBe(200);
    const rows = await ledgerRows(userId);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.reason).toBe(`PURCHASE:${sessionId}`);
    expect(rows[0]?.delta).toBe(500);
    expect(await readBalance(userId)).toBe(500);
  });

  it('le rejeu du même webhook ne crédite pas deux fois', async () => {
    const { cookie, userId } = await signUp();
    const { sessionId } = await startCheckout(cookie, 'PACK_500');

    const rawBody = JSON.stringify({ type: 'checkout.session.completed', sessionId });
    const signature = fake.sign(rawBody);

    const first = await postWebhook(rawBody, signature);
    const second = await postWebhook(rawBody, signature);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(await ledgerRows(userId)).toHaveLength(1);
    expect(await readBalance(userId)).toBe(500);
  });

  it('une signature invalide est refusée sans écriture', async () => {
    const { cookie, userId } = await signUp();
    const { sessionId } = await startCheckout(cookie, 'PACK_500');

    const rawBody = JSON.stringify({ type: 'checkout.session.completed', sessionId });
    const res = await postWebhook(rawBody, 'signature-invalide');

    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('INVALID_SIGNATURE');
    expect(await ledgerRows(userId)).toHaveLength(0);
    expect(await readBalance(userId)).toBe(0);
  });

  it('la commande est PENDING avant le webhook et CREDITED après', async () => {
    const { cookie, userId } = await signUp();
    const { sessionId } = await startCheckout(cookie, 'PACK_500');

    const pending = await authFetch(`/api/v1/shop/orders/${sessionId}`, {}, cookie);
    expect(pending.status).toBe(200);
    const pendingBody = (await pending.json()) as { status: string; ecus: number | null };
    expect(pendingBody.status).toBe('PENDING');
    expect(pendingBody.ecus).toBeNull();

    const rawBody = JSON.stringify({ type: 'checkout.session.completed', sessionId });
    expect((await postWebhook(rawBody, fake.sign(rawBody))).status).toBe(200);

    const credited = await authFetch(`/api/v1/shop/orders/${sessionId}`, {}, cookie);
    expect(credited.status).toBe(200);
    const creditedBody = (await credited.json()) as { status: string; ecus: number | null };
    expect(creditedBody.status).toBe('CREDITED');
    expect(creditedBody.ecus).toBe(500);
    expect(await readBalance(userId)).toBe(500);
  });

  it('la commande d’un autre joueur répond 404', async () => {
    const playerA = await signUp();
    const playerB = await signUp();
    const { sessionId } = await startCheckout(playerA.cookie, 'PACK_500');

    const rawBody = JSON.stringify({ type: 'checkout.session.completed', sessionId });
    expect((await postWebhook(rawBody, fake.sign(rawBody))).status).toBe(200);

    const own = await authFetch(`/api/v1/shop/orders/${sessionId}`, {}, playerA.cookie);
    expect(own.status).toBe(200);

    const foreign = await authFetch(`/api/v1/shop/orders/${sessionId}`, {}, playerB.cookie);
    expect(foreign.status).toBe(404);
    const body = (await foreign.json()) as { code: string };
    expect(body.code).toBe('ORDER_NOT_FOUND');
  });
});

describe('boutique — remboursements', () => {
  it('un remboursement total écrit -500 et ramène le solde à 0', async () => {
    const { cookie, userId } = await signUp();
    const { sessionId } = await completeCheckout(cookie, 'PACK_500');
    expect(await readBalance(userId)).toBe(500);

    const res = await sendRefund(sessionId, {
      amountRefundedCents: 499,
      originalAmountCents: 499,
    });
    expect(res.status).toBe(200);

    const refundRow = (await ledgerRows(userId)).find(
      (row) => row.reason === `PURCHASE_REFUND:${sessionId}`,
    );
    expect(refundRow?.delta).toBe(-500);
    expect(await readBalance(userId)).toBe(0);
  });

  it('un remboursement partiel à 50 % écrit -250', async () => {
    const { cookie, userId } = await signUp();
    const { sessionId } = await completeCheckout(cookie, 'PACK_500');

    const res = await sendRefund(sessionId, {
      amountRefundedCents: 250,
      originalAmountCents: 499,
    });
    expect(res.status).toBe(200);

    const refundRow = (await ledgerRows(userId)).find(
      (row) => row.reason === `PURCHASE_REFUND:${sessionId}`,
    );
    expect(refundRow?.delta).toBe(-250);
    expect(await readBalance(userId)).toBe(250);
  });

  it('le rejeu du même remboursement n’écrit aucune ligne', async () => {
    const { cookie, userId } = await signUp();
    const { sessionId } = await completeCheckout(cookie, 'PACK_500');

    const opts = { amountRefundedCents: 250, originalAmountCents: 499 };
    expect((await sendRefund(sessionId, opts)).status).toBe(200);
    expect((await sendRefund(sessionId, opts)).status).toBe(200);

    const refundRows = (await ledgerRows(userId)).filter(
      (row) => row.reason === `PURCHASE_REFUND:${sessionId}`,
    );
    expect(refundRows).toHaveLength(1);
    expect(await readBalance(userId)).toBe(250);
  });

  it('une session inconnue répond 200 sans écrire', async () => {
    const { userId } = await signUp();
    const sessionId = `cs_test_inconnu-${crypto.randomUUID()}`;

    const res = await sendRefund(sessionId, {
      amountRefundedCents: 499,
      originalAmountCents: 499,
    });
    expect(res.status).toBe(200);

    const rows = await ledgerRows(userId);
    expect(rows.filter((row) => row.reason.includes(sessionId))).toHaveLength(0);
  });

  it('un solde dépensé puis remboursé écrit la ligne et ramène le solde à 0', async () => {
    const { cookie, userId } = await signUp();
    const { sessionId } = await completeCheckout(cookie, 'PACK_500');

    await db
      .insertInto('currency_ledger')
      .values({ user_id: userId, delta: -500, reason: 'MARKET_BUY' })
      .execute();
    await db.updateTable('user').set({ currency: 0 }).where('id', '=', userId).execute();
    expect(await readBalance(userId)).toBe(0);

    const res = await sendRefund(sessionId, {
      amountRefundedCents: 499,
      originalAmountCents: 499,
    });
    expect(res.status).toBe(200);

    const refundRow = (await ledgerRows(userId)).find(
      (row) => row.reason === `PURCHASE_REFUND:${sessionId}`,
    );
    expect(refundRow?.delta).toBe(-500);
    expect(await readBalance(userId)).toBe(0);
  });
});

describe('boutique — plafond quotidien', () => {
  it('un achat au-delà du plafond répond 429 SHOP_DAILY_CAP_REACHED sans créer de session', async () => {
    const { cookie, userId } = await signUp();

    await db
      .insertInto('currency_ledger')
      .values({
        user_id: userId,
        delta: 12000,
        reason: `PURCHASE:seed-${crypto.randomUUID()}`,
      })
      .execute();

    const sessionsBefore = fake.sessions.size;

    const res = await authFetch(
      '/api/v1/shop/checkout',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ packKey: 'PACK_500' }),
      },
      cookie,
    );

    expect(res.status).toBe(429);
    const body = (await res.json()) as { code: string; message: string };
    expect(body.code).toBe('SHOP_DAILY_CAP_REACHED');
    expect(body.message).toBe('Plafond quotidien d’écus atteint : réessayez demain.');
    expect(fake.sessions.size).toBe(sessionsBefore);
  });
});

describe('boutique — formules de remboursement et de plafond', () => {
  it('un remboursement total rend tous les écus du pack', () => {
    expect(
      refundEcus({
        originalEcus: 500,
        alreadyRefunded: 0,
        amountRefundedCents: 499,
        originalAmountCents: 499,
      }),
    ).toBe(500);
  });

  it('un remboursement partiel est proportionnel, arrondi au plancher', () => {
    expect(
      refundEcus({
        originalEcus: 500,
        alreadyRefunded: 0,
        amountRefundedCents: 250,
        originalAmountCents: 499,
      }),
    ).toBe(250);
  });

  it('un rejeu ne reprend rien', () => {
    expect(
      refundEcus({
        originalEcus: 500,
        alreadyRefunded: 250,
        amountRefundedCents: 250,
        originalAmountCents: 499,
      }),
    ).toBe(0);
  });

  it('un cumul supérieur au montant initial est borné au crédit initial', () => {
    expect(
      refundEcus({
        originalEcus: 500,
        alreadyRefunded: 0,
        amountRefundedCents: 600,
        originalAmountCents: 499,
      }),
    ).toBe(500);
  });

  it('le plafond quotidien se compare au cumul du jour', () => {
    expect(dailyCapReached({ purchasedToday: 11500, packEcus: 500, cap: 12000 })).toBe(false);
    expect(dailyCapReached({ purchasedToday: 11501, packEcus: 500, cap: 12000 })).toBe(true);
    expect(dailyCapReached({ purchasedToday: 12000, packEcus: 500, cap: 12000 })).toBe(true);
  });
});
