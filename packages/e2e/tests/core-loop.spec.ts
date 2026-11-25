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

    // Ticket consommé : le bordereau soldé s'affiche **et la planche reste à
    // l'écran**. La mutation de grattage n'invalide `['tickets','current']` que
    // tant que le ticket est encore `ACTIVE` ; une fois `EXHAUSTED`, la réponse
    // autoritaire reste au cache, donc la route ne retombe pas sur la carte
    // générique « Aucun ticket actif ». Le panneau de soldé et la grille 4 × 4
    // sont frères dans le même JSX : ne vérifier que le panneau laisserait
    // passer exactement la régression qu'on veut interdire — un bordereau qui
    // détruit ses cases au moment où le joueur veut les regarder.
    await expect(page.getByRole('heading', { name: 'Ce bordereau est soldé.' })).toBeVisible();

    const board = page.getByRole('group', { name: 'Grille du ticket' });
    await expect(board).toBeVisible();
    await expect.poll(() => board.getByRole('article').count()).toBeGreaterThan(0);
    await expect(board.getByRole('article').first()).toBeVisible();

    // L'action du panneau de soldé, et non plus celle de la carte générique.
    await expect(page.getByRole('button', { name: 'Ouvrir un nouveau ticket' })).toBeVisible();
  });

  await test.step('case révélée : le détail s’ouvre dans un dialogue', async () => {
    // La cloche du Guichet resynchronise son compteur toutes les 60 s : un
    // battement qui tomberait dans la fenêtre du pas ferait échouer l'assertion
    // « aucune requête » sans que la modale y soit pour rien. La garde porte donc
    // sur toute l'API sauf cette pulsation, qui ne dépend pas de l'ouverture.
    const apiRequests: string[] = [];
    const recordRequest = (request: { url(): string }) => {
      const { pathname } = new URL(request.url());
      if (pathname.startsWith('/api/') && !pathname.startsWith('/api/v1/notifications')) {
        apiRequests.push(request.url());
      }
    };
    page.on('request', recordRequest);

    const opener = page.getByRole('button', { name: /^Agrandir la case \d+/ }).first();
    await expect(opener).toBeVisible();
    // Le nom accessible vient du `sr-only` porté par le bouton : `textContent`
    // le rend tel quel, sans dépendre de la mise en page calculée.
    const accessibleName =
      (await opener.getAttribute('aria-label')) ?? (await opener.textContent()) ?? '';

    await opener.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Le dialogue appartient à <body>, jamais à <main> (§4.9, BUG-007).
    expect(await dialog.evaluate((node) => node.closest('main') === null)).toBe(true);
    expect(await dialog.evaluate((node) => node.parentElement === document.body)).toBe(true);

    // Aucun ancêtre transformé : <main> reste en `transform: none`.
    const main = page.getByRole('main');
    expect(await main.evaluate((node) => getComputedStyle(node).transform)).toBe('none');

    // Le titre du dialogue nomme la même case que le bouton. `level: 2` isole
    // l'en-tête du dialogue : la planche détaillée porte elle aussi le nom, en
    // `h3`, comme toute planche du Cartel.
    const expectedTitle = accessibleName.replace(/^Agrandir la case \d+ — /, '');
    await expect(dialog.getByRole('heading', { level: 2, name: expectedTitle })).toBeVisible();

    // Une carte montre son Cartel (l'`article` porte le code de référence) ;
    // un panneau montre le texte de `.docs/01-architecture.md` §2.6. L'un ou
    // l'autre, jamais rien.
    const detail = dialog
      .locator('article')
      .or(dialog.getByText(/coups de grattoir|case adjacente|palier de rareté/));
    await expect(detail.first()).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();

    // Le focus revient à la case d'origine. On réutilise le localisateur du
    // bouton ouvert : deux cases peuvent porter le même nom (deux exemplaires de
    // la même carte), et un sélecteur par nom lèverait une violation de mode strict.
    await expect(opener).toBeFocused();

    // Aucune requête réseau : tout ce qu'affiche la modale était déjà là.
    expect(apiRequests).toEqual([]);

    page.off('request', recordRequest);
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
