import { expect, type Locator, type Page, test } from '@playwright/test';

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

// BUG-006 puis phase 22 : la case révélée rend une **vraie planche** — elle
// n'est plus `decorative`, donc plus `aria-hidden` : la planche porte elle-même
// son nom, son sceau de rareté et son score. Le sélecteur reste borné au
// plateau, pour ne jamais attraper la planche de la modale de Pépite.
const REVEALED_PLATE = 'article.exhibit';
const RARITY_SEAL = /^Rareté : /;
// Un score est une suite de chiffres, éventuellement espacée par groupes de
// milliers, suivie ou non de son unité selon le pied de planche. Aucun libellé
// n'est supposé : le texte est la seule signature.
const SCORE_TEXT = /^\d[\d\s]*(\s*(?:pts|points))?$/;

// BUG-005 : le cinquième contrôle de la barre basse et la feuille qu'il ouvre.
// Le nom accessible du contrôle vaut exactement « Plus », d'où `exact` dans les
// localisateurs : sans lui, « Plus tard » de l'invitation de mise à jour serait
// aussi candidat.
const MORE_CONTROL = 'Plus';
const MORE_SHEET = 'Autres salles';

const ROOMS: readonly string[] = ['/', '/collection', '/market', '/tableau'];

/**
 * Grattage au doigt : quatorze appuis sur une case de 71 × 118 px franchissent
 * le seuil de 65 % de couverture (`SCRATCH_REVEAL_THRESHOLD`). Le modèle qui
 * fixe ce nombre est calibré sur une mesure, pas sur une géométrie idéale : il
 * estampille le vrai tampon — plateau jusqu'à 0,68 R, bordure
 * ((1 − t)/0,32)^1,1, grain d'alpha 128 sur 255 à 254, douze encoches de bord,
 * gigue de position ±0,06 R et d'échelle 0,94 à 1,06 —, rééchantillonne le
 * grain bilinéairement (le tampon est tourné et remis à l'échelle à chaque
 * appui, donc la texture est filtrée) et compte effacé tout pixel sous
 * `alpha < 128`, un pixel sur deux comme `checkCoverage`. Rejoué contre le
 * tampon d'avant le plateau — décroissance pure (1 − t)^1,6, grain 0,35 à 1 —
 * avec les neuf appuis d'origine, il rend 4,06 % là où l'appareil avait mesuré
 * 3,99 % : à 0,07 point près, ce qui autorise à s'en servir.
 *
 * Avec le tampon actuel, les onze appuis de la passe précédente ne donnaient
 * que 68,4 % ± 1,2 (écart type mesuré sur 2 000 tirages) — trois points de
 * marge, donc un banc qui flanche. Treize appuis plafonnent à 75,9 % quel que
 * soit l'emplacement du treizième (six candidats essayés) ; les trois derniers
 * complètent donc la rangée basse à l'image de la rangée haute (0,2 / 0,5 /
 * 0,8), la case étant haute : 80,1 % ± 1,2, soit 15 points de marge. Les trous
 * verticaux coûtent plus que les horizontaux, d'où cet appui au centre.
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
  [0.2, 0.1],
  [0.8, 0.1],
  [0.2, 0.9],
  [0.5, 0.9],
  [0.8, 0.9],
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

/** Une boîte doit tenir dans une autre, à un pixel d'arrondi près. */
function assertInside(inner: Box, outer: Box, label: string): void {
  const tolerance = 1;
  const left = outer.x - tolerance;
  const top = outer.y - tolerance;
  const right = outer.x + outer.width + tolerance;
  const bottom = outer.y + outer.height + tolerance;

  expect(inner.x, `${label} déborde à gauche de la case`).toBeGreaterThanOrEqual(left);
  expect(inner.y, `${label} déborde en haut de la case`).toBeGreaterThanOrEqual(top);
  expect(inner.x + inner.width, `${label} déborde à droite`).toBeLessThanOrEqual(right);
  expect(inner.y + inner.height, `${label} déborde en bas`).toBeLessThanOrEqual(bottom);
}

/**
 * Deux boîtes sont disjointes dès qu'elles ne se recouvrent plus sur un axe.
 * Le pixel de tolérance absorbe les arrondis sous-pixel du rendu : un contact
 * de bord n'est pas un chevauchement, un texte posé sur un autre en est un.
 */
function assertApart(first: Box, second: Box, label: string): void {
  const overlapWidth =
    Math.min(first.x + first.width, second.x + second.width) - Math.max(first.x, second.x);
  const overlapHeight =
    Math.min(first.y + first.height, second.y + second.height) - Math.max(first.y, second.y);

  const apart = overlapWidth <= 1 || overlapHeight <= 1;
  const width = Math.max(overlapWidth, 0).toFixed(1);
  const height = Math.max(overlapHeight, 0).toFixed(1);

  expect(apart, `${label} : chevauchement de ${width} × ${height} px`).toBe(true);
}

/** Taille de police effective, en pixels : en deçà de 10 px rien n'est lisible. */
function readFontSize(locator: Locator): Promise<number> {
  return locator.evaluate((node) => Number.parseFloat(getComputedStyle(node).fontSize));
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

/**
 * Ouvre la feuille « Autres salles » : un seul appui sur le contrôle « Plus ».
 *
 * La visibilité est attendue avant le clic pour que l'absence du contrôle soit
 * rapportée comme une assertion Playwright, et non comme l'expiration d'une
 * action.
 */
async function openMoreSheet(page: Page): Promise<void> {
  const control = page.getByRole('button', { name: MORE_CONTROL, exact: true });
  await expect(control).toBeVisible();
  await control.click();
  await expect(page.getByRole('dialog', { name: MORE_SHEET })).toBeVisible();
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
  expect(scrollable, 'La page du bordereau doit être défilable, sinon le cas ne prouve rien').toBe(
    true,
  );

  await page.evaluate(() => window.scrollTo(0, 0));
  const before = await page.evaluate(() => window.scrollY);

  await dragAcrossCell(page, box);

  // Laisse retomber l'inertie éventuelle avant de mesurer.
  await page.waitForTimeout(300);

  const after = await page.evaluate(() => window.scrollY);
  expect(after).toBe(before);
});

/* ── 4 bis. Case révélée : le cartel reste lisible (BUG-006) ─────────────── */

test('mobile — une case révélée affiche nom, rareté et score sans chevauchement', async ({
  page,
}) => {
  // Aucun ticket actif n'est supposé : `global-setup.ts` gratte des bordereaux
  // jusqu'à posséder les quatre catégories et peut laisser le compte sans
  // ticket ouvert. Le cas s'en procure donc un lui-même.
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Le relevé topographique' })).toBeVisible();

  // Localisateur patient : `count()` ne patiente pas et répondrait avant que le
  // tableau de bord n'ait rendu son état. « Reprendre » n'est qu'un repli, pour
  // le cas où une exécution précédente aurait laissé un bordereau entamé.
  const openBoard = page
    .getByRole('button', { name: 'Obtenir un ticket' })
    .or(page.getByRole('button', { name: 'Ouvrir un nouveau ticket' }))
    .or(page.getByRole('link', { name: 'Reprendre mon ticket' }))
    .first();
  await expect(openBoard).toBeVisible();
  await openBoard.click();
  await expect(page.getByRole('group', { name: 'Grille du ticket' })).toBeVisible();

  const scratchable = page.getByRole('button', { name: SCRATCH_CELL });
  const board = page.getByRole('group', { name: 'Grille du ticket' });
  const plates = board.locator(REVEALED_PLATE);

  // Borne au nombre de cases du bordereau : une révélation qui n'arrive pas
  // s'arrête là au lieu de boucler jusqu'au délai du test.
  const cells = await scratchable.count();
  expect(cells, 'Le bordereau doit présenter au moins une case à gratter.').toBeGreaterThan(0);

  for (let attempt = 0; attempt < cells && (await plates.count()) === 0; attempt += 1) {
    const box = requireBox(await scratchable.first().boundingBox(), 'la première case à gratter');

    for (const [rx, ry] of SCRATCH_TAPS) {
      await page.touchscreen.tap(box.x + box.width * rx, box.y + box.height * ry);
      // Cadence entre deux appuis, comme le cas de grattage existant : aucune
      // attente d'état ne passe par une pause (voir la borne patiente plus bas).
      await page.waitForTimeout(120);
      if ((await plates.count()) > 0) break;
      if ((await scratchable.count()) === 0) break;
    }
  }

  // La dernière révélation est une mutation serveur : la planche n'apparaît
  // qu'après la réponse. La borne est patiente, jamais endormie ; si elle
  // expire, le message français ci-dessous nomme la cause.
  const revealed = await expect
    .poll(() => plates.count(), { timeout: 15_000 })
    .toBeGreaterThan(0)
    .then(() => true)
    .catch(() => false);

  expect(revealed, 'Aucune case révélée après avoir gratté tout le bordereau.').toBe(true);

  const plate = plates.first();
  await expect(plate).toBeVisible();

  // La planche est montée dans un cadre qui la centre, lui-même dans la case :
  // la case est donc la grand-mère de la planche, pas sa mère.
  const cell = plate.locator('xpath=../..');
  await expect(cell).toBeVisible();

  // La planche n'est plus une vignette : son nom est son propre titre, son
  // score le texte numérique de son pied, son sceau le même rôle d'image
  // qu'avant. Trois planches titrent en `h3`, la Rue écrit son nom dans un
  // paragraphe typographique : le premier des deux est le nom.
  const name = cell.locator('h3, p').first();
  const score = cell.getByText(SCORE_TEXT).last();
  const seal = cell.getByRole('img', { name: RARITY_SEAL }).first();

  await expect(name, 'Le nom de la carte révélée doit être rendu').toBeVisible();
  await expect(score, 'Le score de la carte révélée doit être rendu').toBeVisible();
  await expect(seal, 'Le sceau de rareté de la carte révélée doit être rendu').toBeVisible();

  // La grille est un 4 × 4 logique : `index = ligne * 4 + colonne`. Afficher
  // trois colonnes ferait mentir la pastille de distance, qui mesure des écarts
  // de lignes et de colonnes. On mesure donc les décalages réels des cases.
  const boardCells = page.getByRole('group', { name: 'Grille du ticket' }).locator(':scope > *');
  const boardOffsets = await boardCells.evaluateAll((nodes) =>
    nodes.map((node) => {
      const rect = node.getBoundingClientRect();
      return { x: Math.round(rect.x), y: Math.round(rect.y) };
    }),
  );
  const geometryMessage =
    'La grille affichée doit rester 4 × 4, sinon la distance à la pépite ne correspond plus à ce que le joueur voit.';
  const columns = new Set(boardOffsets.map((offset) => offset.x)).size;
  const rows = new Set(boardOffsets.map((offset) => offset.y)).size;

  expect(boardOffsets.length, geometryMessage).toBe(16);
  expect(columns, geometryMessage).toBe(4);
  expect(rows, geometryMessage).toBe(4);

  const cellBox = requireBox(await cell.boundingBox(), 'la case révélée');
  const plateBox = requireBox(await plate.boundingBox(), 'la planche de la case révélée');
  const nameBox = requireBox(await name.boundingBox(), 'le nom de la carte révélée');
  const scoreBox = requireBox(await score.boundingBox(), 'le score de la carte révélée');
  const sealBox = requireBox(await seal.boundingBox(), 'le sceau de rareté de la carte révélée');

  // Le défaut d'origine est un débordement : la planche sortait de sa case.
  // Chaque élément mesuré doit donc tenir dans la case.
  assertInside(plateBox, cellBox, 'La planche');
  assertInside(nameBox, cellBox, 'Le nom');
  assertInside(scoreBox, cellBox, 'Le score');
  assertInside(sealBox, cellBox, 'Le sceau de rareté');

  // Tenir dans la case ne suffit pas : deux textes superposés restent
  // illisibles même lorsque leurs boîtes sont dans le cadre. La planche n'est
  // plus comparée au nom : elle le **contient** désormais, c'est la lecture
  // voulue. Ce sont les trois lectures qui ne doivent jamais se recouvrir.
  assertApart(nameBox, scoreBox, 'Le nom recouvre le score');
  assertApart(scoreBox, sealBox, 'Le score recouvre le sceau de rareté');
  assertApart(nameBox, sealBox, 'Le nom recouvre le sceau de rareté');

  // La planche n'est plus une vignette : elle doit occuper la case. Le plancher
  // de 60 px est la cible ; à 390 px, la piste du plateau fait ~65 px et la
  // case n'en laisse passer que l'intérieur, donc le plancher suit la case
  // plutôt que d'affirmer un débordement impossible.
  const ratioMessage =
    'La planche doit garder sa proportion de carte, sinon elle redevient une vignette.';
  const minimumPlateWidth = Math.min(60, cellBox.width - 16);
  expect(plateBox.width, ratioMessage).toBeGreaterThanOrEqual(minimumPlateWidth);
  const plateRatio = plateBox.height / plateBox.width;
  expect(Math.abs(plateRatio - 7 / 5), ratioMessage).toBeLessThanOrEqual(0.06);

  // Plancher de lisibilité : à moins de 10 px, aucun texte de planche n'est
  // lisible sur un téléphone, quelle que soit la largeur disponible.
  const nameSize = await readFontSize(name);
  const scoreSize = await readFontSize(score);
  expect(nameSize, 'Le nom de la carte est rendu sous 10 px').toBeGreaterThanOrEqual(10);
  expect(scoreSize, 'Le score de la carte est rendu sous 10 px').toBeGreaterThanOrEqual(10);

  // Preuve jointe au rapport : la revue lit la case, pas seulement des nombres.
  await test.info().attach('case-revelee-390.png', {
    contentType: 'image/png',
    body: await page.screenshot(),
  });
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

test('mobile — le registre montre une planche lisible', async ({ page }) => {
  await page.goto('/collection');
  await expect(page.getByRole('heading', { name: 'Ma collection' })).toBeVisible();

  const table = page.getByRole('table', { name: COLLECTION_TABLE });
  await expect(table).toBeVisible();

  const plate = table.locator('article.exhibit').first();
  await expect(plate).toBeVisible();

  const box = requireBox(await plate.boundingBox(), 'la planche du registre');

  // Seconde moitié du défaut : à 84 px la planche était une vignette muette.
  // C'est la largeur qui fait basculer la planche de `decorative` à complète,
  // donc 120 px est la mesure qui prouve la correction (BUG-006).
  const width = box.width;
  const gap = Math.abs(box.height / box.width - 7 / 5);

  expect(width, 'La planche du registre doit mesurer au moins 120 px').toBeGreaterThanOrEqual(120);
  // 7/5 est le rapport des planches : une vignette étirée trahirait un
  // agrandissement de boîte plutôt qu'un rendu à l'échelle.
  expect(gap, 'La planche du registre doit garder le rapport 7/5').toBeLessThanOrEqual(0.05);

  // Le bloc condensé porte le nom, la ligne « Catégorie · N pts » et le sceau :
  // agrandir la planche ne doit pas les faire disparaître de la ligne.
  const row = table.locator('tbody tr').first();
  await expect(row).toBeVisible();

  const name = row
    .locator('p')
    .filter({ hasNotText: /·\s*\d[\d\s]*pts/ })
    .first();
  const label = ((await name.textContent()) ?? '').trim();
  const scoreLine = row.getByText(/·\s*\d[\d\s]*pts/).first();
  const seal = row.getByRole('img', { name: RARITY_SEAL }).first();

  await expect(name, 'Le nom de la planche doit rester lisible').toBeVisible();
  expect(label.length, 'Le nom de la planche est vide').toBeGreaterThan(0);
  await expect(scoreLine, 'La ligne « Catégorie · score » doit rester lisible').toBeVisible();
  await expect(seal, 'Le sceau de rareté doit rester visible dans la ligne').toBeVisible();

  // Une planche élargie ne doit pas pousser le registre hors de la fenêtre.
  await assertNoHorizontalOverflow(page, '/collection');

  await test.info().attach('registre-390.png', {
    contentType: 'image/png',
    body: await page.screenshot(),
  });
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
  // Le référentiel de jeu du banc porte une annonce OPEN d'un second compte
  // (`packages/e2e/fixtures/market-fixture.ts`), insérée avant le démarrage des
  // specs. Sans elle, le cas ne prouverait rien : l'assertion remplace le
  // `test.skip` qui masquait cette absence de données.
  await expect(
    buy.first(),
    'Le marché doit proposer au moins une annonce d’un autre compte',
  ).toBeVisible();

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

/* ── 8. Lignes du tiroir (BUG-008) ───────────────────────────────────────── */

interface DrawerRowGeometry {
  row: Box;
  plate: Box;
}

/**
 * Relève la géométrie des deux premières lignes du tiroir. Les lignes sont des
 * boutons absolus translatés par le virtualiseur : `boundingBox()` porte donc
 * déjà le pas réel, sans avoir à reconstituer `translateY`.
 */
async function measureDrawerRows(
  drawer: Locator,
): Promise<{ first: DrawerRowGeometry; second: DrawerRowGeometry }> {
  const read = async (index: number): Promise<DrawerRowGeometry> => ({
    row: requireBox(
      await drawer.locator(`button[data-index="${index}"]`).boundingBox(),
      `la ligne ${index + 1} du tiroir`,
    ),
    plate: requireBox(
      await drawer.locator(`button[data-index="${index}"] article.exhibit`).first().boundingBox(),
      `la planche de la ligne ${index + 1}`,
    ),
  });

  return { first: await read(0), second: await read(1) };
}

test.describe('mobile — les lignes du tiroir contiennent leur planche', () => {
  // Un tiroir de 76 vh sur un écran de 844 px montre les premières lignes en
  // entier : la mesure ne dépend ni d'un défilement ni d'un rognage.
  test.use({ viewport: { width: 390, height: 844 } });

  test('mobile — deux planches du tiroir ne se recouvrent pas', async ({ page }) => {
    await page.goto('/tableau');
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();

    // Le compte E2E ne possède pas forcément les quatre catégories : un
    // emplacement peut ouvrir un tiroir vide. On parcourt les quatre jusqu'à en
    // trouver un qui propose au moins deux planches.
    const triggers = page.getByRole('button', { name: /Emplacement libre|^Modifier$/ });
    await expect(triggers.first()).toBeVisible();
    const slots = await triggers.count();

    let measured = false;
    for (let slot = 0; slot < slots && !measured; slot += 1) {
      await triggers.nth(slot).click();
      const drawer = page.getByRole('dialog');
      await expect(drawer).toBeVisible();

      const rows = drawer.locator('button[data-index]');
      // Un emplacement dont la catégorie manque au compte ouvre un tiroir vide :
      // ce n'est pas le défaut mesuré, on passe à l'emplacement suivant. Le
      // compte E2E gratte trois bordereaux, donc une catégorie au moins propose
      // plusieurs planches : la boucle finit toujours par mesurer.
      await expect(
        rows.first().or(drawer.getByText('Aucune carte éligible pour cet emplacement.')),
      ).toBeVisible();

      if ((await rows.count()) >= 2) {
        // Le virtualiseur mesure ses lignes après la première image : `toPass`
        // attend que le pas se soit aligné sur la mesure, sans attendre un délai.
        await expect(async () => {
          const { first, second } = await measureDrawerRows(drawer);

          expect(
            first.row.height,
            'La ligne du tiroir doit être plus haute que sa planche, sinon elle la laisse déborder.',
          ).toBeGreaterThanOrEqual(first.plate.height + 4);
          expect(second.row.height).toBeGreaterThanOrEqual(second.plate.height + 4);

          const pitch = second.row.y - first.row.y;
          expect(
            pitch,
            'Le pas du virtualiseur doit valoir la hauteur mesurée de la ligne.',
          ).toBeGreaterThanOrEqual(first.row.height);
          expect(
            first.plate.y + first.plate.height,
            'Deux planches du tiroir ne peuvent pas se recouvrir : la ligne doit être plus haute que sa planche.',
          ).toBeLessThanOrEqual(second.plate.y + 0.5);
          expect(pitch - first.plate.height).toBeGreaterThanOrEqual(4);
          expect(pitch - first.plate.height).toBeLessThanOrEqual(32);
          expect(first.row.height, 'La ligne reste une cible tactile.').toBeGreaterThanOrEqual(44);
        }).toPass({ timeout: 5_000 });

        measured = true;
      }

      await drawer.getByRole('button', { name: 'Fermer' }).click();
      await expect(drawer).toBeHidden();
    }

    expect(
      measured,
      'Aucun emplacement ne propose deux planches : le tiroir ne peut pas être mesuré.',
    ).toBe(true);
  });
});

/* ── 9. Salles secondaires (BUG-005) ─────────────────────────────────────── */

/**
 * Les salles secondaires suivies par le parcours mobile : chacune doit être
 * atteignable depuis Le Relevé, en deux appuis (le contrôle, puis le lien).
 */
const SECONDARY_ROOMS: ReadonlyArray<readonly [string, string]> = [
  ['Les Planches', '/tableaux'],
  ['Mes Offres', '/market/mine'],
];

const SECONDARY_LABELS: readonly string[] = ['Les Planches', 'Mes Offres'];

test('mobile — les salles secondaires sont atteintes en deux appuis', async ({ page }) => {
  for (const [label, path] of SECONDARY_ROOMS) {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();

    // Deux appuis exactement : le contrôle, puis le lien de la feuille.
    await openMoreSheet(page);
    const sheet = page.getByRole('dialog', { name: MORE_SHEET });
    await sheet.getByRole('link', { name: label }).click();

    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  }

  // Depuis « Le Relevé », les salles suivies sont offertes par la feuille.
  await page.goto('/');
  await openMoreSheet(page);
  const sheet = page.getByRole('dialog', { name: MORE_SHEET });
  for (const label of SECONDARY_LABELS) {
    await expect(sheet.getByRole('link', { name: label })).toBeVisible();
  }
});

test('mobile — la cible « Plus » fait au moins 44 px', async ({ page }) => {
  await page.goto('/');

  const plus = page.getByRole('button', { name: MORE_CONTROL, exact: true });
  await expect(plus).toBeVisible();

  const box = requireBox(await plus.boundingBox(), 'la cible « Plus »');
  expect(box.height, 'Cible tactile « Plus »').toBeGreaterThanOrEqual(44);
});

test('mobile — « Les Planches » ne s’allume pas sur La Planche', async ({ page }) => {
  await page.goto('/tableau');
  await openMoreSheet(page);
  const sheet = page.getByRole('dialog', { name: MORE_SHEET });

  // `/tableau` et `/tableaux` partagent un préfixe : seule l'égalité stricte de
  // `isNavItemActive` départage les deux salles.
  await expect(sheet.getByRole('link', { name: 'Les Planches' })).not.toHaveAttribute(
    'aria-current',
    'page',
  );

  await page.goto('/tableaux');
  await openMoreSheet(page);
  await expect(sheet.getByRole('link', { name: 'Les Planches' })).toHaveAttribute(
    'aria-current',
    'page',
  );
});

test("mobile — l'ancienne salle de l'Assemblage mène à L'Atlas", async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();

  await openMoreSheet(page);
  const sheet = page.getByRole('dialog', { name: MORE_SHEET });
  // Le libellé du lien appartient à `nav-items.ts` : la phase 35 ne le renomme
  // pas, elle rouvre seulement la salle qu'il annonçait.
  await sheet.getByRole('link', { name: "L'Assemblage" }).click();

  // `/assemblage` ne rend plus de teaser : la route redirige vers la salle réelle.
  await expect(page).toHaveURL(/\/atlas$/);
  await expect(page.getByRole('heading', { level: 1, name: "L'Atlas" })).toBeVisible();

  // La salle remplace le teaser : la table équivalente est là, et l'annonce
  // « Bientôt disponible » a disparu avec la salle qu'elle décrivait.
  await expect(page.getByRole('table', { name: 'Table équivalente de la carte' })).toBeVisible();
  await expect(page.getByText('Bientôt disponible')).toHaveCount(0);
});

test('mobile — la feuille se ferme par Échap et rend le focus', async ({ page }) => {
  await page.goto('/');
  await openMoreSheet(page);

  const sheet = page.getByRole('dialog', { name: MORE_SHEET });
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();

  // La sortie rend le focus au déclencheur, pas au document.
  await expect(page.getByRole('button', { name: MORE_CONTROL, exact: true })).toBeFocused();
});

test.describe('mobile — sans session', () => {
  // Aucun cookie, aucune origine : le cas n'emprunte pas la session déposée par
  // `global-setup.ts`.
  test.use({ storageState: { cookies: [], origins: [] } });

  test('mobile — sans session, aucune salle secondaire n’est offerte', async ({ page }) => {
    await page.goto('/');

    // Le rail cache toute sa navigation à un visiteur anonyme : la barre basse
    // ne doit pas lui offrir davantage.
    await expect(page.getByRole('button', { name: MORE_CONTROL, exact: true })).toHaveCount(0);
  });
});

/* ── 10. La Boutique retirée ────────────────────────────────────────────── */

test.describe('mobile — la boutique retirée', () => {
  // 390 px : la largeur de référence des cas de la phase 22.
  test.use({ viewport: { width: 390, height: 844 } });

  const BOUTIQUE_ROOM = 'La Boutique';

  test("mobile — la boutique n'est plus offerte ni atteignable", async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();

    // La feuille des salles secondaires ne porte plus l'entrée : le produit a
    // éteint la boutique (`SHOP_ENABLED = false`), la navigation la filtre.
    await openMoreSheet(page);
    const sheet = page.getByRole('dialog', { name: MORE_SHEET });
    await expect(sheet.getByRole('link', { name: BOUTIQUE_ROOM })).toHaveCount(0);

    // L'URL directe ne rend plus rien de la salle : la route lève `notFound()`.
    // On n'asserte pas le texte du 404 (il appartient au routeur), seulement
    // l'absence de l'interface commerciale.
    await page.goto('/boutique');
    await expect(page.getByRole('heading', { level: 1, name: BOUTIQUE_ROOM })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Acheter' })).toHaveCount(0);
    await expect(page.getByText("La boutique n'est pas encore ouverte.")).toHaveCount(0);
  });
});

/**
 * Phase 43 « La Sonnette » — le message doit correspondre au navigateur, jamais
 * à un bouton inerte.
 *
 * Le cas tourne sur les deux projets tactiles, et c'est voulu : un iPhone non
 * installé lit la marche à suivre d'iOS, un Android lit que le serveur a éteint
 * la sonnette (le banc n'a pas de paire VAPID). Chacun asserte **son** état réel ;
 * aucun cas n'est sauté, et la branche est décidée par l'agent utilisateur que le
 * navigateur s'attribue vraiment.
 */
test.describe('mobile — la Sonnette dit ce que le navigateur peut faire', () => {
  test('compte — la bascule suit le support réel', async ({ page }) => {
    await page.goto('/compte', { waitUntil: 'domcontentloaded' });

    const isIos = await page.evaluate(() => /iPad|iPhone|iPod/.test(navigator.userAgent));
    const state = page.locator('[data-push-state]');
    const toggle = page.getByRole('button', { name: 'Activer la Sonnette' });

    if (isIos) {
      // iOS 16.4+ **et** une PWA installée : le banc émule un iPhone non
      // installé, donc la marche à suivre doit être écrite, pas un bouton mort.
      await expect(state).toHaveAttribute('data-push-state', 'ios-requires-install');
      await expect(page.locator('[data-push-message="ios-install"]')).toContainText(
        'écran d’accueil',
      );
      await expect(page.locator('[data-push-message="ios-install"]')).toContainText('16.4');
      await expect(toggle).toHaveCount(0);
      return;
    }

    // Sans paire VAPID, le serveur éteint la sonnette : l'écran le dit, et
    // n'offre toujours pas de bouton qui ne ferait rien.
    await expect(state).toHaveAttribute('data-push-state', 'disabled');
    await expect(page.locator('[data-push-message="disabled"]')).toBeVisible();
    await expect(toggle).toHaveCount(0);
  });
});
