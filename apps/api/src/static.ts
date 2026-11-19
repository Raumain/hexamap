import { resolve } from 'node:path';
import { Elysia } from 'elysia';

const HTML_TYPE = 'text/html; charset=utf-8';

// Types MIME des fichiers produits par le build Vite. Une extension absente de
// cette table n'est jamais servie : le chemin retombe sur la coquille SPA.
const CONTENT_TYPES: Record<string, string> = {
  html: HTML_TYPE,
  js: 'text/javascript; charset=utf-8',
  mjs: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8',
  json: 'application/json; charset=utf-8',
  map: 'application/json; charset=utf-8',
  svg: 'image/svg+xml',
  webp: 'image/webp',
  png: 'image/png',
  ico: 'image/x-icon',
  woff2: 'font/woff2',
  woff: 'font/woff',
  txt: 'text/plain; charset=utf-8',
  webmanifest: 'application/manifest+json',
};

const notFound = {
  code: 'ROUTE_NOT_FOUND',
  message: 'Ressource introuvable.',
};

// En-têtes auparavant posés par nginx : conservés ici, le reverse proxy étant
// supprimé de la production.
const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

// Un client HTTP normalise `%2e%2e` avant d'envoyer la requête : une tentative
// `/assets/%2e%2e/%2e%2e/etc/passwd` arrive ici sous la forme `/etc/passwd`.
// Ces racines système ne sont jamais des routes clientes : refus explicite.
const SYSTEM_ROOTS = new Set([
  'bin',
  'boot',
  'dev',
  'etc',
  'home',
  'media',
  'mnt',
  'opt',
  'proc',
  'root',
  'sbin',
  'srv',
  'sys',
  'tmp',
  'usr',
  'var',
]);

const extensionOf = (relative: string): string => {
  const lastSegment = relative.slice(relative.lastIndexOf('/') + 1);
  const dotIndex = lastSegment.lastIndexOf('.');
  return dotIndex > 0 ? lastSegment.slice(dotIndex + 1).toLowerCase() : '';
};

// Les assets versionnés du build sont immuables ; `index.html` ne doit jamais
// être mis en cache ; le reste est revalidé à chaque requête. Un service worker
// suit la même règle que l'index : mis en cache, un déploiement ne serait pas
// pris en compte immédiatement.
const cacheControlFor = (relative: string): string => {
  if (relative === '' || relative === 'index.html') return 'no-cache';
  if (relative === 'sw.js' || relative === 'service-worker.js') return 'no-cache';
  if (relative.startsWith('assets/')) return 'public, max-age=31536000, immutable';
  return 'public, max-age=0, must-revalidate';
};

type FetchHandler = (request: Request) => Response | Promise<Response>;

export const webRoutes = (root: string, authHandler?: FetchHandler) =>
  new Elysia({ name: 'routes.web' }).get('/*', async ({ params, set, headers, request }) => {
    const relative = params['*'] ?? '';

    // Better Auth est monté par `app.mount(auth.handler)` : Elysia l'enregistre
    // comme une route `ALL /*`, qu'une route `GET /*` — plus spécifique par la
    // méthode — masque. Les lectures de session (`GET /api/auth/get-session`)
    // seraient donc interceptées par le repli SPA : on les lui rend ici.
    if (authHandler && (relative === 'api/auth' || relative.startsWith('api/auth/'))) {
      return authHandler(request);
    }

    // Les autres préfixes de l'API ne retombent jamais sur la coquille SPA : une
    // route inconnue sous `/api` ou `/blasons` doit répondre JSON.
    if (relative === 'api' || relative.startsWith('api/') || relative.startsWith('blasons/')) {
      set.status = 404;
      return notFound;
    }

    // Même garde que `routes/blasons.ts` : refus de `..`, backslash, chemin
    // absolu, segment vide ou `.`. La racine du site (`''`) reste valide et
    // désigne `index.html`. Une extension explicite hors liste blanche est
    // refusée : seuls les chemins sans extension relèvent du routage SPA.
    const isRoot = relative === '';
    const segments = isRoot ? [] : relative.split('/');
    const extension = isRoot ? 'html' : extensionOf(relative);

    if (
      !isRoot &&
      (relative.includes('..') ||
        relative.includes('\\') ||
        relative.startsWith('/') ||
        segments.includes('') ||
        segments.includes('.') ||
        SYSTEM_ROOTS.has(segments[0] ?? '') ||
        (extension !== '' && CONTENT_TYPES[extension] === undefined))
    ) {
      set.status = 404;
      return notFound;
    }

    // CHEMIN EXPLICITE : seule une extension de la liste blanche est servie, et
    // seulement si le fichier existe réellement sous `root`.
    const absolute = resolve(root, isRoot ? 'index.html' : relative);
    if (absolute !== root && !absolute.startsWith(`${root}/`)) {
      set.status = 404;
      return notFound;
    }

    const contentType = CONTENT_TYPES[extension];
    if (!isRoot && extension !== '' && contentType !== undefined) {
      const file = Bun.file(absolute);
      if (await file.exists()) {
        const etag = `"${file.size}-${file.lastModified}"`;
        if (headers['if-none-match'] === etag) {
          return new Response(null, { status: 304, headers: { ...SECURITY_HEADERS, ETag: etag } });
        }

        set.headers['Content-Type'] = contentType;
        set.headers['Cache-Control'] = cacheControlFor(relative);
        set.headers.ETag = etag;
        for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
          set.headers[key] = value;
        }
        return file;
      }
    }

    // REPLI SPA : toute route cliente inconnue reçoit `index.html`. Si le build
    // n'est pas présent, on répond 404 plutôt que de laisser Elysia lever.
    const indexFile = Bun.file(resolve(root, 'index.html'));
    if (!(await indexFile.exists())) {
      set.status = 404;
      return notFound;
    }

    const indexEtag = `"${indexFile.size}-${indexFile.lastModified}"`;
    if (headers['if-none-match'] === indexEtag) {
      return new Response(null, {
        status: 304,
        headers: { ...SECURITY_HEADERS, ETag: indexEtag },
      });
    }

    set.headers['Content-Type'] = HTML_TYPE;
    set.headers['Cache-Control'] = cacheControlFor('index.html');
    set.headers.ETag = indexEtag;
    for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
      set.headers[key] = value;
    }
    return indexFile;
  });
