import { resolve } from 'node:path';
import { Elysia } from 'elysia';
import { env } from '../env';

// Racine du volume Docker `blasons`, monté sur /data/blasons. Les fichiers SVG
// y sont produits hors ligne par le pipeline d'import : l'API ne fait que les
// lire, jamais d'appel réseau sortant.
const blasonsRoot = resolve(env.BLASONS_DIR);

const notFound = {
  code: 'BLASON_NOT_FOUND',
  message: 'Blason introuvable.',
};

// Formats écrits par le pipeline d'import : SVG assaini, ou raster converti en
// WebP 320 px. L'extension du fichier détermine le type servi.
const CONTENT_TYPES: Record<string, string> = {
  svg: 'image/svg+xml',
  webp: 'image/webp',
};

export const blasonRoutes = new Elysia({ name: 'routes.blasons' }).get(
  '/blasons/*',
  async ({ params, set, headers }) => {
    const relative = params['*'] ?? '';

    // Refuse tout chemin dangereux : `..`, backslash, segment vide ou `.`,
    // chemin absolu. Seules les extensions connues sont servies.
    const segments = relative.split('/');
    const lastSegment = segments[segments.length - 1] ?? '';
    const dotIndex = lastSegment.lastIndexOf('.');
    const extension = dotIndex > 0 ? lastSegment.slice(dotIndex + 1).toLowerCase() : '';
    const contentType = CONTENT_TYPES[extension];

    if (
      relative.includes('..') ||
      relative.includes('\\') ||
      relative.startsWith('/') ||
      segments.includes('') ||
      segments.includes('.') ||
      contentType === undefined
    ) {
      set.status = 404;
      return notFound;
    }

    // Résolution sous blasonsRoot : toute évasion de répertoire est rejetée.
    const absolute = resolve(blasonsRoot, relative);
    if (absolute !== blasonsRoot && !absolute.startsWith(`${blasonsRoot}/`)) {
      set.status = 404;
      return notFound;
    }

    const file = Bun.file(absolute);
    if (!(await file.exists())) {
      set.status = 404;
      return notFound;
    }

    const etag = `"${file.size}-${file.lastModified}"`;
    if (headers['if-none-match'] === etag) {
      return new Response(null, { status: 304 });
    }

    set.headers['Content-Type'] = contentType;
    set.headers['Cache-Control'] = 'public, max-age=3600, must-revalidate';
    set.headers.ETag = etag;
    return file;
  },
);
