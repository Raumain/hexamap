import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { app } from '@hexamap/api/app';
import { env } from '@hexamap/api/env';
import { createDb, runMigrations } from '@hexamap/db';

// Le sitemap est construit depuis le contenu public **réel** : il faut donc une
// base, deux comptes et leurs réglages de vitrine. Même patron que
// `profile.spec.ts` — `DATABASE_URL` désigne la base de test posée par
// `ci:check`.
const db = createDb(process.env.DATABASE_URL ?? '');

const prefix = crypto.randomUUID().slice(0, 8);
const publicId = `${prefix}-public`;
const privateId = `${prefix}-private`;
const createdUserIds = [publicId, privateId];

// L'origine canonique vient de `PUBLIC_ORIGIN` : la spécification ne la réécrit
// jamais, sans quoi elle prouverait une valeur que la production n'utilise pas.
const origin = env.PUBLIC_ORIGIN;

const request = (path: string) => app.handle(new Request(`http://localhost${path}`));

async function seedUser(id: string, pseudo: string): Promise<void> {
  const now = new Date();
  await db
    .insertInto('user')
    .values({
      id,
      name: pseudo,
      email: `${id}@hexamap.test`,
      emailVerified: false,
      image: null,
      createdAt: now,
      updatedAt: now,
      pseudo,
      currency: null,
    })
    .execute();
}

describe('I-005 — le fond SEO servi par l’API', () => {
  beforeAll(async () => {
    await runMigrations(db);
    await seedUser(publicId, `Vitrine${prefix}`);
    await seedUser(privateId, `Privee${prefix}`);

    await db
      .insertInto('user_profiles')
      .values([
        { user_id: publicId, bio: null, profile_public: true },
        { user_id: privateId, bio: null, profile_public: false },
      ])
      .execute();
  });

  afterAll(async () => {
    // Les profils avant les comptes : la clé étrangère est en cascade, mais
    // l'ordre explicite garde le nettoyage lisible.
    await db.deleteFrom('user_profiles').where('user_id', 'in', createdUserIds).execute();
    await db.deleteFrom('user').where('id', 'in', createdUserIds).execute();
  });

  it('sert un robots.txt qui renvoie au sitemap absolu', async () => {
    const response = await request('/robots.txt');
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/plain');
    expect(response.headers.get('cache-control')).toContain('public');
    expect(response.headers.get('cache-control')).toContain('max-age=3600');

    const sitemapLine = body
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.startsWith('Sitemap:'));

    expect(sitemapLine, 'robots.txt doit porter une ligne Sitemap:').toBeDefined();
    // Une ligne `Sitemap:` relative n'est lue par aucun moteur : elle doit être
    // une URL absolue sur l'origine publique.
    expect(sitemapLine).toBe(`Sitemap: ${origin}/sitemap.xml`);
    expect(sitemapLine).toStartWith('Sitemap: http');
  });

  it('sert un sitemap.xml qui liste la racine et la vitrine publique', async () => {
    const response = await request('/sitemap.xml');
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/xml');
    expect(response.headers.get('cache-control')).toContain('max-age=3600');

    expect(body).toStartWith('<?xml version="1.0" encoding="UTF-8"?>');
    expect(body).toContain('<urlset');
    expect(body).toContain('http://www.sitemaps.org/schemas/sitemap/0.9');

    // La racine et les pages publiques fixes.
    expect(body).toContain(`<loc>${origin}/</loc>`);
    expect(body).toContain(`<loc>${origin}/rarete</loc>`);
    expect(body).toContain(`<loc>${origin}/mentions-legales</loc>`);
    expect(body).toContain(`<loc>${origin}/confidentialite</loc>`);

    // La vitrine publique est le vrai gisement : elle vient de la base, pas
    // d'une liste écrite à la main.
    expect(body).toContain(`<loc>${origin}/players/${publicId}</loc>`);
  });

  it('I-005 — une vitrine privée n’entre jamais dans le sitemap', async () => {
    const response = await request('/sitemap.xml');
    const body = await response.text();

    // §2.9 : une vitrine privée répond 404, donc l'annoncer dans le sitemap
    // serait promettre une page que le serveur refuse.
    expect(body).not.toContain(privateId);
  });

  it('I-005 — le sitemap n’expose aucune URL d’API', async () => {
    const response = await request('/sitemap.xml');
    const body = await response.text();

    // Le sitemap décrit des pages, pas des ressources : `/api/` n'y a rien à
    // faire, et une entrée de ce type ferait crawler des réponses JSON.
    expect(body).not.toContain('/api/');
    expect(body).not.toContain('/blasons/');
  });

  it('I-005 — le sitemap reste valide quand aucune vitrine n’est publique', async () => {
    // Le cas est produit par la donnée : on retire les réglages des deux
    // comptes, puis on les rétablit. Une liste de vitrines vide ne doit pas
    // casser le document — une base neuve est exactement dans cet état.
    await db.deleteFrom('user_profiles').where('user_id', 'in', createdUserIds).execute();

    try {
      const response = await request('/sitemap.xml');
      const body = await response.text();

      expect(response.status).toBe(200);
      expect(body).toContain(`<loc>${origin}/</loc>`);
      expect(body).not.toContain(`<loc>${origin}/players/${publicId}</loc>`);
      // Le document reste refermé : une dégradation n'est pas une troncature.
      expect(body.trimEnd()).toEndWith('</urlset>');
    } finally {
      await db
        .insertInto('user_profiles')
        .values([
          { user_id: publicId, bio: null, profile_public: true },
          { user_id: privateId, bio: null, profile_public: false },
        ])
        .execute();
    }
  });

  // Le JSON-LD est un fichier statique : le parseur du moteur le lit avant toute
  // exécution, donc le cas lit le fichier lui-même plutôt que le DOM.
  it('I-005 — index.html porte un JSON-LD Organization/WebSite valide', async () => {
    const html = await Bun.file(new URL('../../../apps/web/index.html', import.meta.url)).text();

    const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    expect(match, 'index.html doit porter un script application/ld+json').not.toBeNull();

    const graph = JSON.parse(match?.[1] ?? 'null') as {
      '@context'?: string;
      '@graph'?: { '@type'?: string; name?: string }[];
    };

    expect(graph['@context']).toBe('https://schema.org');
    const nodes = graph['@graph'] ?? [];
    expect(nodes.length).toBeGreaterThanOrEqual(2);

    const types = nodes.map((node) => node['@type']);
    expect(types).toContain('Organization');
    expect(types).toContain('WebSite');
    // La marque s'écrit de façon constante : I-005 en fait un point d'identité.
    for (const node of nodes) {
      expect(node.name).toBe('Hexamap');
    }
  });
});
