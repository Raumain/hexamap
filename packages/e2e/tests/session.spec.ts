import { expect, test } from '@playwright/test';

declare global {
  interface Window {
    __hexamapPaths?: string[];
  }
}

test('session — une coupure réseau ne déconnecte pas', async ({ page }) => {
  // Le routeur écrit par `pushState`/`replaceState` : on garde la trace de
  // chaque destination, pour qu'une redirection fugace vers Le Seuil ne puisse
  // pas se cacher derrière une re-navigation une fois la session retrouvée.
  await page.addInitScript(() => {
    window.__hexamapPaths = [location.pathname];
    const record = () => {
      const paths = window.__hexamapPaths;
      if (paths && paths[paths.length - 1] !== location.pathname) {
        paths.push(location.pathname);
      }
    };
    for (const method of ['pushState', 'replaceState'] as const) {
      const original = history[method].bind(history);
      history[method] = (data: unknown, unused: string, url?: string | URL | null) => {
        original(data, unused, url);
        record();
      };
    }
  });

  let calls = 0;
  await page.route('**/api/auth/get-session', async (route) => {
    calls += 1;
    // Les quatre premières lectures échouent, comme un incident réseau qui dure
    // le temps des retries automatiques : épuisées, elles ne valent toujours pas
    // une déconnexion.
    if (calls <= 4) {
      await route.abort('failed');
      return;
    }
    await route.continue();
  });

  await page.goto('/');

  const unavailable = page.getByText('Votre session n’a pas pu être vérifiée.');
  await expect(unavailable).toBeVisible();
  await expect(page).not.toHaveURL(/\/login/);

  await page.getByRole('button', { name: 'Réessayer' }).click();
  await expect(page.getByRole('heading', { name: 'Le relevé topographique' })).toBeVisible();
  await expect(page).not.toHaveURL(/\/login/);

  expect(calls).toBeGreaterThan(4); // le retry manuel a bien eu lieu
  expect(await page.evaluate(() => window.__hexamapPaths ?? [])).not.toContain('/login');
});
