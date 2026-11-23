import { expect, type Locator, type Page, test } from '@playwright/test';

// Phase 50 « L'Atlas accueille l'outre-mer » — les encarts des DROM.
//
// La métropole garde son cadre (`0 0 1000 1000`). Chaque DROM est projeté dans
// le **même** repère, mais affiché dans un encart dont le `viewBox` est celui de
// son groupe : la géométrie n'est jamais reprojetée dans le navigateur, l'encart
// ne fait que choisir une fenêtre.
//
// La fixture `packages/e2e/fixtures/drom-fixture.ts`, exécutée par le service
// `seed` après le référentiel, sème un groupe : la région `E2E-OM-R1`, le
// département `E2E-OM-D1` et deux communes `E2E-OM-C1`/`E2E-OM-C2`, tous porteurs
// d'un `path_d` et du même `view_box`.

const TABLE_NAME = 'Table équivalente de la carte';
const METRO_MAP = 'svg[data-map-frame="metropole"]';
const GROUP_MAP = 'svg[data-map-frame="groupe"]';
const GROUP_REGION = 'Région E2E Outre-mer';
const GROUP_DEPARTEMENT = 'Département E2E Outre-mer';

function equivalentTable(page: Page): Locator {
  return page.getByRole('table', { name: TABLE_NAME });
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

function parseViewBox(value: string | null): Box {
  const parts = (value ?? '')
    .trim()
    .split(/[\s,]+/)
    .filter((part) => part.length > 0)
    .map(Number);
  expect(parts, `viewBox illisible : ${String(value)}`).toHaveLength(4);
  const [x, y, width, height] = parts as [number, number, number, number];
  expect(Number.isFinite(x) && Number.isFinite(y), `viewBox non numérique : ${String(value)}`).toBe(
    true,
  );
  expect(width > 0 && height > 0, `viewBox dégénéré : ${String(value)}`).toBe(true);
  return { x, y, width, height };
}

test('atlas — chaque DROM a son encart, cadré sur son groupe', async ({ page }) => {
  await page.goto('/atlas');
  const table = equivalentTable(page);
  await expect(table).toBeVisible();

  // La carte métropolitaine garde le cadre de la France, et elle reste la seule
  // à en porter le nom : un encart n'est pas la métropole.
  const metro = page.locator(METRO_MAP);
  await expect(metro).toHaveCount(1);
  expect(await metro.getAttribute('viewBox')).toBe('0 0 1000 1000');

  // Le DROM de la fixture a son encart, titré en français, et il est aussi dans
  // la table équivalente — le chemin accessible ne dépend pas du SVG.
  const inset = page.locator(GROUP_MAP);
  await expect(inset).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 3, name: GROUP_REGION })).toBeVisible();
  await expect(table.getByRole('row', { name: new RegExp(GROUP_REGION) })).toBeVisible();
  await expect(table.getByRole('row', { name: new RegExp(GROUP_DEPARTEMENT) })).toBeVisible();

  // Le cadre n'est pas `0 0 1000 1000` recopié : c'est celui du groupe, donc
  // une fenêtre bien plus petite qu'un millier d'unités.
  const frame = parseViewBox(await inset.getAttribute('viewBox'));
  expect(`${frame.x} ${frame.y} ${frame.width} ${frame.height}`).not.toBe('0 0 1000 1000');
  expect(Math.max(frame.width, frame.height)).toBeLessThan(200);

  // Chaque tracé de l'encart tient **entièrement** dans son cadre : c'est la
  // preuve que le `path_d` est déjà dans le bon repère.
  const fits = await inset.evaluate((svg) => {
    const element = svg as SVGSVGElement;
    const box = element.viewBox.baseVal;
    return Array.from(element.querySelectorAll('path')).map((path) => {
      const bounds = (path as SVGGraphicsElement).getBBox();
      return (
        bounds.x >= box.x &&
        bounds.y >= box.y &&
        bounds.x + bounds.width <= box.x + box.width &&
        bounds.y + bounds.height <= box.y + box.height
      );
    });
  });
  expect(fits.length, "L'encart ne rend aucun tracé").toBeGreaterThan(0);
  expect(fits.every(Boolean), 'Un tracé d’outre-mer sort du cadre de son groupe').toBe(true);
});

test('atlas — un département d’outre-mer suit le même chemin que la métropole', async ({
  page,
}) => {
  await page.goto('/atlas');
  const table = equivalentTable(page);
  await expect(table).toBeVisible();

  const inset = page.locator(GROUP_MAP);
  await expect(inset).toHaveCount(1);
  const groupFrame = parseViewBox(await inset.getAttribute('viewBox'));

  // La carte est un chemin décoratif, doublé par la ligne de table : on ouvre
  // depuis l'encart, comme on ouvrirait depuis la métropole.
  await inset.locator('path[data-entity-kind="departement"]').click();

  await expect(page.getByRole('heading', { level: 2 })).toHaveText(GROUP_DEPARTEMENT);
  await expect(page.getByRole('status')).toContainText(/\b2 communes\b/);

  const rows = table.locator('tbody tr');
  await expect(rows).toHaveCount(2);
  await expect(
    rows.first().getByRole('link', { name: /Voir la commune au Cadastre/ }),
  ).toBeVisible();

  // Le détail prend le cadre du **groupe**, pas celui de la métropole : le même
  // `viewBox` que l'encart, et les deux communes de la fixture.
  const detail = page.locator('svg[data-map-frame]');
  await expect(detail).toHaveCount(1);
  const detailFrame = parseViewBox(await detail.getAttribute('viewBox'));
  expect(detailFrame).toEqual(groupFrame);

  const codes = await detail
    .locator('path[data-entity-code]')
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-entity-code')));
  expect(codes.slice().sort()).toEqual(['E2E-OM-C1', 'E2E-OM-C2']);

  // Remontée : l'encart revient avec la métropole.
  await page.getByRole('button', { name: 'Revenir à la France entière' }).click();
  await expect(page.locator(METRO_MAP)).toHaveCount(1);
  await expect(page.locator(GROUP_MAP)).toHaveCount(1);
});
