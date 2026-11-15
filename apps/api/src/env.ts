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
});

export const env = envSchema.parse(process.env);

export type Env = z.infer<typeof envSchema>;
