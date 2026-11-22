import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { app } from '@hexamap/api/app';
import {
  type PushHostResolver,
  readPushPreferences,
  runPushSweep,
  subscribe,
  unsubscribe,
  writePushPreferences,
} from '@hexamap/api/services/push';
import type { PushSender, PushSendOutcome } from '@hexamap/api/services/push-sender';
import { createDb, runMigrations } from '@hexamap/db';
import {
  classifyPushEndpoint,
  isPrivateAddress,
  isQuietHour,
  PUSH_DEFAULT_QUIET_END,
  PUSH_DEFAULT_QUIET_START,
  PUSH_HTTP_METHODS,
  PUSH_NOTIFICATION,
  pushDecision,
  pushSupport,
  utcDay,
} from '@hexamap/shared';

// Phase 43 « La Sonnette » — `.docs/02-database.md` §4.12, `.docs/01-architecture.md` §4.10.
//
// Deux moitiés dans ce fichier :
//  1. le domaine **pur** (endpoint, heures calmes, décision, iOS), qui ne touche à rien ;
//  2. l'**ordonnanceur** et les routes, contre le vrai PostgreSQL du banc.
//
// Le domaine est pur à dessein : la décision d'envoyer ne dépend ni d'une horloge
// implicite ni d'un état de module, donc elle se vérifie sans base.

const db = createDb(process.env.DATABASE_URL ?? '');

const baseUrl = 'http://localhost:3000';
const origin = 'http://localhost:5174';
const prefix = crypto.randomUUID().slice(0, 8);

const REGEN = 1_800_000;
const PUBLIC_ENDPOINT = `https://push.example.com/${prefix}-a`;
const P256DH =
  'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM';
const AUTH = 'tBHItJI5svbpez7KI4CCXg';

interface PushConfigBody {
  enabled: boolean;
  publicKey: string | null;
}

interface ErrorBody {
  code: string;
  message: string;
}

interface SubscriptionRow {
  id: string;
  endpoint: string;
  last_sent_on: string | null;
  last_notified_charge_at: Date | null;
}

const createdUserIds: string[] = [];

/** Résolveur factice : le banc n'a pas le droit de dépendre d'un DNS réel. */
const publicResolver: PushHostResolver = async () => ['93.184.216.34'];
const loopbackResolver: PushHostResolver = async () => ['127.0.0.1'];
const emptyResolver: PushHostResolver = async () => [];

const NOW = new Date('2026-11-22T12:00:00.000Z');
const REGEN_MS = REGEN;

interface SentCall {
  endpoint: string;
  title: string;
  url: string;
}

function recordingSender(outcome: PushSendOutcome): { sender: PushSender; calls: SentCall[] } {
  const calls: SentCall[] = [];
  const sender: PushSender = async (subscription, message) => {
    calls.push({ endpoint: subscription.endpoint, title: message.title, url: message.url });
    return outcome;
  };
  return { sender, calls };
}

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
        pseudo: `${prefix}-push-${crypto.randomUUID().slice(0, 6)}`,
      }),
    }),
  );

  if (res.status !== 200 && res.status !== 201) {
    throw new Error(`Inscription impossible (${res.status}) : ${await res.text()}`);
  }

  const cookie = extractSessionCookie(res);
  const payload = (await res.json()) as { user?: { id?: string } };
  const userId = payload.user?.id;
  if (userId === undefined) {
    throw new Error('Inscription sans identifiant utilisateur.');
  }

  createdUserIds.push(userId);

  return { cookie, userId };
}

function authFetch(path: string, init: RequestInit & { cookie: string }): Promise<Response> {
  return app.handle(
    new Request(`${baseUrl}${path}`, {
      ...init,
      headers: {
        origin,
        cookie: init.cookie,
        ...(init.body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(init.headers ?? {}),
      },
    }),
  );
}

/**
 * Un carnet vide dont la prochaine charge est échue : exactement l'état que
 * l'ordonnanceur doit annoncer.
 */
async function seedDrainedUser(options?: {
  quietStart?: number;
  quietEnd?: number;
  charges?: number;
  lastRegenAt?: Date;
  endpoint?: string;
}): Promise<{ userId: string; cookie: string; subscriptionId: string }> {
  const { userId, cookie } = await signUp();

  await db
    .insertInto('user_scratch_charges')
    .values({
      user_id: userId,
      charges: options?.charges ?? 0,
      last_regen_at: options?.lastRegenAt ?? new Date(NOW.getTime() - REGEN - 60_000),
    })
    .execute();

  const row = await db
    .insertInto('push_subscriptions')
    .values({
      user_id: userId,
      endpoint: options?.endpoint ?? `${PUBLIC_ENDPOINT}-${userId}`,
      p256dh: P256DH,
      auth: AUTH,
    })
    .returning('id')
    .executeTakeFirstOrThrow();

  if (options?.quietStart !== undefined && options?.quietEnd !== undefined) {
    await writePushPreferences(db, userId, {
      quietStart: options.quietStart,
      quietEnd: options.quietEnd,
    });
  }

  return { userId, cookie, subscriptionId: row.id };
}

async function readSubscription(id: string): Promise<SubscriptionRow | undefined> {
  return db
    .selectFrom('push_subscriptions')
    .select(['id', 'endpoint', 'last_sent_on', 'last_notified_charge_at'])
    .where('id', '=', id)
    .executeTakeFirst();
}

/**
 * Vide les fixtures de ce fichier avant un cas qui compte les envois. Les autres
 * fichiers de spec tournent en parallèle sur la même base : le nettoyage est borné
 * aux comptes **créés ici**, jamais global.
 */
async function clearPushFixtures(): Promise<void> {
  if (createdUserIds.length === 0) return;

  await db.deleteFrom('push_subscriptions').where('user_id', 'in', createdUserIds).execute();
  await db.deleteFrom('user_scratch_charges').where('user_id', 'in', createdUserIds).execute();
  await db.deleteFrom('push_preferences').where('user_id', 'in', createdUserIds).execute();
}

beforeAll(async () => {
  await runMigrations(db);
});

afterAll(async () => {
  if (createdUserIds.length > 0) {
    await db.deleteFrom('push_subscriptions').where('user_id', 'in', createdUserIds).execute();
    await db.deleteFrom('push_preferences').where('user_id', 'in', createdUserIds).execute();
    await db.deleteFrom('user_scratch_charges').where('user_id', 'in', createdUserIds).execute();
    await db.deleteFrom('user').where('id', 'in', createdUserIds).execute();
  }
  await db.destroy();
});

/* ── 1. Point de terminaison : la garde SSRF ──────────────────────────────── */

describe('La Sonnette — le point de terminaison', () => {
  it('refuse un point de terminaison qui n’est pas en HTTPS', () => {
    const verdict = classifyPushEndpoint('http://push.example.com/abc');

    expect(verdict.ok).toBe(false);
    if (verdict.ok) throw new Error('un endpoint http a été accepté');
    expect(verdict.code).toBe('PUSH_ENDPOINT_NOT_HTTPS');
  });

  it('refuse une adresse privée littérale, sous toutes ses formes', () => {
    const refusées = [
      'https://127.0.0.1/push',
      'https://[::1]/push',
      'https://10.1.2.3/push',
      'https://192.168.0.5/push',
      'https://172.16.4.2/push',
      'https://169.254.1.1/push',
      'https://100.64.0.1/push',
      'https://[fd00::1]/push',
      'https://[fe80::1]/push',
      'https://localhost/push',
      'https://cabinet.localhost/push',
      'https://0.0.0.0/push',
    ];

    for (const endpoint of refusées) {
      const verdict = classifyPushEndpoint(endpoint);
      expect(verdict.ok, endpoint).toBe(false);
      if (verdict.ok) continue;
      expect(verdict.code, endpoint).toBe('PUSH_ENDPOINT_PRIVATE_HOST');
    }
  });

  it('refuse une adresse illisible', () => {
    for (const endpoint of ['', '   ', 'pas une url', '//push.example.com']) {
      const verdict = classifyPushEndpoint(endpoint);
      expect(verdict.ok, endpoint).toBe(false);
    }
  });

  it('accepte un hôte public en HTTPS', () => {
    const verdict = classifyPushEndpoint('https://push.example.com/abc/def');

    expect(verdict.ok).toBe(true);
    if (!verdict.ok) throw new Error(`endpoint public refusé : ${verdict.code}`);
    expect(verdict.host).toBe('push.example.com');
  });

  it('classe les adresses par plage, et laisse passer le public', () => {
    expect(isPrivateAddress('127.0.0.1')).toBe(true);
    expect(isPrivateAddress('::1')).toBe(true);
    expect(isPrivateAddress('10.0.0.7')).toBe(true);
    expect(isPrivateAddress('172.31.255.255')).toBe(true);
    expect(isPrivateAddress('172.32.0.1')).toBe(false);
    expect(isPrivateAddress('192.168.1.1')).toBe(true);
    expect(isPrivateAddress('169.254.169.254')).toBe(true);
    expect(isPrivateAddress('93.184.216.34')).toBe(false);
    expect(isPrivateAddress('push.example.com')).toBe(false);
  });
});

/* ── 2. Heures calmes et décision ─────────────────────────────────────────── */

describe('La Sonnette — les heures calmes', () => {
  it('lit une plage qui passe minuit', () => {
    expect(isQuietHour(23, 22, 8)).toBe(true);
    expect(isQuietHour(0, 22, 8)).toBe(true);
    expect(isQuietHour(7, 22, 8)).toBe(true);
    expect(isQuietHour(8, 22, 8)).toBe(false);
    expect(isQuietHour(12, 22, 8)).toBe(false);
    expect(isQuietHour(21, 22, 8)).toBe(false);
  });

  it('lit aussi une plage dans la journée', () => {
    expect(isQuietHour(9, 8, 22)).toBe(true);
    expect(isQuietHour(23, 8, 22)).toBe(false);
    expect(isQuietHour(7, 8, 22)).toBe(false);
  });

  it('désactive la plage quand les bornes sont égales', () => {
    expect(isQuietHour(3, 22, 22)).toBe(false);
    expect(isQuietHour(3, 0, 0)).toBe(false);
  });

  it('replie une heure hors bornes', () => {
    expect(isQuietHour(35, 22, 8)).toBe(false); // 35 ≡ 11 h, hors plage
    expect(isQuietHour(47, 22, 8)).toBe(true); // 47 ≡ 23 h, dans la plage
    expect(isQuietHour(-1, 22, 8)).toBe(true); // −1 ≡ 23 h
  });
});

describe('La Sonnette — la décision d’envoi', () => {
  const base = {
    charges: 0,
    lastRegenAt: new Date(NOW.getTime() - REGEN - 60_000),
    regenMs: REGEN_MS,
    now: NOW,
    quietStart: PUSH_DEFAULT_QUIET_START,
    quietEnd: PUSH_DEFAULT_QUIET_END,
    lastSentOn: null,
    lastNotifiedChargeAt: null,
  } as const;

  it('envoie quand le carnet est vide et la charge échue', () => {
    const decision = pushDecision({ ...base });

    expect(decision.send).toBe(true);
    expect(decision.reason).toBe('SEND');
    expect(decision.chargeAt.toISOString()).toBe(new Date(NOW.getTime() - 60_000).toISOString());
  });

  it('se tait tant que le carnet n’est pas vide', () => {
    expect(pushDecision({ ...base, charges: 2 }).reason).toBe('NO_CHARGE_DUE');
  });

  it('se tait tant que la charge n’est pas échue', () => {
    const decision = pushDecision({ ...base, lastRegenAt: new Date(NOW.getTime() - 1_000) });
    expect(decision.reason).toBe('NO_CHARGE_DUE');
    expect(decision.send).toBe(false);
  });

  it('n’annonce pas deux fois le même instant de charge', () => {
    const chargeAt = new Date(base.lastRegenAt.getTime() + REGEN_MS);
    const decision = pushDecision({ ...base, lastNotifiedChargeAt: chargeAt });

    expect(decision.reason).toBe('ALREADY_NOTIFIED');
    expect(decision.send).toBe(false);
  });

  it('respecte le quota du jour', () => {
    const decision = pushDecision({ ...base, lastSentOn: utcDay(NOW) });

    expect(decision.reason).toBe('DAILY_QUOTA');
    expect(decision.send).toBe(false);
  });

  it('reporte pendant les heures calmes sans rien consommer', () => {
    const decision = pushDecision({
      ...base,
      now: new Date('2026-11-22T23:30:00.000Z'),
    });

    expect(decision.reason).toBe('QUIET_HOURS');
    expect(decision.send).toBe(false);
  });

  it('fixe le jour UTC, jamais le jour local', () => {
    expect(utcDay(new Date('2026-11-22T23:59:59.999Z'))).toBe('2026-11-22');
    expect(utcDay(new Date('2026-11-23T00:00:00.000Z'))).toBe('2026-11-23');
  });
});

/* ── 3. iOS et support du navigateur ──────────────────────────────────────── */

describe('La Sonnette — le support du navigateur', () => {
  const IPHONE_15 =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1';
  const IPHONE_17 =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1';
  const DESKTOP =
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

  it('rend disponible un navigateur de bureau complet', () => {
    expect(
      pushSupport({
        userAgent: DESKTOP,
        standalone: false,
        hasPushManager: true,
        hasNotification: true,
      }),
    ).toBe('available');
  });

  it('rend non supporté un navigateur sans PushManager', () => {
    expect(
      pushSupport({
        userAgent: DESKTOP,
        standalone: false,
        hasPushManager: false,
        hasNotification: true,
      }),
    ).toBe('unsupported');
  });

  it('exige l’installation sur iOS, même en 17', () => {
    expect(
      pushSupport({
        userAgent: IPHONE_17,
        standalone: false,
        hasPushManager: true,
        hasNotification: true,
      }),
    ).toBe('ios-requires-install');
  });

  it('exige iOS 16.4 ou plus récent', () => {
    expect(
      pushSupport({
        userAgent: IPHONE_15,
        standalone: true,
        hasPushManager: true,
        hasNotification: true,
      }),
    ).toBe('ios-requires-install');
  });

  it('accepte un iPhone installé et à jour', () => {
    expect(
      pushSupport({
        userAgent: IPHONE_17,
        standalone: true,
        hasPushManager: true,
        hasNotification: true,
      }),
    ).toBe('available');
  });

  it('couvre les cinq méthodes HTTP du service worker', () => {
    expect([...PUSH_HTTP_METHODS]).toEqual(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
  });

  it('pointe la notification vers Le Relevé', () => {
    expect(PUSH_NOTIFICATION.url).toBe('/');
    expect(PUSH_NOTIFICATION.title.length).toBeGreaterThan(0);
  });
});

/* ── 4. Abonnement, désabonnement, préférences ────────────────────────────── */

describe('La Sonnette — abonnement et préférences', () => {
  it('enregistre un abonnement une seule fois par endpoint', async () => {
    const { userId } = await signUp();
    const endpoint = `${PUBLIC_ENDPOINT}-unique`;

    await subscribe(
      db,
      userId,
      { endpoint, p256dh: P256DH, auth: AUTH },
      { resolve: publicResolver },
    );
    await subscribe(
      db,
      userId,
      { endpoint, p256dh: P256DH, auth: AUTH },
      { resolve: publicResolver },
    );

    const rows = await db
      .selectFrom('push_subscriptions')
      .select('id')
      .where('endpoint', '=', endpoint)
      .execute();

    expect(rows).toHaveLength(1);
  });

  it('réassigne l’abonnement au compte qui se réabonne sur le même navigateur', async () => {
    const first = await signUp();
    const second = await signUp();
    const endpoint = `${PUBLIC_ENDPOINT}-shared`;

    await subscribe(
      db,
      first.userId,
      { endpoint, p256dh: P256DH, auth: AUTH },
      { resolve: publicResolver },
    );
    await subscribe(
      db,
      second.userId,
      { endpoint, p256dh: P256DH, auth: AUTH },
      { resolve: publicResolver },
    );

    const row = await db
      .selectFrom('push_subscriptions')
      .select('user_id')
      .where('endpoint', '=', endpoint)
      .executeTakeFirstOrThrow();

    expect(row.user_id).toBe(second.userId);
  });

  it('refuse un endpoint privé avant tout stockage', async () => {
    const { userId } = await signUp();

    await expect(
      subscribe(
        db,
        userId,
        { endpoint: 'https://127.0.0.1/push', p256dh: P256DH, auth: AUTH },
        {
          resolve: publicResolver,
        },
      ),
    ).rejects.toThrow();

    const rows = await db
      .selectFrom('push_subscriptions')
      .select('id')
      .where('user_id', '=', userId)
      .execute();
    expect(rows).toHaveLength(0);
  });

  it('refuse un nom qui résout vers la boucle locale', async () => {
    const { userId } = await signUp();

    await expect(
      subscribe(
        db,
        userId,
        { endpoint: 'https://sonnette.example.com/push', p256dh: P256DH, auth: AUTH },
        { resolve: loopbackResolver },
      ),
    ).rejects.toThrow();
  });

  it('refuse un nom qui ne résout pas', async () => {
    const { userId } = await signUp();

    await expect(
      subscribe(
        db,
        userId,
        { endpoint: 'https://fantome.example.com/push', p256dh: P256DH, auth: AUTH },
        { resolve: emptyResolver },
      ),
    ).rejects.toThrow();
  });

  it('écrit et relit les heures calmes, avec les défauts du contrat', async () => {
    const { userId } = await signUp();

    const defaults = await readPushPreferences(db, userId);
    expect(defaults).toEqual({
      quietStart: PUSH_DEFAULT_QUIET_START,
      quietEnd: PUSH_DEFAULT_QUIET_END,
    });

    await writePushPreferences(db, userId, { quietStart: 23, quietEnd: 6 });
    expect(await readPushPreferences(db, userId)).toEqual({ quietStart: 23, quietEnd: 6 });
  });

  it('conserve les préférences après un désabonnement', async () => {
    const { userId } = await signUp();

    await writePushPreferences(db, userId, { quietStart: 21, quietEnd: 7 });
    await subscribe(
      db,
      userId,
      { endpoint: `${PUBLIC_ENDPOINT}-gone`, p256dh: P256DH, auth: AUTH },
      { resolve: publicResolver },
    );

    await unsubscribe(db, userId, `${PUBLIC_ENDPOINT}-gone`);

    expect(await readPushPreferences(db, userId)).toEqual({ quietStart: 21, quietEnd: 7 });
  });

  it('supprime la ligne au désabonnement et arrête l’envoi', async () => {
    await clearPushFixtures();
    const { userId } = await seedDrainedUser();
    const { sender, calls } = recordingSender('SENT');

    const endpoint = (
      await db
        .selectFrom('push_subscriptions')
        .select('endpoint')
        .where('user_id', '=', userId)
        .executeTakeFirstOrThrow()
    ).endpoint;

    const removed = await unsubscribe(db, userId, endpoint);
    expect(removed).toBe(1);

    const result = await runPushSweep({ db, now: NOW, sender });
    expect(result.sent).toBe(0);
    expect(calls).toHaveLength(0);

    const rows = await db
      .selectFrom('push_subscriptions')
      .select('id')
      .where('user_id', '=', userId)
      .execute();
    expect(rows).toHaveLength(0);
  });
});

/* ── 5. L'ordonnanceur ────────────────────────────────────────────────────── */

describe('La Sonnette — l’ordonnanceur', () => {
  // Chaque cas compte les envois : les abonnements des cas précédents ne doivent
  // pas être candidats à ce battement.
  beforeEach(clearPushFixtures);

  it('envoie une fois, puis se tait pour la même charge', async () => {
    const { subscriptionId } = await seedDrainedUser();
    const { sender, calls } = recordingSender('SENT');

    const first = await runPushSweep({ db, now: NOW, sender });
    expect(first.sent).toBeGreaterThanOrEqual(1);
    expect(calls.some((call) => call.title === PUSH_NOTIFICATION.title)).toBe(true);

    const row = await readSubscription(subscriptionId);
    expect(row?.last_sent_on).toBe(utcDay(NOW));
    expect(row?.last_notified_charge_at?.toISOString()).toBe(
      new Date(new Date(NOW.getTime() - REGEN - 60_000).getTime() + REGEN_MS).toISOString(),
    );

    const second = await runPushSweep({ db, now: new Date(NOW.getTime() + 60_000), sender });
    expect(second.sent).toBe(0);
    expect(calls).toHaveLength(1);
  });

  it('ne consomme pas le quota pendant les heures calmes, puis envoie après', async () => {
    const { subscriptionId } = await seedDrainedUser({
      charges: 0,
      lastRegenAt: new Date('2026-11-22T20:00:00.000Z'),
      quietStart: 22,
      quietEnd: 8,
    });
    const { sender, calls } = recordingSender('SENT');

    const quiet = await runPushSweep({ db, now: new Date('2026-11-22T23:30:00.000Z'), sender });
    expect(quiet.sent).toBe(0);
    expect(calls).toHaveLength(0);

    const untouched = await readSubscription(subscriptionId);
    expect(untouched?.last_sent_on).toBeNull();
    expect(untouched?.last_notified_charge_at).toBeNull();

    const morning = await runPushSweep({ db, now: new Date('2026-11-23T08:30:00.000Z'), sender });
    expect(morning.sent).toBeGreaterThanOrEqual(1);
    expect(calls).toHaveLength(1);
  });

  it('ne dépasse pas une notification par jour, même pour une autre charge', async () => {
    const { subscriptionId, userId } = await seedDrainedUser();
    const { sender } = recordingSender('SENT');

    await runPushSweep({ db, now: NOW, sender });

    // Une charge plus récente — donc un instant de régénération **différent**, que
    // l'anti-doublon ne couvre plus —, mais le quota du jour est déjà consommé.
    await db
      .updateTable('user_scratch_charges')
      .set({ charges: 0, last_regen_at: new Date(NOW.getTime() - 1_000) })
      .where('user_id', '=', userId)
      .execute();

    const sameDay = await runPushSweep({ db, now: new Date(NOW.getTime() + 3_600_000), sender });
    expect(sameDay.sent).toBe(0);

    const row = await readSubscription(subscriptionId);
    expect(row?.last_sent_on).toBe(utcDay(NOW));
  });

  it('supprime l’abonnement qu’un service de push déclare disparu', async () => {
    const { subscriptionId } = await seedDrainedUser();
    const { sender } = recordingSender('GONE');

    const result = await runPushSweep({ db, now: NOW, sender });

    expect(result.purged).toBeGreaterThanOrEqual(1);
    expect(await readSubscription(subscriptionId)).toBeUndefined();
  });

  it('garde l’abonnement quand le service de push échoue autrement', async () => {
    const { subscriptionId } = await seedDrainedUser();
    const { sender } = recordingSender('FAILED');

    const result = await runPushSweep({ db, now: NOW, sender });

    expect(result.skipped).toBeGreaterThanOrEqual(1);
    expect(await readSubscription(subscriptionId)).toBeDefined();
  });

  it('n’envoie rien à un carnet plein', async () => {
    const { subscriptionId } = await seedDrainedUser({ charges: 4 });
    const { sender, calls } = recordingSender('SENT');

    const result = await runPushSweep({ db, now: NOW, sender });

    expect(result.sent).toBe(0);
    expect(calls).toHaveLength(0);
    expect(await readSubscription(subscriptionId)).toBeDefined();
  });
});

/* ── 6. Les routes ────────────────────────────────────────────────────────── */

describe('La Sonnette — les routes', () => {
  it('déclare la sonnette éteinte sans clés VAPID', async () => {
    const { cookie } = await signUp();
    const response = await authFetch('/api/v1/push/config', { method: 'GET', cookie });

    expect(response.status).toBe(200);
    const body = (await response.json()) as PushConfigBody;
    expect(body.enabled).toBe(false);
    expect(body.publicKey).toBeNull();
  });

  it('répond un code nommé quand la sonnette est éteinte', async () => {
    const { cookie } = await signUp();

    const response = await authFetch('/api/v1/push/subscription', {
      method: 'POST',
      cookie,
      body: JSON.stringify({
        endpoint: `${PUBLIC_ENDPOINT}-disabled`,
        keys: { p256dh: P256DH, auth: AUTH },
      }),
    });

    expect(response.status).toBe(503);
    expect(((await response.json()) as ErrorBody).code).toBe('PUSH_DISABLED');
  });

  it('refuse un endpoint privé par la route, avant stockage', async () => {
    const { cookie } = await signUp();

    const response = await authFetch('/api/v1/push/subscription', {
      method: 'POST',
      cookie,
      body: JSON.stringify({
        endpoint: 'https://127.0.0.1/push',
        keys: { p256dh: P256DH, auth: AUTH },
      }),
    });

    expect(response.status).toBe(503);
  });

  it('exige une session', async () => {
    const response = await app.handle(
      new Request(`${baseUrl}/api/v1/push/config`, { headers: { origin } }),
    );

    expect(response.status).toBe(401);
  });
});
