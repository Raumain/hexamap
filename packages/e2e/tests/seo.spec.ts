import { expect, test } from '@playwright/test';
import { noindexHead, publicHead, seoForPath } from '../../../apps/web/src/lib/seo';

// Phase 54 « Le fond SEO » — I-005 de `.docs/09-idees.md`.
//
// Trois choses se voient dans un vrai navigateur, et une quatrième se vérifie
// sans lui : le titre est propre à la page, la canonique désigne l'origine
// servie, une salle de jeu refuse l'indexation, et la table des métadonnées ne
// fige aucune origine. Un contrôle qui compile n'est pas un contrôle qui marche.

/** Une origine de test, choisie pour ne jamais ressembler à celle du dépôt. */
const TEST_ORIGIN = 'https://exemple.test';

test('I-005 — deux salles publiques portent des titres différents', async ({ page }) => {
  await page.goto('/rarete');
  const rareteTitle = await page.title();

  await page.goto('/mentions-legales');
  const legalTitle = await page.title();

  // La marque s'écrit de façon constante : c'est ce que Google associe à
  // l'entité, et I-005 en fait un point d'identité.
  expect(rareteTitle).toContain('Hexamap');
  expect(legalTitle).toContain('Hexamap');
  expect(rareteTitle).not.toBe(legalTitle);
});

test('I-005 — la racine porte une canonique absolue et unique', async ({ page }) => {
  await page.goto('/');

  const canonical = page.locator('link[rel="canonical"]');
  await expect(canonical, 'La racine doit désigner exactement une originale').toHaveCount(1);

  const href = await canonical.getAttribute('href');
  // L'origine est celle du déploiement interrogé, jamais une constante : le banc
  // tourne sous `https://hexamap.test`, pas sous `https://hexamap.fr`.
  expect(href).toBe(`${new URL(page.url()).origin}/`);
  expect(href).not.toContain('localhost');
});

test('I-005 — une salle derrière session porte noindex', async ({ page }) => {
  await page.goto('/collection');

  const robots = page.locator('meta[name="robots"]');
  await expect(robots).toHaveCount(1);
  await expect(robots).toHaveAttribute('content', /noindex/);

  // Une salle de jeu ne désigne aucune originale, et le balisage de la racine ne
  // doit pas laisser sa canonique derrière lui.
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
});

test('I-005 — la table des métadonnées ne fige aucune origine', () => {
  const publicPage = seoForPath('/rarete', TEST_ORIGIN);
  expect(publicPage?.robots).toContain('index');
  expect(publicPage?.canonical).toBe(`${TEST_ORIGIN}/rarete`);

  // Une salle privée refuse l'indexation et ne désigne aucune originale.
  const privatePage = seoForPath('/collection', TEST_ORIGIN);
  expect(privatePage?.robots).toContain('noindex');
  expect(privatePage?.canonical).toBeNull();

  // La vitrine nomme le joueur : sa route ne fixe donc rien elle-même.
  expect(seoForPath('/players/quelquun', TEST_ORIGIN)).toBeNull();

  // Un chemin inconnu ne s'indexe pas — une page introuvable n'a rien à vendre.
  expect(seoForPath('/inexistant', TEST_ORIGIN)?.robots).toContain('noindex');

  // Les deux aides prennent l'origine en paramètre : aucune URL absolue en dur.
  const descriptor = publicHead({
    title: 'Titre',
    description: 'Description',
    path: '/x',
    origin: TEST_ORIGIN,
  });
  expect(descriptor.canonical).toBe(`${TEST_ORIGIN}/x`);
  expect(noindexHead({ title: 'Titre' }).canonical).toBeNull();
});

test('I-005 — le sitemap est servi par l’API de production, sur l’origine publique', async ({
  request,
}) => {
  // La spécification tape `app.handle` en développement ; ce cas tape le
  // déploiement réel : l'API sert elle-même le SPA derrière Caddy, et
  // `/sitemap.xml` doit être une route — jamais le repli `index.html`.
  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.status()).toBe(200);
  expect(sitemap.headers()['content-type']).toContain('application/xml');

  const body = await sitemap.text();
  expect(body).toContain('<urlset');
  expect(body).toContain('<loc>https://hexamap.test/</loc>');
  expect(body).not.toContain('/api/');
  expect(body).not.toContain('http://localhost');

  const robots = await request.get('/robots.txt');
  expect(robots.status()).toBe(200);
  expect(robots.headers()['content-type']).toContain('text/plain');
  expect(await robots.text()).toContain('Sitemap: https://hexamap.test/sitemap.xml');
});

test('I-005 — index.html porte le JSON-LD de la marque', async ({ page }) => {
  await page.goto('/mentions-legales');

  // Le graphe est un fichier statique : le parseur du moteur le lit avant toute
  // exécution, et le navigateur le garde dans le DOM.
  const script = page.locator('script[type="application/ld+json"]');
  await expect(script).toHaveCount(1);

  const raw = await script.textContent();
  const graph = JSON.parse(raw ?? 'null') as {
    '@context'?: string;
    '@graph'?: { '@type'?: string; name?: string }[];
  };

  expect(graph['@context']).toBe('https://schema.org');
  const types = (graph['@graph'] ?? []).map((node) => node['@type']);
  expect(types).toContain('Organization');
  expect(types).toContain('WebSite');
});
