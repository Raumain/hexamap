import { cors } from '@elysiajs/cors';
import { openapi } from '@elysiajs/openapi';
import { Elysia } from 'elysia';
import { sql } from 'kysely';
import { auth } from './auth';
import { db } from './db';
import { env } from './env';
import { authPlugin } from './middleware/auth';
import { blasonRoutes } from './routes/blasons';
import { cardRoutes } from './routes/cards';
import { importStatusRoutes } from './routes/import-status';
import { marketRoutes } from './routes/market';
import { refRoutes } from './routes/ref';
import { tableauRoutes } from './routes/tableaux';
import { ticketRoutes } from './routes/tickets';

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

export const app = new Elysia()
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
  .use(blasonRoutes)
  .mount(auth.handler);

export type App = typeof app;
