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
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV === 'production' && !value.FRONTEND_URL) {
      ctx.addIssue({
        code: 'custom',
        path: ['FRONTEND_URL'],
        message:
          'FRONTEND_URL est obligatoire en production : elle définit la seule origine autorisée par CORS.',
      });
    }
  });

export const env = envSchema.parse(process.env);

export type Env = z.infer<typeof envSchema>;
