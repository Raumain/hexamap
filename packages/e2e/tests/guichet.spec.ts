import { randomUUID } from 'node:crypto';
import { type BrowserContext, expect, type Page, test } from '@playwright/test';
import { E2E_PASSWORD, readAccountFixture } from './fixtures/auth';

// Le Guichet de bout en bout : une demande d'ami écrite par un joueur neuf
// allume la cloche, la lecture l'éteint, et la salle reste fermée sans session.
//
// Pourquoi le demandeur change à chaque exécution : `dedupe_key` vaut
// `FRIEND_REQUEST:<requester_id>`, et l'unicité `(user_id, dedupe_key)` porte
// l'idempotence. Rejouer la même paire ne ré-écrit donc **jamais** de ligne —
// c'est le contrat, prouvé par `packages/spec/src/notifications.spec.ts` — et un
// second compte fixe rendrait ce cas vert une fois puis vide. Un inscrit neuf
// par exécution garde le banc idempotent sans toucher au contrat.

const MARK_ALL = 'Tout marquer comme lu';
const MARK_READ = /^Marquer comme lu/;
const EMPTY_COUNTER = 'Aucune notification non lue.';
// Une inscription passe par bcrypt côté Better Auth : même borne que le
// `globalSetup`, qui attend la même promesse sur la même pile.
const REGISTRATION_TIMEOUT = 30_000;

interface FreshPlayer {
  pseudo: string;
  email: string;
}

test('une demande d’ami allume la cloche, la lecture l’éteint', async ({ page, browser }) => {
  const account = readAccountFixture();
  const main = page.getByRole('main');
  const bell = page.getByRole('complementary');

  // 1. Remise à zéro : une exécution précédente interrompue peut laisser une
  //    ligne non lue derrière elle, et le cas ne doit dépendre que de lui-même.
  await page.goto('/guichet');
  const counter = main.getByText(/^(Aucune notification non lue\.|\d+ non lues?)$/);
  await counter.waitFor({ state: 'visible' });

  const markAll = main.getByRole('button', { name: MARK_ALL });
  if ((await markAll.count()) > 0) {
    await markAll.click();
    await expect(counter).toHaveText(EMPTY_COUNTER);
    await expect(markAll).toHaveCount(0);
  }

  // 2. L'origine réelle de la pile (le banc tourne sous HTTPS via Caddy) : elle
  //    sert de `baseURL` au contexte du demandeur et d'`Origin` à la requête.
  const origin = new URL(page.url()).origin;

  const pseudo = `gui-${randomUUID().slice(0, 8)}`;
  const player: FreshPlayer = { pseudo, email: `${pseudo}@hexamap.test` };

  const other = await browser.newContext({
    baseURL: origin,
    ignoreHTTPSErrors: true,
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
  });

  try {
    // `browser.newContext()` hérite du `storageState` de la configuration : sans
    // ce vidage, le contexte joue la session du joueur principal, `/register`
    // redirige vers l'accueil et aucun demandeur neuf n'existe.
    await other.clearCookies();
    await registerFreshPlayer(other, player);

    // 3. La demande passe par l'API, pas par l'écran : ce cas prouve le
    //    guichet, pas le formulaire des Amis.
    const response = await other.request.post('/api/v1/friends/requests', {
      data: { pseudo: account.pseudo },
      headers: { origin },
    });
    expect(response.ok()).toBe(true);

    // 4. La salle montre la demande, dans son groupe, non lue.
    await page.goto('/guichet');
    await counter.waitFor({ state: 'visible' });

    const description = `${player.pseudo} vous demande en ami.`;
    const row = page.getByRole('listitem').filter({ hasText: description });
    const group = page
      .locator('section')
      .filter({ has: page.getByRole('heading', { name: /^Demandes d.ami$/ }) });

    await expect(group.getByRole('listitem').filter({ hasText: description })).toBeVisible();
    await expect(row).toHaveAttribute('data-unread', 'true');

    // 5. La cloche annonce le compteur du serveur, jamais un incrément local :
    //    son nom accessible porte la valeur, et sa région `aria-live` la dit.
    const bellLink = bell.getByRole('link', { name: /^Le Guichet, \d+ non lues$/ });
    await expect(bellLink).toBeVisible();

    const label = (await bellLink.getAttribute('aria-label')) ?? '';
    const announced = Number(/^Le Guichet, (\d+) non lues$/.exec(label)?.[1] ?? '0');
    expect(announced).toBeGreaterThan(0);

    // 6. La lecture éteint la ligne **et** la cloche.
    await row.getByRole('button', { name: MARK_READ }).click();
    await expect(row).toHaveAttribute('data-unread', 'false');
    await expect(row.getByRole('button', { name: MARK_READ })).toHaveCount(0);
    await expect(bell.getByRole('link', { name: /non lues$/ })).toHaveCount(0);
    await expect(bell.getByText(EMPTY_COUNTER)).toBeVisible();

    // 7. Un rechargement prouve l'état du serveur, pas une illusion du client.
    await page.reload();
    await counter.waitFor({ state: 'visible' });
    await expect(row).toHaveAttribute('data-unread', 'false');
    await expect(row.getByRole('button', { name: MARK_READ })).toHaveCount(0);
    await expect(bell.getByText(EMPTY_COUNTER)).toBeVisible();
  } finally {
    await other.close();
  }
});

test.describe('sans session', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('la salle du Guichet est fermée', async ({ page }) => {
    await page.goto('/guichet');

    await page.waitForURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Se connecter' })).toBeVisible();
  });
});

/**
 * Inscription par l'interface, calquée sur `global-setup.ts` : mêmes libellés,
 * même attente du titre de bienvenue. Le contexte garde les cookies de session,
 * et sa page n'est plus nécessaire une fois le compte créé.
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
