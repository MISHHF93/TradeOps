import { z } from 'zod';
import {
  FOUNDER_DIRECT_DEFAULTS,
  founderDirectPublicWarning,
  getAccessMode,
  isAuthenticatedAccessMode,
  isDirectIdentityEnabled,
  isFounderDirectAccess,
  isLikelyPublicDeployment,
  parseAccessMode,
  type TradeOpsAccessMode,
} from './access-mode';
import { loadDotEnvFiles } from './dotenv';

export { loadDotEnvFiles, type DotEnvLoadResult } from './dotenv';

export {
  ACCESS_MODES,
  FOUNDER_DIRECT_DEFAULTS,
  founderDirectPublicWarning,
  getAccessMode,
  isAuthenticatedAccessMode,
  isDirectIdentityEnabled,
  isFounderDirectAccess,
  isLikelyPublicDeployment,
  parseAccessMode,
  type TradeOpsAccessMode,
} from './access-mode';

export {
  assertSecurityBoot,
  evaluateSecurityBoot,
  isLoopbackHost,
  isPublicNetworkBind,
  isWeakAppSecret,
  isWeakCredentialsKey,
  type SecurityBootEnv,
  type SecurityBootResult,
} from './security-boot';

export {
  getXaiConfig,
  isXaiConfigured,
  parseAiMode,
  resolveAiMode,
  resolveXaiApiKey,
  shouldDefaultGenerate,
  shouldUseXai,
  xaiPublicStatus,
  type ResolvedAiMode,
  type TradeOpsAiMode,
  type XaiConfig,
} from './xai-config';

export {
  getAiPlatformConfig,
  aiPlatformPublicStatus,
  isAiRuntimeConfigured,
  type AiPlatformConfig,
  type AiProviderId,
  type SearchProviderId,
} from './ai-platform-config';

export {
  PLATFORM_ENV_MANIFEST,
  TENANT_SCOPED_CREDENTIAL_NAMES,
  ENV_ALIASES,
  listManifestSecrets,
  listRequiredProductionEnv,
  resolveEnvAlias,
  environmentManifestPublicStatus,
  type EnvVarManifest,
  type EnvStorage,
} from './environment-manifest';

export {
  validateEnvironmentConfig,
  assertProductionEnv,
  envValidationPublicStatus,
  type EnvValidationIssue,
  type EnvValidationResult,
} from './env-validation';

/**
 * Platform environment schema.
 * Fail fast on boot if required configuration is missing or invalid.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  API_PORT: z.coerce.number().int().positive().default(4000),
  /**
   * Default 127.0.0.1 — loopback only. Use 0.0.0.0 only behind a reverse proxy
   * with auth, and never with founder_direct on the public internet.
   */
  API_HOST: z.string().default('127.0.0.1'),
  WEB_PORT: z.coerce.number().int().positive().default(3000),
  /** Prefer 127.0.0.1 so Next binds loopback when start.mjs passes -H */
  WEB_HOST: z.string().default('127.0.0.1'),
  WEB_ORIGIN: z.string().url().default('http://localhost:3000'),
  API_PUBLIC_URL: z.string().url().default('http://127.0.0.1:4000'),

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
   * Application access mode (central switch — see access-mode.ts).
   * founder_direct | authenticated | multi_tenant
   */
  TRADEOPS_ACCESS_MODE: z
    .string()
    .optional()
    .transform((v) => parseAccessMode(v)),

  /**
   * When true (and not production, unless founder_direct), allow synthetic
   * founder identity without a session cookie. Prefer TRADEOPS_ACCESS_MODE.
   */
  AUTH_BYPASS: z
    .union([z.boolean(), z.string()])
    .transform((v) => {
      if (typeof v === 'boolean') return v;
      const s = v.trim().toLowerCase();
      return s === '1' || s === 'true' || s === 'yes' || s === 'on';
    })
    .default(true),

  /**
   * Force the founder-direct public-deployment warning even on localhost.
   */
  TRADEOPS_PUBLIC_WARNING: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((v) => {
      if (v === undefined) return false;
      if (typeof v === 'boolean') return v;
      const s = v.trim().toLowerCase();
      return s === '1' || s === 'true' || s === 'yes' || s === 'on';
    }),

  /**
   * Cohere (sole generative provider for operator Phase B).
   * Optional at boot — missing key blocks Phase B honestly; tools still run.
   * Empty / whitespace-only values are normalized to undefined.
   */
  COHERE_API_KEY: z
    .string()
    .optional()
    .transform((v) => {
      const t = v?.trim();
      return t ? t : undefined;
    }),
  CO_API_KEY: z
    .string()
    .optional()
    .transform((v) => {
      const t = v?.trim();
      return t ? t : undefined;
    }),
  COHERE_CHAT_MODEL: z
    .string()
    .optional()
    .transform((v) => {
      const t = v?.trim();
      return t ? t : 'command-a-plus-05-2026';
    })
    .default('command-a-plus-05-2026'),
  COHERE_EMBED_MODEL: z
    .string()
    .optional()
    .transform((v) => {
      const t = v?.trim();
      return t ? t : 'embed-v4.0';
    })
    .default('embed-v4.0'),
  COHERE_RERANK_MODEL: z
    .string()
    .optional()
    .transform((v) => {
      const t = v?.trim();
      return t ? t : 'rerank-v3.5';
    })
    .default('rerank-v3.5'),
  AI_PROVIDER: z.string().optional(),
});

export type Env = z.infer<typeof envSchema> & {
  TRADEOPS_ACCESS_MODE: TradeOpsAccessMode;
};

let cached: Env | undefined;
let dotenvLoaded = false;

/**
 * Load dotenv files then validate environment variables once per process.
 * When `source === process.env`, monorepo root / apps/api `.env*` files are applied first.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (cached && source === process.env) {
    return cached;
  }
  // Load .env into process.env so adapters reading process.env see COHERE_* etc.
  if (source === process.env && !dotenvLoaded) {
    loadDotEnvFiles(process.env);
    dotenvLoaded = true;
  }
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }
  const data = parsed.data;
  // Mirror validated Cohere key into process.env for ai-runtime adapters
  if (source === process.env) {
    const key = data.COHERE_API_KEY || data.CO_API_KEY;
    if (key) {
      process.env.COHERE_API_KEY = key;
    } else {
      // Ensure empty placeholders don't count as configured
      if (process.env.COHERE_API_KEY?.trim() === '') delete process.env.COHERE_API_KEY;
      if (process.env.CO_API_KEY?.trim() === '') delete process.env.CO_API_KEY;
    }
    if (data.COHERE_CHAT_MODEL) process.env.COHERE_CHAT_MODEL = data.COHERE_CHAT_MODEL;
    if (data.COHERE_EMBED_MODEL) process.env.COHERE_EMBED_MODEL = data.COHERE_EMBED_MODEL;
    if (data.COHERE_RERANK_MODEL) process.env.COHERE_RERANK_MODEL = data.COHERE_RERANK_MODEL;
  }
  const result: Env = {
    ...data,
    TRADEOPS_ACCESS_MODE: data.TRADEOPS_ACCESS_MODE ?? parseAccessMode(undefined),
  };
  if (source === process.env) {
    cached = result;
  }
  return result;
}

/** Test helper — clears memoized env between cases. */
export function resetEnvCache(): void {
  cached = undefined;
  dotenvLoaded = false;
}

/** Effective Cohere API key after trim (undefined if missing/empty). */
export function getCohereApiKey(env: Env = loadEnv()): string | undefined {
  return env.COHERE_API_KEY || env.CO_API_KEY || undefined;
}

export function isProduction(env: Env = loadEnv()): boolean {
  return env.NODE_ENV === 'production';
}

/**
 * Whether the API may resolve identity without a session cookie.
 * Prefer TRADEOPS_ACCESS_MODE=founder_direct over AUTH_BYPASS alone.
 */
export function isAuthBypassEnabled(env: Env = loadEnv()): boolean {
  return isDirectIdentityEnabled({
    TRADEOPS_ACCESS_MODE: env.TRADEOPS_ACCESS_MODE,
    AUTH_BYPASS: env.AUTH_BYPASS,
    NODE_ENV: env.NODE_ENV,
  });
}

/** Convenience wrappers bound to loaded env. */
export function accessMode(env: Env = loadEnv()): TradeOpsAccessMode {
  return getAccessMode({ TRADEOPS_ACCESS_MODE: env.TRADEOPS_ACCESS_MODE });
}

export function founderAccessActive(env: Env = loadEnv()): boolean {
  return isFounderDirectAccess({ TRADEOPS_ACCESS_MODE: env.TRADEOPS_ACCESS_MODE });
}

export function publicAccessWarning(env: Env = loadEnv()): string | null {
  return founderDirectPublicWarning({
    TRADEOPS_ACCESS_MODE: env.TRADEOPS_ACCESS_MODE,
    WEB_ORIGIN: env.WEB_ORIGIN,
    TRADEOPS_PUBLIC_WARNING: env.TRADEOPS_PUBLIC_WARNING ? 'true' : undefined,
  });
}

// Re-export constants used by bootstrap
export { FOUNDER_DIRECT_DEFAULTS as FOUNDER_DEFAULTS };

export {
  type FinancialGateKey,
  type FinancialGateState,
  FINANCIAL_GATE_ENV_NAMES,
  isFinancialGateEnabled,
  getFinancialGate,
  listFinancialGates,
  assertFinancialGate,
  capitalWriteMode,
  financialDomainCatalog,
} from './financial-gates';

export {
  type CapitalProductMode,
  getCapitalProductMode,
  isPooledInvestmentEnabled,
  isGuaranteedReturnsEnabled,
  isInternalCustodyEnabled,
  capitalModeCatalog,
  assertNotPooledInvestment,
  assertNoGuaranteedReturns,
  assertNoInternalCustodyInProduction,
} from './capital-mode';
