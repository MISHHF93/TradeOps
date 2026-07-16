import { z } from 'zod';

/**
 * Platform environment schema.
 * Fail fast on boot if required configuration is missing or invalid.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  API_PORT: z.coerce.number().int().positive().default(4000),
  API_HOST: z.string().default('0.0.0.0'),
  WEB_PORT: z.coerce.number().int().positive().default(3000),
  WEB_ORIGIN: z.string().url().default('http://localhost:3000'),
  API_PUBLIC_URL: z.string().url().default('http://localhost:4000'),

  DATABASE_URL: z
    .string()
    .min(1)
    .default('postgresql://tradeops:tradeops@localhost:5432/tradeops?schema=public'),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),

  APP_SECRET: z.string().min(16).default('dev-only-change-me-to-a-long-random-string'),
  CREDENTIALS_MASTER_KEY: z
    .string()
    .min(1)
    .default('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='),

  /** Server-side session lifetime in hours (cookie + DB expiry). */
  SESSION_TTL_HOURS: z.coerce.number().int().positive().max(720).default(168),

  /**
   * When true (and NODE_ENV is not production), skip session verification and
   * impersonate the seeded demo owner so local UI/API work without login.
   * Forced off in production regardless of the env value.
   */
  AUTH_BYPASS: z
    .union([z.boolean(), z.string()])
    .transform((v) => {
      if (typeof v === 'boolean') return v;
      const s = v.trim().toLowerCase();
      return s === '1' || s === 'true' || s === 'yes' || s === 'on';
    })
    .default(true),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

/**
 * Load and validate environment variables once per process.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (cached) {
    return cached;
  }
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }
  cached = parsed.data;
  return cached;
}

/** Test helper — clears memoized env between cases. */
export function resetEnvCache(): void {
  cached = undefined;
}

export function isProduction(env: Env = loadEnv()): boolean {
  return env.NODE_ENV === 'production';
}

/** Local-only auth bypass (never active in production). */
export function isAuthBypassEnabled(env: Env = loadEnv()): boolean {
  return Boolean(env.AUTH_BYPASS) && env.NODE_ENV !== 'production';
}
