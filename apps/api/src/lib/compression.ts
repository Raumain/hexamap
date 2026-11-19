import { brotliCompressSync, constants } from 'node:zlib';

// Seuil : sous cette taille, l'en-tête et le dictionnaire coûtent plus que le gain.
export const COMPRESSION_MIN_BYTES = 1024;

export type Encoding = 'br' | 'gzip';

// Types déjà compressés par le pipeline d'import (WebP, PNG, woff2) : jamais
// recompressés. Seuls le texte et les formats balisés en bénéficient vraiment.
export const isCompressibleType = (contentType: string | null): boolean => {
  if (!contentType) return false;
  const type = (contentType.split(';')[0] ?? '').trim().toLowerCase();
  if (type.startsWith('text/')) return true;
  return (
    type === 'application/javascript' ||
    type === 'application/json' ||
    type === 'application/manifest+json' ||
    type === 'application/xml' ||
    type === 'image/svg+xml'
  );
};

// `;q=0.5` ou `; q=0.5` ; une valeur illisible vaut 1 plutôt que de lever. La
// qualité est bornée à [0, 1] comme l'exige la RFC : `q=7` ne doit pas battre
// `q=1` et faire choisir un autre codec.
const qualityOf = (params: string[]): number => {
  for (const param of params) {
    const match = /^\s*q\s*=\s*([0-9.]+)\s*$/i.exec(param);
    if (match) {
      const value = Number.parseFloat(match[1] ?? '');
      if (!Number.isFinite(value)) return 1;
      return Math.min(1, Math.max(0, value));
    }
  }
  return 1;
};

// Négociation `Accept-Encoding` : q-values respectées, `br` prioritaire à
// qualité égale (meilleur taux sur le JS), `q=0` exclut, jeton inconnu ignoré.
// `identity` n'est jamais renvoyé : c'est l'absence de compression, décidée
// par l'appelant.
export const negotiateEncoding = (acceptEncoding: string | null): Encoding | null => {
  if (!acceptEncoding || acceptEncoding.trim() === '') return null;

  const declared = new Map<Encoding, number>();
  let wildcard: number | null = null;

  for (const raw of acceptEncoding.split(',')) {
    const token = raw.trim();
    if (token === '') continue;

    const [namePart, ...params] = token.split(';');
    const name = (namePart ?? '').trim().toLowerCase();
    if (name === '') continue;

    const quality = qualityOf(params);

    if (name === '*') {
      wildcard = Math.max(wildcard ?? 0, quality);
      continue;
    }
    if (name !== 'gzip' && name !== 'br') continue;

    declared.set(name, Math.max(declared.get(name) ?? 0, quality));
  }

  const effectiveQuality = (encoding: Encoding): number => {
    const value = declared.get(encoding);
    if (value !== undefined) return value;
    return wildcard ?? 0;
  };

  let best: Encoding | null = null;
  let bestQuality = 0;
  // `br` examiné en premier : à qualité égale il l'emporte.
  for (const encoding of ['br', 'gzip'] as const) {
    const quality = effectiveQuality(encoding);
    if (quality <= 0) continue;
    if (quality > bestQuality) {
      best = encoding;
      bestQuality = quality;
    }
  }

  return best;
};

export const compressBytes = (bytes: Uint8Array, encoding: Encoding): Uint8Array<ArrayBuffer> =>
  encoding === 'gzip'
    ? // `Bun.gzipSync` exige un tableau adossé à un `ArrayBuffer` : la copie
      // garantit le type sans cast.
      new Uint8Array(Bun.gzipSync(new Uint8Array(bytes)))
    : new Uint8Array(
        brotliCompressSync(bytes, { params: { [constants.BROTLI_PARAM_QUALITY]: 5 } }),
      );

// `Vary` ne doit jamais être écrasé (CORS y place `origin`).
export const appendVary = (existing: string | null | undefined, value: string): string => {
  if (!existing || existing.trim() === '') return value;

  const entries = existing
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '');

  if (entries.length === 0) return value;
  if (entries.some((entry) => entry.toLowerCase() === value.toLowerCase())) {
    return entries.join(', ');
  }
  return [...entries, value].join(', ');
};
