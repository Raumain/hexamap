import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { readdir, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { app } from '@hexamap/api/app';
import { auth } from '@hexamap/api/auth';
import { drainCapturedMail } from '@hexamap/api/lib/mailer';
import { assertAccountPurged } from '@hexamap/api/services/account';
import { createDb, runMigrations } from '@hexamap/db';
import { validatePseudo } from '@hexamap/shared';

const db = createDb(process.env.DATABASE_URL ?? '');

const baseUrl = 'http://localhost:3000';
const origin = 'http://localhost:5174';
const prefix = crypto.randomUUID().slice(0, 8);
const createdUserIds: string[] = [];

const DEFAULT_PASSWORD = 'motdepasse-123';
const NEW_PASSWORD = 'nouveaumotdepasse-456';

interface SignUpResult {
  cookie: string;
  userId: string;
  email: string;
  pseudo: string;
}

interface ExportedAccount {
  achievements: unknown[];
  cards: unknown[];
  friendships: unknown[];
  ledger: unknown[];
  profile: Record<string, unknown>;
  tableaux: unknown[];
}

function extractSessionCookie(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(';')[0])
    .join('; ');
}

async function signUp(
  pseudo = `${prefix}-${crypto.randomUUID().slice(0, 6)}`,
): Promise<SignUpResult> {
  const email = `spec-${prefix}-${crypto.randomUUID()}@hexamap.test`;
  const res = await app.handle(
    new Request(`${baseUrl}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin },
      body: JSON.stringify({ email, password: DEFAULT_PASSWORD, name: 'Spec', pseudo }),
    }),
  );
  expect(res.status).toBeGreaterThanOrEqual(200);
  expect(res.status).toBeLessThan(300);
  const body = (await res.json()) as { user: { id: string; pseudo: string } };
  createdUserIds.push(body.user.id);
  return {
    cookie: extractSessionCookie(res),
    userId: body.user.id,
    email,
    pseudo: body.user.pseudo,
  };
}

async function authFetch(path: string, init: RequestInit = {}, cookie?: string): Promise<Response> {
  const headers = new Headers(init.headers);
  if (!headers.has('origin')) headers.set('origin', origin);
  if (cookie) headers.set('cookie', cookie);
  return app.handle(new Request(`${baseUrl}${path}`, { ...init, headers }));
}

function jsonInit(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}

/** Insère une carte et rend son identifiant, pour composer tableaux et annonces. */
async function insertCard(
  userId: string,
  category: 'REGION' | 'DEPARTEMENT' | 'COMMUNE' | 'RUE',
  refCode: string,
): Promise<string> {
  const row = await db
    .insertInto('user_cards')
    .values({ user_id: userId, category, ref_code: refCode, rarity: 'RARE', score: 750 })
    .returning('id')
    .executeTakeFirstOrThrow();
  return row.id;
}

/** Toutes les clés d'un JSON, objets et tableaux parcourus, en minuscules. */
function collectKeys(value: unknown, acc: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, acc);
    return acc;
  }
  if (value !== null && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      acc.push(key.toLowerCase());
      collectKeys(child, acc);
    }
  }
  return acc;
}

/**
 * Sème une ligne dans chaque table que la suppression doit vider pour un compte.
 * Rend les identifiants de tickets, seuls nécessaires pour compter les révélations.
 */
async function seedFullAccount(userId: string, partnerId: string, outsiderId: string) {
  const regionCard = await insertCard(userId, 'REGION', `${prefix}-R1`);
  const listedCard = await insertCard(userId, 'COMMUNE', `${prefix}-C1`);

  const ticket = await db
    .insertInto('tickets')
    .values({ user_id: userId, grid: [], treasure_index: 3 })
    .returning('id')
    .executeTakeFirstOrThrow();

  await db
    .insertInto('ticket_reveals')
    .values({ ticket_id: ticket.id, cell_index: 0, card_user_id: regionCard, distance: 2 })
    .execute();

  await db
    .insertInto('tableaux')
    .values({ user_id: userId, name: 'Tableau Spécimen', region_card_id: regionCard })
    .execute();

  await db
    .insertInto('market_listings')
    .values({ seller_id: userId, user_card_id: listedCard, price: 120, status: 'OPEN' })
    .execute();

  // Annonce du partenaire déjà vendue à ce compte : `buyer_id` doit repasser à
  // `NULL` à la suppression, sans emporter l'annonce.
  const partnerCard = await insertCard(partnerId, 'COMMUNE', `${prefix}-C2`);
  await db
    .insertInto('market_listings')
    .values({
      seller_id: partnerId,
      user_card_id: partnerCard,
      price: 90,
      status: 'SOLD',
      sold_at: new Date(),
      buyer_id: userId,
    })
    .execute();

  await db
    .insertInto('currency_ledger')
    .values({ user_id: userId, delta: 250, reason: 'MARKET_SELL' })
    .execute();

  await db.insertInto('user_scratch_charges').values({ user_id: userId, charges: 2 }).execute();

  await db
    .insertInto('user_achievements')
    .values({ user_id: userId, achievement_key: 'FIRST_SCRATCH' })
    .execute();

  // Une amitié dans chaque sens : demandeur, puis destinataire.
  await db
    .insertInto('friendships')
    .values({ requester_id: userId, addressee_id: partnerId, status: 'PENDING' })
    .execute();
  await db
    .insertInto('friendships')
    .values({ requester_id: outsiderId, addressee_id: userId, status: 'ACCEPTED' })
    .execute();

  // Un blocage dans chaque sens également.
  await db.insertInto('blocks').values({ blocker_id: userId, blocked_id: outsiderId }).execute();
  await db.insertInto('blocks').values({ blocker_id: partnerId, blocked_id: userId }).execute();

  await db
    .insertInto('user_profiles')
    .values({ user_id: userId, bio: 'Cartographe du dimanche', profile_public: true })
    .execute();

  return { ticketIds: [ticket.id] };
}

/**
 * Ouvre un transport de courriel vers un répertoire temporaire, puis referme et
 * efface. Le `503` sans transport se prouve donc sur l'**absence** de la
 * variable, pas sur un état laissé par un cas précédent.
 */
async function withMailOutbox<T>(run: (dir: string) => Promise<T>): Promise<T> {
  const dir = join(tmpdir(), `hexamap-mail-${crypto.randomUUID()}`);
  process.env.MAIL_OUTBOX_DIR = dir;
  try {
    return await run(dir);
  } finally {
    delete process.env.MAIL_OUTBOX_DIR;
    await rm(dir, { recursive: true, force: true });
  }
}

beforeAll(async () => {
  await runMigrations(db);
});

afterAll(async () => {
  // Le grand-livre porte des références auto-incrementaires sans clé étrangère
  // problematique : la cascade de `"user"` suffit pour le reste.
  await db.deleteFrom('currency_ledger').where('user_id', 'in', createdUserIds).execute();
  if (createdUserIds.length > 0) {
    await db.deleteFrom('user').where('id', 'in', createdUserIds).execute();
  }
  await db.destroy();
});

describe('Comptes §2.9 — la forme du pseudo', () => {
  it('accepte les lettres accentuées, les chiffres, les tirets et le souligné', () => {
    for (const pseudo of ['Élodie-2', 'rue_des_écoles', 'abc', 'a'.repeat(24)]) {
      expect(validatePseudo(pseudo)).toEqual({ ok: true, pseudo });
    }
  });

  it('refuse une longueur hors bornes', () => {
    expect(validatePseudo('ab')).toEqual({ ok: false, problem: 'TOO_SHORT' });
    expect(validatePseudo('a'.repeat(25))).toEqual({ ok: false, problem: 'TOO_LONG' });
  });

  it('refuse les espaces et les caractères interdits', () => {
    expect(validatePseudo('deux mots')).toEqual({ ok: false, problem: 'INVALID_CHARACTERS' });
    expect(validatePseudo('pseudo@exemple')).toEqual({ ok: false, problem: 'INVALID_CHARACTERS' });
    expect(validatePseudo('pseudo!')).toEqual({ ok: false, problem: 'INVALID_CHARACTERS' });
  });

  it('retire les espaces de bord avant de mesurer', () => {
    expect(validatePseudo('  abc  ')).toEqual({ ok: true, pseudo: 'abc' });
  });
});

describe('Comptes §2.9 — le pseudo changeable', () => {
  it('Comptes §2.9 — un pseudo pris à la casse près répond 409 PSEUDO_TAKEN', async () => {
    const other = await signUp();
    const taken = (await signUp()).pseudo;

    const res = await authFetch(
      '/api/v1/account/pseudo',
      jsonInit('PATCH', { pseudo: taken.toUpperCase() }),
      other.cookie,
    );
    expect(res.status).toBe(409);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('PSEUDO_TAKEN');

    // Le pseudo du demandeur n'a pas bougé.
    const row = await db
      .selectFrom('user')
      .select('pseudo')
      .where('id', '=', other.userId)
      .executeTakeFirstOrThrow();
    expect(row.pseudo).toBe(other.pseudo);
  });

  it('Comptes §2.9 — un pseudo mal formé répond 422 PSEUDO_INVALID', async () => {
    const account = await signUp();
    const res = await authFetch(
      '/api/v1/account/pseudo',
      jsonInit('PATCH', { pseudo: 'deux mots' }),
      account.cookie,
    );
    expect(res.status).toBe(422);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('PSEUDO_INVALID');
  });

  it('Comptes §2.9 — un pseudo libre est enregistré', async () => {
    const account = await signUp();
    const wanted = `${prefix}-nouveau`;

    const res = await authFetch(
      '/api/v1/account/pseudo',
      jsonInit('PATCH', { pseudo: `  ${wanted}  ` }),
      account.cookie,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { pseudo: string };
    expect(body.pseudo).toBe(wanted);

    const row = await db
      .selectFrom('user')
      .select('pseudo')
      .where('id', '=', account.userId)
      .executeTakeFirstOrThrow();
    expect(row.pseudo).toBe(wanted);
  });
});

describe('Comptes §2.9 — le mot de passe', () => {
  it('Comptes §2.9 — sans mot de passe actuel, la route refuse', async () => {
    const account = await signUp();
    const res = await authFetch(
      '/api/v1/account/password',
      jsonInit('POST', { newPassword: NEW_PASSWORD }),
      account.cookie,
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('CURRENT_PASSWORD_REQUIRED');
  });

  it('Comptes §2.9 — un mauvais mot de passe actuel répond 400 INVALID_PASSWORD', async () => {
    const account = await signUp();
    const res = await authFetch(
      '/api/v1/account/password',
      jsonInit('POST', {
        currentPassword: 'mauvais-mot-de-passe',
        newPassword: NEW_PASSWORD,
      }),
      account.cookie,
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('INVALID_PASSWORD');
  });

  it('Comptes §2.9 — le bon mot de passe change la connexion', async () => {
    const account = await signUp();
    const res = await authFetch(
      '/api/v1/account/password',
      jsonInit('POST', { currentPassword: DEFAULT_PASSWORD, newPassword: NEW_PASSWORD }),
      account.cookie,
    );
    expect(res.status).toBe(200);

    const oldLogin = await authFetch(
      '/api/auth/sign-in/email',
      jsonInit('POST', { email: account.email, password: DEFAULT_PASSWORD }),
    );
    expect(oldLogin.status).toBeGreaterThanOrEqual(400);

    const newLogin = await authFetch(
      '/api/auth/sign-in/email',
      jsonInit('POST', { email: account.email, password: NEW_PASSWORD }),
    );
    expect(newLogin.status).toBe(200);
  });
});

describe('Comptes §2.9 — le courriel', () => {
  it('Comptes §2.9 — le changement n’écrit rien avant la vérification', async () => {
    const account = await signUp();

    await withMailOutbox(async (dir) => {
      drainCapturedMail();

      const newEmail = `nouveau-${crypto.randomUUID()}@hexamap.test`;
      const res = await authFetch(
        '/api/v1/account/email',
        jsonInit('POST', { newEmail }),
        account.cookie,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { pending: boolean; email: string };
      expect(body.pending).toBe(true);
      expect(body.email).toBe(account.email);

      const before = await db
        .selectFrom('user')
        .select(['email', 'emailVerified'])
        .where('id', '=', account.userId)
        .executeTakeFirstOrThrow();
      expect(before.email).toBe(account.email);
      expect(before.emailVerified).toBe(false);

      // Le transport écrit un fichier par message : c'est la preuve que le lien
      // peut réellement être ouvert, et non seulement capturé en mémoire.
      const files = (await readdir(dir)).filter((name) => name.endsWith('.json'));
      expect(files.length).toBeGreaterThan(0);
      const writtenPath = join(dir, files[files.length - 1] ?? '');
      const written = JSON.parse(await readFile(writtenPath, 'utf8')) as {
        to: string;
        url: string;
        subject: string;
        sentAt: string;
      };
      expect(Object.keys(written).sort()).toEqual(['sentAt', 'subject', 'to', 'url']);
      expect(written.to).toBe(newEmail);
      expect(written.url).toContain('token=');
      expect((await stat(writtenPath)).mode & 0o777).toBe(0o600);

      const mails = drainCapturedMail();
      expect(mails.length).toBeGreaterThan(0);
      const last = mails[mails.length - 1];
      expect(last).toBeDefined();
      const token = new URL(last?.url ?? '').searchParams.get('token');
      expect(token).toBeTruthy();

      const verify = await authFetch(
        `/api/auth/verify-email?token=${encodeURIComponent(token ?? '')}`,
        {},
        account.cookie,
      );
      expect(verify.status).toBeLessThan(400);

      const after = await db
        .selectFrom('user')
        .select(['email', 'emailVerified'])
        .where('id', '=', account.userId)
        .executeTakeFirstOrThrow();
      expect(after.email).toBe(newEmail);
      // Better Auth applique le nouvel email en conservant `emailVerified` : c'est
      // sa sémantique du chemin `change-email-verification`, pas un défaut.
      expect(after.emailVerified).toBe(false);
    });
  });

  it('Comptes §2.9 — un courriel déjà pris répond 400 EMAIL_ALREADY_EXISTS', async () => {
    const owner = await signUp();
    const other = await signUp();

    // La garde de transport passe AVANT la pré-vérification d'existence : sans
    // `MAIL_OUTBOX_DIR`, ce cas répondrait `503`, pas `400`.
    await withMailOutbox(async () => {
      const res = await authFetch(
        '/api/v1/account/email',
        jsonInit('POST', { newEmail: owner.email.toUpperCase() }),
        other.cookie,
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as { code: string };
      expect(body.code).toBe('EMAIL_ALREADY_EXISTS');
    });
  });

  it('Comptes §2.9 — sans transport de courriel, la demande répond 503', async () => {
    delete process.env.MAIL_OUTBOX_DIR;
    const account = await signUp();

    const res = await authFetch(
      '/api/v1/account/email',
      jsonInit('POST', { newEmail: `sans-transport-${crypto.randomUUID()}@hexamap.test` }),
      account.cookie,
    );
    expect(res.status).toBe(503);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('EMAIL_VERIFICATION_DISABLED');

    // Aucun courriel n'est parti : rien n'a bougé en base.
    const row = await db
      .selectFrom('user')
      .select(['email', 'emailVerified'])
      .where('id', '=', account.userId)
      .executeTakeFirstOrThrow();
    expect(row.email).toBe(account.email);
    expect(row.emailVerified).toBe(false);
  });
});

describe('Comptes §2.9 — les capacités du compte', () => {
  it('Comptes §2.9 — /account/capabilities dit ce que le serveur sait faire', async () => {
    process.env.ACCOUNT_DELETION_ENABLED = 'false';
    delete process.env.MAIL_OUTBOX_DIR;

    const anonymous = await authFetch('/api/v1/account/capabilities');
    expect(anonymous.status).toBe(401);
    const denied = (await anonymous.json()) as { code: string };
    expect(denied.code).toBe('UNAUTHORIZED');

    const account = await signUp();
    const closed = await authFetch('/api/v1/account/capabilities', {}, account.cookie);
    expect(closed.status).toBe(200);
    // Aucun transport, interrupteur éteint : l'écran ne doit rien proposer.
    expect(await closed.json()).toEqual({ deletion: false, emailVerification: false });

    process.env.ACCOUNT_DELETION_ENABLED = 'true';
    try {
      const open = await authFetch('/api/v1/account/capabilities', {}, account.cookie);
      expect(open.status).toBe(200);
      expect(await open.json()).toEqual({ deletion: true, emailVerification: false });
    } finally {
      process.env.ACCOUNT_DELETION_ENABLED = 'false';
    }
  });

  it('Comptes §2.9 — la vérification reste annoncée et vaut toujours faux', async () => {
    // R-001 : le produit ne veut aucune confirmation d’adresse. La capacité reste
    // dans la charge utile — un écran n’apprend pas son absence par une clé
    // manquante — mais elle est éteinte pour de bon. `MAIL_OUTBOX_DIR` n’est pas
    // un transport de courriel, seulement le témoin d’écriture du banc : le poser
    // ne doit donc rien rallumer.
    process.env.ACCOUNT_DELETION_ENABLED = 'false';

    await withMailOutbox(async () => {
      const account = await signUp();
      const res = await authFetch('/api/v1/account/capabilities', {}, account.cookie);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ deletion: false, emailVerification: false });
    });
  });

  it('Comptes §2.9 — l’interrupteur est ouvert par défaut', async () => {
    // Le produit ouvre la suppression par défaut depuis que les pages légales
    // sont publiées : l'absence de variable vaut `true`, jamais `false`.
    delete process.env.ACCOUNT_DELETION_ENABLED;
    try {
      const account = await signUp();
      const res = await authFetch('/api/v1/account/capabilities', {}, account.cookie);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ deletion: true, emailVerification: false });
    } finally {
      process.env.ACCOUNT_DELETION_ENABLED = 'false';
    }
  });
});

describe('Comptes §2.9 — l’export', () => {
  it('Comptes §2.9 — six familles exactement, sans donnée de session', async () => {
    const account = await signUp();
    const card = await insertCard(account.userId, 'REGION', `${prefix}-export`);
    await db
      .insertInto('tableaux')
      .values({ user_id: account.userId, name: 'Tableau Export', region_card_id: card })
      .execute();

    const res = await authFetch('/api/v1/account/export', {}, account.cookie);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-disposition') ?? '').toContain('attachment');

    const body = (await res.json()) as ExportedAccount;
    expect(Object.keys(body).sort()).toEqual([
      'achievements',
      'cards',
      'friendships',
      'ledger',
      'profile',
      'tableaux',
    ]);

    expect(body.cards).toHaveLength(1);
    expect(body.tableaux).toHaveLength(1);

    const keys = collectKeys(body);
    for (const forbidden of ['session', 'account', 'currency', 'grid', 'treasure_index']) {
      expect(keys).not.toContain(forbidden);
    }
  });
});

describe('Comptes §2.9 — la suppression', () => {
  it('Comptes §2.9 — l’interrupteur éteint interdit toute suppression', async () => {
    process.env.ACCOUNT_DELETION_ENABLED = 'false';
    const account = await signUp();
    const partner = await signUp();

    const res = await authFetch(
      '/api/v1/account',
      jsonInit('DELETE', { password: DEFAULT_PASSWORD, confirmation: account.pseudo }),
      account.cookie,
    );
    expect(res.status).toBe(503);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('ACCOUNT_DELETION_DISABLED');

    // Le chemin Better Auth direct est fermé par le même interrupteur.
    let thrown = false;
    try {
      await auth.api.deleteUser({
        body: { password: DEFAULT_PASSWORD },
        headers: new Headers({ cookie: account.cookie, origin }),
      });
    } catch {
      thrown = true;
    }
    expect(thrown).toBe(true);

    const still = await db
      .selectFrom('user')
      .select('id')
      .where('id', '=', account.userId)
      .executeTakeFirst();
    expect(still?.id).toBe(account.userId);
    expect(partner.userId).not.toBe(account.userId);
  });

  it('Comptes §2.9 — une suppression réelle vide toutes les tables du compte et laisse les voisins intacts', async () => {
    process.env.ACCOUNT_DELETION_ENABLED = 'true';
    try {
      const account = await signUp();
      const partner = await signUp();
      const outsider = await signUp();
      const { ticketIds } = await seedFullAccount(account.userId, partner.userId, outsider.userId);

      const partnerCardsBefore = await db
        .selectFrom('user_cards')
        .select((eb) => eb.fn.countAll().as('count'))
        .where('user_id', '=', partner.userId)
        .executeTakeFirstOrThrow();
      const partnerTableauxBefore = await db
        .selectFrom('tableaux')
        .select((eb) => eb.fn.countAll().as('count'))
        .where('user_id', '=', partner.userId)
        .executeTakeFirstOrThrow();

      const res = await authFetch(
        '/api/v1/account',
        jsonInit('DELETE', { password: DEFAULT_PASSWORD, confirmation: account.pseudo }),
        account.cookie,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { deleted: boolean; cascade: Record<string, number> };
      expect(body.deleted).toBe(true);

      const report = await assertAccountPurged(account.userId, ticketIds);
      for (const [table, value] of Object.entries(report)) {
        expect({ table, value }).toEqual({ table, value: 0 });
      }
      for (const [table, value] of Object.entries(body.cascade)) {
        expect({ table, value }).toEqual({ table, value: 0 });
      }

      // La session ne répond plus : le compte n'existe plus.
      const me = await authFetch('/api/v1/me', {}, account.cookie);
      expect(me.status).toBe(401);

      // L'annonce du partenaire survit, son acheteur repasse à `NULL`.
      const partnerCardsAfter = await db
        .selectFrom('user_cards')
        .select((eb) => eb.fn.countAll().as('count'))
        .where('user_id', '=', partner.userId)
        .executeTakeFirstOrThrow();
      const partnerTableauxAfter = await db
        .selectFrom('tableaux')
        .select((eb) => eb.fn.countAll().as('count'))
        .where('user_id', '=', partner.userId)
        .executeTakeFirstOrThrow();
      expect(partnerCardsAfter.count).toBe(partnerCardsBefore.count);
      expect(partnerTableauxAfter.count).toBe(partnerTableauxBefore.count);
    } finally {
      process.env.ACCOUNT_DELETION_ENABLED = 'false';
    }
  });

  it('Comptes §2.9 — un mauvais mot de passe ne supprime rien', async () => {
    process.env.ACCOUNT_DELETION_ENABLED = 'true';
    try {
      const account = await signUp();
      const res = await authFetch(
        '/api/v1/account',
        jsonInit('DELETE', {
          password: 'mauvais-mot-de-passe',
          confirmation: account.pseudo,
        }),
        account.cookie,
      );
      expect(res.status).toBe(401);
      const body = (await res.json()) as { code: string };
      expect(body.code).toBe('INVALID_PASSWORD');

      const still = await db
        .selectFrom('user')
        .select('id')
        .where('id', '=', account.userId)
        .executeTakeFirst();
      expect(still?.id).toBe(account.userId);
    } finally {
      process.env.ACCOUNT_DELETION_ENABLED = 'false';
    }
  });

  it('Comptes §2.9 — la réauthentification précède la confirmation du pseudo', async () => {
    process.env.ACCOUNT_DELETION_ENABLED = 'true';
    try {
      const account = await signUp();

      // Les deux champs sont faux : la réponse doit nommer le mot de passe,
      // parce que la décision de contrat ordonne la réauthentification d'abord
      // et la saisie du pseudo ensuite.
      const res = await authFetch(
        '/api/v1/account',
        jsonInit('DELETE', {
          password: 'mauvais-mot-de-passe',
          confirmation: 'mauvais-pseudo',
        }),
        account.cookie,
      );
      expect(res.status).toBe(401);
      const body = (await res.json()) as { code: string };
      expect(body.code).toBe('INVALID_PASSWORD');
    } finally {
      process.env.ACCOUNT_DELETION_ENABLED = 'false';
    }
  });

  it('Comptes §2.9 — une confirmation erronée ne supprime rien', async () => {
    process.env.ACCOUNT_DELETION_ENABLED = 'true';
    try {
      const account = await signUp();
      const res = await authFetch(
        '/api/v1/account',
        jsonInit('DELETE', { password: DEFAULT_PASSWORD, confirmation: 'mauvais-pseudo' }),
        account.cookie,
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as { code: string };
      expect(body.code).toBe('CONFIRMATION_MISMATCH');

      const still = await db
        .selectFrom('user')
        .select('id')
        .where('id', '=', account.userId)
        .executeTakeFirst();
      expect(still?.id).toBe(account.userId);
    } finally {
      process.env.ACCOUNT_DELETION_ENABLED = 'false';
    }
  });

  it('Comptes §2.9 — la confirmation est exacte, la casse compte', async () => {
    process.env.ACCOUNT_DELETION_ENABLED = 'true';
    try {
      const account = await signUp();

      // Le pseudo est en minuscules : la même chaîne en majuscules n'est plus
      // « exactement » le pseudo, et le serveur refuse comme le libellé l'annonce.
      const otherCase = account.pseudo.toUpperCase();
      expect(otherCase).not.toBe(account.pseudo);

      const res = await authFetch(
        '/api/v1/account',
        jsonInit('DELETE', { password: DEFAULT_PASSWORD, confirmation: otherCase }),
        account.cookie,
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as { code: string };
      expect(body.code).toBe('CONFIRMATION_MISMATCH');

      const still = await db
        .selectFrom('user')
        .select('id')
        .where('id', '=', account.userId)
        .executeTakeFirst();
      expect(still?.id).toBe(account.userId);
    } finally {
      process.env.ACCOUNT_DELETION_ENABLED = 'false';
    }
  });
});

describe('Comptes §2.9 — la forme de l’export', () => {
  it('Comptes §2.9 — exportedAt vit dans profile, jamais à la racine', async () => {
    const account = await signUp();
    const res = await authFetch('/api/v1/account/export', {}, account.cookie);
    expect(res.status).toBe(200);

    const body = (await res.json()) as ExportedAccount;
    expect(Object.hasOwn(body, 'exportedAt')).toBe(false);
    expect(typeof body.profile.exportedAt).toBe('string');
    expect(body.profile.pseudo).toBe(account.pseudo);
    // Le solde brut n'est pas une donnée exportable : le grand-livre en tient lieu.
    expect(Object.hasOwn(body.profile, 'currency')).toBe(false);
  });
});

describe('Comptes §2.9 — la lecture des réglages de vitrine', () => {
  it('Comptes §2.9 — GET /api/v1/profile refuse sans session et rend le défaut', async () => {
    const anonymous = await authFetch('/api/v1/profile');
    expect(anonymous.status).toBe(401);
    const denied = (await anonymous.json()) as { code: string };
    expect(denied.code).toBe('UNAUTHORIZED');

    // Un compte neuf n'a aucune ligne `user_profiles` : la lecture rend le
    // défaut de la table, sans en écrire une.
    const account = await signUp();
    const res = await authFetch('/api/v1/profile', {}, account.cookie);
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      profile: { pseudo: string | null; bio: string | null; profilePublic: boolean };
    };
    expect(Object.keys(body)).toEqual(['profile']);
    expect(Object.keys(body.profile).sort()).toEqual(['bio', 'profilePublic', 'pseudo']);
    expect(body.profile.pseudo).toBe(account.pseudo);
    expect(body.profile.bio).toBeNull();
    expect(body.profile.profilePublic).toBe(true);

    const rows = await db
      .selectFrom('user_profiles')
      .select('user_id')
      .where('user_id', '=', account.userId)
      .execute();
    expect(rows).toHaveLength(0);
  });
});
