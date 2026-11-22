import { randomUUID } from 'node:crypto';
import { type BrowserContext, expect, type Page, test } from '@playwright/test';
import { E2E_PASSWORD, readAccountFixture } from './fixtures/auth';

// R-003 — « Un ami n'a pas de lien vers sa vitrine ».
//
// La vitrine publique existe (`/players/:id`) et l'identifiant du joueur était déjà
// dans la charge utile de `/friends`, mais le pseudo restait du texte mort. Le lien
// n'est offert que lorsque `profile_public` est vrai : une vitrine privée répond
// `404` par dessein (`.docs/01-architecture.md` §2.9), et la même section interdit
// de proposer un lien mort. Les deux états sont donc éprouvés sur le **même** ami :
// public d'abord, puis fermé — ce qui prouve que le drapeau est bien lu, et non
// qu'un ami public et un ami privé se ressemblent par accident.

const INCOMING = 'Demandes reçues';
const ACCEPT = 'Accepter';
// Une inscription passe par bcrypt côté Better Auth : même borne que le
// `globalSetup`, qui attend la même promesse sur la même pile.
const REGISTRATION_TIMEOUT = 30_000;

interface FreshPlayer {
  pseudo: string;
  email: string;
}

test('le pseudo d’un ami mène à sa vitrine quand elle est publique, et reste du texte sinon', async ({
  page,
  browser,
}) => {
  const account = readAccountFixture();
  const main = page.getByRole('main');
  const friendsSection = main
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Mes amis', exact: true }) });

  const pseudo = `ami-${randomUUID().slice(0, 8)}`;
  const player: FreshPlayer = { pseudo, email: `${pseudo}@hexamap.test` };

  // 1. Un ami neuf : c'est lui qui demande, le compte principal accepte. Un pseudo
  //    neuf par exécution garde le banc idempotent sans toucher au contrat.
  await page.goto('/friends');
  const origin = new URL(page.url()).origin;

  const other = await browser.newContext({
    baseURL: origin,
    ignoreHTTPSErrors: true,
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
  });

  try {
    // `browser.newContext()` hérite du `storageState` de la configuration : sans
    // ce vidage, le contexte jouerait la session du joueur principal.
    await other.clearCookies();
    await registerFreshPlayer(other, player);

    const session = await other.request.get('/api/auth/get-session');
    expect(session.ok()).toBe(true);
    const friendId = userIdOf(await session.json());
    expect(friendId, 'L’ami neuf doit avoir un identifiant, c’est lui qui porte le lien.').not.toBe(
      null,
    );

    const request = await other.request.post('/api/v1/friends/requests', {
      data: { pseudo: account.pseudo },
      headers: { origin },
    });
    expect(request.ok()).toBe(true);

    // 2. L'acceptation passe par l'écran : c'est la salle des Amis qu'on éprouve.
    await page.reload();
    const incoming = main
      .locator('section')
      .filter({ has: page.getByRole('heading', { name: INCOMING, exact: true }) });
    const incomingRow = incoming.getByRole('listitem').filter({ hasText: pseudo });
    await expect(incomingRow).toBeVisible();
    await incomingRow.getByRole('button', { name: ACCEPT }).click();

    // 3. La vitrine est publique par défaut (base §4.9) : le pseudo devient un lien
    //    dont le libellé est **exactement** le pseudo, et il mène à `/players/:id`.
    const friendRow = friendsSection.getByRole('listitem').filter({ hasText: pseudo });
    await expect(friendRow).toBeVisible();

    const profileLink = friendRow.getByRole('link', { name: pseudo, exact: true });
    await expect(profileLink).toBeVisible();
    await expect(profileLink).toHaveAttribute('href', `/players/${friendId}`);

    // Le lien ouvre réellement la vitrine : elle répond, au lieu d'un 404 muet.
    await profileLink.click();
    await page.waitForURL(`**/players/${friendId}`);
    await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toBeVisible();

    // 4. Le même ami ferme sa vitrine par le produit lui-même : plus aucun lien, et
    //    le pseudo redevient le texte d'avant — sans explication additionnelle.
    const closed = await other.request.patch('/api/v1/profile', {
      data: { profilePublic: false },
      headers: { origin },
    });
    expect(closed.ok()).toBe(true);

    await page.goto('/friends');
    const privateRow = friendsSection.getByRole('listitem').filter({ hasText: pseudo });
    await expect(privateRow).toBeVisible();
    await expect(privateRow.getByRole('link', { name: pseudo, exact: true })).toHaveCount(0);
    await expect(privateRow.getByText(pseudo, { exact: true })).toBeVisible();
  } finally {
    await other.close();
  }
});

/** `get-session` rend `null` ou `{ user: { id } }` : aucune donnée n'est devinée. */
function userIdOf(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null;

  const user: unknown = Reflect.get(payload, 'user');
  if (typeof user !== 'object' || user === null) return null;

  const id: unknown = Reflect.get(user, 'id');
  return typeof id === 'string' && id.length > 0 ? id : null;
}

/**
 * Inscription par l'interface, calquée sur `guichet.spec.ts` et `global-setup.ts` :
 * mêmes libellés, même attente du titre de bienvenue. Le contexte garde les cookies
 * de session, et sa page n'est plus nécessaire une fois le compte créé.
 */
async function registerFreshPlayer(context: BrowserContext, player: FreshPlayer): Promise<void> {
  const page: Page = await context.newPage();

  try {
    await page.goto('/register', { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'Inscription' }).waitFor();

    await page.getByLabel('Pseudo').fill(player.pseudo);
    await page.getByLabel(/^Adresse e-mail/).fill(player.email);
    await page.getByLabel(/^Mot de passe/).fill(E2E_PASSWORD);
    await page.getByLabel(/^Confirmation du mot de passe/).fill(E2E_PASSWORD);

    await page.getByRole('button', { name: "S'inscrire" }).click();

    await page
      .getByRole('heading', { name: `Bienvenue, ${player.pseudo}.` })
      .waitFor({ timeout: REGISTRATION_TIMEOUT });
  } finally {
    await page.close();
  }
}
