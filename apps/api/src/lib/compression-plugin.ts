import { Elysia } from 'elysia';
import { appendVary, COMPRESSION_MIN_BYTES, compressBytes, negotiateEncoding } from './compression';

export interface CompressionOptions {
  minBytes?: number;
}

// Forme JSON nue rendue par une route : objet simple ou tableau. Tout le reste
// (Response, Blob, Date, flux, fichier, null, chaîne, nombre, booléen) est
// laissé intact : resérialiser `"foo"` en JSON produirait `"\"foo\""`.
const isJsonPayload = (value: unknown): boolean => {
  if (value === null || typeof value !== 'object') return false;
  if (Array.isArray(value)) return true;

  // `Date`, `Blob`, `Response` et `ReadableStream` portent leur propre
  // prototype : ils ne passent jamais le test ci-dessous.
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

const isJsonType = (contentType: string | null): boolean =>
  contentType !== null &&
  (contentType.split(';')[0] ?? '').trim().toLowerCase() === 'application/json';

// Copie en conservant les en-têtes répétés : `.set()` n'en garderait qu'un,
// alors que `set-cookie` peut légitimement apparaître plusieurs fois.
const appendHeaders = (target: Headers, source: Headers): void => {
  for (const [key, value] of source.entries()) {
    const lowered = key.toLowerCase();
    if (lowered === 'content-length' || lowered === 'content-encoding') continue;
    target.append(key, value);
  }
};

// Compression des réponses JSON de l'API. Les fichiers statiques ne passent pas
// ici : `static.ts` et `routes/blasons.ts` compressent eux-mêmes, avec un cache
// indexé sur le mtime.
export const compressionPlugin = (options: CompressionOptions = {}) => {
  const minBytes = options.minBytes ?? COMPRESSION_MIN_BYTES;

  return new Elysia({ name: 'compression' }).onAfterHandle(
    { as: 'global' },
    async ({ response, request, set }) => {
      // Une réponse HEAD n'a pas de corps à encoder.
      if (request.method === 'HEAD') return;

      // Jamais de double encodage.
      const declaredEncoding = set.headers['Content-Encoding'] ?? set.headers['content-encoding'];
      if (typeof declaredEncoding === 'string' && declaredEncoding !== '') return;

      const currentVary = typeof set.headers.Vary === 'string' ? set.headers.Vary : null;
      // JSON nu : la réponse n'est pas encore sérialisée, c'est nous qui
      // produisons le corps. Toute autre forme est laissée à Elysia.
      const isBareJson = !(response instanceof Response) && isJsonPayload(response);

      const encoding = negotiateEncoding(request.headers.get('accept-encoding'));

      // Variante identité : elle partage l'URL avec la variante compressée et
      // doit donc annoncer la dimension, sinon un cache partagé sert l'une pour
      // l'autre.
      if (!encoding) {
        if (isBareJson) set.headers.Vary = appendVary(currentVary, 'accept-encoding');
        return;
      }

      let status = 200;
      let statusText: string | undefined;
      let existingVary: string | null = null;
      let source: Uint8Array<ArrayBuffer>;
      const headers = new Headers();

      // Rien de ce qu'un hook précédent a posé dans `set.headers` n'est perdu.
      for (const [key, value] of Object.entries(set.headers)) {
        if (value === undefined || value === null) continue;
        if (Array.isArray(value)) {
          for (const item of value) headers.append(key, String(item));
          continue;
        }
        headers.append(key, String(value));
      }

      if (isBareJson) {
        const declaredStatus = set.status;
        status = typeof declaredStatus === 'number' ? declaredStatus : 200;

        // Sans corps, il n'y a rien à encoder (miroir de la branche Response).
        if (status < 200 || status === 204 || status === 304) return;

        existingVary = currentVary;
        headers.set('content-type', 'application/json; charset=utf-8');
        source = new TextEncoder().encode(JSON.stringify(response));
      } else if (response instanceof Response) {
        if (response.headers.get('content-encoding')) return;
        if (!isJsonType(response.headers.get('content-type'))) return;

        status = response.status;
        statusText = response.statusText;
        // Sans corps, il n'y a rien à encoder.
        if (status < 200 || status === 204 || status === 304) return;

        existingVary = response.headers.get('vary');
        appendHeaders(headers, response.headers);
        source = new Uint8Array(await response.arrayBuffer());
      } else {
        return;
      }

      if (source.byteLength < minBytes) {
        if (isBareJson) {
          set.headers.Vary = appendVary(currentVary, 'accept-encoding');
          return;
        }
        // Le corps a déjà été lu pour mesurer sa taille : le renvoyer tel quel,
        // sinon Elysia émettrait une Response dont le flux est consommé
        // (`TypeError: Body object should not be disturbed or locked`).
        return new Response(source, { status, statusText, headers });
      }

      const body = compressBytes(source, encoding);

      const result = new Headers();
      for (const [key, value] of headers.entries()) {
        const lowered = key.toLowerCase();
        if (lowered === 'content-length' || lowered === 'content-encoding') continue;
        result.append(key, value);
      }
      result.set('content-type', 'application/json; charset=utf-8');
      result.set('content-encoding', encoding);
      result.set('content-length', String(body.byteLength));
      result.set('vary', appendVary(existingVary ?? headers.get('vary'), 'accept-encoding'));

      return new Response(body, { status, statusText, headers: result });
    },
  );
};
