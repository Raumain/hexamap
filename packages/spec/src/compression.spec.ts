import { describe, expect, it } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { brotliDecompressSync, gunzipSync } from 'node:zlib';
import { createApp } from '@hexamap/api/app';

// Fixtures dédiées : un fichier volumineux et répétitif (compressible), un
// fichier sous le seuil, un binaire (jamais compressé) et deux blasons.
const webDistDir = fileURLToPath(new URL('../fixtures/web-dist', import.meta.url));
const blasonsDir = fileURLToPath(new URL('../fixtures/blasons', import.meta.url));

const app = createApp({ webDistDir, blasonsDir, serveWeb: true });
const jsonApp = createApp({ webDistDir, blasonsDir, serveWeb: true, compressionMinBytes: 0 });

const fixture = (relative: string): string =>
  fileURLToPath(new URL(`../fixtures/${relative}`, import.meta.url));

const request = (path: string, headers: Record<string, string> = {}) =>
  app.handle(new Request(`http://localhost${path}`, { headers }));

const jsonRequest = (path: string, headers: Record<string, string> = {}) =>
  jsonApp.handle(new Request(`http://localhost${path}`, { headers }));

const decompress = async (response: Response): Promise<Uint8Array> => {
  const encoding = response.headers.get('content-encoding');
  const body = new Uint8Array(await response.arrayBuffer());
  if (encoding === 'gzip') return new Uint8Array(gunzipSync(body));
  if (encoding === 'br') return new Uint8Array(brotliDecompressSync(body));
  return body;
};

describe('Archi §6.1 — compression des réponses servies par l’API', () => {
  it('un asset texte est compressé quand le client l’accepte', async () => {
    const response = await request('/assets/big-fixture.js', { 'accept-encoding': 'gzip' });
    const expected = new Uint8Array(await readFile(fixture('web-dist/assets/big-fixture.js')));

    expect(response.status).toBe(200);
    expect(response.headers.get('content-encoding')).toBe('gzip');
    expect(response.headers.get('vary')?.toLowerCase()).toContain('accept-encoding');
    expect(await decompress(response)).toEqual(expected);
  });

  it('un asset texte est compressé en brotli quand le client le préfère', async () => {
    const response = await request('/assets/big-fixture.js', { 'accept-encoding': 'br, gzip' });
    const expected = new Uint8Array(await readFile(fixture('web-dist/assets/big-fixture.js')));

    expect(response.headers.get('content-encoding')).toBe('br');
    expect(await decompress(response)).toEqual(expected);
  });

  it('aucune compression sans Accept-Encoding', async () => {
    const response = await request('/assets/big-fixture.js');
    const expected = new Uint8Array(await readFile(fixture('web-dist/assets/big-fixture.js')));

    expect(response.headers.get('content-encoding')).toBeNull();
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(expected);
    expect(response.headers.get('vary')?.toLowerCase()).toContain('accept-encoding');
  });

  it('identity et q=0 ne compriment pas', async () => {
    const identity = await request('/assets/big-fixture.js', { 'accept-encoding': 'identity' });
    const zero = await request('/assets/big-fixture.js', { 'accept-encoding': 'gzip;q=0' });

    expect(identity.headers.get('content-encoding')).toBeNull();
    expect(zero.headers.get('content-encoding')).toBeNull();
  });

  it('les octets binaires ne sont jamais compressés', async () => {
    const response = await request('/assets/image-fixture.png', { 'accept-encoding': 'gzip' });
    const size = (await readFile(fixture('web-dist/assets/image-fixture.png'))).byteLength;

    expect(response.headers.get('content-encoding')).toBeNull();
    expect(response.headers.get('content-length')).toBe(String(size));
  });

  it('un fichier sous le seuil n’est pas compressé', async () => {
    const response = await request('/assets/small-fixture.js', { 'accept-encoding': 'gzip' });

    expect(response.headers.get('content-encoding')).toBeNull();
  });

  it('le validateur survit à la compression', async () => {
    const plain = await request('/assets/big-fixture.js');
    const compressed = await request('/assets/big-fixture.js', { 'accept-encoding': 'gzip' });
    const plainEtag = plain.headers.get('etag');
    const compressedEtag = compressed.headers.get('etag');

    expect(plainEtag).toBeTruthy();
    expect(plainEtag).toBe(compressedEtag);

    const revalidated = await request('/assets/big-fixture.js', {
      'accept-encoding': 'gzip',
      'if-none-match': plainEtag ?? '',
    });

    expect(revalidated.status).toBe(304);
    expect(revalidated.headers.get('content-encoding')).toBeNull();
    expect((await revalidated.arrayBuffer()).byteLength).toBe(0);
    expect(revalidated.headers.get('vary')?.toLowerCase()).toContain('accept-encoding');
  });

  it('Vary Accept-Encoding s’ajoute sans casser le CORS', async () => {
    const response = await request('/assets/big-fixture.js', {
      origin: 'http://localhost:5174',
      'accept-encoding': 'gzip',
    });

    expect(response.headers.get('vary')?.toLowerCase()).toContain('accept-encoding');
    expect(response.headers.get('access-control-allow-origin')).toBeTruthy();
  });

  it('une réponse JSON de l’API est compressée quand le client l’accepte', async () => {
    const response = await jsonRequest('/api/v1/health', { 'accept-encoding': 'gzip' });
    const decoded = JSON.parse(
      new TextDecoder().decode(gunzipSync(new Uint8Array(await response.arrayBuffer()))),
    ) as { status?: string; service?: string };

    expect(response.headers.get('content-encoding')).toBe('gzip');
    expect(decoded.status).toBe('ok');
    expect(decoded.service).toBe('hexamap-api');
  });

  it('aucune compression JSON sans Accept-Encoding', async () => {
    const response = await jsonRequest('/api/v1/health');
    const decoded = (await response.json()) as { status?: string };

    expect(response.headers.get('content-encoding')).toBeNull();
    expect(decoded.status).toBe('ok');
  });

  it('un blason SVG est compressé quand le client l’accepte', async () => {
    const response = await request('/blasons/commune-big.svg', { 'accept-encoding': 'gzip' });
    const expected = new Uint8Array(await readFile(fixture('blasons/commune-big.svg')));

    expect(response.status).toBe(200);
    expect(response.headers.get('content-encoding')).toBe('gzip');
    expect(await decompress(response)).toEqual(expected);
  });

  it('un blason WebP n’est jamais compressé', async () => {
    const response = await request('/blasons/vignette.webp', { 'accept-encoding': 'gzip' });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-encoding')).toBeNull();
  });

  it('un module monté hérite de la compression', async () => {
    const response = await jsonRequest('/api/v1/import-status', { 'accept-encoding': 'gzip' });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-encoding')).toBe('gzip');

    const decoded = JSON.parse(
      new TextDecoder().decode(gunzipSync(new Uint8Array(await response.arrayBuffer()))),
    ) as { running?: boolean; phase?: string };

    expect(typeof decoded.running).toBe('boolean');
    expect(typeof decoded.phase).toBe('string');
  });

  // Une réponse HEAD n'a pas de corps : lui poser un `Content-Encoding`
  // annoncerait un codage que le client ne peut pas décoder.
  it('une réponse HEAD ne porte jamais d’encodage', async () => {
    const response = await app.handle(
      new Request('http://localhost/assets/big-fixture.js', {
        method: 'HEAD',
        headers: { 'accept-encoding': 'gzip' },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-encoding')).toBeNull();
    expect(new Uint8Array(await response.arrayBuffer()).byteLength).toBe(0);
  });
});
