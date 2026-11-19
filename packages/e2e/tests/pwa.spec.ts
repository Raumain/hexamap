import { expect, type Page, test } from '@playwright/test';

// Phase 19 « L'Installation vérifiée » — la couche PWA du banc e2e.
//
// Ce fichier n'est joué que par le projet `pwa` : `playwright.config.ts`
// l'exclut du projet `chromium`, qui continue de jouer les seuls parcours de
// bureau. Le banc sert `https://hexamap.test` derrière Caddy, parce qu'un
// service worker ne s'enregistre que dans un contexte sécurisé.

/**
 * Amorce le worker : il s'active dès l'installation (`skipWaiting: false` n'a
 * rien à attendre au premier passage), mais `clientsClaim: false` fait qu'il ne
 * contrôle PAS le document courant. Sans le rechargement, `controller` reste nul
 * et aucun cas hors ligne ne prouve quoi que ce soit.
 */
async function warmWorker(page: Page): Promise<void> {
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const registration = await navigator.serviceWorker.ready;
          return registration.active?.scriptURL ?? null;
        }),
      { timeout: 30_000 },
    )
    .toMatch(/\/sw\.js$/);

  await page.reload({ waitUntil: 'domcontentloaded' });

  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? null), {
      timeout: 30_000,
    })
    .toMatch(/\/sw\.js$/);
}

/** Toutes les caches du contexte et les URL de leurs entrées. */
async function readCaches(page: Page): Promise<Record<string, string[]>> {
  return page.evaluate(async () => {
    const names = await caches.keys();
    const entries: Record<string, string[]> = {};
    for (const name of names) {
      const cache = await caches.open(name);
      const requests = await cache.keys();
      entries[name] = requests.map((request) => request.url);
    }
    return entries;
  });
}

/**
 * Les entrées de précache portent `?__WB_REVISION__=…` : comparer les URL
 * brutes ne dirait rien de l'extension réelle du fichier.
 */
function withoutRevision(url: string): string {
  const marker = url.indexOf('?__WB_REVISION__');
  return marker === -1 ? url : url.slice(0, marker);
}

interface WebManifestIcon {
  sizes?: string;
  purpose?: string;
  type?: string;
}

interface WebManifest {
  name?: string;
  short_name?: string;
  display?: string;
  start_url?: string;
  scope?: string;
  lang?: string;
  theme_color?: string;
  icons?: WebManifestIcon[];
}

/* ── 1. Manifeste ────────────────────────────────────────────────────────── */

test('installation — le manifeste est conforme', async ({ page }) => {
  const response = await page.request.get('/manifest.webmanifest');

  expect(response.status()).toBe(200);
  expect(response.headers()['content-type'] ?? '').toContain('application/manifest+json');

  const manifest: WebManifest = JSON.parse(await response.text());

  expect(manifest.name, 'Le nom de l’application est déclaré').toBeTruthy();
  expect(manifest.short_name, 'Le nom court est déclaré').toBeTruthy();
  expect(manifest.display).toBe('standalone');
  expect(manifest.start_url).toBe('/');
  expect(manifest.scope).toBe('/');
  expect(manifest.lang).toBe('fr');
  expect(manifest.theme_color).toBe('#0c1210');

  const icons = manifest.icons ?? [];
  expect(icons.length).toBeGreaterThan(0);

  const sizes = icons.map((icon) => icon.sizes ?? '');
  expect(sizes, 'Icône 192 × 192').toContain('192x192');
  expect(sizes, 'Icône 512 × 512').toContain('512x512');

  const purposes = icons.map((icon) => icon.purpose ?? '');
  expect(
    purposes.some((purpose) => purpose.includes('maskable')),
    'Une icône maskable est déclarée',
  ).toBe(true);

  await page.goto('/', { waitUntil: 'domcontentloaded' });

  await expect(page.locator('link[rel="manifest"]')).toHaveCount(1);

  const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
  expect(viewport, 'Le viewport couvre les zones sûres').toContain('viewport-fit=cover');
});

/* ── 2. Installation du worker ───────────────────────────────────────────── */

test('installation — le worker s’installe et contrôle', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  // La raison d'être du banc HTTPS : hors contexte sécurisé, le navigateur
  // n'expose même pas `navigator.serviceWorker`.
  expect(await page.evaluate(() => window.isSecureContext)).toBe(true);

  // `clientsClaim: false` : le tout premier chargement n'est pas contrôlé.
  expect(await page.evaluate(() => navigator.serviceWorker.controller)).toBeNull();

  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const registration = await navigator.serviceWorker.ready;
          return registration.active?.scriptURL ?? null;
        }),
      { timeout: 30_000 },
    )
    .toMatch(/\/sw\.js$/);

  await page.reload({ waitUntil: 'domcontentloaded' });

  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? null), {
      timeout: 30_000,
    })
    .toMatch(/\/sw\.js$/);

  // Première installation : aucune mise à jour à proposer.
  await expect(page.getByText('Nouvelle version disponible')).toHaveCount(0);
});

/* ── 3. Précache de la coquille ──────────────────────────────────────────── */

test('installation — la coquille est précachée', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  // Le précache est rempli pendant l'installation : `ready` suffit, aucun
  // rechargement n'est nécessaire.
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const registration = await navigator.serviceWorker.ready;
          return registration.active?.scriptURL ?? null;
        }),
      { timeout: 30_000 },
    )
    .toMatch(/\/sw\.js$/);

  const snapshot = await readCaches(page);
  const precacheNames = Object.keys(snapshot).filter((name) => name.includes('workbox-precache'));

  expect(precacheNames.length, 'Une cache de précache existe').toBeGreaterThan(0);

  const urls = precacheNames.flatMap((name) => snapshot[name] ?? []).map(withoutRevision);

  expect(
    urls.some((url) => url.endsWith('/index.html')),
    'La coquille est précachée',
  ).toBe(true);
  expect(
    urls.some((url) => url.endsWith('.js')),
    'Le bundle est précaché',
  ).toBe(true);
  expect(
    urls.some((url) => url.endsWith('.css')),
    'La feuille de style est précachée',
  ).toBe(true);
  expect(
    urls.some((url) => url.endsWith('.woff2')),
    'Les polices sont précachées',
  ).toBe(true);
});

/* ── 4. Aucun appel d'API depuis la cache ────────────────────────────────── */

test('installation — les appels d’API ne viennent jamais du cache', async ({ page }) => {
  await warmWorker(page);

  // D'abord la preuve qu'il existe une réponse qu'une cache naïve aurait pu
  // servir : hors ligne, l'absence de cache est indiscernable d'une panne.
  const health = await page.request.get('/api/v1/health');
  expect(health.status()).toBe(200);

  await page.context().setOffline(true);
  try {
    const outcome = await page.evaluate(async () => {
      try {
        const res = await fetch('/api/v1/health');
        return `statut:${res.status}`;
      } catch {
        return 'erreur-réseau';
      }
    });

    expect(outcome).toBe('erreur-réseau');
  } finally {
    await page.context().setOffline(false);
  }

  // Complément statique : le runtime ne peut échantillonner que GET. Les quatre
  // autres méthodes sont prouvées par le worker généré ; ce couplage à la
  // sortie de Workbox est accepté et localisé ici.
  const workerResponse = await page.request.get('/sw.js');
  expect(workerResponse.status()).toBe(200);

  const workerSource = await workerResponse.text();

  // Le worker généré est minifié : la classe Workbox y est aliasée et l'appel
  // sans argument perd ses parenthèses (`new s.NetworkOnly,"GET"`), donc le
  // motif tolère le préfixe du module et une liste d'arguments vide.
  const networkOnly = workerSource.match(/new\s+[\w$]*\.?NetworkOnly\b/g) ?? [];
  expect(
    networkOnly.length,
    'Une route NetworkOnly par méthode HTTP, sur /api/',
  ).toBeGreaterThanOrEqual(5);

  // Et ces cinq routes couvrent réellement les cinq méthodes : une entrée
  // Workbox ne s'applique qu'à une méthode.
  const methods = [...workerSource.matchAll(/NetworkOnly\b\)?,\s*"([A-Z]+)"/g)]
    .map((match) => match[1])
    .sort();
  expect(methods, 'Les cinq méthodes HTTP sont couvertes').toEqual([
    'DELETE',
    'GET',
    'PATCH',
    'POST',
    'PUT',
  ]);
});

/* ── 5. Repli de navigation hors ligne ───────────────────────────────────── */

test('installation — un lien profond hors ligne retombe sur la coquille', async ({ page }) => {
  await warmWorker(page);

  await page.context().setOffline(true);
  try {
    // On vérifie la coquille, jamais la salle : la requête de session échoue
    // hors ligne et la salle peut rediriger vers Le Seuil.
    const response = await page.goto('/collection', { waitUntil: 'domcontentloaded' });

    expect(response?.status()).toBe(200);
    await expect(page.locator('#root')).not.toBeEmpty();
    await expect(page).toHaveTitle(/Hexamap/);
    await expect(page.getByText('Cabinet de cartographie').first()).toBeVisible();
  } finally {
    await page.context().setOffline(false);
  }
});

/* ── 6. Aucun appel d'API dans une cache ─────────────────────────────────── */

test('installation — aucun appel d’API n’est mis en cache', async ({ page }) => {
  await warmWorker(page);

  const snapshot = await readCaches(page);
  expect(Object.keys(snapshot).length, 'Au moins une cache existe').toBeGreaterThan(0);

  // La boucle couvre toutes les caches, y compris celle des blasons, qui est une
  // StaleWhileRevalidate d'images statiques : elle ne doit pas être devenue une
  // porte dérobée vers l'API.
  for (const [name, urls] of Object.entries(snapshot)) {
    const offending = urls.filter((url) => url.includes('/api/'));
    expect(offending, `Cache ${name}`).toHaveLength(0);
  }
});

/* ── 7. Zones sûres ──────────────────────────────────────────────────────── */

test('installation — les marges de zone sûre sont appliquées', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  // Assertion STRUCTURELLE, pas une mesure : sous Playwright, Chrome résout
  // toujours `env(safe-area-inset-*)` à 0, si bien qu'un `padding-bottom` mesuré
  // vaudrait 0 sur un appareil à encoche comme sur un bureau. On vérifie donc
  // que les déclarations survivent à la compilation.
  const cssText = await page.evaluate(() => {
    const parts: string[] = [];

    const walk = (rules: CSSRuleList): void => {
      for (const rule of Array.from(rules)) {
        parts.push(rule.cssText);
        const grouping = rule as CSSGroupingRule;
        if (grouping.cssRules !== undefined) walk(grouping.cssRules);
      }
    };

    for (const sheet of Array.from(document.styleSheets)) {
      let rules: CSSRuleList;
      try {
        rules = sheet.cssRules;
      } catch {
        // Feuille d'une autre origine : elle ne porte aucun jeton du cabinet.
        continue;
      }
      walk(rules);
    }

    return parts.join('\n');
  });

  expect(cssText, 'La marge haute de zone sûre est compilée').toContain('safe-area-inset-top');
  expect(cssText, 'La marge basse de zone sûre est compilée').toContain('safe-area-inset-bottom');

  const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
  expect(viewport, 'Le viewport couvre les zones sûres').toContain('viewport-fit=cover');
});
