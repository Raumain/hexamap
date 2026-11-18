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
// En production, `FRONTEND_URL` est la référence : c'est l'origine publique
// réellement servie au navigateur.
const knownOrigins = [env.FRONTEND_URL, env.APP_URL]
  .filter((value): value is string => Boolean(value))
  .map((value) => new URL(value).origin);

export const trustedOrigins = [
  ...new Set([
    ...knownOrigins,
    new URL(env.BETTER_AUTH_URL).origin,
    ...devLanOrigins,
    ...extraOrigins,
  ]),
];

// Cookies `Secure` obligatoires en production (HTTPS). Le banc E2E, servi en
// HTTP simple à l'intérieur du réseau Docker, peut les désactiver explicitement.
const useSecureCookies = env.AUTH_COOKIE_SECURE ?? env.NODE_ENV === 'production';

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
  // Le rate limiter Better Auth persiste ses compteurs en base : ils survivent
  // aux redémarrages et sont partagés par toutes les instances de l'API.
  rateLimit: {
    storage: 'database',
  },
  advanced: {
    useSecureCookies,
  },
});
