import { expect, type Page, test } from '@playwright/test';

const SHEET_CONTROL = 'Plus';
const SHEET_TITLE = 'Autres salles';
const ROOM_LABEL = 'Les Raretés';

/** Les six libellés exacts du domaine (`RARITY_LABELS` de `@hexamap/shared`). */
const RARITY_LABELS = ['Commune', 'Peu commune', 'Rare', 'Épique', 'Légendaire', 'Mythique'];

async function assertNoHorizontalOverflow(page: Page, where: string): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `Débordement horizontal ${where}`).toBeLessThanOrEqual(0);
}

test.describe('rarete — page publique', () => {
  // La salle ne demande aucune session : le contexte est vidé de ses cookies.
  test.use({ storageState: { cookies: [], origins: [] }, viewport: { width: 390, height: 844 } });

  test('rarete — les six paliers, les deux tables et un exemple chiffré se lisent sans session', async ({
    page,
  }) => {
    await page.goto('/rarete');

    await expect(page).toHaveURL(/\/rarete$/);
    await expect(page.getByRole('heading', { level: 1, name: ROOM_LABEL })).toBeVisible();

    // Les six paliers, chacun avec son libellé exact et son poids.
    const paliers = page.getByRole('table', { name: 'Les six paliers' });
    await expect(paliers).toBeVisible();
    for (const label of RARITY_LABELS) {
      await expect(paliers.getByText(label, { exact: true })).toHaveCount(1);
    }
    // La somme des poids affichés fait 100 %.
    await expect(paliers.getByText('100,0 %', { exact: true })).toBeVisible();

    // Les deux tables de seuils.
    const communeSeuils = page.getByRole('table', { name: 'Une commune : sa population' });
    await expect(communeSeuils).toBeVisible();
    for (const label of RARITY_LABELS) {
      await expect(communeSeuils.getByText(label, { exact: true })).toHaveCount(1);
    }
    const rueSeuils = page.getByRole('table', { name: 'Une rue : le nombre de communes' });
    await expect(rueSeuils).toBeVisible();
    await expect(rueSeuils.getByText('1 commune', { exact: true })).toBeVisible();

    // Un exemple chiffré, figé dans le domaine : 100 habitants valent 400 points.
    const exemplesCommune = page.getByRole('list', { name: 'Une commune' });
    await expect(exemplesCommune.getByText('100 habitants', { exact: true })).toBeVisible();
    await expect(exemplesCommune.getByText('400 pts', { exact: true })).toBeVisible();

    // La rareté inversée, avec l'exemple de la rue unique.
    const inversee = page
      .getByRole('article')
      .filter({ has: page.getByRole('heading', { name: 'La rareté inversée des rues' }) });
    await expect(inversee).toContainText(/3\s?000\s?pts/);
    await expect(inversee).toContainText(/une seule commune/);

    await assertNoHorizontalOverflow(page, 'à 390 px');
  });

  test('rarete — la section « six éditions » porte les six scores et la phrase des deux cartes', async ({
    page,
  }) => {
    await page.goto('/rarete');

    const editions = page.getByRole('article').filter({
      has: page.getByRole('heading', { name: 'Régions et départements : six éditions' }),
    });
    await expect(editions).toBeVisible();

    const scores = editions.getByRole('table', {
      name: 'Régions et départements : six éditions',
    });
    await expect(scores).toBeVisible();

    // Les six paliers et leurs six scores d'édition (200 → 3 500), lus dans
    // `EDITION_SCORE` par la page : aucun chiffre n'est écrit à la main.
    for (const label of RARITY_LABELS) {
      await expect(scores.getByText(label, { exact: true })).toHaveCount(1);
    }
    for (const score of ['200 pts', '400 pts', '750 pts', '1 250 pts', '2 000 pts', '3 500 pts']) {
      await expect(scores.getByText(new RegExp(`^${score.replace(/\s/g, '\\s?')}$`))).toBeVisible();
    }

    // La phrase qui tue le malentendu du doublon.
    await expect(editions).toContainText(/n’est pas un doublon, c’est deux cartes/);
    // Et le contraste avec la commune, dont la rareté ne change jamais.
    await expect(editions).toContainText(/ne change jamais/);

    await assertNoHorizontalOverflow(page, 'avec la section des six éditions à 390 px');
  });
});

test.describe('rarete — depuis la feuille des salles', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('rarete — la feuille « Autres salles » ouvre la salle', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();

    const control = page.getByRole('button', { name: SHEET_CONTROL, exact: true });
    await expect(control).toBeVisible();
    await control.click();

    const sheet = page.getByRole('dialog', { name: SHEET_TITLE });
    await expect(sheet).toBeVisible();
    await sheet.getByRole('link', { name: ROOM_LABEL }).click();

    await expect(page).toHaveURL(/\/rarete$/);
    await expect(page.getByRole('heading', { level: 1, name: ROOM_LABEL })).toBeVisible();
  });
});

test.describe('rarete — cadre large', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('rarete — la salle tient dans le cadre à 1280 px', async ({ page }) => {
    await page.goto('/rarete');
    await expect(page.getByRole('heading', { level: 1, name: ROOM_LABEL })).toBeVisible();
    await assertNoHorizontalOverflow(page, 'à 1280 px');

    // Deux colonnes sur un cadre large : les deux premières planches sont côte à côte.
    const boxes = await page.getByRole('article').evaluateAll((articles) =>
      articles.slice(0, 2).map((article) => {
        const rect = article.getBoundingClientRect();
        return { top: Math.round(rect.top), left: Math.round(rect.left) };
      }),
    );
    expect(boxes).toHaveLength(2);
    const [first, second] = boxes;
    if (!first || !second) throw new Error('deux articles attendus');
    expect(first.top).toBe(second.top);
    expect(first.left).toBeLessThan(second.left);
  });
});
