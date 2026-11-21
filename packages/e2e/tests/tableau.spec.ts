import { expect, type Locator, type Page, test } from '@playwright/test';

// Le tri par compatibilité du tiroir de La Planche était prouvé par neuf cas
// d'intégration serveur, jamais vu tourner. Ce cas le regarde jouer : une carte
// posée dans un emplacement voisin doit classer les candidates compatibles en
// tête, avec leur pastille, sans masquer les autres.
//
// Le combo est garanti par `fixtures/tableau-fixture.ts`, appelée depuis
// `global-setup.ts` **après** le grattage : `E2E-R1` → `E2E-D1` →
// `E2E-C-RARE-0`, plus l'odonyme réellement rattaché à cette commune par
// `commune_odonymes`.
//
// Les clics visent `.first()` et non un locator strict : `user_cards` n'a aucune
// unicité sur `ref_code`, donc un joueur peut posséder plusieurs exemplaires du
// même lieu — deux tickets peuvent tirer la même commune. Ce qui est asserté est
// la présence et l'ordre, jamais le nombre d'exemplaires.

const SORT_BANNER = 'Triées par compatibilité';
const COMPATIBLE = 'Compatible';

/** Déclencheur d'un emplacement **vide** : « Emplacement libre » + le libellé de l'emplacement. */
function emptySlot(page: Page, slotLabel: string): Locator {
  return page.getByRole('button', { name: new RegExp(`Emplacement libre\\s+${slotLabel}`, 'i') });
}

/** Première ligne du tiroir : l'index 0 de la liste virtualisée, donc le sommet du tri. */
function firstRow(drawer: Locator): Locator {
  return drawer.locator('button[data-index="0"]');
}

test('planche — le tiroir place les cartes compatibles en tête', async ({ page }) => {
  await page.goto('/tableau');
  await expect(page.getByRole('heading', { name: "La planche d'alignement" })).toBeVisible();

  const drawer = page.getByRole('dialog');

  // 1. Région seule : aucune extrémité de lien n'est choisie, donc `considered`
  //    vaut faux et le bandeau ne doit pas apparaître. Trier sans matière à
  //    comparer serait un mensonge sur la collection.
  await emptySlot(page, 'Région').click();
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText(SORT_BANNER)).toHaveCount(0);
  await drawer
    .getByRole('button', { name: /Région E2E A/ })
    .first()
    .click();
  await expect(drawer).toBeHidden();

  // 2. Département, voisin de la région posée : la région E2E-R1 contraint la
  //    liste, donc le département E2E-D1 passe en tête et porte la pastille.
  await emptySlot(page, 'Département').click();
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText(SORT_BANNER)).toBeVisible();
  await expect(firstRow(drawer)).toContainText('Département E2E A');
  await expect(firstRow(drawer)).toContainText(COMPATIBLE);
  // Le département de la région B reste **listé** : le tiroir trie, il ne filtre
  // pas — masquer une carte que le joueur possède lui mentirait sur sa collection.
  // `first()` parce qu'un joueur peut posséder plusieurs exemplaires d'un même
  // lieu : ce qui est asserté est la présence, jamais l'unicité.
  await expect(drawer.getByRole('button', { name: /Département E2E B/ }).first()).toBeVisible();
  await drawer.getByRole('button', { name: 'Fermer' }).click();
  await expect(drawer).toBeHidden();

  // 3. Commune : la recherche borne la liste virtualisée au combo, sans quoi la
  //    ligne cherchée pourrait vivre hors de la fenêtre rendue.
  await emptySlot(page, 'Commune').click();
  await expect(drawer).toBeVisible();
  await drawer.getByLabel('Recherche').fill('Commune E2E RARE 0');
  await drawer
    .getByRole('button', { name: /Commune E2E RARE 0/ })
    .first()
    .click();
  await expect(drawer).toBeHidden();

  // 4. Rue : « la rue existe dans cette commune » est la seule compatibilité que
  //    le navigateur ne peut pas déduire — elle vient de la jointure
  //    `commune_odonymes` du serveur. Si la pastille apparaît ici, le lien est
  //    réel, pas une ressemblance de nom.
  await emptySlot(page, 'Rue').click();
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText(SORT_BANNER)).toBeVisible();
  // L'ordre se lit sur la liste complète : la première ligne est compatible,
  // donc aucune carte hors-zone ne la précède.
  await expect(firstRow(drawer)).toContainText(COMPATIBLE);
  await test.info().attach('tiroir-compatible', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });

  // L'identité se lit ensuite sur une liste bornée par la recherche : le compte
  // peut posséder d'autres odonymes eux aussi compatibles (les liens portent sur
  // des raretés entières), donc l'index 0 seul ne nommerait pas la bonne rue.
  await drawer.getByLabel('Recherche').fill('Rue E2E INHABITUELLE 0');
  await expect(firstRow(drawer)).toContainText('Rue E2E INHABITUELLE 0');
  await expect(firstRow(drawer)).toContainText(COMPATIBLE);
});
