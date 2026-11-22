import { expect, test } from '@playwright/test';
import {
  clearVitrineTableaux,
  ensureVitrineTableaux,
  type VitrineFixture,
} from '../fixtures/vitrine-fixture';

// La Vitrine publique rendait un score, jamais ses planches : `bestTableau`
// n'exposait qu'un total, et les quatre cartes qui le composent étaient jetées
// après le calcul. Ce fichier regarde la page jouer ce qu'une spec serveur ne
// peut pas prouver à sa place — quatre planches réellement montées, un
// emplacement vide réellement lisible, et le budget DOM tenu sur chacune.
//
// Les lignes `tableaux` sont insérées par `fixtures/vitrine-fixture.ts` dans le
// `beforeAll`, pas par `global-setup.ts` : semées globalement, elles
// existeraient pendant tous les autres cas, y compris ceux qui comptent les
// tableaux du compte principal. La fixture les retire en `afterAll`.
//
// Ordre d'exécution : `fullyParallel: false`, `workers: 1`, donc ce fichier
// (v) passe après `tableau.spec.ts` (t) et ses lignes ne perturbent personne.

let fixture: VitrineFixture;

test.beforeAll(async () => {
  fixture = await ensureVitrineTableaux();
});

test.afterAll(async () => {
  await clearVitrineTableaux();
});

/** La feuille « Meilleur tableau » : `Sheet` rend une `<section>` titrée. */
function bestTableauSection(page: import('@playwright/test').Page) {
  return page
    .locator('section', {
      has: page.getByRole('heading', { name: 'Meilleur tableau', exact: true }),
    })
    .last();
}

/** Planches réellement montrées : les miniatures décoratives sont hors propos. */
function visiblePlates(page: import('@playwright/test').Page) {
  return page.locator('article.exhibit:not([aria-hidden="true"])');
}

test('vitrine — les quatre planches du meilleur tableau sont visibles', async ({ page }) => {
  await page.goto(`/players/${fixture.primaryUserId}`);

  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();

  const section = bestTableauSection(page);
  await expect(section, 'La feuille « Meilleur tableau » doit être montée.').toBeVisible();

  // Quatre positions quoi qu'il arrive : c'est le contrat de la phase, pas la
  // longueur de ce que le serveur rend.
  await expect(section.locator('ol > li'), 'La vitrine expose quatre positions.').toHaveCount(4);
  await expect(visiblePlates(page), 'Les quatre planches sont visibles.').toHaveCount(4);

  // Les noms viennent du référentiel E2E (`scripts/import/src/e2e-seed.ts`) :
  // une planche vide porterait son score mais pas son nom.
  for (const name of [
    'Région E2E A',
    'Département E2E A',
    'Commune E2E RARE 0',
    'Rue E2E INHABITUELLE 0',
  ]) {
    await expect(
      section.getByText(name, { exact: true }).first(),
      `« ${name} » manque.`,
    ).toBeVisible();
  }

  // Le résumé reste celui du serveur : aucun total ni multiplicateur n'est
  // recalculé dans le navigateur.
  await expect(section.getByText('pts', { exact: true }).first()).toBeVisible();
  await expect(section.getByText(/^×/).first()).toBeVisible();
  await expect(section.getByText(/lien(s)? d[’']alignement/).first()).toBeVisible();

  // Un tableau complet n'a aucun trou à annoncer.
  await expect(page.getByText('Emplacement vide')).toHaveCount(0);
});

test('vitrine — un tableau troué montre un emplacement vide', async ({ page }) => {
  await page.goto(`/players/${fixture.secondUserId}`);

  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();

  const section = bestTableauSection(page);
  await expect(
    section,
    'Un tableau troué n’est plus ignoré : sa feuille est montée.',
  ).toBeVisible();

  // Une seule carte possédée : une planche, trois trous explicites.
  await expect(visiblePlates(page), 'Seule la commune est posée.').toHaveCount(1);
  await expect(page.getByText('Emplacement vide'), 'Trois trous sur quatre positions.').toHaveCount(
    3,
  );

  // Le libellé de l'emplacement est porté par la case vide, pas seulement par la
  // planche : sans lui, « Emplacement vide » ne dirait pas lequel.
  for (const label of ['Région', 'Département', 'Commune', 'Rue']) {
    await expect(
      section.getByText(label, { exact: true }).first(),
      `« ${label} » manque.`,
    ).toBeVisible();
  }

  await expect(section.getByText('Commune E2E RARE 0', { exact: true }).first()).toBeVisible();

  // Le repli sur l'état vide serait un mensonge : le joueur a bien un tableau.
  await expect(page.getByText('Aucun tableau composé pour le moment.')).toHaveCount(0);
});

test('vitrine — les quatre planches tiennent le budget de 18 nœuds non-SVG', async ({ page }) => {
  await page.goto(`/players/${fixture.primaryUserId}`);
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();

  const plates = visiblePlates(page);
  await expect(plates).toHaveCount(4);

  // Même formule que `design-system.spec.ts` §4 : `querySelectorAll('*')` inclut
  // les nœuds internes des <svg> (traits, chemins), décoratifs et hors budget.
  const counts = await plates.evaluateAll((elements) =>
    elements.map((element) => {
      const descendants = element.querySelectorAll('*').length;
      const svgInternals = element.querySelectorAll('svg *').length;
      return {
        name: (element.querySelector('h3')?.textContent ?? element.textContent ?? '')
          .trim()
          .slice(0, 40),
        nodes: descendants + 1 - svgInternals,
      };
    }),
  );

  expect(counts).toHaveLength(4);

  for (const plate of counts) {
    expect(
      plate.nodes,
      `Planche « ${plate.name} » : ${plate.nodes} nœuds rendus`,
    ).toBeLessThanOrEqual(18);
  }

  await test.info().attach('vitrine-planches', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
});
