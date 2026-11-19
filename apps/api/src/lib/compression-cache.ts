import type { Encoding } from './compression';

const MAX_ENTRIES = 64;
const cache = new Map<string, Uint8Array<ArrayBuffer>>();

export const compressionCacheKey = (
  absolute: string,
  size: number,
  lastModified: number,
  encoding: Encoding,
): string => `${absolute}\0${size}\0${lastModified}\0${encoding}`;

// Compression paresseuse et bornée : les assets hachés ne changent jamais, un
// `index.html` recompressé à chaque déploiement change de clé (mtime).
export const cachedCompression = (
  key: string,
  compute: () => Uint8Array<ArrayBuffer>,
): Uint8Array<ArrayBuffer> => {
  const hit = cache.get(key);
  if (hit !== undefined) return hit;

  const value = compute();

  if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next();
    if (!oldest.done) cache.delete(oldest.value);
  }

  cache.set(key, value);
  return value;
};
