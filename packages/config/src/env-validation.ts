/**
 * Conditional environment validation.
 * Optional integrations stay optional; production fails closed for the active AI provider.
 * Never logs or returns secret values.
 */

import {
  getAiPlatformConfig,
  isAiRuntimeConfigured,
  type AiProviderId,
} from './ai-platform-config';

function truthy(v: string | undefined | null): boolean {
  if (v == null || v === '') return false;
  const s = String(v).trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'on';
}

function present(env: Record<string, string | undefined>, name: string): boolean {
  return Boolean((env[name] ?? '').toString().trim());
}

export type EnvValidationIssue = {
  code: string;
  severity: 'error' | 'warning';
  message: string;
  subsystem: string;
};

export type EnvValidationResult = {
  ok: boolean;
  production: boolean;
  issues: EnvValidationIssue[];
  providers: Array<{
    name: string;
    status: 'configured' | 'missing' | 'disabled' | 'optional_unconfigured';
    required: boolean;
    mode: 'live' | 'test' | 'unknown' | 'n/a';
    detail: string;
  }>;
};

/**
 * Validate platform env for the current process.
 * @param failClosedProduction — when true (default), missing required production AI keys are errors.
 */
export function validateEnvironmentConfig(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
  options: { failClosedProduction?: boolean } = {},
): EnvValidationResult {
  const failClosed = options.failClosedProduction !== false;
  const production = String(env.NODE_ENV ?? '').toLowerCase() === 'production';
  const issues: EnvValidationIssue[] = [];
  const ai = getAiPlatformConfig(env);
  const webSearchEnabled = truthy(env.WEB_SEARCH_ENABLED as string | undefined);

  const providers: EnvValidationResult['providers'] = [];

  // --- Core (always required in production) ---
  const coreRequired = ['DATABASE_URL', 'APP_SECRET', 'CREDENTIALS_MASTER_KEY', 'WEB_ORIGIN'] as const;
  for (const name of coreRequired) {
    const ok = present(env as Record<string, string | undefined>, name);
    providers.push({
      name,
      status: ok ? 'configured' : 'missing',
      required: production,
      mode: 'n/a',
      detail: ok ? 'set' : 'not set',
    });
    if (production && failClosed && !ok) {
      issues.push({
        code: `missing_${name.toLowerCase()}`,
        severity: 'error',
        message: `${name} is required in production.`,
        subsystem: 'core',
      });
    }
  }

  // --- AI provider (conditional) ---
  const provider: AiProviderId = ai.aiProvider;
  const runtimeOk = isAiRuntimeConfigured(env);
  providers.push({
    name: `ai_provider:${provider}`,
    status: runtimeOk ? 'configured' : 'missing',
    required: production,
    mode: 'live',
    detail: runtimeOk
      ? `${provider} credentials present (value redacted)`
      : `${provider} credentials missing`,
  });

  if (production && failClosed && !runtimeOk) {
    const keyHint =
      provider === 'cohere'
        ? 'COHERE_API_KEY'
        : provider === 'openai'
          ? 'OPENAI_API_KEY'
          : provider === 'xai'
            ? 'XAI_API_KEY'
            : 'GEMINI_API_KEY';
    issues.push({
      code: 'ai_runtime_unconfigured',
      severity: 'error',
      message: `AI_PROVIDER=${provider} requires ${keyHint} in production. Set the key in the deployment secret manager (never commit it).`,
      subsystem: 'ai',
    });
  } else if (!runtimeOk && !production) {
    issues.push({
      code: 'ai_runtime_unconfigured_dev',
      severity: 'warning',
      message: `AI runtime (${provider}) is not configured. Chat will fail closed until the provider key is set locally in .env.`,
      subsystem: 'ai',
    });
  }

  // Cohere models — non-secret flags only
  providers.push({
    name: 'cohere_chat_model',
    status: present(env as Record<string, string | undefined>, 'COHERE_CHAT_MODEL') ||
      present(env as Record<string, string | undefined>, 'COHERE_MODEL')
      ? 'configured'
      : 'optional_unconfigured',
    required: false,
    mode: 'n/a',
    detail: ai.cohereChatModel,
  });
  providers.push({
    name: 'cohere_embed_model',
    status: 'configured',
    required: false,
    mode: 'n/a',
    detail: ai.cohereEmbedModel,
  });
  providers.push({
    name: 'cohere_rerank_model',
    status: 'configured',
    required: false,
    mode: 'n/a',
    detail: ai.cohereRerankModel,
  });

  // --- Web search (optional unless enabled) ---
  const searchKeyOk =
    ai.tavilyConfigured ||
    (ai.openaiConfigured && ai.openaiWebSearchEnabled) ||
    (ai.xaiConfigured && ai.xaiWebSearchEnabled);

  if (!webSearchEnabled) {
    providers.push({
      name: 'web_search',
      status: 'disabled',
      required: false,
      mode: 'n/a',
      detail: 'WEB_SEARCH_ENABLED=false — requests needing live web data return blocked/partial (no invented citations)',
    });
  } else {
    providers.push({
      name: 'web_search',
      status: searchKeyOk ? 'configured' : 'missing',
      required: true,
      mode: 'live',
      detail: searchKeyOk
        ? `enabled via primary=${ai.searchProviderPrimary}`
        : 'WEB_SEARCH_ENABLED=true but no TAVILY_API_KEY / OPENAI_API_KEY / XAI_API_KEY available',
    });
    if (failClosed && !searchKeyOk) {
      issues.push({
        code: 'web_search_enabled_without_key',
        severity: production ? 'error' : 'warning',
        message:
          'WEB_SEARCH_ENABLED is true but no search provider key is configured. Disable search or set TAVILY_API_KEY or OPENAI_API_KEY.',
        subsystem: 'search',
      });
    }
  }

  // --- Stripe (optional) ---
  const stripeSecret = present(env as Record<string, string | undefined>, 'STRIPE_SECRET_KEY');
  const stripeWebhook = present(env as Record<string, string | undefined>, 'STRIPE_WEBHOOK_SECRET');
  if (stripeSecret || stripeWebhook) {
    providers.push({
      name: 'stripe_billing',
      status: stripeSecret && stripeWebhook ? 'configured' : 'missing',
      required: false,
      mode: stripeSecret && String(env.STRIPE_SECRET_KEY ?? '').startsWith('sk_test') ? 'test' : 'live',
      detail:
        stripeSecret && stripeWebhook
          ? 'platform SaaS billing keys present'
          : 'partial Stripe config (secret and webhook both recommended)',
    });
    if (stripeSecret && !stripeWebhook) {
      issues.push({
        code: 'stripe_webhook_missing',
        severity: 'warning',
        message: 'STRIPE_SECRET_KEY is set but STRIPE_WEBHOOK_SECRET is missing.',
        subsystem: 'billing',
      });
    }
  } else {
    providers.push({
      name: 'stripe_billing',
      status: 'optional_unconfigured',
      required: false,
      mode: 'n/a',
      detail: 'Stripe not configured (optional)',
    });
  }

  // --- Redis (optional locally) ---
  providers.push({
    name: 'redis',
    status: present(env as Record<string, string | undefined>, 'REDIS_URL')
      ? 'configured'
      : 'optional_unconfigured',
    required: false,
    mode: 'n/a',
    detail: present(env as Record<string, string | undefined>, 'REDIS_URL')
      ? 'REDIS_URL set'
      : 'REDIS_URL not set',
  });

  const errors = issues.filter((i) => i.severity === 'error');
  return {
    ok: errors.length === 0,
    production,
    issues,
    providers,
  };
}

/**
 * Fail process when production env is incomplete for the active AI runtime.
 * Development only warns (via returned result).
 */
export function assertProductionEnv(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): EnvValidationResult {
  const result = validateEnvironmentConfig(env, { failClosedProduction: true });
  const soft = String(env.TRADEOPS_ENV_VALIDATION ?? '')
    .trim()
    .toLowerCase();
  const warnOnly = soft === 'warn' || soft === 'soft';

  for (const issue of result.issues) {
    const line = `[env] ${issue.severity}: ${issue.message}`;
    if (issue.severity === 'error') console.error(line);
    else console.warn(line);
  }

  if (!result.ok && result.production && !warnOnly) {
    console.error(
      '[env] Production environment validation failed. Fix required keys or set TRADEOPS_ENV_VALIDATION=warn (not recommended).',
    );
    process.exit(1);
  }
  return result;
}

/** Public health-safe summary (no secret values). */
export function envValidationPublicStatus(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
) {
  const r = validateEnvironmentConfig(env, { failClosedProduction: true });
  return {
    ok: r.ok,
    production: r.production,
    issueCount: r.issues.length,
    errorCount: r.issues.filter((i) => i.severity === 'error').length,
    issues: r.issues.map((i) => ({
      code: i.code,
      severity: i.severity,
      subsystem: i.subsystem,
      message: i.message,
    })),
    providers: r.providers,
    checkedAt: new Date().toISOString(),
  };
}
