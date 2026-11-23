import { expect, type Locator, type Page, test } from '@playwright/test';

// Phase 35 « L'Atlas » — la carte des possessions.
//
// La salle descend de la France entière au département, puis à la commune. La
// carte n'est jamais seule : une table équivalente porte le même contenu, et
// c'est elle que lisent le clavier et les lecteurs d'écran. Les cas ci-dessous
// regardent ce contrat jouer, pas seulement compiler.
//
// La fixture `e2e-seed.ts` sème deux régions (`E2E-R1`, `E2E-R2`), deux
// départements (`E2E-D1`, `E2E-D2`) et six communes par département, toutes
// pourvues d'un `path_d` : le nombre de tracés égale donc toujours le nombre de
// lignes de la table nationale. Depuis la phase 50, `drom-fixture.ts` ajoute un
// groupe d'outre-mer (une région, un département, deux communes), rendu dans un
// encart : les tracés de l'encart comptent donc aussi, et le niveau national
// annonce trois régions et trois départements.

const TABLE_NAME = 'Table équivalente de la carte';
const NATIONAL_STATUS = /^Niveau national : 3 régions et 3 départements\.$/;
const ENTITY_PATH = 'svg path[data-entity-code]';

function equivalentTable(page: Page): Locator {
  return page.getByRole('table', { name: TABLE_NAME });
}

function levelTitle(page: Page): Locator {
  return page.getByRole('heading', { level: 2 });
}

function statusLine(page: Page): Locator {
  return page.getByRole('status');
}

async function openDepartementA(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Ouvrir les communes de Département E2E A' }).click();
  await expect(levelTitle(page)).toHaveText('Département E2E A');
}

test('atlas — la table équivalente est complète', async ({ page }) => {
  await page.goto('/atlas');
  await expect(page.getByRole('heading', { level: 1, name: "L'Atlas" })).toBeVisible();

  const table = equivalentTable(page);
  await expect(table).toBeVisible();

  // La carte et sa table disent la même chose : un tracé, une ligne.
  const rows = table.locator('tbody tr');
  const paths = page.locator(ENTITY_PATH);
  await expect(paths.first()).toBeVisible();
  expect(await rows.count()).toBe(await paths.count());

  // Le SVG est purement décoratif : aucun texte, ni `<title>`, ni `<desc>`.
  const svg = page.locator('figure svg');
  expect(await svg.evaluate((node) => node.textContent)).toBe('');
  expect(await svg.locator('title, desc').count()).toBe(0);

  // Trois colonnes par ligne : Entité, Possession, Couverture.
  const rowCount = await rows.count();
  for (let index = 0; index < rowCount; index += 1) {
    await expect(rows.nth(index).locator('th, td')).toHaveCount(3);
  }

  await expect(statusLine(page)).toHaveText(NATIONAL_STATUS);
});

test('atlas — la descente région → département → commune', async ({ page }) => {
  await page.goto('/atlas');
  const table = equivalentTable(page);
  await expect(table).toBeVisible();

  // Niveau national : régions puis départements dans la même table.
  await expect(table.getByRole('row', { name: /Région E2E A/ })).toBeVisible();
  await expect(table.getByRole('row', { name: /Département E2E A/ })).toBeVisible();

  await openDepartementA(page);

  // Le titre de niveau prend le focus à chaque descente : le clavier ne se perd
  // pas dans un SVG qui n'est pas focusable.
  await expect(levelTitle(page)).toBeFocused();
  // La phrase est « Département <nom> : … » et la fixture s'appelle déjà
  // « Département E2E A » : on asserte les faits (niveau, volume, couverture)
  // plutôt que le libellé doublé qu'un gabarit collé au nom produirait.
  const status = statusLine(page);
  await expect(status).toContainText('Département E2E A');
  await expect(status).toContainText(/\b6 communes\b/);
  await expect(status).toContainText(/\d+ couvertes?\b/);

  const rows = table.locator('tbody tr');
  await expect(rows).toHaveCount(6);

  // La carte rend désormais les communes de `E2E-D1`, pas les régions.
  const codes = await page
    .locator(ENTITY_PATH)
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-entity-code')));
  expect(codes).toHaveLength(6);
  expect(codes.every((code) => code?.startsWith('E2E-C-'))).toBe(true);

  // Remontée : le niveau national et ses lignes reviennent.
  await page.getByRole('button', { name: 'Revenir à la France entière' }).click();
  await expect(levelTitle(page)).toHaveText('La France entière');
  await expect(table.getByRole('row', { name: /Région E2E A/ })).toBeVisible();
  await expect(table.getByRole('row', { name: /Département E2E A/ })).toBeVisible();
  await expect(statusLine(page)).toHaveText(NATIONAL_STATUS);
});

test('atlas — la commune mène au Cadastre', async ({ page }) => {
  await page.goto('/atlas');
  await expect(equivalentTable(page)).toBeVisible();
  await openDepartementA(page);

  await page
    .getByRole('link', { name: /Voir la commune au Cadastre/ })
    .first()
    .click();

  // `commune` est un point d'entrée du Cadastre : il est consommé à l'arrivée et
  // remplacé par `q`. Le code INSEE doit donc survivre dans la recherche.
  await expect(page).toHaveURL(/\/collection\?q=E2E-C-[^&]+$/);
  const code = new URL(page.url()).searchParams.get('q') ?? '';
  expect(code, 'Le code INSEE a disparu de la requête').toMatch(/^E2E-C-/);
  await expect(page.getByRole('searchbox', { name: 'Recherche' })).toHaveValue(code);
});

test('atlas — le département mène au Cadastre', async ({ page }) => {
  await page.goto('/atlas');
  const table = equivalentTable(page);
  await expect(table).toBeVisible();

  const row = table.getByRole('row', { name: /Département E2E A/ });
  await expect(row).toHaveCount(1);
  await row.getByRole('link', { name: /Voir les cartes au Cadastre/ }).click();

  // `E2E-D1` n'est pas un code de département français : le validateur du contrat
  // du Cadastre (`^(\d{2,3}|2[AB])$`) l'écarte par construction, donc l'arrivée est
  // le Cadastre nu. Ce n'est pas une régression — ne pas « corriger » cette URL
  // vers `?departement=E2E-D1`.
  await expect(page).toHaveURL(/\/collection$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Ma collection' })).toBeVisible();
});

test('atlas — une région et un département n’ont pas le même style', async ({ page }) => {
  await page.goto('/atlas');
  await expect(equivalentTable(page)).toBeVisible();

  const region = page.locator('svg path[data-entity-kind="region"]').first();
  const departement = page.locator('svg path[data-entity-kind="departement"]').first();
  await expect(region).toBeAttached();
  await expect(departement).toBeAttached();

  // Les attributs ne prouvent rien : c'est le rendu calculé qui distingue les
  // deux niveaux, donc on lit `getComputedStyle`, pas `getAttribute`.
  const styleOf = (locator: Locator) =>
    locator.evaluate((node) => {
      const style = getComputedStyle(node);
      return {
        fill: style.fill,
        fillOpacity: style.fillOpacity,
        stroke: style.stroke,
        strokeWidth: style.strokeWidth,
      };
    });

  const regionStyle = await styleOf(region);
  const departementStyle = await styleOf(departement);

  // La région est un contour : aucun aplat.
  expect(regionStyle.fill, 'Une région ne doit pas porter d’aplat').toBe('none');
  // Le département porte un fond coloré, donc un `fill` réel et différent.
  expect(departementStyle.fill, 'Un département doit porter un fond coloré').not.toBe('none');
  expect(departementStyle.fill).not.toBe(regionStyle.fill);

  // Les deux contours sont tracés : ni l'un ni l'autre ne disparaît.
  expect(Number.parseFloat(regionStyle.strokeWidth)).toBeGreaterThan(0);
  expect(Number.parseFloat(departementStyle.strokeWidth)).toBeGreaterThan(0);
  expect(regionStyle.stroke).not.toBe('none');
  expect(departementStyle.stroke).not.toBe('none');
});

test('atlas — le clic d’un département fait ce que fait sa ligne de table', async ({ page }) => {
  await page.goto('/atlas');
  const table = equivalentTable(page);
  await expect(table).toBeVisible();

  // Référence : le chemin accessible, la ligne de table.
  await openDepartementA(page);
  // Attendre la fin du chargement du détail : sinon le statut lu serait
  // « Chargement des communes… », et la comparaison dépendrait d'un cache.
  await expect(statusLine(page)).toContainText(/\b6 communes\b/);
  const statusFromTable = ((await statusLine(page).textContent()) ?? '').trim();
  const codesFromTable = await page
    .locator(ENTITY_PATH)
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-entity-code')));
  await expect(table.locator('tbody tr')).toHaveCount(6);

  // Remontée, puis la même ouverture depuis la carte seule.
  await page.getByRole('button', { name: 'Revenir à la France entière' }).click();
  await expect(levelTitle(page)).toHaveText('La France entière');

  await page.locator('svg path[data-entity-kind="departement"][data-entity-code="E2E-D1"]').click();

  // Même état : même titre, même statut, mêmes communes rendues.
  await expect(levelTitle(page)).toHaveText('Département E2E A');
  await expect(levelTitle(page)).toBeFocused();
  await expect(equivalentTable(page).locator('tbody tr')).toHaveCount(6);
  await expect(statusLine(page)).toContainText(/\b6 communes\b/);
  expect(((await statusLine(page).textContent()) ?? '').trim()).toBe(statusFromTable);
  expect(
    await page
      .locator(ENTITY_PATH)
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-entity-code'))),
  ).toEqual(codesFromTable);
});

test('atlas — /assemblage redirige vers /atlas en gardant la recherche', async ({ page }) => {
  await page.goto('/assemblage?departement=E2E-D1');

  await expect(page).toHaveURL(/\/atlas\?departement=E2E-D1$/);
  await expect(page.getByRole('heading', { level: 1, name: "L'Atlas" })).toBeVisible();

  // Le teaser de la phase 34 a disparu avec la salle qu'il annonçait.
  await expect(page.getByText('Bientôt disponible')).toHaveCount(0);
});

test.describe('atlas — 320 px', () => {
  test.use({ viewport: { width: 320, height: 640 } });

  test('atlas — aucun débordement ni texte sous 10 px', async ({ page }) => {
    await page.goto('/atlas');
    await expect(equivalentTable(page)).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow, 'Débordement horizontal à 320 px').toBeLessThanOrEqual(0);

    // Le plus petit texte visible vit dans le contenu de la salle, pas dans la
    // coquille : on marche `main`, en sautant ce qui ne rend pas de texte.
    const offenders = await page.evaluate(() => {
      const skipped = new Set(['SCRIPT', 'STYLE', 'SVG', 'PATH', 'TITLE', 'DESC']);
      const main = document.querySelector('main');
      if (main === null) return ['aucun <main> à mesurer'];

      const tooSmall: string[] = [];
      for (const element of Array.from(main.querySelectorAll('*'))) {
        if (skipped.has(element.tagName)) continue;
        const size = Number.parseFloat(getComputedStyle(element).fontSize);
        if (!Number.isFinite(size)) continue;
        if (size < 10) tooSmall.push(`${element.tagName} à ${size} px`);
      }
      return tooSmall;
    });
    expect(offenders, 'Aucun texte sous 10 px').toEqual([]);
  });
});

test('atlas — le mouvement réduit supprime la transition', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/atlas');

  const first = page.locator(ENTITY_PATH).first();
  await expect(first).toBeAttached();

  const transition = await first.evaluate((node) => getComputedStyle(node).transitionProperty);
  expect(transition).toBe('none');
});

/** Canal sRGB (0–255) vers sa luminance linéaire, formule WCAG 2.x. */
function linearChannel(channel: number): number {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminanceOf(color: string): number {
  const match = /rgba?\(([^)]+)\)/.exec(color);
  const body = match?.[1];
  if (body === undefined) throw new Error(`Couleur illisible : ${color}`);
  const channels = body
    .split(/[,\s/]+/)
    .filter((part) => part !== '')
    .slice(0, 3)
    .map(Number);
  const [red, green, blue] = channels;
  if (red === undefined || green === undefined || blue === undefined) {
    throw new Error(`Couleur incomplète : ${color}`);
  }
  return 0.2126 * linearChannel(red) + 0.7152 * linearChannel(green) + 0.0722 * linearChannel(blue);
}

function contrastRatio(first: number, second: number): number {
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

test('atlas — le filet de laiton est lisible sur la carte', async ({ page }) => {
  await page.goto('/atlas');
  await expect(equivalentTable(page)).toBeVisible();

  const possessed = page.locator('svg path[data-possession="true"]');
  await expect(page.locator(ENTITY_PATH).first()).toBeAttached();
  const count = await possessed.count();
  expect(
    count,
    'Aucune carte possédée : le filet de laiton ne peut pas être mesuré',
  ).toBeGreaterThan(0);

  const stroke = await possessed.first().evaluate((node) => getComputedStyle(node).stroke);
  const background = await page
    .locator('figure')
    .first()
    .evaluate((figure) => {
      const color = getComputedStyle(figure).backgroundColor;
      const isTransparent = color === 'transparent' || /^rgba\([^)]*,\s*0\)$/.test(color);
      return isTransparent ? getComputedStyle(document.body).backgroundColor : color;
    });

  const ratio = contrastRatio(luminanceOf(stroke), luminanceOf(background));
  expect(
    ratio,
    `Contraste du filet de laiton (${stroke} sur ${background})`,
  ).toBeGreaterThanOrEqual(3);
});
