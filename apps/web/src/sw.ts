import { ExpirationPlugin } from 'workbox-expiration';
import type { PrecacheEntry } from 'workbox-precaching';
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { NetworkOnly, StaleWhileRevalidate } from 'workbox-strategies';

/**
 * Le service worker du Cabinet — écrit à la main depuis la phase 43.
 *
 * `generateSW` produisait un worker aveugle : il ne savait pas recevoir une
 * poussée. `injectManifest` laisse Workbox injecter le manifeste de précache dans
 * ce fichier, et **les règles de cache du §4.10 de `.docs/01-architecture.md` sont
 * recopiées à l'identique**, pas réinventées :
 *
 * - cinq routes `NetworkOnly` sur `/api/`, une par méthode — une entrée Workbox ne
 *   s'applique qu'à une seule méthode, et `POST` porte toutes les mutations Eden ;
 * - `/blasons/` en `StaleWhileRevalidate` (200 entrées, 30 jours) ;
 * - `index.html` dans le précache, sans quoi `createHandlerBoundToURL` lève
 *   `non-precached-url` à l'installation et le worker ne s'active jamais ;
 * - aucune mise à jour imposée : `skipWaiting` et `clientsClaim` ne sont **pas**
 *   appelés, l'invitation française reste le seul chemin.
 */

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: (PrecacheEntry | string)[];
};

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

/**
 * Une route par méthode, sur le chemin de l'API. Le tableau est écrit en clair
 * plutôt qu'importé de `@hexamap/shared` : le worker embarqué dans le bundle PWA
 * n'a pas à tirer tout le domaine du jeu pour cinq chaînes, et
 * `packages/spec/src/push.spec.ts` verrouille la même liste côté partagé.
 */
const API_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

for (const method of API_METHODS) {
  registerRoute(({ url }) => url.pathname.startsWith('/api/'), new NetworkOnly(), method);
}

registerRoute(
  ({ url }) => url.pathname.startsWith('/blasons/'),
  new StaleWhileRevalidate({
    cacheName: 'blasons',
    plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 2_592_000 })],
  }),
  'GET',
);

// Le repli de navigation : une route inconnue retombe sur la coquille, jamais sur
// du HTML à la place d'une réponse d'API ou d'un blason. `NavigationRoute` est
// déjà une route — elle ne se déclare pas de méthode, elle ne capte que les
// navigations.
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('/index.html'), {
    denylist: [/^\/api\//, /^\/blasons\//],
  }),
);

/* ── La Sonnette : réception d'une poussée ───────────────────────────────── */

interface PushNotification {
  title: string;
  body: string;
  url: string;
  tag: string;
}

const DEFAULT_NOTIFICATION: PushNotification = {
  title: 'Hexamap',
  body: 'Votre carnet a repris une charge.',
  url: '/',
  tag: 'hexamap-charges',
};

function asText(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readPayload(data: PushMessageData | null): PushNotification {
  if (data === null) return DEFAULT_NOTIFICATION;

  let parsed: unknown;
  try {
    parsed = data.json();
  } catch {
    return DEFAULT_NOTIFICATION;
  }

  if (typeof parsed !== 'object' || parsed === null) return DEFAULT_NOTIFICATION;

  return {
    title: asText(Reflect.get(parsed, 'title')) ?? DEFAULT_NOTIFICATION.title,
    body: asText(Reflect.get(parsed, 'body')) ?? DEFAULT_NOTIFICATION.body,
    url: asText(Reflect.get(parsed, 'url')) ?? DEFAULT_NOTIFICATION.url,
    tag: asText(Reflect.get(parsed, 'tag')) ?? DEFAULT_NOTIFICATION.tag,
  };
}

self.addEventListener('push', (event) => {
  const payload = readPayload(event.data);

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      // Le même `tag` remplace une notification précédente au lieu d'en empiler
      // deux : une charge revenue ne s'annonce qu'une fois à l'écran.
      tag: payload.tag,
      lang: 'fr',
      icon: '/icons/pwa-192x192.png',
      badge: '/icons/pwa-64x64.png',
      data: { url: payload.url },
    }),
  );
});

/* ── La Sonnette : clic sur la notification ──────────────────────────────── */

function isWindowClient(client: Client): client is WindowClient {
  return client.type === 'window' && 'focus' in client && 'navigate' in client;
}

async function focusOrOpen(url: string): Promise<void> {
  const target = new URL(url, self.location.origin).href;

  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

  for (const client of windows) {
    if (!isWindowClient(client)) continue;
    // Une fenêtre d'une autre origine ne peut être ni focalisée ni pilotée ici.
    if (new URL(client.url).origin !== self.location.origin) continue;

    const focused = await client.focus();
    if (focused !== null) await focused.navigate(target);
    return;
  }

  await self.clients.openWindow(target);
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data: unknown = event.notification.data;
  const raw = typeof data === 'object' && data !== null ? Reflect.get(data, 'url') : null;
  const url = asText(raw) ?? DEFAULT_NOTIFICATION.url;

  event.waitUntil(focusOrOpen(url));
});
