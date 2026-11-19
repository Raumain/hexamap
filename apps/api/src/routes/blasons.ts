import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Elysia } from 'elysia';
import { env } from '../env';
import {
  appendVary,
  COMPRESSION_MIN_BYTES,
  compressBytes,
  isCompressibleType,
  negotiateEncoding,
} from '../lib/compression';
import { cachedCompression, compressionCacheKey } from '../lib/compression-cache';

// Racine du volume Docker `blasons`, monté sur /data/blasons. Les fichiers SVG
// y sont produits hors ligne par le pipeline d'import : l'API ne fait que les
// lire, jamais d'appel réseau sortant. La racine est injectable pour que la
// spécification puisse servir des fixtures sans toucher au volume réel.
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

export const blasonRoutes = (root: string = env.BLASONS_DIR) => {
  const blasonsRoot = resolve(root);

  return new Elysia({ name: 'routes.blasons' }).get(
    '/blasons/*',
    async ({ params, set, headers, request }) => {
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

      // Validateur faible : identité, gzip et br sont trois représentations
      // sémantiquement équivalentes du même blason ; un validateur fort ne
      // désignerait qu'une seule d'entre elles.
      const etag = `W/"${file.size}-${file.lastModified}"`;
      const currentVary = set.headers.Vary;
      const vary = appendVary(
        typeof currentVary === 'string' ? currentVary : null,
        'accept-encoding',
      );

      if (headers['if-none-match'] === etag) {
        return new Response(null, { status: 304, headers: { ETag: etag, Vary: vary } });
      }

      // Le SVG se compresse, le WebP jamais : c'est le type qui décide, pas
      // l'extension. Une réponse HEAD n'a pas de corps à encoder, et la branche
      // compressée retourne avant toute écriture dans `set.headers`.
      const encoding =
        request.method === 'HEAD' ? null : negotiateEncoding(headers['accept-encoding'] ?? null);

      if (encoding && isCompressibleType(contentType) && file.size >= COMPRESSION_MIN_BYTES) {
        // CORS reflète l'origine et pose `Vary: Origin` dans son propre
        // onAfterHandle, qui n'atteint pas une Response construite ici : la
        // dimension est réintégrée explicitement, sans quoi un cache partagé
        // servirait la variante d'une origine à une autre.
        const varyWithOrigin = appendVary(
          typeof currentVary === 'string' ? currentVary : null,
          'origin',
        );
        const compressedVary = appendVary(varyWithOrigin, 'accept-encoding');

        const body = cachedCompression(
          compressionCacheKey(absolute, file.size, file.lastModified, encoding),
          () => compressBytes(new Uint8Array(readFileSync(absolute)), encoding),
        );

        return new Response(body, {
          status: 200,
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=3600, must-revalidate',
            ETag: etag,
            'Content-Encoding': encoding,
            Vary: compressedVary,
            'Content-Length': String(body.byteLength),
          },
        });
      }

      set.headers['Content-Type'] = contentType;
      set.headers['Cache-Control'] = 'public, max-age=3600, must-revalidate';
      set.headers.ETag = etag;
      set.headers.Vary = vary;
      return file;
    },
  );
};
