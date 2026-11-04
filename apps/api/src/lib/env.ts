import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

// Load the .env file before validation runs. `NODE_ENV=test` reads .env.test so
// the suite never points at the development database. Real environment
// variables always win over file contents, which is what lets a deployment
// inject configuration without a file present.
dotenv.config({
  path: path.resolve(
    __dirname,
    '../..',
    process.env.NODE_ENV === 'test' ? '.env.test' : '.env',
  ),
});

/**
 * Environment configuration.
 *
 * Validated once at startup so that a misconfigured deployment fails fast and
 * loudly instead of throwing confusing errors on the first request. Secrets are
 * only ever read from the environment — never hardcoded, never logged.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),

  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required')
    .refine((url) => url.startsWith('postgres://') || url.startsWith('postgresql://'), {
      message: 'DATABASE_URL must be a PostgreSQL connection string (postgresql://...)',
    }),

  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters long'),
  JWT_EXPIRES_IN: z.string().default('7d'),

  COOKIE_NAME: z.string().default('stockflow_token'),
  /** Set to "true" when the API is served over HTTPS. */
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),

  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),

  /** Comma-separated list of allowed browser origins. */
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    // Only the variable names and messages are printed, never the values.
    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  return parsed.data;
}

export const env = loadEnv();

export const corsOrigins = env.CORS_ORIGIN.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
