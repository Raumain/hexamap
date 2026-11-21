import { mkdir, writeFile } from 'node:fs/promises';
import { type Browser, chromium, type Page } from '@playwright/test';
import { ensureComboCards } from './fixtures/tableau-fixture';
import {
  type AccountFixture,
  accountPath,
  authDirectory,
  CATEGORIES,
  CATEGORY_LABELS,
  type Category,
  E2E_PASSWORD,
  storageStatePath,
} from './tests/fixtures/auth';

// Préparation unique du banc E2E : un compte neuf est créé par l'UI, puis des
// tickets sont grattés jusqu'à couvrir les quatre catégories de cartes. Le
// cookie de session obtenu est enregistré dans `storageState` : les specs
// n'ont plus à s'inscrire, et la base n'est pas polluée par chaque test.

const STACK_TIMEOUT = 30_000;
const MAX_TICKETS = 8;

export default async function globalSetup(): Promise<void> {
  const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:8080';
  const pseudo = `e2e-${Date.now()}`;
  const email = `${pseudo}@hexamap.test`;

  const browser = await launchBrowser();

  const context = await browser.newContext({
    baseURL,
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    // Le banc est servi par Caddy avec son AC interne, absente de tout trust
    // store. Ce contexte est créé à la main : il n'hérite pas de `use` du
    // `playwright.config.ts`, donc le réglage doit être répété ici.
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  try {
    await openRegistration(page, baseURL);
    await register(page, { pseudo, email });

    const userId = await sessionUserId(page);

    // Premier appel, avant le grattage : il donne à `collectCards` la géographie
    // qu'il chercherait sinon dans les tickets — une région tombe à 8 % et un
    // département à 17 % —, et le compte ne dispose que de six charges. Sans ce
    // raccourci, la boucle épuiserait le carnet et la septième tentative
    // d'« Obtenir un ticket » attendrait un bouton dont le nom accessible a
    // changé.
    await ensureComboCards(userId);

    const { categories, tickets } = await collectCards(page);

    // Second appel, **après** le grattage, et c'est celui qui fait autorité : un
    // ticket peut redonner une carte déjà présente dans le combo (`user_cards`
    // n'a aucune unicité sur `ref_code`), donc une fixture jouée seulement avant
    // laisserait deux exemplaires du même lieu — et le tiroir, qui les liste tous
    // les deux, ferait échouer un locator strict. Puisqu'elle supprime puis
    // insère, la fixture est le **dernier mot** sur les `ref_code` qu'elle
    // garantit : un seul exemplaire par lieu du combo.
    await ensureComboCards(userId);

    await mkdir(authDirectory, { recursive: true });
    await context.storageState({ path: storageStatePath });

    const account: AccountFixture = {
      pseudo,
      email,
      password: E2E_PASSWORD,
      categories,
      ticketsScratched: tickets,
      createdAt: new Date().toISOString(),
    };
    await writeFile(accountPath, `${JSON.stringify(account, null, 2)}\n`, 'utf8');
  } finally {
    await context.close();
    await browser.close();
  }
}

async function launchBrowser(): Promise<Browser> {
  try {
    return await chromium.launch();
  } catch (error) {
    throw new Error(
      `Chromium n'a pas pu démarrer pour l'initialisation E2E (${describeError(error)}). ` +
        'Lancez les tests dans l’image Playwright : ' +
        '`docker compose -f docker-compose.e2e.yml run --rm playwright`.',
    );
  }
}

async function openRegistration(page: Page, baseURL: string): Promise<void> {
  const status = await page
    .goto('/register', { waitUntil: 'domcontentloaded', timeout: STACK_TIMEOUT })
    .then((response) => response?.status() ?? 0)
    .catch((error: unknown) => {
      throw unreachable(baseURL, error);
    });

  if (status === 0 || status >= 500) {
    throw new Error(
      `La pile E2E répond mal sur ${baseURL} (statut ${status === 0 ? 'aucune réponse' : status}). ` +
        'Démarrez-la avec `docker compose -f docker-compose.e2e.yml up -d --build db api proxy` puis relancez Playwright.',
    );
  }
}

function unreachable(baseURL: string, error: unknown): Error {
  return new Error(
    `La pile E2E est injoignable sur ${baseURL} (${describeError(error)}). ` +
      'Démarrez-la avec `docker compose -f docker-compose.e2e.yml up -d --build db api proxy` puis relancez Playwright.',
  );
}

interface Credentials {
  pseudo: string;
  email: string;
}

async function register(page: Page, { pseudo, email }: Credentials): Promise<void> {
  await page.getByRole('heading', { name: 'Inscription' }).waitFor({ timeout: STACK_TIMEOUT });

  await page.getByLabel('Pseudo').fill(pseudo);
  await page.getByLabel(/^Adresse e-mail/).fill(email);
  await page.getByLabel(/^Mot de passe/).fill(E2E_PASSWORD);
  await page.getByLabel(/^Confirmation du mot de passe/).fill(E2E_PASSWORD);

  await page.getByRole('button', { name: "S'inscrire" }).click();

  await page
    .getByRole('heading', { name: `Bienvenue, ${pseudo}.` })
    .waitFor({ timeout: STACK_TIMEOUT });
}

interface CollectedCards {
  categories: Category[];
  tickets: number;
}

/**
 * Identifiant du joueur inscrit, lu sur la session Better Auth. La fixture a
 * besoin de `user_id` pour rattacher le combo, et le compte est créé à chaque
 * exécution : l'identifiant ne peut pas être deviné.
 */
async function sessionUserId(page: Page): Promise<string> {
  const response = await page.request.get('/api/auth/get-session', { timeout: STACK_TIMEOUT });

  if (!response.ok()) {
    throw new Error(
      `Lecture de session impossible pour la fixture de La Planche (statut ${response.status()}).`,
    );
  }

  const userId = userIdOf(await response.json());

  if (userId === null) {
    throw new Error(
      'Session E2E sans identifiant utilisateur : le combo de La Planche ne peut pas être semé.',
    );
  }

  return userId;
}

/** Extraction défensive : `get-session` rend `null` ou `{ user: { id } }`. */
function userIdOf(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null;

  const user: unknown = Reflect.get(payload, 'user');
  if (typeof user !== 'object' || user === null) return null;

  const id: unknown = Reflect.get(user, 'id');
  return typeof id === 'string' && id.length > 0 ? id : null;
}

/** Gratte des tickets jusqu'à couvrir les quatre catégories, dans une borne fixe. */
async function collectCards(page: Page): Promise<CollectedCards> {
  const obtained = new Set<Category>();
  let tickets = 0;

  while (obtained.size < CATEGORIES.length && tickets < MAX_TICKETS) {
    tickets += 1;
    await obtainTicket(page);
    await scratchTicket(page);

    for (const category of await ownedCategories(page)) {
      obtained.add(category);
    }
  }

  return {
    categories: CATEGORIES.filter((category) => obtained.has(category)),
    tickets,
  };
}

async function obtainTicket(page: Page): Promise<void> {
  // Toujours repartir du tableau de bord : sur la page d'un ticket épuisé, le
  // bouton mène à une navigation qui laisse brièvement l'ancienne grille dans
  // le DOM — gratter à cet instant produirait une course vide.
  await page.goto('/', { waitUntil: 'domcontentloaded', timeout: STACK_TIMEOUT });
  await page.getByRole('button', { name: 'Obtenir un ticket' }).click({ timeout: STACK_TIMEOUT });

  await page.waitForURL((url) => /\/tickets\/[0-9a-f-]{8,}$/i.test(url.pathname), {
    timeout: STACK_TIMEOUT,
  });
  await page
    .getByRole('group', { name: 'Grille du ticket' })
    .waitFor({ state: 'visible', timeout: STACK_TIMEOUT });
}

async function scratchTicket(page: Page): Promise<void> {
  const scratchable = page.getByRole('button', { name: /^Case \d+, non révélée$/ });

  // 16 cases, 4 coups de grattoir (+2 par Station-service) : même boucle que le
  // parcours critique, la borne évite une boucle infinie si le ticket se bloque.
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const before = await scratchable.count();
    if (before === 0) break;

    const cell = scratchable.first();
    // Chemin clavier : même révélation que le grattage au pointeur.
    await cell.focus();
    await cell.press('Enter');

    const revealed = await waitForCountBelow(scratchable, before);
    if (!revealed) {
      throw new Error(
        'Le grattage du ticket E2E n’a révélé aucune case en 15 s : la pile ne progresse plus.',
      );
    }
  }

  await page
    .getByText(/Ce bordereau est soldé|Aucun ticket actif/)
    .waitFor({ state: 'visible', timeout: STACK_TIMEOUT });
}

async function waitForCountBelow(
  target: ReturnType<Page['getByRole']>,
  before: number,
): Promise<boolean> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if ((await target.count()) < before) return true;
    await sleep(200);
  }
  return false;
}

/**
 * Catégories possédées, lues sur l'écran de collection en filtrant par
 * catégorie : le compteur « N cartes affichées sur M cartes » est rendu par la
 * page, aucune requête API n'est supposée.
 */
async function ownedCategories(page: Page): Promise<Category[]> {
  await page.goto('/collection', { waitUntil: 'domcontentloaded', timeout: STACK_TIMEOUT });
  await page
    .getByRole('table', { name: 'Liste des cartes de votre collection' })
    .waitFor({ state: 'visible', timeout: STACK_TIMEOUT });

  const owned: Category[] = [];

  for (const category of CATEGORIES) {
    await page.getByRole('button', { name: CATEGORY_LABELS[category], exact: true }).click();
    const shown = await settledShownCards(page);
    if (shown > 0) owned.push(category);
  }

  await page.getByRole('button', { name: 'Toutes', exact: true }).click();
  return owned;
}

/** Attend que le compteur de la collection cesse de bouger, puis le retourne. */
async function settledShownCards(page: Page): Promise<number> {
  let previous = await shownCards(page);
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await sleep(150);
    const current = await shownCards(page);
    if (current === previous) return current;
    previous = current;
  }
  return previous;
}

async function shownCards(page: Page): Promise<number> {
  const texts = await page.getByText(/cartes? affichées? sur/).allInnerTexts();
  for (const text of texts) {
    const match = /^(\d+) cartes? affichées? sur (\d+) cartes?$/.exec(text.trim());
    const shown = match?.[1];
    if (shown !== undefined) return Number.parseInt(shown, 10);
  }
  return 0;
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
