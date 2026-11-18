import { expect, type Locator, type Page, test } from '@playwright/test';
import { CATEGORY_LABELS, type Category, readAccountFixture } from './fixtures/auth';

// Contrat visuel et structurel de la Phase 13 (DESIGN_SYSTEM.md §3 à §6).
// Les sélecteurs restent orientés utilisateur (rôles, libellés, textes) ;
// `evaluate` n'apparaît que lorsque le sujet EST le style ou la géométrie.

const PAPER_BACKGROUND = 'rgb(244, 241, 234)';

// Échelle publiée par `evaluateTableauAlignment` dans `@hexamap/shared`.
// Elle n'est jamais recalculée ici : le badge affiché est la seule source, et
// le multiplicateur doit lui correspondre exactement.
const MULTIPLIER_BY_LINKS = ['×1,0', '×1,5', '×2,5', '×5,0'] as const;

async function openCollection(page: Page): Promise<void> {
  await page.goto('/collection');
  await expect(page.getByRole('heading', { name: 'Ma collection' })).toBeVisible();
  await expect(
    page.getByRole('table', { name: 'Liste des cartes de votre collection' }),
  ).toBeVisible();
}

/** Filtre la collection sur une catégorie et attend que le tableau soit stable. */
async function filterCategory(page: Page, category: Category): Promise<void> {
  await page.getByLabel('Catégorie').selectOption(category);
  await expect(page.getByText(/^\d+ cartes? affichées? sur/).first()).toBeVisible();

  let previous = -1;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const current = await page.locator('article').count();
    if (current === previous) return;
    previous = current;
    await page.waitForTimeout(100);
  }
}

test('jetons — le fond de page est le papier cartographique', async ({ page }) => {
  await page.goto('/collection');

  const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);

  expect(background).toBe(PAPER_BACKGROUND);
});

test('jetons — aucun dégradé ni verre dépoli', async ({ page }) => {
  await openCollection(page);

  const offenders = await page.evaluate(() => {
    const problems: string[] = [];

    for (const element of Array.from(document.querySelectorAll('*'))) {
      const style = getComputedStyle(element);
      const name = element.tagName.toLowerCase();

      // `url(...)` reste autorisé : les blasons sont des calques de fond.
      if (style.backgroundImage.includes('gradient(')) {
        problems.push(`${name} — background-image`);
      }
      if (style.backdropFilter !== 'none') {
        problems.push(`${name} — backdrop-filter: ${style.backdropFilter}`);
      }
    }

    return problems.slice(0, 12);
  });

  expect(offenders).toEqual([]);
});

test('typographie — les nombres sont en mono tabulaire', async ({ page }) => {
  await openCollection(page);

  const offenders = await page.evaluate(() => {
    // Nombre ou score isolé : « 12 340 », « +45 pts », « 7 500 ⬢ ».
    const scorePattern = /^\+?[\d\s\u202f]+(pts|⬢)?$/;
    const problems: string[] = [];

    for (const element of Array.from(document.querySelectorAll('*'))) {
      // Seuls les nœuds feuilles portent un nombre : on ignore les conteneurs
      // dont le texte concatène plusieurs cellules.
      if (element.children.length > 0) continue;

      const text = (element.textContent ?? '').trim();
      if (!scorePattern.test(text) || !/\d/.test(text)) continue;

      const style = getComputedStyle(element);
      const tabular = style.fontVariantNumeric.includes('tabular-nums');
      const mono = /JetBrains Mono/.test(style.fontFamily);

      if (!tabular || !mono) {
        problems.push(`${element.tagName.toLowerCase()} « ${text} »`);
      }
    }

    return problems.slice(0, 12);
  });

  expect(offenders).toEqual([]);
});

test('carte — les gabarits sont structurellement distincts', async ({ page }) => {
  const account = readAccountFixture();
  await openCollection(page);

  const cards = page.locator('article');
  await expect(cards.first()).toBeVisible();
  expect(await cards.count()).toBeGreaterThanOrEqual(2);

  const shells = await cards.evaluateAll((elements) =>
    elements.slice(0, 2).map((element) => {
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return {
        borderWidth: style.borderTopWidth,
        borderRadius: Number.parseFloat(style.borderTopLeftRadius),
        ratio: box.height === 0 ? 0 : box.width / box.height,
      };
    }),
  );

  for (const shell of shells) {
    expect(shell.borderWidth).toBe('2px');
    expect(shell.borderRadius).toBeGreaterThanOrEqual(4);
    expect(shell.borderRadius).toBeLessThanOrEqual(6);
    // Gabarit 3 / 4 (carte à jouer verticale), à 5 % près.
    expect(Math.abs(shell.ratio - 3 / 4)).toBeLessThanOrEqual(0.05);
  }

  if (account.categories.includes('RUE')) {
    await filterCategory(page, 'RUE');
    // Le gabarit Rue est une plaque émaillée : fond bleu du panneau parisien.
    const backgrounds = await page
      .locator('article')
      .evaluateAll((elements) =>
        elements.map((element) => getComputedStyle(element).backgroundColor),
      );
    expect(backgrounds).toContain('rgb(0, 51, 153)');
  } else {
    test.skip(
      true,
      `Aucune carte ${CATEGORY_LABELS.RUE} obtenue par le compte de démonstration : sous-assertion Rue ignorée.`,
    );
  }

  if (account.categories.includes('COMMUNE')) {
    await filterCategory(page, 'COMMUNE');
    // Le gabarit Commune encadre le panneau EB10 d'un liseré rouge routier.
    const framedCards = await page.locator('article').evaluateAll(
      (elements) =>
        elements.filter((element) =>
          Array.from(element.querySelectorAll('*')).some((child) => {
            const style = getComputedStyle(child);
            return style.borderTopWidth === '2px' && style.borderTopColor === 'rgb(217, 35, 35)';
          }),
        ).length,
    );
    expect(framedCards).toBeGreaterThan(0);
  } else {
    test.skip(
      true,
      `Aucune carte ${CATEGORY_LABELS.COMMUNE} obtenue par le compte de démonstration : sous-assertion Commune ignorée.`,
    );
  }
});

test('carte — budget DOM de 12 nœuds', async ({ page }) => {
  await openCollection(page);

  const cards = page.locator('article');
  await expect(cards.first()).toBeVisible();

  const counts = await cards.evaluateAll((elements) =>
    elements.map((element) => {
      const descendants = element.querySelectorAll('*').length;
      // `querySelectorAll('*')` inclut les nœuds internes des <svg> (paths,
      // lignes de relief, rivets) : ils sont décoratifs et hors budget.
      const svgInternals = element.querySelectorAll('svg *').length;
      return { tag: element.tagName.toLowerCase(), nodes: descendants + 1 - svgInternals };
    }),
  );

  for (const card of counts) {
    expect(card.nodes, `Carte ${card.tag} : ${card.nodes} nœuds rendus`).toBeLessThanOrEqual(12);
  }
});

/** Lit le multiplicateur affiché dans le panneau et le nombre de badges validés. */
async function readMultiplierPanel(panel: Locator): Promise<{ aligned: number; label: string }> {
  const aligned = await panel.getByText(/^✓/).count();
  const label = ((await panel.getByText(/^×\d/).first().textContent()) ?? '').trim();
  return { aligned, label };
}

/** Attend que le panneau ne bouge plus (prévisualisation serveur stabilisée). */
async function settledMultiplierPanel(
  panel: Locator,
  page: Page,
): Promise<{ aligned: number; label: string }> {
  let previous = await readMultiplierPanel(panel);

  for (let attempt = 0; attempt < 60; attempt += 1) {
    await page.waitForTimeout(250);
    const current = await readMultiplierPanel(panel);
    if (current.aligned === previous.aligned && current.label === previous.label) return current;
    previous = current;
  }

  throw new Error('Le panneau multiplicateur ne s’est pas stabilisé après la sélection.');
}

/** Choisit la première carte éligible de la tiroir ouvert. */
async function pickFirstEligibleCard(page: Page): Promise<boolean> {
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  const buttons = dialog.getByRole('button');
  const count = await buttons.count();

  for (let index = 0; index < count; index += 1) {
    const button = buttons.nth(index);
    const ariaLabel = await button.getAttribute('aria-label');
    if (ariaLabel === 'Fermer') continue;
    if (await button.isEnabled()) {
      await button.click();
      await expect(dialog).toBeHidden();
      return true;
    }
  }

  await page.getByRole('button', { name: 'Fermer' }).click();
  return false;
}

/** Le statut « Recalcul… » signale une prévisualisation serveur en vol. */
async function waitForPreview(page: Page): Promise<void> {
  await page
    .getByRole('status')
    .first()
    .waitFor({ state: 'hidden', timeout: 10_000 })
    .catch(() => undefined);
}

test('tableau — le multiplicateur affiché vient du serveur', async ({ page }) => {
  await page.goto('/tableau');
  await expect(page.getByRole('heading', { name: 'Constructeur de combos' })).toBeVisible();

  // Le panneau latéral porte le multiplicateur : `aside` = rôle complementary.
  const panel = page.getByRole('complementary');
  await expect(panel.getByText('×1,0', { exact: true })).toBeVisible();

  // Un emplacement par catégorie ; une catégorie absente de la collection de
  // démonstration est simplement sautée, sans recomposer le graphe à la main.
  const slots = [
    { label: 'Région', pattern: /^Région Choisir une carte$/ },
    { label: 'Département', pattern: /^Département Choisir une carte$/ },
    { label: 'Commune', pattern: /^Commune Choisir une carte$/ },
    { label: 'Rue', pattern: /^Rue Choisir une carte$/ },
  ] as const;

  let placed = 0;
  for (const slot of slots) {
    const button = page.getByRole('button', { name: slot.pattern });
    if ((await button.count()) === 0) continue;

    await button.first().click();
    if (await pickFirstEligibleCard(page)) placed += 1;
    await waitForPreview(page);
  }

  if (placed === 0) {
    test.skip(
      true,
      'La collection de démonstration ne contient aucune carte plaçable : le multiplicateur ne peut pas être exercé.',
    );
  }

  const panelState = await settledMultiplierPanel(panel, page);
  const expected = MULTIPLIER_BY_LINKS[panelState.aligned] ?? MULTIPLIER_BY_LINKS[0];

  expect(
    panelState.label,
    `${panelState.aligned} badge(s) « ✓ Aligné » affiché(s) : attendu ${expected}`,
  ).toBe(expected);
});
