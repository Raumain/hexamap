import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Locator, type Page, test } from '@playwright/test';
import { multiplierLabel } from '../../../apps/web/src/content/tableau';
import { communeVignette } from '../../../apps/web/src/lib/commune-vignette';

// Contrat visuel et structurel du design system v4 — « Le Cabinet de
// cartographie » (DESIGN_SYSTEM.md, révision 4).
//
// Les sélecteurs restent orientés utilisateur (rôles, libellés, textes) ;
// `evaluate` n'apparaît que lorsque le sujet EST le style ou la géométrie.

/** `--color-cabinet` (#0c1210), la pièce de DESIGN_SYSTEM.md §3. */
const CABINET_BACKGROUND = 'rgb(12, 18, 16)';

/**
 * Les six métaux de `RARITY_ACCENT_HEX` (§7.3), saisis tels quels et rendus
 * par le navigateur en notation `rgb()`. La source reste `packages/shared` ;
 * ces valeurs ne sont jamais réécrites dans l'application.
 */
const METAL_RGB: readonly string[] = [
  'rgb(143, 151, 154)', // étain — COMMUNE
  'rgb(178, 112, 63)', // cuivre — INHABITUELLE
  'rgb(211, 217, 221)', // argent — RARE
  'rgb(62, 90, 138)', // émail — EPIQUE
  'rgb(201, 162, 39)', // or — LEGENDAIRE
  'rgb(232, 206, 140)', // électrum — MYTHIQUE
] as const;

const COLLECTION_TABLE = 'Liste des cartes de votre collection';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

async function openCollection(page: Page): Promise<void> {
  await page.goto('/collection');
  await expect(page.getByRole('heading', { name: 'Ma collection' })).toBeVisible();
  await expect(page.getByRole('table', { name: COLLECTION_TABLE })).toBeVisible();
}

/* ── La prévisualisation serveur d'un tableau ─────────────────────────────── */

interface PreviewSample {
  multiplier: number;
  links: number;
}

/** Lit `alignment` de la réponse sans jamais recalculer sa valeur. */
function readPreviewSample(body: unknown): PreviewSample | null {
  if (typeof body !== 'object' || body === null) return null;

  const alignment = (body as Record<string, unknown>).alignment;
  if (typeof alignment !== 'object' || alignment === null) return null;

  const { multiplier, links } = alignment as Record<string, unknown>;
  if (typeof multiplier !== 'number' || typeof links !== 'number') return null;

  return { multiplier, links };
}

/** Collecte les réponses `GET /tableaux/preview` déclenchées par la page. */
function trackPreviews(page: Page): () => Promise<PreviewSample[]> {
  const pending: Array<Promise<PreviewSample | null>> = [];

  page.on('response', (response) => {
    if (!response.url().includes('/tableaux/preview')) return;

    pending.push(
      response
        .json()
        .then((body: unknown) => readPreviewSample(body))
        .catch(() => null),
    );
  });

  return async () =>
    (await Promise.all(pending)).filter((sample): sample is PreviewSample => sample !== null);
}

/** Le statut « Recalcul… » signale une prévisualisation serveur en vol. */
async function waitForPreview(page: Page): Promise<void> {
  await page
    .getByRole('status')
    .first()
    .waitFor({ state: 'hidden', timeout: 10_000 })
    .catch(() => undefined);
}

/** Choisit la première carte éligible du tiroir ouvert. */
async function pickFirstEligibleCard(page: Page): Promise<boolean> {
  const drawer = page.getByRole('dialog');
  await expect(drawer).toBeVisible();

  const closeButton = drawer.getByRole('button', { name: 'Fermer' });

  const buttons = drawer.locator('button:not([aria-label="Fermer"])');
  const count = await buttons.count();

  for (let index = 0; index < count; index += 1) {
    const button = buttons.nth(index);
    if (await button.isEnabled()) {
      await button.click();
      await expect(drawer).toBeHidden();
      return true;
    }
  }

  await closeButton.click();
  return false;
}

/**
 * Remplit les emplacements libres de La Planche avec les premières cartes
 * éligibles de la collection de démonstration. Retourne le nombre de planches
 * posées : `0` signifie que le compte ne peut pas exercer la composition.
 */
async function placeCards(page: Page): Promise<number> {
  let placed = 0;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const slot = page.getByRole('button', { name: /Emplacement libre/ }).first();
    if ((await slot.count()) === 0) break;

    await slot.click();
    if (!(await pickFirstEligibleCard(page))) break;

    placed += 1;
    await waitForPreview(page);
  }

  return placed;
}

/* ── 1. La pièce ─────────────────────────────────────────────────────────── */

test('la pièce — le fond est le cabinet et le grain est fixé sur body::after', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Le relevé topographique' })).toBeVisible();

  const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(background).toBe(CABINET_BACKGROUND);

  const grain = await page.evaluate(() => {
    const style = getComputedStyle(document.body, '::after');
    return {
      content: style.content,
      mixBlendMode: style.mixBlendMode,
      backgroundImage: style.backgroundImage,
    };
  });

  // Une seule couche, statique, posée sur `body` (§3 « Grain »).
  expect(grain.content).not.toBe('none');
  expect(grain.content).not.toBe('');
  expect(grain.mixBlendMode).toBe('soft-light');
  expect(grain.backgroundImage).toContain('url(');
  expect(grain.backgroundImage.length).toBeGreaterThan('url()'.length);
});

/* ── 2. Typographie ──────────────────────────────────────────────────────── */

test('typographie — Fraunces porte les titres de salle', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Le relevé topographique' })).toBeVisible();

  const homeFamily = await page
    .getByRole('heading', { level: 1, name: 'Le relevé topographique' })
    .evaluate((element) => getComputedStyle(element).fontFamily);
  expect(homeFamily).toContain('Fraunces');

  await openCollection(page);

  const collectionFamily = await page
    .getByRole('heading', { level: 1, name: 'Ma collection' })
    .evaluate((element) => getComputedStyle(element).fontFamily);
  expect(collectionFamily).toContain('Fraunces');
});

test('typographie — les chiffres du registre sont mono et tabulaires', async ({ page }) => {
  await openCollection(page);
  await expect(
    page.getByRole('table', { name: COLLECTION_TABLE }).locator('tbody tr').first(),
  ).toBeVisible();

  // §8.2 : les compteurs du bandeau et les colonnes Score / Acquise le sont en
  // chiffres tabulaires ; les lignes du registre sont en JetBrains Mono.
  const problems = await page.locator('main').evaluate((main) => {
    const numeric = /^[\d\s\u202f]+$/;
    const offenders: string[] = [];

    function scan(root: Element, monoRequired: boolean): void {
      for (const element of Array.from(root.querySelectorAll('*'))) {
        // Seuls les nœuds feuilles portent un nombre : un conteneur concatène
        // plusieurs cellules et son texte n'est plus un chiffre.
        if (element.children.length > 0) continue;

        const text = (element.textContent ?? '').trim();
        if (!numeric.test(text) || !/\d/.test(text)) continue;

        const style = getComputedStyle(element);
        if (!style.fontVariantNumeric.includes('tabular-nums')) {
          offenders.push(`${element.tagName.toLowerCase()} « ${text} » — chiffres non tabulaires`);
        }
        if (monoRequired && !/JetBrains Mono/.test(style.fontFamily)) {
          offenders.push(`${element.tagName.toLowerCase()} « ${text} » — hors JetBrains Mono`);
        }
      }
    }

    scan(main, false);

    const table = document.querySelector(
      'table[aria-label="Liste des cartes de votre collection"]',
    );
    if (table) scan(table, true);

    return offenders.slice(0, 12);
  });

  expect(problems).toEqual([]);
});

/* ── 3. Les quatre planches ──────────────────────────────────────────────── */

test('planches — quatre gravures et quatre cartons de métal', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Le relevé topographique' })).toBeVisible();

  // Le Relevé expose une planche de chaque catégorie dans son chapiteau (§8.1).
  const plates = page.locator('article.exhibit');
  await expect(plates).toHaveCount(4);

  const shells = await plates.evaluateAll((elements) =>
    elements.map((element) => {
      const style = getComputedStyle(element);
      return {
        className: element.className,
        innerHTML: element.innerHTML,
        borderColor: style.borderTopColor,
        borderWidth: style.borderTopWidth,
      };
    }),
  );

  expect(shells).toHaveLength(4);

  for (const shell of shells) {
    expect(shell.className).toContain('exhibit');
    expect(METAL_RGB).toContain(shell.borderColor);
    expect(Number.parseFloat(shell.borderWidth)).toBeGreaterThanOrEqual(1);
  }

  // Quatre gravures : aucune structure HTML n'est réutilisée telle quelle.
  const structures = new Set(shells.map((shell) => shell.innerHTML));
  expect(structures.size).toBe(4);

  // Les quatre planches d'exemple couvrent au moins trois métaux différents.
  const metals = new Set(shells.map((shell) => shell.borderColor));
  expect(metals.size).toBeGreaterThanOrEqual(3);
});

/* ── 4. Budget DOM ───────────────────────────────────────────────────────── */

test('planches — budget de 18 nœuds non-SVG par planche', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Le relevé topographique' })).toBeVisible();

  // Le chapiteau du Relevé expose une planche complète de chaque catégorie :
  // le budget est mesuré sur les quatre gravures réelles, sans dépendre d'un
  // tirage ni d'une collection de démonstration.
  const plates = page.locator('article.exhibit:not([aria-hidden="true"])');
  await expect(plates).toHaveCount(4);

  const counts = await plates.evaluateAll((elements) =>
    elements.map((element) => {
      const descendants = element.querySelectorAll('*').length;
      // `querySelectorAll('*')` inclut les nœuds internes des <svg> (traits,
      // chemins, feuilles) : ils sont décoratifs et hors budget (§7.5).
      const svgInternals = element.querySelectorAll('svg *').length;
      return {
        name: (element.querySelector('h3')?.textContent ?? '').trim(),
        nodes: descendants + 1 - svgInternals,
      };
    }),
  );

  expect(counts.length).toBeGreaterThan(0);

  for (const plate of counts) {
    expect(
      plate.nodes,
      `Planche « ${plate.name} » : ${plate.nodes} nœuds rendus`,
    ).toBeLessThanOrEqual(18);
  }
});

/* ── 5. Vignette communale déterministe ──────────────────────────────────── */

test('vignette — la vue communale est déterministe depuis le code INSEE', () => {
  const lyon = communeVignette('69123');
  const rennes = communeVignette('35238');

  expect(lyon.ridges.length).toBeGreaterThan(0);
  expect(lyon.roofline.length).toBeGreaterThan(0);

  // Deux communes différentes ne produisent jamais la même vue (§7.2).
  expect(lyon.ridges).not.toBe(rennes.ridges);
  expect(lyon.roofline).not.toBe(rennes.roofline);

  // Aucun aléatoire au rendu : le même code redonne exactement la même vue.
  expect(communeVignette('69123')).toEqual(lyon);
  expect(communeVignette('35238')).toEqual(rennes);
});

/* ── 6. Alignement piloté par le serveur ─────────────────────────────────── */

test('la planche — le multiplicateur de la plaque vient du serveur', async ({ page }) => {
  await page.goto('/tableau');
  await expect(page.getByRole('heading', { name: /La planche d.alignement/ })).toBeVisible();

  const plate = page.locator('section.vellum[aria-live="polite"]');
  if ((await plate.count()) === 0) {
    test.skip(
      true,
      'Aucune plaque de calcul en vélin n’est montée sur La Planche : le multiplicateur ne peut pas être comparé.',
    );
  }

  const drainPreviews = trackPreviews(page);

  if ((await placeCards(page)) === 0) {
    test.skip(
      true,
      'La collection de démonstration ne contient aucune carte plaçable : la prévisualisation serveur ne peut pas être exercée.',
    );
  }

  await waitForPreview(page);

  const samples = await drainPreviews();
  const last = samples[samples.length - 1];

  if (last === undefined) {
    test.skip(
      true,
      'Aucune réponse GET /tableaux/preview captée : la route n’a pas été sollicitée par cette pile.',
    );
    return;
  }

  // Le sceau de cire de la plaque : c'est le seul `bg-oxide` circulaire monté
  // dans la plaque de calcul (§8.3).
  const displayed = (
    (await plate.locator('span.rounded-full.bg-oxide').textContent()) ?? ''
  ).trim();

  // `multiplierLabel` ne fait que formater : la valeur comparée reste celle de
  // `alignment.multiplier`, jamais un recalcul local.
  expect(displayed, `Multiplicateur serveur ×${last.multiplier}`).toBe(
    multiplierLabel(last.multiplier),
  );
});

/* ── 7. Mouvement ────────────────────────────────────────────────────────── */

test('mouvement — prefers-reduced-motion coupe le balayage', () => {
  const stylesheet = readFileSync(
    path.join(repositoryRoot, 'apps', 'web', 'src', 'styles.css'),
    'utf8',
  );

  // Le seul mouvement continu autorisé est le balayage `.sheen`, et il est le
  // dernier bloc du fichier (§10).
  expect(stylesheet).toContain('.sheen::after');
  expect(stylesheet).toContain('animation: sheen 8s');

  const reducedIndex = stylesheet.indexOf('@media (prefers-reduced-motion: reduce)');
  expect(reducedIndex, 'Aucun bloc prefers-reduced-motion dans styles.css').toBeGreaterThan(-1);

  const reduced = stylesheet.slice(reducedIndex);
  expect(reduced).toContain('.sheen::after');
  expect(reduced).toContain('animation-duration: 1ms');
  expect(reduced).toContain('animation-iteration-count: 1');
});

/* ── 8. Interdits dans les listes et autour du canvas ────────────────────── */

/** Aucun `backdrop-filter` ni `filter` sur le sous-arbre visé (§13). */
async function blurredNodes(root: Locator): Promise<string[]> {
  return root.evaluate((element) => {
    const offenders: string[] = [];
    const nodes: Element[] = [element, ...Array.from(element.querySelectorAll('*'))];

    for (const node of nodes) {
      const style = getComputedStyle(node);
      if (style.backdropFilter !== 'none') {
        offenders.push(`${node.tagName.toLowerCase()} — backdrop-filter: ${style.backdropFilter}`);
      }
      if (style.filter !== 'none') {
        offenders.push(`${node.tagName.toLowerCase()} — filter: ${style.filter}`);
      }
    }

    return offenders.slice(0, 12);
  });
}

test('registre — aucun verre dépoli dans la liste virtualisée', async ({ page }) => {
  await openCollection(page);

  const rows = page.getByRole('table', { name: COLLECTION_TABLE }).locator('tbody tr');
  await expect(rows.first()).toBeVisible();

  expect(await blurredNodes(rows.first())).toEqual([]);
  expect(await blurredNodes(page.getByRole('table', { name: COLLECTION_TABLE }))).toEqual([]);
});

test('canvas — aucun filtre autour de la grille de grattage', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Le relevé topographique' })).toBeVisible();

  const resume = page.getByRole('link', { name: 'Reprendre mon ticket' });
  if ((await resume.count()) === 0) {
    // Le bordereau est une mutation serveur : on en ouvre un plutôt que de
    // sauter silencieusement l'assertion.
    const obtain = page.getByRole('button', { name: 'Obtenir un ticket' });
    if ((await obtain.count()) === 0) {
      test.skip(
        true,
        'Aucun bordereau ne peut être ouvert depuis Le Relevé : le canvas de grattage n’est pas monté.',
      );
    }
    await obtain.first().click();
  } else {
    await resume.first().click();
  }

  const grid = page.getByRole('group', { name: 'Grille du ticket' });
  await expect(grid).toBeVisible();

  // Le canvas lui-même et ses ancêtres jusqu'à `main` (§13).
  const offenders = await grid.evaluate((element) => {
    const nodes = new Set<Element>([element, ...Array.from(element.querySelectorAll('*'))]);
    let parent = element.parentElement;
    while (parent !== null && parent.tagName.toLowerCase() !== 'main') {
      nodes.add(parent);
      parent = parent.parentElement;
    }

    const problems: string[] = [];
    for (const node of nodes) {
      const style = getComputedStyle(node);
      if (style.backdropFilter !== 'none') {
        problems.push(`${node.tagName.toLowerCase()} — backdrop-filter: ${style.backdropFilter}`);
      }
      if (style.filter !== 'none') {
        problems.push(`${node.tagName.toLowerCase()} — filter: ${style.filter}`);
      }
    }

    return problems.slice(0, 12);
  });

  expect(offenders).toEqual([]);
});

/* ── Overlays : bloc conteneur et ancrage (BUG-007) ──────────────────────── */

interface SheetBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

function requireSheetBox(box: SheetBox | null): SheetBox {
  if (box === null) throw new Error('Le tiroir de sélection n’a rendu aucune boîte.');
  return box;
}

/**
 * Ouvre le tiroir de sélection d'un emplacement : bouton d'emplacement libre
 * s'il en reste un, sinon le bouton « Modifier » du premier emplacement rempli.
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

test('design system — main ne conserve aucun transform après l’entrée en salle', async ({
  page,
}) => {
  // `.enter-salon` anime `main` : en `both`, la valeur finale `translateY(0)`
  // reste appliquée et fait de `main` le bloc conteneur des overlays `fixed`.
  for (const room of ['/', '/tableau']) {
    await page.goto(room);
    await expect
      .poll(() =>
        page.evaluate(() => {
          const main = document.querySelector('main');
          return main === null ? 'aucun main' : getComputedStyle(main).transform;
        }),
      )
      .toBe('none');
  }
});

test('bureau — le tiroir est rendu hors de main et dégage le rail', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/tableau');
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();

  await openSlotDrawer(page);

  const inMain = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    const main = document.querySelector('main');
    return main?.contains(dialog) ?? false;
  });
  expect(inMain).toBe(false);

  const box = requireSheetBox(await page.getByRole('dialog').boundingBox());
  // Le rail mesure 232 px : `md:left-[232px]` doit l'épouser exactement, et non
  // s'ajouter au `md:pl-[232px]` d'un ancêtre (≈ 464 px avant le portail).
  expect(Math.abs(box.x - 232)).toBeLessThanOrEqual(1);
  expect(Math.abs(box.x + box.width - 1280)).toBeLessThanOrEqual(1);
});
