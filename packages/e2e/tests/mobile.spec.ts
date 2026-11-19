import { expect, type Page, test } from '@playwright/test';

// Phase 16 « Le Geste » — la coquille mobile.
//
// Les sélecteurs restent orientés utilisateur (rôles ARIA, libellés français).
// `nav`/`aside` ne servent qu'à distinguer les deux incarnations d'une même
// navigation, que le libellé ne départage pas.
//
// Ce fichier n'est joué que par les projets tactiles (`Pixel 7`, `iPhone 13`).
// `playwright.config.ts` l'exclut du projet `chromium`, qui continue de jouer
// les seuls parcours de bureau.

const CABINET_NAV = 'nav[aria-label="Salles du cabinet"]';
const COLLECTION_TABLE = 'Liste des cartes de votre collection';
const SCRATCH_CELL = /^Case \d+, non révélée$/;

const ROOMS: readonly string[] = ['/', '/collection', '/market', '/tableau'];

/**
 * Grattage au doigt : quatre appuis puis le centre d'une case de 70 px suffisent
 * à franchir le seuil de 40 % de couverture (`SCRATCH_REVEAL_THRESHOLD`).
 *
 * Les appuis sont employés plutôt qu'un glissement : le contrôleur ne peint
 * qu'un échantillon par image (`requestAnimationFrame`), si bien qu'un
 * glissement synthétique perd des `pointermove` et ne franchit pas le seuil de
 * façon fiable. Chaque appui est une entrée tactile complète, mesurée à sa fin.
 */
const SCRATCH_TAPS: ReadonlyArray<readonly [number, number]> = [
  [0.25, 0.25],
  [0.75, 0.25],
  [0.25, 0.75],
  [0.75, 0.75],
  [0.5, 0.5],
  [0.5, 0.2],
  [0.2, 0.5],
  [0.5, 0.8],
  [0.8, 0.5],
];

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Point {
  x: number;
  y: number;
}

function requireBox(box: Box | null, label: string): Box {
  if (box === null) throw new Error(`Aucune boîte rendue pour ${label}.`);
  return box;
}

function viewportHeight(page: Page): number {
  const size = page.viewportSize();
  if (size === null) throw new Error('Ce projet ne déclare aucun viewport.');
  return size.height;
}

/**
 * Les deux navigations portent le même libellé : seule la position les sépare.
 * La barre basse est ancrée en bas de la fenêtre, le rail en haut.
 */
function visibleCabinetNav(page: Page) {
  return page.locator(`${CABINET_NAV}:visible`);
}

async function openRoom(page: Page, room: string): Promise<void> {
  await page.goto(room);
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
}

async function assertNoHorizontalOverflow(page: Page, room: string): Promise<void> {
  // La mesure est la seule façon de vérifier un débordement : elle porte sur la
  // racine du document, pas sur un composant.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow, `Débordement horizontal sur ${room}`).toBeLessThanOrEqual(0);
}

/* ── 1. Coquille : une seule navigation visible ──────────────────────────── */

test('mobile — la barre d’onglets est visible et le menu latéral masqué', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Le relevé topographique' })).toBeVisible();

  await expect(page.locator('aside').first()).toBeHidden();

  const nav = visibleCabinetNav(page);
  await expect(nav).toHaveCount(1);

  const box = requireBox(await nav.boundingBox(), 'la barre d’onglets');
  // Ancrage bas : c'est bien la barre d'onglets, pas le rail.
  expect(box.y).toBeGreaterThan(viewportHeight(page) / 2);
});

test.describe('bureau — cadre large', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('bureau — le menu latéral est visible et la barre masquée', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Le relevé topographique' })).toBeVisible();

    await expect(page.locator('aside').first()).toBeVisible();

    const nav = visibleCabinetNav(page);
    await expect(nav).toHaveCount(1);

    const box = requireBox(await nav.boundingBox(), 'le rail latéral');
    // Ancrage haut : c'est le rail, pas la barre d'onglets.
    expect(box.y).toBeLessThan(viewportHeight(page) / 2);
  });
});

/* ── 2. Aucun débordement horizontal ─────────────────────────────────────── */

test('mobile — aucun débordement horizontal', async ({ page }) => {
  for (const room of ROOMS) {
    await openRoom(page, room);
    await assertNoHorizontalOverflow(page, room);
  }
});

test.describe('mobile — écran étroit', () => {
  // La plus petite largeur supportée : 320 px.
  test.use({ viewport: { width: 320, height: 640 } });

  test('mobile — aucun débordement horizontal à 320 px', async ({ page }) => {
    for (const room of ROOMS) {
      await openRoom(page, room);
      await assertNoHorizontalOverflow(page, room);
    }
  });
});

/* ── 3. Cibles tactiles ──────────────────────────────────────────────────── */

test('mobile — les cibles tactiles font au moins 44 px', async ({ page }) => {
  await page.goto('/');

  const nav = visibleCabinetNav(page);
  await expect(nav).toHaveCount(1);

  const links = nav.getByRole('link');
  const count = await links.count();
  expect(count).toBeGreaterThan(0);

  for (let index = 0; index < count; index += 1) {
    const box = requireBox(await links.nth(index).boundingBox(), `le lien ${index} de la barre`);
    expect(box.height, `Cible tactile ${index}`).toBeGreaterThanOrEqual(44);
  }
});

/* ── 4. Grattoir au doigt ────────────────────────────────────────────────── */

/** Ouvre un bordereau actif : reprise s'il en existe un, sinon création. */
async function openTicket(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Le relevé topographique' })).toBeVisible();

  const resume = page.getByRole('link', { name: 'Reprendre mon ticket' });
  if ((await resume.count()) > 0) {
    await resume.first().click();
  } else {
    await page.getByRole('button', { name: 'Obtenir un ticket' }).first().click();
  }

  await expect(page.getByRole('group', { name: 'Grille du ticket' })).toBeVisible();
}

/** Laisse passer une image avant l'échantillon suivant du glissement. */
function strokePause(): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, 60);
  });
}

/**
 * Glissement horizontal au doigt sur une case. WebKit n'expose pas CDP : la
 * souris émet les mêmes `pointermove`, que le contrôleur consomme sans
 * distinguer la source.
 */
async function dragAcrossCell(page: Page, box: Box): Promise<void> {
  const y = box.y + box.height / 2;
  const left = box.x + box.width * 0.15;
  const right = box.x + box.width * 0.85;
  const points: Point[] = [];
  for (let step = 1; step <= 4; step += 1) {
    points.push({ x: left + ((right - left) * step) / 4, y });
  }

  const engine = page.context().browser()?.browserType().name();

  if (engine === 'chromium') {
    // Vrai toucher : CDP produit des `pointerdown`/`pointermove` de type `touch`.
    const client = await page.context().newCDPSession(page);
    try {
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x: left, y }],
      });
      for (const point of points) {
        await strokePause();
        await client.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [{ x: point.x, y: point.y }],
        });
      }
      await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } finally {
      await client.detach();
    }
    return;
  }

  await page.mouse.move(left, y);
  await page.mouse.down();
  for (const point of points) {
    await strokePause();
    await page.mouse.move(point.x, point.y);
  }
  await page.mouse.up();
}

test('mobile — gratter au doigt révèle la case', async ({ page }) => {
  await openTicket(page);

  const scratchable = page.getByRole('button', { name: SCRATCH_CELL });
  const before = await scratchable.count();
  expect(before).toBeGreaterThan(0);

  const box = requireBox(await scratchable.first().boundingBox(), 'la première case à gratter');

  for (const [rx, ry] of SCRATCH_TAPS) {
    await page.touchscreen.tap(box.x + box.width * rx, box.y + box.height * ry);
    await page.waitForTimeout(120);
    if ((await scratchable.count()) < before) break;
  }

  // Une case révélée n'est plus un bouton de grattage : le compte diminue.
  await expect.poll(() => scratchable.count(), { timeout: 15_000 }).toBeLessThan(before);
});

test('mobile — gratter ne fait pas défiler la page', async ({ page }) => {
  await openTicket(page);

  const scratchable = page.getByRole('button', { name: SCRATCH_CELL });
  expect(await scratchable.count()).toBeGreaterThan(0);

  const box = requireBox(await scratchable.first().boundingBox(), 'la première case à gratter');

  const scrollable = await page.evaluate(
    () => document.documentElement.scrollHeight > window.innerHeight,
  );
  if (!scrollable) {
    test.skip(true, 'Le bordereau tient dans la fenêtre : le défilement ne peut pas être observé.');
    return;
  }

  await page.evaluate(() => window.scrollTo(0, 0));
  const before = await page.evaluate(() => window.scrollY);

  await dragAcrossCell(page, box);

  // Laisse retomber l'inertie éventuelle avant de mesurer.
  await page.waitForTimeout(300);

  const after = await page.evaluate(() => window.scrollY);
  expect(after).toBe(before);
});

/* ── 5. Registre condensé ────────────────────────────────────────────────── */

test('mobile — la collection reste condensée', async ({ page }) => {
  await page.goto('/collection');
  await expect(page.getByRole('heading', { name: 'Ma collection' })).toBeVisible();

  const table = page.getByRole('table', { name: COLLECTION_TABLE });
  await expect(table).toBeVisible();

  const row = table.locator('tbody tr').first();
  await expect(row).toBeVisible();

  // Score, verrou et date sont des colonnes de bureau : une seule cellule
  // (le nom de la planche) reste rendue sous `md`.
  await expect(row.locator('td:visible')).toHaveCount(1);

  const name = ((await row.locator('td').first().textContent()) ?? '').trim();
  expect(name.length, 'Le nom de la planche reste visible').toBeGreaterThan(0);
});

/* ── 6. Achat : un double-appui n'achète qu'une fois ─────────────────────── */

test('market — un double-appui n’achète qu’une fois', async ({ page }) => {
  let buyCalls = 0;

  await page.route('**/api/v1/market/listings/*/buy', async (route) => {
    buyCalls += 1;
    // Achat volontairement lent : la fenêtre d'attente laisse le temps au
    // second appui d'arriver.
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 1_200);
    });
    await route.continue();
  });

  await openRoom(page, '/market');

  const buy = page.getByRole('button', { name: 'Acquérir' });
  if ((await buy.count()) === 0) {
    // Limitation du banc : `global-setup.ts` n'inscrit qu'un compte, donc
    // aucune annonce d'un autre joueur n'est ouverte de façon déterministe.
    // La route reste armée pour que les invariants soient vérifiés dès qu'une
    // annonce étrangère existe ; aucune fixture backend n'est inventée ici.
    test.skip(true, 'Aucune annonce d’un autre compte : rien à acquérir de façon déterministe.');
    return;
  }

  const first = buy.first();
  await first.click();
  // Second appui immédiat, sans attendre : il ne doit produire aucun achat.
  await first.click({ force: true, timeout: 2_000 }).catch(() => undefined);

  const busy = await first.getAttribute('aria-busy');
  const disabled = await first.isDisabled();
  expect(busy === 'true' || disabled, 'Le bouton n’annonce pas son attente').toBeTruthy();
  expect(buyCalls).toBe(1);
});

/* ── 7. Overlays ancrés à la fenêtre (BUG-007) ───────────────────────────── */

/**
 * Ouvre le tiroir de sélection d'un emplacement.
 *
 * Le déclencheur dépend de l'état de l'emplacement : un emplacement libre est
 * un bouton dont le libellé contient « Emplacement libre », un emplacement
 * rempli expose un bouton « Modifier ». Les deux ouvrent le même tiroir.
 */
async function openSlotDrawer(page: Page): Promise<void> {
  // Un `count()` ne patiente pas : il répondrait avant que la collection ne soit
  // chargée. Un localisateur patient attend le premier déclencheur disponible —
  // un emplacement libre, ou « Modifier » pour un emplacement déjà rempli.
  const trigger = page
    .getByRole('button', { name: /Emplacement libre/ })
    .or(page.getByRole('button', { name: 'Modifier' }))
    .first();
  await trigger.click();
  await expect(page.getByRole('dialog')).toBeVisible();
}

test.describe('mobile — les overlays restent ancrés à la fenêtre', () => {
  // Fenêtre courte : la page défile largement, l'écart entre le bloc conteneur
  // de `main` et la fenêtre devient mesurable.
  test.use({ viewport: { width: 390, height: 420 } });

  test('mobile — le tiroir de sélection reste dans la fenêtre après défilement', async ({
    page,
  }) => {
    await page.goto('/tableau');
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();

    // Le clic amène le déclencheur dans la fenêtre : le défilement qui compte
    // est donc celui qui suit l'ouverture.
    await openSlotDrawer(page);

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    expect(await page.evaluate(() => window.scrollY), 'la page doit être défilée').toBeGreaterThan(
      0,
    );

    const sheet = page.getByRole('dialog');
    const box = requireBox(await sheet.boundingBox(), 'le tiroir de sélection');
    const height = viewportHeight(page);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(height + 1);
    expect(Math.abs(box.y + box.height - height)).toBeLessThanOrEqual(1);
  });
});
