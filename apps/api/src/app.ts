import { cors } from '@elysiajs/cors';
import { openapi } from '@elysiajs/openapi';
import { Elysia } from 'elysia';
import { sql } from 'kysely';
import { auth, trustedOrigins } from './auth';
import { db } from './db';
import { env } from './env';

const isDev = env.NODE_ENV !== 'production';

export const app = new Elysia()
  .use(
    cors({
      credentials: true,
      // Reflète l'origine de la requête quand elle est autorisée. Pas de `*`
      // avec credentials (invalide). En dev, toute origine est reflétée pour
      // l'accès LAN par IP ; en production, seules les origines de confiance.
      origin: (request) => {
        const origin = request.headers.get('origin');
        if (!origin) return true; // même origine ou pas d'en-tête (curl)
        if (isDev) return true;
        return trustedOrigins.includes(origin);
      },
    }),
  )
  .use(openapi({ path: '/api/docs' }))
  .macro({
    auth: {
      async resolve({ request, status }) {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session) {
          return status(401, 'Non authentifié');
        }
        return { user: session.user, session: session.session };
      },
    },
  })
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
  .get(
    '/api/v1/me',
    ({ user }) => ({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        pseudo: user.pseudo,
        currency: user.currency,
      },
    }),
    { auth: true },
  )
  .mount(auth.handler);

export type App = typeof app;
