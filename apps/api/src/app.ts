import { resolve } from 'node:path';
import { cors } from '@elysiajs/cors';
import { openapi } from '@elysiajs/openapi';
import { Elysia } from 'elysia';
import { sql } from 'kysely';
import { auth } from './auth';
import { db } from './db';
import { env } from './env';
import { compressionPlugin } from './lib/compression-plugin';
import { authPlugin } from './middleware/auth';
import { blasonRoutes } from './routes/blasons';
import { cardRoutes } from './routes/cards';
import { chargeRoutes } from './routes/charges';
import { importStatusRoutes } from './routes/import-status';
import { marketRoutes } from './routes/market';
import { refRoutes } from './routes/ref';
import { tableauRoutes } from './routes/tableaux';
import { ticketRoutes } from './routes/tickets';
import { webRoutes } from './static';

const isDev = env.NODE_ENV !== 'production';

const normalizeOrigin = (value: string): string => new URL(value).origin;

// Liste blanche stricte de production : l'origine du frontend déclarée par
// `FRONTEND_URL`, plus les origines explicitement listées dans `TRUSTED_ORIGINS`.
// Aucune autre origine n'obtient d'en-tête CORS.
const extraOrigins = env.TRUSTED_ORIGINS.split(',')
  .map((value) => value.trim())
  .filter(Boolean)
  .map(normalizeOrigin);

const productionOrigins = new Set<string>([
  ...(env.FRONTEND_URL ? [normalizeOrigin(env.FRONTEND_URL)] : []),
  ...extraOrigins,
]);

const publicRoutes = new Elysia({ prefix: '/api/v1' }).use(importStatusRoutes);

const protectedRoutes = new Elysia({ prefix: '/api/v1' })
  .use(authPlugin)
  .use(refRoutes)
  .use(ticketRoutes)
  .use(cardRoutes)
  .use(tableauRoutes)
  .use(marketRoutes)
  .use(chargeRoutes)
  .get('/me', ({ user, status }) => {
    if (!user) {
      return status(401, { code: 'UNAUTHORIZED', message: 'Non authentifié' });
    }
    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        pseudo: user.pseudo,
        currency: user.currency,
      },
    };
  });

export interface CreateAppOptions {
  // Répertoire du build SPA ; par défaut `WEB_DIST_DIR`.
  webDistDir?: string;
  // Force l'activation ou la désactivation du service du front.
  serveWeb?: boolean;
  // Racine des blasons ; par défaut BLASONS_DIR.
  blasonsDir?: string;
  // Seuil de compression sous lequel l'API ne compresse pas ; 1024 octets par défaut.
  compressionMinBytes?: number;
}

export function createApp(options: CreateAppOptions = {}) {
  const base = new Elysia()
    // Route inconnue : réponse JSON stable, y compris quand le plugin web n'est
    // pas monté (développement). Les autres codes d'erreur restent intacts.
    .onError(({ code, set }) => {
      if (code === 'NOT_FOUND') {
        set.status = 404;
        return { code: 'ROUTE_NOT_FOUND', message: 'Ressource introuvable.' };
      }
      return undefined;
    })
    .use(
      cors({
        // Obligatoire : Better Auth lit et écrit des cookies de session.
        credentials: true,
        // Reflète l'origine de la requête quand elle est autorisée. Pas de `*`
        // avec credentials (invalide). En dev, toute origine est reflétée pour
        // l'accès LAN par IP ; en production, seule la liste blanche passe.
        origin: (request) => {
          const origin = request.headers.get('origin');
          if (!origin) return true; // même origine ou pas d'en-tête (curl, healthcheck)
          if (isDev) return true;
          return productionOrigins.has(origin);
        },
      }),
    )
    // Compression des réponses JSON : montée avant les modules pour couvrir les
    // routes de santé, le 404 JSON et les plugins montés ensuite.
    .use(compressionPlugin({ minBytes: options.compressionMinBytes }))
    .use(openapi({ path: '/api/docs' }))
    .get('/api/v1/health', () => ({ status: 'ok', service: 'hexamap-api' }))
    .get('/api/v1/health/db', async ({ set }) => {
      try {
        await sql`select 1`.execute(db);
        return { status: 'ok', database: 'up' };
      } catch {
        set.status = 503;
        return { status: 'error', database: 'down' };
      }
    })
    .use(publicRoutes)
    .use(protectedRoutes)
    // Assets statiques hors du préfixe /api/v1 : servis directement sur /blasons.
    .use(blasonRoutes(options.blasonsDir ?? env.BLASONS_DIR))
    .mount(auth.handler);

  // Service du front : explicite via `SERVE_WEB`, ou automatique en production.
  const serveWeb = options.serveWeb ?? (env.SERVE_WEB === 'true' || env.NODE_ENV === 'production');
  if (!serveWeb) return base;

  const webDistDir = resolve(options.webDistDir ?? env.WEB_DIST_DIR);
  console.log(`[hexamap] Assets web servis depuis ${webDistDir}`);
  return base.use(webRoutes(webDistDir, auth.handler));
}

export const app = createApp();

export type App = typeof app;
