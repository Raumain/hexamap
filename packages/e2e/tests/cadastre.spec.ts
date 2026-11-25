import { type BrowserContext, expect, type Locator, type Page, test } from '@playwright/test';
import { clearExemplairesCards, ensureExemplairesCards } from '../fixtures/exemplaires-fixture';

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
const RESET_LABEL = 'Réinitialiser les filtres';

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

test('cadastre — un filtre département retiré est écarté, la liste reste entière', async ({
  page,
}) => {
  await page.goto('/collection?departement=75');

  // `departement` n'est plus une clé du contrat du Cadastre : elle est écartée comme
  // toute clé inconnue, l'adresse est réécrite sans elle, et aucune carte n'est filtrée.
  await expect(page).toHaveURL(/\/collection$/);
  await expect(page.getByRole('combobox', { name: DEPARTEMENT_NAME })).toHaveCount(0);

  await expect(collectionRows(page).first()).toBeVisible();
  const rows = await collectionRows(page).count();
  expect(rows, 'Le Cadastre nu ne rend aucune ligne').toBeGreaterThan(0);
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

  // Le Cadastre n'a plus de filtre département : le lien pose une recherche par code.
  // `E2E-D1` est le code de référence du département, que le compte possède — la
  // recherche par code le retrouve donc, nom comme référence.
  await expect(page).toHaveURL(/\/collection\?q=E2E-D1$/);
  await expect(searchBox(page)).toHaveValue('E2E-D1');
  const matched = collectionTable(page).getByRole('row', { name: /Département E2E A/ });
  await expect(matched).toHaveCount(1);

  // « Réinitialiser les filtres » ramène au Cadastre nu.
  await page.getByRole('button', { name: RESET_LABEL }).first().click();
  await expect(page).toHaveURL(/\/collection$/);

  await categoryToggle(page, CATEGORY_LABELS.commune).click();
  await expect(page).toHaveURL(/\/collection\?categorie=COMMUNE$/);

  await page.goBack();
  await expect(page).toHaveURL(/\/collection$/);

  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: COLLECTION_TITLE })).toBeVisible();
  await expect(collectionTable(page)).toBeVisible();
});

// Code postal — I-002 de `.docs/09-idees.md`. Le tri vit dans l'état local du
// tableau, pas dans l'URL : il ne s'assert donc pas par une adresse, mais par
// l'ordre réellement rendu.

const CODE_POSTAL_HEADER = 'Code postal';
const CODE_POSTAL_ABSENT = '—';

/** Index de la colonne « Code postal » dans l'en-tête rendu. */
async function codePostalColumnIndex(table: Locator): Promise<number> {
  const headers = table.locator('thead th');
  const count = await headers.count();
  for (let index = 0; index < count; index += 1) {
    const text = (await headers.nth(index).textContent()) ?? '';
    if (text.includes(CODE_POSTAL_HEADER)) return index;
  }
  return -1;
}

/** Les codes postaux des lignes rendues, dans l'ordre du DOM. */
async function codePostalValues(page: Page, columnIndex: number): Promise<string[]> {
  const rows = collectionRows(page);
  const count = await rows.count();
  const values: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const cell = rows.nth(index).locator('td').nth(columnIndex);
    values.push(((await cell.textContent()) ?? '').trim());
  }
  return values;
}

test('cadastre — la colonne Code postal trie les lignes', async ({ page }) => {
  // La table d'en-tête est un gabarit de bureau (`md:block`) : le tri se prouve
  // à une largeur de bureau, quelle que soit celle du projet Playwright.
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/collection?categorie=COMMUNE');

  const table = collectionTable(page);
  await expect(collectionRows(page).first()).toBeVisible();
  await expect(table.locator('thead')).toContainText(CODE_POSTAL_HEADER);

  const columnIndex = await codePostalColumnIndex(table);
  expect(columnIndex, 'La colonne « Code postal » ne figure pas dans l’en-tête').toBeGreaterThan(0);

  const header = table.getByRole('button', { name: CODE_POSTAL_HEADER });
  await expect(header).toBeVisible();

  await header.click();
  await expect(table.locator('thead th').nth(columnIndex)).toHaveAttribute(
    'aria-sort',
    'ascending',
  );
  const ascending = await codePostalValues(page, columnIndex);
  expect(ascending.length, 'Aucune ligne à trier').toBeGreaterThan(1);
  expect(ascending, `Ordre croissant attendu, reçu ${ascending.join(' · ')}`).toEqual(
    [...ascending].sort(),
  );

  await header.click();
  await expect(table.locator('thead th').nth(columnIndex)).toHaveAttribute(
    'aria-sort',
    'descending',
  );
  const descending = await codePostalValues(page, columnIndex);
  expect(descending, `Ordre décroissant attendu, reçu ${descending.join(' · ')}`).toEqual(
    [...descending].sort().reverse(),
  );
  expect(descending, 'Le tri n’a rien réordonné').not.toEqual(ascending);
});

test('cadastre — une carte qui n’est pas une commune affiche un tiret', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/collection?categorie=DEPARTEMENT');

  await expect(collectionRows(page).first()).toBeVisible();
  const table = collectionTable(page);
  const columnIndex = await codePostalColumnIndex(table);
  expect(columnIndex, 'La colonne « Code postal » ne figure pas dans l’en-tête').toBeGreaterThan(0);

  const values = await codePostalValues(page, columnIndex);
  expect(values.length, 'Aucun département rendu').toBeGreaterThan(0);
  for (const value of values) {
    expect(value, 'Un département ne porte pas de code postal').toBe(CODE_POSTAL_ABSENT);
  }
});

test('cadastre — le code postal ne fait pas déborder la page à 390 px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/collection?categorie=COMMUNE');

  await expect(collectionRows(page).first()).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, 'Débordement horizontal à 390 px').toBeLessThanOrEqual(0);

  // Sur mobile, la colonne est masquée : le code postal rejoint la ligne de
  // métadonnées sous le nom, et une commune du banc en porte un.
  await expect(collectionRows(page).first()).toContainText(/\d{5}/);
});

// Exemplaires multiples — l'identité d'une ligne du Cadastre est la carte
// (catégorie, référence, rareté), pas la ligne de `user_cards`. Trois doublons
// identiques font donc **une** ligne portant « 3 exemplaires », tandis que deux
// éditions du même lieu restent deux lignes. Le tiroir de La Planche et le Cartel
// gardent la marque compacte `×3`.

interface CollectionCardBody {
  id: string;
  refCode: string;
  rarity: string;
}

interface CardsBody {
  items: CollectionCardBody[];
}

async function sessionUserId(context: BrowserContext): Promise<string> {
  const response = await context.request.get('/api/auth/get-session');
  expect(response.ok()).toBe(true);
  const body = (await response.json()) as { user: { id: string } | null };
  expect(body.user?.id).toBeTruthy();
  return body.user?.id ?? '';
}

async function collectionCards(page: Page): Promise<CollectionCardBody[]> {
  const response = await page.request.get('/api/v1/cards?limit=5000');
  expect(response.ok()).toBe(true);
  return ((await response.json()) as CardsBody).items;
}

test.describe('cadastre — exemplaires multiples', () => {
  test('trois identiques font une ligne, deux éditions en font deux', async ({ page }) => {
    const userId = await sessionUserId(page.context());
    await ensureExemplairesCards(userId);

    try {
      await page.goto('/collection?categorie=COMMUNE');

      // Le nombre d'exemplaires est une colonne à part entière, lisible sur les deux
      // gabarits : en-tête de table sur bureau, ligne de métadonnées sur mobile.
      await expect(collectionTable(page).locator('thead')).toContainText('Exemplaires');

      const group = collectionTable(page).getByRole('row', {
        name: /Commune E2E LEGENDAIRE 0/,
      });
      await expect(group).toHaveCount(1);
      await expect(group).toContainText('3 exemplaires');

      const editions = collectionTable(page).getByRole('row', {
        name: /Commune E2E MYTHIQUE 0/,
      });
      await expect(editions).toHaveCount(2);

      // Le compteur dit ce qu'il compte : des groupes, pas des lignes brutes.
      await expect(counterLine(page)).toContainText('groupe');

      // Le Cartel d'un représentant annonce ses trois exemplaires.
      const cards = await collectionCards(page);
      const card = cards.find((item) => item.refCode === 'E2E-C-LEGENDAIRE-0');
      expect(
        card,
        'La carte « Commune E2E LEGENDAIRE 0 » est absente de /api/v1/cards',
      ).toBeTruthy();
      await page.goto(`/card/${card?.id ?? ''}`);
      await expect(page.getByText(/3 exemplaires/).first()).toBeVisible();

      // Le tiroir de La Planche liste les cartes du joueur, marque comprise.
      await page.goto('/tableau');
      await page
        .getByRole('button', { name: /Emplacement libre.*Commune/i })
        .first()
        .click();
      const candidate = page.getByRole('button', { name: /Commune E2E LEGENDAIRE 0/ }).first();
      await expect(candidate).toBeVisible();
      await expect(candidate).toContainText('×3');
    } finally {
      await clearExemplairesCards(userId);
    }
  });
});
