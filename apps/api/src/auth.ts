import { pseudoErrorMessage, validatePseudo } from '@hexamap/shared';
import { betterAuth } from 'better-auth';
import { APIError } from 'better-auth/api';
import { sql } from 'kysely';
import { db } from './db';
import { env } from './env';
import { accountDeletionEnabled } from './lib/account-switch';
import { sendVerificationMail } from './lib/mailer';

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

// Sans mandataire de confiance, aucune IP cliente n'est résolue et Better Auth
// replie tout le trafic sur un seau de rate limiting unique par chemin : un
// attaquant peut alors épuiser la limite de connexion de tous les joueurs.
// L'avertissement reste un avertissement — une bordure légitime peut terminer
// TLS sans produire d'`X-Forwarded-For`, et un échec au démarrage couperait
// l'application pour un réglage perfectible.
if (env.NODE_ENV === 'production' && env.TRUSTED_PROXIES.trim() === '') {
  console.warn(
    '[hexamap] TRUSTED_PROXIES est vide : aucune adresse IP cliente n’est résolue derrière un mandataire, donc le rate limiting d’authentification est réduit à un unique seau partagé par chemin. Un attaquant peut épuiser la limite de connexion de tous les joueurs. Renseignez l’adresse ou le CIDR du reverse proxy dans TRUSTED_PROXIES (séparés par des virgules) et transmettez X-Forwarded-For depuis la bordure.',
  );
}

// Le pseudo est l'identité publique (`.docs/01-architecture.md` §2.9) : il sert
// d'URL dans `/players/:id`, donc il est validé en forme et unique sans tenir
// compte de la casse. La forme est décidée une seule fois, par
// `packages/shared/src/pseudo.ts` ; l'unicité reste ici parce que Better Auth
// est la seule porte d'entrée des comptes.
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
  // Le changement de courriel passe par un lien signé : aucune colonne
  // `pendingEmail` n'existe, c'est l'ouverture du lien qui écrit. L'inscription
  // n'envoie rien (`sendOnSignUp: false`) : elle garde son comportement actuel.
  emailVerification: {
    expiresIn: 3600,
    sendOnSignUp: false,
    sendVerificationEmail: async ({ user, url }) => {
      await sendVerificationMail({ to: user.email, url });
    },
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
    changeEmail: {
      enabled: true,
    },
    // Better Auth répond 404 si la suppression n'est pas activée. Elle l'est,
    // mais un `beforeDelete` la refuse tant que l'interrupteur est éteint : le
    // chemin direct `POST /api/auth/delete-user` ne contourne donc pas le 503
    // de la route métier.
    deleteUser: {
      enabled: true,
      beforeDelete: async () => {
        if (!accountDeletionEnabled()) {
          throw new APIError('SERVICE_UNAVAILABLE', {
            message: 'La suppression de compte est momentanément indisponible.',
            code: 'ACCOUNT_DELETION_DISABLED',
          });
        }
      },
    },
  },
  // Le rate limiter Better Auth persiste ses compteurs en base : ils survivent
  // aux redémarrages et sont partagés par toutes les instances de l'API.
  databaseHooks: {
    user: {
      create: {
        // Un pseudo hors de 3 à 24 caractères, mal formé, ou déjà pris à la
        // casse près, est refusé avant toute écriture : le compteur d'erreurs
        // Better Auth n'a rien à réconcilier ensuite.
        before: async (user) => {
          const raw = typeof user.pseudo === 'string' ? user.pseudo : '';
          const validation = validatePseudo(raw);
          if (!validation.ok) {
            throw new APIError('BAD_REQUEST', {
              message: pseudoErrorMessage(validation.problem),
            });
          }

          const pseudo = validation.pseudo;
          const taken = await sql<{ id: string }>`
            select id from "user" where lower(pseudo) = lower(${pseudo}) limit 1
          `.execute(db);
          if (taken.rows.length > 0) {
            throw new APIError('BAD_REQUEST', { message: 'Ce pseudo est déjà pris.' });
          }

          return { data: { ...user, pseudo } };
        },
      },
    },
  },
  rateLimit: {
    storage: 'database',
    // `/get-session` est une lecture bon marché, montée par chaque chargement de
    // page. Le plafond par défaut de Better Auth (100 par fenêtre et par IP) est
    // donc atteint par un navigateur qui enchaîne les navigations, et par tout
    // joueur derrière un NAT partagé. Au-delà, l'API répond 429 : le client ne
    // peut plus vérifier sa session et l'écran de panne s'affiche. Mesuré sur le
    // banc E2E (quatre tentatives de suite refusées, toutes en 429), puis en
    // rafale sur cette route (75 × 200, puis 45 × 429, `count` bloqué à 100).
    // Le plafond est relevé pour cette seule route : les règles qui protègent les
    // identifiants (connexion, inscription) restent celles par défaut.
    customRules: {
      '/get-session': { window: 10, max: 1000 },
    },
  },
  advanced: {
    useSecureCookies,
    // Résolution de l'IP cliente (A3). Sans elle, `session.ipAddress` reste vide
    // et Better Auth replie tout le trafic sur un unique seau de rate limiting :
    // un joueur peut alors épuiser la limite de tous les autres derrière le
    // mandataire d'hébergement.
    //
    // `ipAddressHeaders` nomme les en-têtes lus ; `trustedProxies` dit à qui
    // faire confiance pour les écrire. La liste reste vide tant que la bordure
    // n'est pas connue : aucun en-tête n'est cru, donc aucune IP ne peut être
    // falsifiée par un client. Renseigner `TRUSTED_PROXIES` au déploiement.
    ipAddress: {
      ipAddressHeaders: ['x-forwarded-for'],
      trustedProxies: env.TRUSTED_PROXIES.split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    },
  },
});
