import { expect, test } from '@playwright/test';

// Parcours critique de la V1, piloté par des sélecteurs orientés utilisateur
// (rôles ARIA et libellés visibles en français). Aucun sélecteur CSS ne doit
// apparaître ici : si un test casse, c'est que le comportement a changé.

const password = 'Grattage-E2E-2026';

// Le parcours critique crée son propre compte : il part d'un contexte vierge,
// alors que le `storageState` global contient déjà la session de démonstration.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe.configure({ mode: 'serial' });

test('parcours critique : inscription, ticket, grattage, collection, marché', async ({ page }) => {
  // Identifiants uniques par tentative : une reprise ne réutilise pas le compte
  // créé par la tentative précédente.
  const runId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const pseudo = `E2E${runId}`.slice(0, 20);
  const email = `e2e-${runId}@hexamap.test`;

  await test.step('inscription', async () => {
    await page.goto('/register');

    await expect(page.getByRole('heading', { name: 'Inscription' })).toBeVisible();

    await page.getByLabel('Pseudo').fill(pseudo);
    await page.getByLabel(/^Adresse e-mail/).fill(email);
    await page.getByLabel(/^Mot de passe/).fill(password);
    await page.getByLabel(/^Confirmation du mot de passe/).fill(password);

    await page.getByRole('button', { name: "S'inscrire" }).click();

    // Redirection vers le tableau de bord et session active.
    await expect(page.getByRole('heading', { name: `Bienvenue, ${pseudo}.` })).toBeVisible();
  });

  await test.step('génération du ticket', async () => {
    await page.getByRole('button', { name: 'Obtenir un ticket' }).click();

    await expect(page).toHaveURL(/\/tickets\/[0-9a-f-]+$/i);
    await expect(page.getByRole('group', { name: 'Grille du ticket' })).toBeVisible();
  });

  await test.step('grattage complet', async () => {
    const scratchable = page.getByRole('button', { name: /^Case \d+, non révélée$/ });

    // 16 cases, 4 coups de grattoir (+2 par Station-service) : la boucle
    // s'arrête dès que le ticket est consommé, avant cette borne de sécurité.
    for (let attempt = 0; attempt < 16; attempt += 1) {
      const before = await scratchable.count();
      if (before === 0) break;

      const cell = scratchable.first();
      // Chemin clavier : même révélation que le grattage au pointeur, sans
      // dépendre des coordonnées du canvas.
      await cell.focus();
      await cell.press('Enter');

      await expect.poll(() => scratchable.count(), { timeout: 15_000 }).toBeLessThan(before);
    }

    // Ticket consommé : l'écran propose immédiatement un nouveau ticket.
    await expect(page.getByText(/Ce bordereau est soldé|Aucun ticket actif/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Obtenir un ticket' })).toBeVisible();
  });

  await test.step('inventaire : la collection contient les cartes révélées', async () => {
    await page.goto('/collection');

    await expect(page.getByRole('heading', { name: 'Ma collection' })).toBeVisible();

    const table = page.getByRole('table', { name: 'Liste des cartes de votre collection' });
    await expect(table).toBeVisible();

    // Ligne d'en-tête + au moins une carte obtenue au grattage.
    await expect.poll(() => table.getByRole('row').count()).toBeGreaterThan(1);
  });

  await test.step('marché : la place de marché est accessible', async () => {
    await page.goto('/market');

    await expect(page.getByRole('heading', { name: 'Hôtel des ventes' })).toBeVisible();

    await page.getByRole('link', { name: 'Gérer mes ventes' }).first().click();
    await expect(page.getByRole('heading', { name: 'Mes ventes' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Mettre une carte en vente' })).toBeVisible();
  });
});

test.describe('sécurité CORS en production', () => {
  const apiUrl = process.env.E2E_API_URL ?? 'http://localhost:3000';
  // Le banc sert désormais HTTPS derrière Caddy : l'origine autorisée est celle
  // du contexte sécurisé, pas l'ancienne `http://hexamap.test:3000`.
  const frontendUrl = process.env.E2E_FRONTEND_URL ?? 'https://hexamap.test';

  test('autorise uniquement l’origine du frontend', async ({ request }) => {
    const allowed = await request.get(`${apiUrl}/api/v1/health`, {
      headers: { origin: frontendUrl },
    });

    expect(allowed.ok()).toBeTruthy();
    expect(allowed.headers()['access-control-allow-origin']).toBe(frontendUrl);
    expect(allowed.headers()['access-control-allow-credentials']).toBe('true');
  });

  test('refuse une origine non listée', async ({ request }) => {
    const forbidden = await request.get(`${apiUrl}/api/v1/health`, {
      headers: { origin: 'https://attaquant.example' },
    });

    expect(forbidden.headers()['access-control-allow-origin']).toBeUndefined();
  });
});
