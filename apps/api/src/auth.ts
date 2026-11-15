import { betterAuth } from 'better-auth';
import { db } from './db';
import { env } from './env';

// Accès dev depuis le LAN : le web est servi sur 5174 et joint via l'IP de la
// machine. Better Auth accepte les motifs à wildcard ; `192.168.*.*` n'accepte
// que des adresses IPv4 (anti DNS-rebinding). Désactivé en production.
const devLanOrigins =
  env.NODE_ENV === 'production'
    ? []
    : [
        'http://localhost:5174',
        'http://localhost:3000',
        'http://192.168.*.*:5174',
        'http://10.*.*.*:5174',
        'http://172.*.*.*:5174',
      ];

const extraOrigins = env.TRUSTED_ORIGINS.split(',')
  .map((s) => s.trim())
  .filter(Boolean);

// Origines de confiance partagées par Better Auth et le middleware CORS.
export const trustedOrigins = [
  env.APP_URL,
  new URL(env.BETTER_AUTH_URL).origin,
  ...devLanOrigins,
  ...extraOrigins,
];

export const auth = betterAuth({
  database: {
    db,
    type: 'postgres',
  },
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins,
  emailAndPassword: {
    enabled: true,
  },
  user: {
    additionalFields: {
      pseudo: {
        type: 'string',
        required: true,
      },
      currency: {
        type: 'number',
        required: false,
        defaultValue: 0,
        input: false,
      },
    },
  },
  rateLimit: {
    storage: 'database',
  },
  advanced: {
    useSecureCookies: env.NODE_ENV === 'production',
  },
});
