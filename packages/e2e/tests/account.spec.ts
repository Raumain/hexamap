import { readFileSync } from 'node:fs';
import { type APIRequestContext, type APIResponse, expect, request, test } from '@playwright/test';
import { createDb } from '../../db/src/index';
import {
  readSecondAccountFixture,
  type SecondAccountFixture,
  secondStorageStatePath,
} from '../fixtures/second-account';
import { storageStatePath } from './fixtures/auth';

/**
 * Les comptes — deux joueurs réels.
 *
 * Le compte jetable naît pendant le cas, par la vraie route d'inscription, et
 * l'autre joueur est celui du banc (`fixtures/second-account.ts`) : il porte une
 * session réelle et une carte, et c'est exactement le témoin qu'il faut pour
 * prouver qu'une suppression n'emporte qu'un compte. Inscrire un second compte
 * jetable est impossible ici : Better Auth plafonne `/sign-up/email` à trois
 * requêtes par fenêtre et par IP, et `global-setup.ts` en consomme déjà deux.
 *
 * `storageState` ne peut pas servir : l'identité du compte jetable n'existe
 * qu'à l'exécution. Les sessions voyagent donc dans l'en-tête `cookie` d'un
 * `APIRequestContext` neuf, exactement comme la fixture du second compte.
 *
 * La suppression est ouverte par défaut (`ACCOUNT_DELETION_ENABLED`) depuis la
 * publication des pages légales ; le cas « interrupteur refermé → 503 » vit dans
 * `packages/spec/src/account.spec.ts`.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'https://hexamap.test';

/** Commune du référentiel E2E : `${PREFIX}-C-${rarete}-${district}`. */
const CARD_REF = 'E2E-C-RARE-0';
const CARD_SCORE = 1000;

// Les pages publiques se regardent en anonyme : c'est la seule lecture qui
// prouve qu'aucune surface ouverte ne mène à `/compte`.
test.use({ storageState: { cookies: [], origins: [] } });

interface TestIdentity {
  pseudo: string;
  email: string;
  password: string;
}

interface TestAccount extends TestIdentity {
  userId: string;
  cookieHeader: string;
}

/** Stable par processus de worker : un retry rejoue la même identité. */
const STAMP = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const IDENTITY: TestIdentity = {
  pseudo: `e2e${STAMP}compte`,
  email: `e2e-compte-${STAMP}@hexamap.test`,
  password: `Compte-${STAMP}!9`,
};

/** `headersArray()` est le seul accès sûr : un `Expires` contient une virgule. */
function cookieHeaderOf(response: APIResponse): string {
  const pairs: string[] = [];

  for (const header of response.headersArray()) {
    if (header.name.toLowerCase() !== 'set-cookie') continue;
    const pair = header.value.split(';')[0];
    if (pair?.includes('=')) pairs.push(pair.trim());
  }

  if (pairs.length === 0) {
    throw new Error('La réponse d’inscription E2E ne porte aucun cookie de session.');
  }

  return pairs.join('; ');
}

function textField(source: unknown, key: string): string | null {
  if (typeof source !== 'object' || source === null) return null;
  const value: unknown = Reflect.get(source, key);
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/** Identité lue sur `GET /api/auth/get-session`, ou `null` si la session est morte. */
async function readSessionIdentity(
  context: APIRequestContext,
  cookieHeader: string,
): Promise<{ id: string; pseudo: string | null } | null> {
  const response = await context.get('/api/auth/get-session', {
    headers: { cookie: cookieHeader },
  });
  if (!response.ok()) return null;

  const payload: unknown = await response.json();
  if (typeof payload !== 'object' || payload === null) return null;

  const user: unknown = Reflect.get(payload, 'user');
  const id = textField(user, 'id');
  if (id === null) return null;

  return { id, pseudo: textField(user, 'pseudo') };
}

/**
 * Inscription, puis connexion en repli : un rejeu immédiat tombe dans la fenêtre
 * de limitation de `/sign-up/email`, et le compte de la première tentative
 * existe déjà. La connexion retrouve alors la même session.
 */
async function createAccount(
  context: APIRequestContext,
  account: TestIdentity,
): Promise<TestAccount> {
  const headers = { origin: BASE_URL };

  const signUp = await context.post('/api/auth/sign-up/email', {
    headers,
    data: {
      email: account.email,
      password: account.password,
      name: account.pseudo,
      pseudo: account.pseudo,
    },
  });

  const authenticated = signUp.ok()
    ? signUp
    : await context.post('/api/auth/sign-in/email', {
        headers,
        data: { email: account.email, password: account.password },
      });

  if (!authenticated.ok()) {
    throw new Error(
      `Compte jetable E2E inutilisable : inscription ${signUp.status()}, ` +
        `connexion ${authenticated.status()} (${await authenticated.text()}).`,
    );
  }

  const cookieHeader = cookieHeaderOf(authenticated);
  const session = await readSessionIdentity(context, cookieHeader);

  if (session === null) {
    throw new Error('Inscription E2E acceptée mais aucune session lisible : le cas est aveugle.');
  }

  return { ...account, userId: session.id, cookieHeader };
}

/** Session du second joueur, telle que la fixture du banc l'a déposée sur disque. */
function witnessCookieHeader(): string {
  const raw = readFileSync(secondStorageStatePath, 'utf8');
  const state: unknown = JSON.parse(raw);
  const cookies: unknown =
    typeof state === 'object' && state !== null ? Reflect.get(state, 'cookies') : null;

  if (!Array.isArray(cookies)) {
    throw new Error(`État de session du second compte illisible (${secondStorageStatePath}).`);
  }

  const pairs = cookies
    .map((cookie: unknown) => {
      const name = textField(cookie, 'name');
      const value = textField(cookie, 'value');
      return name === null || value === null ? null : `${name}=${value}`;
    })
    .filter((pair): pair is string => pair !== null);

  if (pairs.length === 0) {
    throw new Error('État de session du second compte sans cookie : le témoin serait aveugle.');
  }

  return pairs.join('; ');
}

function headersOf(account: { cookieHeader: string }): Record<string, string> {
  return { cookie: account.cookieHeader, origin: BASE_URL };
}

test.describe('Les comptes', () => {
  // Le scénario est une chaîne : le pseudo change, l'export se lit, puis le
  // compte disparaît. Les cas partagent donc le même worker et le même état.
  test.describe.configure({ mode: 'serial' });

  let context: APIRequestContext;
  let db: ReturnType<typeof createDb>;
  let account: TestAccount;
  let witness: SecondAccountFixture;

  test.beforeAll(async () => {
    context = await request.newContext({ baseURL: BASE_URL, ignoreHTTPSErrors: true });

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL manquant : la cascade de la suppression ne peut pas être lue.');
    }
    db = createDb(databaseUrl);

    witness = readSecondAccountFixture();
    account = await createAccount(context, IDENTITY);

    // Un peu de matière à supprimer : sans elle, la cascade ne prouverait que
    // l'effacement des lignes d'authentification.
    await db
      .insertInto('user_cards')
      .values({
        user_id: account.userId,
        category: 'COMMUNE',
        ref_code: CARD_REF,
        rarity: 'RARE',
        score: CARD_SCORE,
      })
      .execute();
    await db
      .insertInto('currency_ledger')
      .values({ user_id: account.userId, delta: 10, reason: 'ACHIEVEMENT:e2e-account' })
      .execute();
    await db
      .insertInto('user_scratch_charges')
      .values({ user_id: account.userId, charges: 3 })
      .execute();
  });

  test.afterAll(async () => {
    if (db !== undefined) {
      // Le compte du banc est un témoin, jamais une donnée jetable : il survit
      // au cas, comme à tous les autres.
      await db
        .deleteFrom('user')
        .where('id', '=', account?.userId ?? '')
        .execute();
      await db.destroy();
    }
    if (context !== undefined) await context.dispose();
  });

  test('unicité du pseudo — la collision à la casse près est refusée', async () => {
    const response = await context.patch('/api/v1/account/pseudo', {
      headers: headersOf(account),
      data: { pseudo: witness.pseudo.toUpperCase() },
    });

    expect(response.status()).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'PSEUDO_TAKEN' });

    // Le refus ne laisse aucune trace : le pseudo d'origine est toujours celui
    // que la session rend.
    const session = await readSessionIdentity(context, account.cookieHeader);
    expect(session?.pseudo).toBe(account.pseudo);
  });

  test('changement de pseudo — accepté, puis relu par la session', async () => {
    const wanted = `${account.pseudo}2`;
    const response = await context.patch('/api/v1/account/pseudo', {
      headers: headersOf(account),
      data: { pseudo: wanted },
    });

    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({ pseudo: wanted });

    const session = await readSessionIdentity(context, account.cookieHeader);
    expect(session?.id).toBe(account.userId);
    expect(session?.pseudo).toBe(wanted);
  });

  test('mot de passe — sans le mot de passe actuel, le changement est refusé', async () => {
    const response = await context.post('/api/v1/account/password', {
      headers: headersOf(account),
      data: { newPassword: `${account.password}-bis` },
    });

    expect(response.status()).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'CURRENT_PASSWORD_REQUIRED' });
  });

  test('export — six familles exactes et un téléchargement', async () => {
    const response = await context.get('/api/v1/account/export', { headers: headersOf(account) });

    expect(response.status()).toBe(200);
    expect(response.headers()['content-disposition']).toMatch(/^attachment/i);

    const payload: unknown = await response.json();
    expect(typeof payload).toBe('object');
    expect(payload).not.toBeNull();

    expect(Object.keys(payload as Record<string, unknown>).sort()).toEqual([
      'achievements',
      'cards',
      'friendships',
      'ledger',
      'profile',
      'tableaux',
    ]);
  });

  test('suppression — cascade réelle, session morte, second compte intact', async () => {
    const response = await context.delete('/api/v1/account', {
      headers: headersOf(account),
      data: { password: account.password, confirmation: `${account.pseudo}2` },
    });

    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({ deleted: true });

    // La session ne rend plus rien, et ne donne plus accès au groupe protégé.
    expect(await readSessionIdentity(context, account.cookieHeader)).toBeNull();
    const guarded = await context.get('/api/v1/account/export', { headers: headersOf(account) });
    expect(guarded.status()).toBe(401);

    // Les lignes ont quitté la base, y compris celles qui ne portent pas
    // directement l'identifiant du compte (`session`, `account`).
    const userId = account.userId;
    const deleted = {
      user: await db.selectFrom('user').select('id').where('id', '=', userId).execute(),
      session: await db.selectFrom('session').select('id').where('userId', '=', userId).execute(),
      account: await db.selectFrom('account').select('id').where('userId', '=', userId).execute(),
      cards: await db.selectFrom('user_cards').select('id').where('user_id', '=', userId).execute(),
      tickets: await db.selectFrom('tickets').select('id').where('user_id', '=', userId).execute(),
      tableaux: await db
        .selectFrom('tableaux')
        .select('id')
        .where('user_id', '=', userId)
        .execute(),
      ledger: await db
        .selectFrom('currency_ledger')
        .select('id')
        .where('user_id', '=', userId)
        .execute(),
      charges: await db
        .selectFrom('user_scratch_charges')
        .select('user_id')
        .where('user_id', '=', userId)
        .execute(),
      achievements: await db
        .selectFrom('user_achievements')
        .select('user_id')
        .where('user_id', '=', userId)
        .execute(),
      profile: await db
        .selectFrom('user_profiles')
        .select('user_id')
        .where('user_id', '=', userId)
        .execute(),
      listings: await db
        .selectFrom('market_listings')
        .select('id')
        .where('seller_id', '=', userId)
        .execute(),
    };

    for (const [table, rows] of Object.entries(deleted)) {
      expect(rows, `lignes restantes dans ${table}`).toHaveLength(0);
    }

    // Le second joueur n'a rien perdu : ni sa ligne, ni sa carte, ni sa session.
    const survivor = await db
      .selectFrom('user')
      .select('id')
      .where('id', '=', witness.userId)
      .execute();
    expect(survivor).toHaveLength(1);

    const cards = await db
      .selectFrom('user_cards')
      .select('id')
      .where('user_id', '=', witness.userId)
      .execute();
    expect(cards.length).toBeGreaterThan(0);

    const witnessSession = await readSessionIdentity(context, witnessCookieHeader());
    expect(witnessSession?.id).toBe(witness.userId);
    expect(witnessSession?.pseudo).toBe(witness.pseudo);
  });

  test('surface fermée — /compte renvoie au Seuil et n’est liée nulle part sans session', async ({
    page,
  }) => {
    await page.goto('/compte', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('input[type=password]')).toBeVisible();
    await expect(page.locator('a[href="/compte"]')).toHaveCount(0);

    // Aucune surface sans session n’expose le lien : ni l’accueil…
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('a[href="/compte"]')).toHaveCount(0);

    // …ni la vitrine d’un joueur. La route d’API `/players/:id` est publique,
    // la page ne l’est pas : `players.$playerId.tsx` rend `<Navigate
    // to="/login" />` tant que la session est anonyme, donc le lien du rail —
    // réservé aux joueurs connectés — n’est jamais offert ici.
    await page.goto(`/players/${witness.userId}`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('a[href="/compte"]')).toHaveCount(0);
  });
});

/**
 * La salle du registre, regardée avec une session réelle.
 *
 * Le cas précédent prouve la fermeture ; celui-ci prouve l’ouverture. Il se sert
 * de la session du compte principal — celle que `global-setup.ts` a déposée dans
 * `storageState` et que tous les autres fichiers du banc consomment déjà —, donc
 * il n’inscrit personne : `/sign-up/email` est plafonné à trois requêtes par
 * fenêtre et par IP, et le banc en consomme déjà deux au démarrage.
 *
 * `storageState` est reposé ici explicitement : le `test.use` anonyme en tête de
 * fichier vaut pour tout le fichier, et cette salle exige l’inverse.
 *
 * Les libellés sont ceux de `apps/web/src/content/account.ts` ; aucun sélecteur
 * de classe n’intervient, et aucune attente de confort ne masque un défaut : si
 * une section ne se monte pas, l’assertion échoue au lieu de laisser filer.
 */
test.describe('Le registre, session ouverte', () => {
  test.use({ storageState: storageStatePath });

  /**
   * Un seul bruit du banc est écarté, et il est nommé : le projet `chromium`
   * n’ouvre pas Chrome avec `--ignore-certificate-errors` — seul le projet
   * `pwa` le fait, parce que le téléchargement du script du worker passe par la
   * pile réseau de Chrome et non par le routage CDP (Archi §4.8). L’AC du banc
   * n’étant dans aucun trust store, l’enregistrement du service worker échoue
   * donc ici sur `hexamap.test`, sur **toutes** les pages, avant même que la
   * salle ne soit en cause. Ces deux messages-là sont écartés ; tout le reste
   * fait échouer le cas, exceptions de page comprises.
   */
  const BENCH_TLS_NOISE = /service ?worker|SSL certificate error/i;

  test('compte — la salle s’ouvre, annonce son état réel et n’écrit aucune erreur', async ({
    page,
  }) => {
    // Les deux sources sont branchées avant la première requête : une erreur de
    // rendu ou un rejet de promesse survenu pendant le montage doit être vu.
    const consoleErrors: string[] = [];
    const record = (message: string) => {
      if (BENCH_TLS_NOISE.test(message)) return;
      consoleErrors.push(message);
    };
    page.on('console', (message) => {
      if (message.type() === 'error') record(message.text());
    });
    page.on('pageerror', (error) => {
      record(error.message);
    });

    await page.goto('/compte', { waitUntil: 'domcontentloaded' });

    // 1. La salle reste la sienne : aucune redirection vers Le Seuil.
    await expect(page).toHaveURL(/\/compte$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Mon compte' })).toBeVisible();

    // 2. Les six sections du registre, par leur titre français.
    await expect(page.getByRole('heading', { level: 2, name: 'Identité' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Courriel' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Mot de passe' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Bio et visibilité' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Vos données' })).toBeVisible();

    // Les formulaires sont réellement montés, pas seulement leurs titres.
    await expect(page.getByLabel('Nouveau pseudo')).toBeVisible();
    await expect(page.getByLabel('Mot de passe actuel')).toBeVisible();
    await expect(page.getByLabel('Biographie')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Télécharger mes données' })).toBeVisible();

    // 3. Plus aucune pastille d'état : R-001 ne demande plus de confirmer
    // l'adresse, donc l'écran ne reproche plus rien.
    await expect(page.getByText(/^(Vérifiée|Non vérifiée)$/)).toHaveCount(0);

    // 4. Le banc allume la suppression et n’a aucun transport de courriel : la
    // zone de fermeture est donc là (elle dépend des capacités lues au serveur),
    // et le champ du courriel reste éditable en permanence — ni texte
    // d’indisponibilité, ni désactivation, et la saisie est réellement acceptée.
    await expect(page.getByRole('heading', { level: 2, name: 'Fermer le compte' })).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Supprimer définitivement mon compte/ }),
    ).toBeVisible();
    const newEmail = page.getByLabel('Nouvelle adresse');
    await expect(newEmail).toBeEnabled();
    await expect(page.getByText(/Le changement d’adresse n’est pas encore ouvert/)).toHaveCount(0);
    await newEmail.fill('sans-verification@hexamap.test');
    await expect(newEmail).toHaveValue('sans-verification@hexamap.test');
    await expect(page.getByRole('button', { name: 'Changer d’adresse' })).toBeEnabled();

    // 5. Aucune erreur console, aucune exception de page sur tout le parcours.
    expect(consoleErrors, `erreurs console : ${consoleErrors.join(' | ')}`).toHaveLength(0);
  });
});
