import { betterAuth } from 'better-auth';
import { APIError } from 'better-auth/api';
import { sql } from 'kysely';
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
// compte de la casse. La validation vit ici, pas dans un écran d'inscription,
// parce que Better Auth est la seule porte d'entrée des comptes.
const PSEUDO_MIN_LENGTH = 3;
const PSEUDO_MAX_LENGTH = 24;

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
  databaseHooks: {
    user: {
      create: {
        // Un pseudo hors de 3 à 24 caractères, ou déjà pris à la casse près,
        // est refusé avant toute écriture : le compteur d'erreurs Better Auth
        // n'a rien à réconcilier ensuite.
        before: async (user) => {
          const pseudo = typeof user.pseudo === 'string' ? user.pseudo.trim() : '';
          if (pseudo.length < PSEUDO_MIN_LENGTH || pseudo.length > PSEUDO_MAX_LENGTH) {
            throw new APIError('BAD_REQUEST', {
              message: `Le pseudo doit contenir entre ${PSEUDO_MIN_LENGTH} et ${PSEUDO_MAX_LENGTH} caractères.`,
            });
          }

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
