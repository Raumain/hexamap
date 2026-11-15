import type { auth } from '@hexamap/api/auth';
import { inferAdditionalFields } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_URL || window.location.origin,
  basePath: '/api/auth',
  plugins: [inferAdditionalFields<typeof auth>()],
});

export const { signIn, signUp, signOut, getSession } = authClient;

export type SessionUser = typeof authClient.$Infer.Session.user;
