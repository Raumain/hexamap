import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  APP_URL: z.url(),
  BETTER_AUTH_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  // Origines supplémentaires autorisées (CORS + Better Auth), séparées par des virgules.
  TRUSTED_ORIGINS: z.string().default(''),
  // Répertoire des blasons SVG (volume Docker `blasons`), produits hors ligne.
  BLASONS_DIR: z.string().default('/data/blasons'),
  // Répertoire du fichier d'état partagé avec le pipeline d'import (volume Docker
  // `importstatus`), lu par la page de suivi temporaire.
  IMPORT_STATUS_DIR: z.string().default('/data/import-status'),
});

export const env = envSchema.parse(process.env);

export type Env = z.infer<typeof envSchema>;
