import { expect, type Locator, type Page, test } from '@playwright/test';

// Phase 36 « Les filtres du Cadastre » — l'état des filtres vit dans l'URL.
//
// Les cas ci-dessous regardent le contrat du lien profond jouer dans un vrai
// navigateur : une URL entrante se normalise, une frappe n'écrit pas
// d'historique, le retour défait un filtre et non une salle, et la mesure des
// lignes virtualisées ne bouge pas quand les filtres changent.
//
// `packages/e2e` ne dépend pas de `@hexamap/web` : les libellés de
// `apps/web/src/content/collection.ts` et de `apps/web/src/content/tickets.ts`
// sont recopiés ici, dans ce bloc et nulle part ailleurs.

const COLLECTION_TITLE = 'Ma collection';
const TABLE_NAME = 'Liste des cartes de votre collection';
const ATLAS_TABLE_NAME = 'Table équivalente de la carte';
const SEARCH_NAME = 'Recherche';
const DEPARTEMENT_NAME = 'Département';
const FILTERED_EMPTY_TITLE = 'Aucune carte ne correspond à ces filtres';

const CATEGORY_LABELS = {
  region: 'Région',
  departement: 'Département',
  commune: 'Commune',
  rue: 'Rue',
} as const;

const RARITY_LABELS = {
  rare: 'Rare',
  epique: 'Épique',
} as const;

function collectionTable(page: Page): Locator {
  return page.getByRole('table', { name: TABLE_NAME });
}

function collectionRows(page: Page): Locator {
  return collectionTable(page).locator('tbody tr');
}

/** La table équivalente de L'Atlas, celle que lit `atlas.spec.ts`. */
function atlasTable(page: Page): Locator {
  return page.getByRole('table', { name: ATLAS_TABLE_NAME });
}

/** Le palier de rareté est un `<button role="checkbox">` : jamais un bouton nu. */
function rarityCheckbox(page: Page, label: string): Locator {
  return page.getByRole('checkbox', { name: label, exact: true });
}

/** La catégorie est un `<button aria-pressed>` ; `exact` évite « Peu commune ». */
function categoryToggle(page: Page, label: string): Locator {
  return page.getByRole('button', { name: label, exact: true });
}

function searchBox(page: Page): Locator {
  return page.getByRole('searchbox', { name: SEARCH_NAME });
}

function departementSelect(page: Page): Locator {
  return page.getByRole('combobox', { name: DEPARTEMENT_NAME });
}

/** La ligne de compte des cartes filtrées : un `<p aria-live="polite">`. */
function counterLine(page: Page): Locator {
  return page.locator('p[aria-live="polite"]');
}

test("cadastre — un lien profond se restaure à l'identique", async ({ page }) => {
  await page.goto('/collection?rarete=EPIQUE,RARE&categorie=RUE,COMMUNE');

  // L'URL est réécrite dans l'ordre du domaine (`CATEGORY`, puis `RARITY`),
  // jamais dans l'ordre des clics ni dans l'ordre alphabétique.
  await expect(page).toHaveURL(/\/collection\?categorie=COMMUNE,RUE&rarete=RARE,EPIQUE$/);

  await expect(categoryToggle(page, CATEGORY_LABELS.commune)).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(categoryToggle(page, CATEGORY_LABELS.rue)).toHaveAttribute('aria-pressed', 'true');
  await expect(categoryToggle(page, CATEGORY_LABELS.region)).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await expect(rarityCheckbox(page, RARITY_LABELS.rare)).toHaveAttribute('aria-checked', 'true');
  await expect(rarityCheckbox(page, RARITY_LABELS.epique)).toHaveAttribute('aria-checked', 'true');

  await expect(collectionRows(page).first()).toBeVisible();
  const before = await collectionRows(page).count();
  expect(before, 'Le lien profond ne rend aucune ligne').toBeGreaterThan(0);

  await page.reload();

  await expect(page).toHaveURL(/\/collection\?categorie=COMMUNE,RUE&rarete=RARE,EPIQUE$/);
  await expect(categoryToggle(page, CATEGORY_LABELS.commune)).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(rarityCheckbox(page, RARITY_LABELS.rare)).toHaveAttribute('aria-checked', 'true');
  await expect(collectionRows(page).first()).toBeVisible();
  expect(await collectionRows(page).count()).toBe(before);
});

test('cadastre — le retour défait le dernier filtre, pas la navigation', async ({ page }) => {
  await page.goto('/collection');
  await expect(page).toHaveURL(/\/collection$/);

  await rarityCheckbox(page, RARITY_LABELS.rare).click();
  await expect(page).toHaveURL(/\/collection\?rarete=RARE$/);

  await categoryToggle(page, CATEGORY_LABELS.commune).click();
  await expect(page).toHaveURL(/\/collection\?categorie=COMMUNE&rarete=RARE$/);

  await page.goBack();
  await expect(page).toHaveURL(/\/collection\?rarete=RARE$/);
  await expect(page.getByRole('heading', { level: 1, name: COLLECTION_TITLE })).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/collection$/);
});

test("cadastre — une frappe n'ajoute pas d'entrée d'historique", async ({ page }) => {
  // Posé depuis une autre salle : le retour doit rendre cette salle-là, pas une
  // étape intermédiaire de la recherche.
  await page.goto('/tableau');
  await page.goto('/collection');

  await searchBox(page).fill('e2e');
  await expect(page).toHaveURL(/\/collection\?q=e2e$/);

  await page.goBack();
  await expect(page).toHaveURL(/\/tableau$/);
});

test('cadastre — un département absent des données vide la liste', async ({ page }) => {
  await page.goto('/collection?departement=99');

  // `99` est bien formé mais absent : le `<select>` l'accepte et l'injecte comme
  // option, puisque le résumé d'Atlas ne connaît que les codes `E2E-*`.
  const select = departementSelect(page);
  await expect(select).toHaveValue('99');
  await expect(select.getByRole('option', { name: '99', exact: true })).toBeAttached();

  await expect(counterLine(page)).toHaveText(/^0 cartes affichées/);
  await expect(page.getByText(FILTERED_EMPTY_TITLE, { exact: true })).toBeVisible();
});

test('cadastre — une commune entrante devient une recherche', async ({ page }) => {
  await page.goto('/collection?commune=E2E-C-RARE-0');

  // `commune` est un point d'entrée, jamais un état : la navigation le consomme
  // et le remplace par `q`. La regex n'admet aucun autre paramètre.
  await expect(page).toHaveURL(/\/collection\?q=E2E-C-RARE-0$/);
  await expect(searchBox(page)).toHaveValue('E2E-C-RARE-0');
  // La ligne se reconnaît au nom affiché de la carte : à cette largeur, le code de
  // référence (`E2E-C-RARE-0`) n'est pas rendu comme texte de ligne.
  await expect(
    collectionTable(page).getByRole('row', { name: /Commune E2E RARE 0/ }),
  ).toBeVisible();
});

test('cadastre — une valeur inconnue est écartée et l’URL réécrite', async ({ page }) => {
  await page.goto('/collection?rarete=ANANAS&categorie=COMMUNE');

  await expect(page).toHaveURL(/\/collection\?categorie=COMMUNE$/);
  await expect(page.getByRole('alert')).toHaveCount(0);

  await expect(collectionRows(page).first()).toBeVisible();
  const withUnknown = await collectionRows(page).count();
  expect(withUnknown, 'Le filtre de catégorie ne rend aucune ligne').toBeGreaterThan(0);

  await page.goto('/collection?categorie=COMMUNE');
  await expect(page).toHaveURL(/\/collection\?categorie=COMMUNE$/);
  await expect(collectionRows(page)).toHaveCount(withUnknown);
});

test('cadastre — la mesure des lignes ne bouge pas entre deux jeux de filtres', async ({
  page,
}) => {
  const target = /Département E2E A/;

  await page.goto('/collection?rarete=RARE');
  const rareRow = collectionTable(page).getByRole('row', { name: target });
  await expect(rareRow).toBeVisible();
  const rareHeight = await rareRow.evaluate((element) => element.getBoundingClientRect().height);

  await page.goto('/collection?categorie=DEPARTEMENT&rarete=RARE');
  const departementRow = collectionTable(page).getByRole('row', { name: target });
  await expect(departementRow).toBeVisible();
  const departementHeight = await departementRow.evaluate(
    (element) => element.getBoundingClientRect().height,
  );

  expect(
    Math.abs(departementHeight - rareHeight),
    `Ligne « Département E2E A » : ${departementHeight} px sous catégorie + rareté, ${rareHeight} px sous rareté seule`,
  ).toBeLessThan(0.5);
  expect(departementHeight, 'La ligne mesurée a une hauteur nulle').toBeGreaterThan(0);
});

test("cadastre — le parcours depuis L'Atlas", async ({ page }) => {
  await page.goto('/atlas');
  const table = atlasTable(page);
  await expect(table).toBeVisible();

  // Le lien vit sur la ligne départementale de la table nationale : descendre dans
  // le département n'est pas nécessaire, et `atlas.spec.ts` ne le fait pas non plus.
  const row = table.getByRole('row', { name: /Département E2E A/ });
  await expect(row).toHaveCount(1);
  await row.getByRole('link', { name: /Voir les cartes au Cadastre/ }).click();

  // `E2E-D1` n'est pas un code de département français : le validateur du
  // contrat du Cadastre (`^(\d{2,3}|2[AB])$`) l'écarte, donc l'arrivée est le
  // Cadastre nu. Ce n'est pas une régression.
  await expect(page).toHaveURL(/\/collection$/);
  await expect(page.getByRole('heading', { level: 1, name: COLLECTION_TITLE })).toBeVisible();

  await categoryToggle(page, CATEGORY_LABELS.commune).click();
  await expect(page).toHaveURL(/\/collection\?categorie=COMMUNE$/);

  await page.goBack();
  await expect(page).toHaveURL(/\/collection$/);

  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: COLLECTION_TITLE })).toBeVisible();
  await expect(collectionTable(page)).toBeVisible();
});
