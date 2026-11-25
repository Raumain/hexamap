import { expect, test } from '@playwright/test';

// I-001 — la carte à vendre se choisit par planches, plus par liste déroulante.
//
// Le banc n'avait aucun cas de vente : `mobile.spec.ts` n'atteignait
// `/market/mine` que par la feuille des salles secondaires, et l'achat était le
// seul geste couvert. Ce fichier couvre le parcours complet — filtres,
// sélection, envoi, verrouillage — et le passage étroit.
//
// Le référentiel E2E garantit au compte de démonstration quatre cartes du combo
// et deux témoins (`packages/e2e/fixtures/tableau-fixture.ts`) : la commune
// `E2E-C-RARE-0` est donc toujours là, déverrouillée, avant le premier achat.

const PICKER = 'Cartes disponibles à la vente';
const SEARCH_LABEL = 'Rechercher une carte';
const EMPTY_FILTERS = 'Aucune carte ne correspond à ces filtres.';

test('market — mettre une carte en vente depuis le tiroir de planches', async ({ page }) => {
  const posted: Array<{ userCardId?: unknown; price?: unknown }> = [];

  await page.route('**/api/v1/market/listings', async (route) => {
    if (route.request().method() === 'POST') {
      posted.push(route.request().postDataJSON());
    }
    await route.continue();
  });

  await page.goto('/market/mine');
  await expect(page.getByRole('heading', { level: 1, name: 'Mes ventes' })).toBeVisible();

  // (1) La liste déroulante a disparu : plus aucun sélecteur natif sur la salle.
  await expect(page.getByRole('combobox')).toHaveCount(0);

  const list = page.getByRole('region', { name: PICKER });
  await expect(list).toBeVisible();

  const rows = list.locator('button[data-index]');
  await expect(rows.first()).toBeVisible();

  // (3) Une collection quelconque ne rend qu'une fenêtre : le compte annoncé
  // peut dépasser le nombre de lignes présentes dans le DOM, et le cadre est
  // borné — c'est le virtualiseur, pas un hasard de mesure.
  const countText =
    (await page
      .getByText(/^\d+ cartes?$/)
      .first()
      .textContent()) ?? '';
  const total = Number.parseInt(countText, 10);
  expect(total, 'Le compte des cartes disponibles doit être annoncé.').toBeGreaterThan(0);

  const rendered = await rows.count();
  expect(rendered, 'La liste doit rester bornée en nœuds.').toBeLessThanOrEqual(25);
  if (total > 25) expect(rendered).toBeLessThan(total);

  const listBox = await list.boundingBox();
  if (listBox === null) throw new Error('Le tiroir ne rend aucune boîte.');
  expect(listBox.height, 'Le tiroir doit rester borné en hauteur.').toBeLessThanOrEqual(360);

  // (2) Les deux filtres agissent ensemble : rareté « Rare », puis le code.
  await page
    .getByRole('group', { name: 'Rareté' })
    .getByRole('button', { name: 'Rare', exact: true })
    .click();
  await page.getByLabel(SEARCH_LABEL).fill('E2E-C-RARE-0');

  const commune = rows.filter({ hasText: 'E2E-C-RARE-0' });
  await expect(commune).toHaveCount(1);

  // (5) La ligne est une planche, pas une option de texte : `aria-label` porte
  // le libellé du domaine, et la planche du tiroir est une `article.exhibit`.
  await expect(commune.locator('article.exhibit')).toHaveCount(1);
  const label = (await commune.getAttribute('aria-label')) ?? '';
  expect(label).toContain('—');

  // (7) Le tap sélectionne : il ne vend pas.
  await commune.click();
  await expect(commune).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText(/^Carte choisie : /)).toBeVisible();
  expect(posted, 'Sélectionner ne doit envoyer aucune requête.').toHaveLength(0);

  // (4) La vente reste un geste explicite, avec la validation de prix.
  await page.getByLabel('Prix').fill('250');
  await page.getByRole('button', { name: 'Mettre en vente' }).click();

  await expect.poll(() => posted.length, { timeout: 15_000 }).toBe(1);
  expect(posted[0]?.price).toBe(250);
  expect(String(posted[0]?.userCardId ?? '')).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/);

  // L'annonce rejoint la liste des ventes du vendeur.
  const listing = page.getByRole('listitem').filter({ hasText: 'E2E-C-RARE-0' });
  await expect(listing).toBeVisible();
  await expect(listing.getByText('250')).toBeVisible();

  // La carte est passée `locked` : le tiroir, qui ne propose que le libre, ne la
  // rend plus pour la même recherche.
  await expect(page.getByText(EMPTY_FILTERS)).toBeVisible();

  // Teardown : annuler la vente rend la carte au tiroir, donc le banc rejouable.
  await listing.getByRole('button', { name: 'Annuler la vente' }).click();
  await expect(rows.filter({ hasText: 'E2E-C-RARE-0' })).toHaveCount(1);
});

test.describe('market — le tiroir sur un écran étroit', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('market — 390 px : le tiroir défile, le prix reste atteignable', async ({ page }) => {
    await page.goto('/market/mine');
    await expect(page.getByRole('heading', { level: 1, name: 'Mes ventes' })).toBeVisible();

    const list = page.getByRole('region', { name: PICKER });
    await expect(list).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow, 'Le tiroir ne doit pas déborder horizontalement').toBeLessThanOrEqual(0);

    const listBox = await list.boundingBox();
    if (listBox === null) throw new Error('Le tiroir ne rend aucune boîte.');
    expect(listBox.height, 'Le tiroir doit tenir dans un écran de 844 px').toBeLessThanOrEqual(360);

    // Les deux jeux de puces restent des cibles tactiles.
    const chipBox = await page
      .getByRole('group', { name: 'Catégorie' })
      .getByRole('button', { name: 'Commune', exact: true })
      .boundingBox();
    if (chipBox === null) throw new Error('Aucune puce de catégorie rendue.');
    expect(chipBox.height).toBeGreaterThanOrEqual(32);

    // Le prix est rendu **après** la liste dans le document : il n'est jamais
    // enfoui sous elle, quel que soit le défilement. Le test porte sur l'ordre
    // du DOM, 4 étant `DOCUMENT_POSITION_FOLLOWING`.
    const priceAfterList = await page.evaluate((listLabel) => {
      const region = document.querySelector(`section[aria-label="${listLabel}"]`);
      const price = document.getElementById('sell-price');
      if (region === null || price === null) return null;
      return (region.compareDocumentPosition(price) & 4) !== 0;
    }, PICKER);
    expect(priceAfterList, 'Le prix doit suivre la liste').toBe(true);

    const price = page.getByLabel('Prix');
    await price.scrollIntoViewIfNeeded();
    await expect(price).toBeVisible();

    // Une planche se marque du premier appui.
    const first = list.locator('button[data-index]').first();
    await first.click();
    await expect(first).toHaveAttribute('aria-pressed', 'true');

    await page.screenshot({ path: test.info().outputPath('vendre-390.png'), fullPage: false });
  });
});

test.describe('market — le tiroir sur un écran large', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('market — 1280 px : le prix et le bouton restent visibles sous la liste', async ({
    page,
  }) => {
    await page.goto('/market/mine');
    await expect(page.getByRole('heading', { level: 1, name: 'Mes ventes' })).toBeVisible();

    const list = page.getByRole('region', { name: PICKER });
    await expect(list).toBeVisible();

    // Le compte annoncé suit les filtres : c'est lui qui prouve que le clic et
    // la frappe ont été pris en compte, et non un rendu lu avant la mise à jour.
    const counter = page.getByText(/^\d+ cartes?$/).first();
    await expect(counter).toBeVisible();
    const before = (await counter.textContent()) ?? '';

    const rareChip = page
      .getByRole('group', { name: 'Rareté' })
      .getByRole('button', { name: 'Rare', exact: true });
    await rareChip.click();
    await expect(rareChip).toHaveAttribute('aria-pressed', 'true');
    await expect(counter).not.toHaveText(before);

    await page.getByLabel(SEARCH_LABEL).fill('E2E-C-RARE-0');
    await expect(counter).toHaveText('1 carte');
    await expect(list.locator('button[data-index]')).toHaveCount(1);

    const submit = page.getByRole('button', { name: 'Mettre en vente' });
    await expect(submit).toBeDisabled();

    const listBox = await list.boundingBox();
    if (listBox === null) throw new Error('Le tiroir ne rend aucune boîte.');
    expect(listBox.height).toBeLessThanOrEqual(360);

    await page.screenshot({ path: test.info().outputPath('vendre-1280.png'), fullPage: false });
  });
});
