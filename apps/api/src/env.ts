import { z } from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.string().min(1),
    APP_URL: z.url(),
    BETTER_AUTH_URL: z.url(),
    BETTER_AUTH_SECRET: z.string().min(32),
    // Origine unique du frontend autorisée en production (liste blanche CORS et
    // origines de confiance Better Auth). Obligatoire en production.
    FRONTEND_URL: z.url().optional(),
    // Origines supplémentaires autorisées (CORS + Better Auth), séparées par des virgules.
    TRUSTED_ORIGINS: z.string().default(''),
    // Adresses ou CIDR des mandataires de confiance pour la résolution de l'IP
    // cliente (reverse proxy, ingress). Vide par défaut : tant que la bordure
    // d'hébergement n'est pas connue, aucun en-tête `X-Forwarded-For` n'est cru
    // et l'IP reste celle de la connexion. Séparés par des virgules.
    TRUSTED_PROXIES: z.string().default(''),
    // Cookies `Secure` : forcés en production, désactivables uniquement pour les
    // bancs de test servis en HTTP simple (jamais en production réelle).
    AUTH_COOKIE_SECURE: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .optional(),
    // Répertoire des blasons SVG (volume Docker `blasons`), produits hors ligne.
    BLASONS_DIR: z.string().default('/data/blasons'),
    // Répertoire du fichier d'état partagé avec le pipeline d'import (volume Docker
    // `importstatus`), lu par la page de suivi temporaire.
    IMPORT_STATUS_DIR: z.string().default('/data/import-status'),
    // Répertoire contenant le front construit (`dist` de Vite), servi par l'API.
    WEB_DIST_DIR: z.string().default('./public'),
    // Interrupteur explicite : autorise l'API à servir le front hors production.
    // En production, le service est toujours actif.
    SERVE_WEB: z.enum(['true', 'false']).optional(),
    // Boutique : toutes optionnelles, une valeur vide ferme la boutique (503).
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
    STRIPE_PRICE_PACK_500: z.string().optional(),
    STRIPE_PRICE_PACK_1200: z.string().optional(),
    STRIPE_PRICE_PACK_2500: z.string().optional(),
    STRIPE_PRICE_PACK_6000: z.string().optional(),
    // Consentement aux CGV au paiement. Désactivé par défaut : Stripe refuse
    // `terms_of_service: 'required'` tant qu'aucune URL de CGV n'est configurée
    // dans le Dashboard (Settings → Business → Public details). Un checkout
    // cassé est pire qu'une case absente : l'interrupteur s'allume une fois
    // l'URL en place (`.docs/05-deploiement.md` §7).
    SHOP_REQUIRE_TOS_CONSENT: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .optional(),
    // Fermeture de compte : le défaut du code reste `false` parce qu'une
    // spécification exerce les **deux** états dans un même processus en
    // supprimant la variable (`packages/spec/src/account.spec.ts`). L'ouverture
    // est une décision d'exploitation, pas un défaut : `.env.example` pose
    // `ACCOUNT_DELETION_ENABLED=true`, et la variable est relue à chaque appel.
    // Le défaut est posé **avant** la transformation : en Zod 4, `.default()`
    // s'applique à la sortie, et `'false'` y serait une chaîne, donc vraie.
    ACCOUNT_DELETION_ENABLED: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    // Transport de courriel : répertoire où les messages de vérification sont
    // écrits, un fichier JSON par message. Aucun envoi réseau ; sans lui, le
    // changement d'adresse répond 503.
    MAIL_OUTBOX_DIR: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    // La valeur d'exemple de `.env.example` ne doit jamais servir de secret :
    // `min(32)` la refuserait si elle était courte, mais un opérateur pourrait
    // l'allonger. Le motif couvre toutes les répétitions de `change-me`, quelle
    // que soit leur longueur.
    if (/^change-me(-change-me)*$/.test(value.BETTER_AUTH_SECRET)) {
      ctx.addIssue({
        code: 'custom',
        path: ['BETTER_AUTH_SECRET'],
        message:
          'BETTER_AUTH_SECRET ne peut pas être la valeur d’exemple « change-me » : générez un secret aléatoire d’au moins 32 octets, par exemple avec `openssl rand -base64 48`.',
      });
    }

    if (value.NODE_ENV === 'production' && !value.FRONTEND_URL) {
      ctx.addIssue({
        code: 'custom',
        path: ['FRONTEND_URL'],
        message:
          'FRONTEND_URL est obligatoire en production : elle définit la seule origine autorisée par CORS.',
      });
    }

    // En production réelle, un cookie de session non `Secure` circule en clair.
    // La dérogation n'existe que pour un banc servi en HTTP simple.
    if (value.NODE_ENV === 'production' && value.AUTH_COOKIE_SECURE === false) {
      ctx.addIssue({
        code: 'custom',
        path: ['AUTH_COOKIE_SECURE'],
        message:
          'AUTH_COOKIE_SECURE=false est interdit en production : les cookies de session doivent porter l’attribut Secure. Cette dérogation est réservée aux bancs de test en HTTP.',
      });
    }
  });

export const env = envSchema.parse(process.env);

export type Env = z.infer<typeof envSchema>;
