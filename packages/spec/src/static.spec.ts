import { describe, expect, it } from 'bun:test';
import { fileURLToPath } from 'node:url';
import { createApp } from '@hexamap/api/app';

// L'application est construite une seule fois pour toute la suite : les fixtures
// `web-dist` reproduisent la sortie d'un build Vite minimal.
const app = createApp({
  webDistDir: fileURLToPath(new URL('../fixtures/web-dist', import.meta.url)),
  serveWeb: true,
});

const request = (path: string) => app.handle(new Request(`http://localhost${path}`));

describe('Archi §6.1 — service du front construit par l’API', () => {
  it('sert index.html sur la racine', async () => {
    const response = await request('/');
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toStartWith('text/html');
    expect(body).toContain('id="root"');
    expect(response.headers.get('etag')).toBeTruthy();
  });

  it('sert index.html sur une route cliente inconnue', async () => {
    const response = await request('/collection');
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toStartWith('text/html');
    expect(body).toContain('id="root"');
  });

  it('sert les assets avec un cache immuable', async () => {
    const response = await request('/assets/app-fixture.js');
    const cacheControl = response.headers.get('cache-control') ?? '';

    expect(response.status).toBe(200);
    expect(cacheControl).toContain('immutable');
    expect(cacheControl).toContain('max-age=31536000');
    expect(response.headers.get('etag')).toBeTruthy();
  });

  it('sert index.html sans cache', async () => {
    const response = await request('/');

    expect(response.headers.get('cache-control')).toContain('no-cache');
  });

  it('Archi §6.1 — le service worker n’est jamais mis en cache', async () => {
    const response = await request('/sw.js');

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toStartWith('text/javascript');
    expect(response.headers.get('cache-control')).toBe('no-cache');
  });

  it('laisse la route de santé à l’API', async () => {
    const response = await request('/api/v1/health');
    const body = (await response.json()) as { status?: string };

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(body.status).toBe('ok');
  });

  it('répond 404 JSON sur une route API inconnue', async () => {
    const response = await request('/api/v1/inexistant');
    const body = (await response.json()) as { code?: string };

    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('json');
    expect(body.code).toBeTruthy();
  });

  it('ne sert jamais la coquille SPA sous /api/auth', async () => {
    const response = await request('/api/auth/ok');

    expect(response.headers.get('content-type') ?? '').not.toStartWith('text/html');
  });

  it('laisse /blasons à l’API (pas de repli SPA)', async () => {
    const response = await request('/blasons/x.svg');
    const body = (await response.json()) as { code?: string };

    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('json');
    expect(body.code).toBeTruthy();
  });

  it('sert le manifeste avec son type dédié', async () => {
    const response = await request('/manifest.webmanifest');

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/manifest+json');
  });

  it('refuse une évasion de répertoire encodée', async () => {
    const response = await request('/assets/%2e%2e/%2e%2e/etc/passwd');

    expect(response.status).toBe(404);
  });

  it('ne masque pas la documentation OpenAPI', async () => {
    const response = await request('/api/docs');
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).not.toContain('id="root"');
  });

  // Better Auth est monté en `ALL /*` : sans délégation explicite, la route
  // `GET /*` du repli SPA capterait les lectures de session et l'application
  // resterait bloquée sur l'écran de connexion.
  it('rend les lectures de session à Better Auth', async () => {
    const response = await request('/api/auth/get-session');
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('json');
    expect(body).not.toContain('ROUTE_NOT_FOUND');
  });
});
