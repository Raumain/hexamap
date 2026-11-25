import { Elysia } from 'elysia';
import { db } from '../db';
import { env } from '../env';

/**
 * `robots.txt` et `sitemap.xml` sont deux **routes**, pas deux fichiers de
 * `WEB_DIST_DIR`. Un fichier statique serait faux dès la première nouvelle
 * vitrine, et le build l'écraserait : `static.ts` refuse d'ailleurs toute
 * extension hors de sa liste blanche, où `xml` ne figure pas.
 *
 * Aucune URL absolue n'est écrite en dur : l'origine vient de `PUBLIC_ORIGIN`
 * (I-005, `.docs/01-architecture.md` §2.9 pour ce qu'une vitrine ne montre
 * jamais).
 */

/** Les pages publiques fixes. Une vitrine privée n'y entre jamais. */
const PUBLIC_PAGES = ['/', '/rarete', '/mentions-legales', '/confidentialite'] as const;

/**
 * Borne du sitemap. Un sitemap de protocole accepte 50 000 URL par fichier ;
 * la borne basse garde la réponse légère et rend le tri déterministe. Au-delà,
 * il faudra un index de sitemaps — hors périmètre de cette phase.
 */
const PUBLIC_SHOWCASES_LIMIT = 5000;

const CACHE_CONTROL = 'public, max-age=3600';

/**
 * Les salles derrière session ne sont **pas** listées en `Disallow` : un moteur
 * qui ne peut pas lire une page ne peut pas non plus lire son `noindex`, et la
 * page resterait indexable par ses liens entrants. Le refus d'indexation est
 * donc porté par la balise `robots` des routes (`.docs/sessions/seo-fond`),
 * pas par ce fichier. Seules les ressources qui ne sont pas des pages sont
 * écartées ici.
 */
function robotsTxt(origin: string): string {
  return [
    'User-agent: *',
    'Allow: /',
    '',
    '# Ressources de l’API et images de blasons : jamais des pages.',
    'Disallow: /api/',
    'Disallow: /blasons/',
    '',
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ].join('\n');
}

/** Échappement XML des cinq entités : une URL peut porter `&`. */
function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

/**
 * Le `lastmod` du protocole est une date W3C. `toISOString().slice(0, 10)`
 * donne `YYYY-MM-DD` en UTC, sans dépendre du fuseau du serveur.
 */
function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

interface SitemapEntry {
  loc: string;
  lastmod: string | null;
}

/**
 * Les vitrines publiques, lues dans le schéma existant. Trois colonnes
 * seulement — identifiant public, pseudo non nul, date de réglage : ni adresse
 * électronique, ni solde, ni carte (§2.9). Une vitrine privée est exclue par la
 * clause `profile_public`, exactement comme la route `/players/:id` répond
 * `404`.
 */
async function loadPublicShowcases(origin: string): Promise<SitemapEntry[]> {
  const rows = await db
    .selectFrom('user_profiles')
    .innerJoin('user', 'user.id', 'user_profiles.user_id')
    .select(['user.id as id', 'user_profiles.updated_at as updated_at'])
    .where('user_profiles.profile_public', '=', true)
    .where('user.pseudo', 'is not', null)
    .orderBy('user_profiles.updated_at', 'desc')
    .limit(PUBLIC_SHOWCASES_LIMIT)
    .execute();

  return rows.map((row) => ({
    loc: `${origin}/players/${row.id}`,
    lastmod: row.updated_at ? dateOnly(row.updated_at) : null,
  }));
}

function renderSitemap(entries: SitemapEntry[]): string {
  const urls = entries.map((entry) => {
    const lastmod = entry.lastmod === null ? '' : `<lastmod>${entry.lastmod}</lastmod>`;
    return `  <url><loc>${escapeXml(entry.loc)}</loc>${lastmod}</url>`;
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n');
}

export const seoRoutes = (origin: string = env.PUBLIC_ORIGIN) =>
  new Elysia({ name: 'routes.seo' })
    .get('/robots.txt', ({ set }) => {
      set.headers['Content-Type'] = 'text/plain; charset=utf-8';
      set.headers['Cache-Control'] = CACHE_CONTROL;
      return robotsTxt(origin);
    })
    .get('/sitemap.xml', async ({ set }) => {
      const fixed: SitemapEntry[] = PUBLIC_PAGES.map((path) => ({
        loc: `${origin}${path}`,
        lastmod: null,
      }));

      // Une panne de lecture ne casse pas la route : un sitemap réduit aux pages
      // fixes reste valide, et un moteur préfère un plan partiel à un `500`. Une
      // vitrine manquante sera retrouvée au passage suivant — la réponse est
      // mise en cache une heure, pas un an.
      let showcases: SitemapEntry[] = [];
      try {
        showcases = await loadPublicShowcases(origin);
      } catch (error) {
        console.warn('[seo] sitemap réduit aux pages fixes', error);
      }

      set.headers['Content-Type'] = 'application/xml; charset=utf-8';
      set.headers['Cache-Control'] = CACHE_CONTROL;
      return renderSitemap([...fixed, ...showcases]);
    });
