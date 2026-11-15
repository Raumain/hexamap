import { Elysia } from 'elysia';
import { auth } from '../auth';

export const authPlugin = new Elysia({ name: 'auth' })
  .derive({ as: 'scoped' }, async ({ request }) => {
    const session = await auth.api.getSession({ headers: request.headers });
    return { user: session?.user, session: session?.session };
  })
  .onBeforeHandle({ as: 'scoped' }, ({ user, status }) => {
    if (!user) {
      return status(401, { code: 'UNAUTHORIZED', message: 'Non authentifié' });
    }
  });
