/**
 * TradeOps Environment Manifest — derived from repository scan (not speculative).
 * Source of truth: packages/apps/scripts process.env usage + typed config modules.
 *
 * Secrets: never store real values here.
 */

export type EnvScope = 'development' | 'test' | 'preview' | 'production' | 'all';

export type EnvStorage = 'platform_env' | 'tenant_connector_vault' | 'browser_public' | 'os_only';

export type EnvVarManifest = {
  name: string;
  subsystem: string;
  secret: boolean;
  requiredInProduction: boolean;
  serverOnly: boolean;
  storage: EnvStorage;
  description: string;
  aliases?: string[];
  deprecated?: boolean;
  replacement?: string;
  safeDefault?: string;
};

/**
 * Canonical platform variables used by code paths today.
 * Vendor paste templates in .env that are not yet read by code are listed separately as optional inventory.
 */
export const PLATFORM_ENV_MANIFEST: EnvVarManifest[] = [
  // Core
  { name: 'NODE_ENV', subsystem: 'core', secret: false, requiredInProduction: true, serverOnly: true, storage: 'platform_env', description: 'Node environment', safeDefault: 'development' },
  { name: 'LOG_LEVEL', subsystem: 'core', secret: false, requiredInProduction: false, serverOnly: true, storage: 'platform_env', description: 'Pino log level', safeDefault: 'info' },
  { name: 'API_PORT', subsystem: 'core', secret: false, requiredInProduction: false, serverOnly: true, storage: 'platform_env', description: 'API listen port', safeDefault: '4000' },
  { name: 'API_HOST', subsystem: 'core', secret: false, requiredInProduction: false, serverOnly: true, storage: 'platform_env', description: 'API bind host', safeDefault: '127.0.0.1' },
  { name: 'WEB_PORT', subsystem: 'core', secret: false, requiredInProduction: false, serverOnly: true, storage: 'platform_env', description: 'Web listen port', safeDefault: '3000' },
  { name: 'WEB_HOST', subsystem: 'core', secret: false, requiredInProduction: false, serverOnly: true, storage: 'platform_env', description: 'Web bind host', safeDefault: '127.0.0.1' },
  { name: 'WEB_ORIGIN', subsystem: 'core', secret: false, requiredInProduction: true, serverOnly: true, storage: 'platform_env', description: 'Browser origin for CORS/cookies', safeDefault: 'http://localhost:3000' },
  { name: 'API_PUBLIC_URL', subsystem: 'core', secret: false, requiredInProduction: true, serverOnly: false, storage: 'platform_env', description: 'Public API base URL', safeDefault: 'http://127.0.0.1:4000' },
  { name: 'NEXT_PUBLIC_API_PUBLIC_URL', subsystem: 'core', secret: false, requiredInProduction: false, serverOnly: false, storage: 'browser_public', description: 'Browser API base URL (public)', safeDefault: 'http://127.0.0.1:4000' },
  { name: 'API_TIMEOUT_MS', subsystem: 'core', secret: false, requiredInProduction: false, serverOnly: false, storage: 'platform_env', description: 'Client API timeout', safeDefault: '60000' },
  { name: 'NEXT_PUBLIC_API_TIMEOUT_MS', subsystem: 'core', secret: false, requiredInProduction: false, serverOnly: false, storage: 'browser_public', description: 'Browser API timeout', safeDefault: '60000' },

  // Database / cache
  { name: 'DATABASE_URL', subsystem: 'database', secret: true, requiredInProduction: true, serverOnly: true, storage: 'platform_env', description: 'PostgreSQL connection string' },
  { name: 'REDIS_URL', subsystem: 'cache', secret: true, requiredInProduction: false, serverOnly: true, storage: 'platform_env', description: 'Redis URL (optional locally)', safeDefault: 'redis://localhost:6379' },

  // Security
  { name: 'APP_SECRET', subsystem: 'security', secret: true, requiredInProduction: true, serverOnly: true, storage: 'platform_env', description: 'Session/cookie signing secret' },
  { name: 'CREDENTIALS_MASTER_KEY', subsystem: 'security', secret: true, requiredInProduction: true, serverOnly: true, storage: 'platform_env', description: 'AES key for connector credential encryption' },
  { name: 'SESSION_TTL_HOURS', subsystem: 'security', secret: false, requiredInProduction: false, serverOnly: true, storage: 'platform_env', description: 'Session TTL hours', safeDefault: '168' },

  // Access / tenancy
  { name: 'TRADEOPS_ACCESS_MODE', subsystem: 'tenancy', secret: false, requiredInProduction: true, serverOnly: true, storage: 'platform_env', description: 'founder_direct | authenticated | multi_tenant', safeDefault: 'founder_direct' },
  { name: 'NEXT_PUBLIC_TRADEOPS_ACCESS_MODE', subsystem: 'tenancy', secret: false, requiredInProduction: false, serverOnly: false, storage: 'browser_public', description: 'Public access-mode hint for UI' },
  { name: 'AUTH_BYPASS', subsystem: 'tenancy', secret: false, requiredInProduction: false, serverOnly: true, storage: 'platform_env', description: 'Dev-only synthetic identity (never production)', safeDefault: 'true' },
  { name: 'TRADEOPS_PUBLIC_WARNING', subsystem: 'tenancy', secret: false, requiredInProduction: false, serverOnly: true, storage: 'platform_env', description: 'Force public founder warning' },
  { name: 'TRADEOPS_SECURITY_BOOT', subsystem: 'security', secret: false, requiredInProduction: false, serverOnly: true, storage: 'platform_env', description: 'Security boot enforcement mode' },
  { name: 'TRADEOPS_ALLOW_INSECURE_BIND', subsystem: 'security', secret: false, requiredInProduction: false, serverOnly: true, storage: 'platform_env', description: 'Allow 0.0.0.0 bind override' },
  { name: 'TRADEOPS_ALLOW_PUBLIC_FOUNDER', subsystem: 'security', secret: false, requiredInProduction: false, serverOnly: true, storage: 'platform_env', description: 'Allow founder_direct on public bind' },

  // AI — Cohere runtime (canonical)
  { name: 'AI_PROVIDER', subsystem: 'ai', secret: false, requiredInProduction: true, serverOnly: true, storage: 'platform_env', description: 'cohere | openai | xai | auto', safeDefault: 'cohere' },
  { name: 'COHERE_API_KEY', subsystem: 'ai', secret: true, requiredInProduction: true, serverOnly: true, storage: 'platform_env', description: 'Cohere server API key (rotated; never NEXT_PUBLIC)' },
  { name: 'COHERE_BASE_URL', subsystem: 'ai', secret: false, requiredInProduction: false, serverOnly: true, storage: 'platform_env', description: 'Cohere API base', safeDefault: 'https://api.cohere.com' },
  { name: 'COHERE_CHAT_MODEL', subsystem: 'ai', secret: false, requiredInProduction: false, serverOnly: true, storage: 'platform_env', description: 'Chat model id', safeDefault: 'command-a-03-2025', aliases: ['COHERE_MODEL'] },
  { name: 'COHERE_EMBED_MODEL', subsystem: 'ai', secret: false, requiredInProduction: false, serverOnly: true, storage: 'platform_env', description: 'Embed model', safeDefault: 'embed-v4.0' },
  { name: 'COHERE_RERANK_MODEL', subsystem: 'ai', secret: false, requiredInProduction: false, serverOnly: true, storage: 'platform_env', description: 'Rerank model', safeDefault: 'rerank-v3.5' },
  { name: 'COHERE_TEMPERATURE', subsystem: 'ai', secret: false, requiredInProduction: false, serverOnly: true, storage: 'platform_env', description: 'Default temperature', safeDefault: '0.2' },
  { name: 'COHERE_MAX_TOKENS', subsystem: 'ai', secret: false, requiredInProduction: false, serverOnly: true, storage: 'platform_env', description: 'Default max tokens', safeDefault: '4000' },
  { name: 'COHERE_TIMEOUT_MS', subsystem: 'ai', secret: false, requiredInProduction: false, serverOnly: true, storage: 'platform_env', description: 'Request timeout', safeDefault: '60000', aliases: ['COHERE_REQUEST_TIMEOUT_MS'] },
  { name: 'COHERE_RETRIEVAL_ENABLED', subsystem: 'ai', secret: false, requiredInProduction: false, serverOnly: true, storage: 'platform_env', description: 'Enable Cohere retrieval engine', safeDefault: 'true' },
  { name: 'AI_MAX_TOOL_ROUNDS', subsystem: 'ai', secret: false, requiredInProduction: false, serverOnly: true, storage: 'platform_env', description: 'Agent tool selection rounds', safeDefault: '8' },
  { name: 'AI_MAX_TOOL_CALLS', subsystem: 'ai', secret: false, requiredInProduction: false, serverOnly: true, storage: 'platform_env', description: 'Max tools per request', safeDefault: '15' },
  { name: 'AI_MAX_EXECUTION_SECONDS', subsystem: 'ai', secret: false, requiredInProduction: false, serverOnly: true, storage: 'platform_env', description: 'Agent wall clock budget', safeDefault: '120' },
  { name: 'AI_REQUIRE_APPROVAL_FOR_WRITES', subsystem: 'ai', secret: false, requiredInProduction: false, serverOnly: true, storage: 'platform_env', description: 'Gate write actions', safeDefault: 'true' },
  { name: 'AI_REQUIRE_APPROVAL_FOR_PAYMENTS', subsystem: 'ai', secret: false, requiredInProduction: false, serverOnly: true, storage: 'platform_env', description: 'Gate payment actions', safeDefault: 'true' },
  { name: 'AI_REQUIRE_APPROVAL_FOR_REFUNDS', subsystem: 'ai', secret: false, requiredInProduction: false, serverOnly: true, storage: 'platform_env', description: 'Gate refunds', safeDefault: 'true' },
  { name: 'AI_REQUIRE_APPROVAL_FOR_PUBLISHING', subsystem: 'ai', secret: false, requiredInProduction: false, serverOnly: true, storage: 'platform_env', description: 'Gate listing publish', safeDefault: 'true' },
  { name: 'AI_STRUCTURED_OUTPUT_ENABLED', subsystem: 'ai', secret: false, requiredInProduction: false, serverOnly: true, storage: 'platform_env', description: 'JSON schema synthesis', safeDefault: 'true' },
  { name: 'AI_TOOL_CALLING_ENABLED', subsystem: 'ai', secret: false, requiredInProduction: false, serverOnly: true, storage: 'platform_env', description: 'Enable tool selection', safeDefault: 'true' },
  { name: 'AI_STREAMING_ENABLED', subsystem: 'ai', secret: false, requiredInProduction: false, serverOnly: true, storage: 'platform_env', description: 'Streaming (progressive)', safeDefault: 'true' },
  { name: 'AI_RESPONSE_MODE', subsystem: 'ai', secret: false, requiredInProduction: false, serverOnly: true, storage: 'platform_env', description: 'json_schema | json_object | text', safeDefault: 'json_schema' },
  { name: 'AI_OUTPUT_SCHEMA_VERSION', subsystem: 'ai', secret: false, requiredInProduction: false, serverOnly: true, storage: 'platform_env', description: 'Envelope schema version', safeDefault: '1.0' },

  // Search (TradeOps-owned)
  { name: 'WEB_SEARCH_ENABLED', subsystem: 'search', secret: false, requiredInProduction: false, serverOnly: true, storage: 'platform_env', description: 'Enable public web search', safeDefault: 'false' },
  { name: 'SEARCH_PROVIDER_PRIMARY', subsystem: 'search', secret: false, requiredInProduction: false, serverOnly: true, storage: 'platform_env', description: 'openai | tavily | xai', safeDefault: 'openai' },
  { name: 'SEARCH_PROVIDER_RETRIEVAL', subsystem: 'search', secret: false, requiredInProduction: false, serverOnly: true, storage: 'platform_env', description: 'Retrieval preference', safeDefault: 'openai' },
  { name: 'SEARCH_PROVIDER_INTERNAL', subsystem: 'search', secret: false, requiredInProduction: false, serverOnly: true, storage: 'platform_env', description: 'cohere | local', safeDefault: 'cohere' },
  { name: 'SEARCH_REQUIRE_CITATIONS', subsystem: 'search', secret: false, requiredInProduction: false, serverOnly: true, storage: 'platform_env', description: 'Require citations when search allowed', safeDefault: 'true' },
  { name: 'SEARCH_MAX_QUERIES_PER_REQUEST', subsystem: 'search', secret: false, requiredInProduction: false, serverOnly: true, storage: 'platform_env', description: 'Max search queries', safeDefault: '6' },
  { name: 'SEARCH_MAX_RESULTS_PER_QUERY', subsystem: 'search', secret: false, requiredInProduction: false, serverOnly: true, storage: 'platform_env', description: 'Max results per query', safeDefault: '10' },
  { name: 'SEARCH_DEFAULT_CACHE_TTL_SECONDS', subsystem: 'search', secret: false, requiredInProduction: false, serverOnly: true, storage: 'platform_env', description: 'Search cache TTL', safeDefault: '3600' },
  { name: 'SEARCH_ALLOWED_DOMAINS', subsystem: 'search', secret: false, requiredInProduction: false, serverOnly: true, storage: 'platform_env', description: 'CSV allowlist' },
  { name: 'SEARCH_BLOCKED_DOMAINS', subsystem: 'search', secret: false, requiredInProduction: false, serverOnly: true, storage: 'platform_env', description: 'CSV blocklist' },
  { name: 'TAVILY_API_KEY', subsystem: 'search', secret: true, requiredInProduction: false, serverOnly: true, storage: 'platform_env', description: 'Optional Tavily retrieval key' },
  { name: 'TAVILY_SEARCH_ENABLED', subsystem: 'search', secret: false, requiredInProduction: false, serverOnly: true, storage: 'platform_env', description: 'Enable Tavily search', safeDefault: 'true' },
  { name: 'TAVILY_EXTRACT_ENABLED', subsystem: 'search', secret: false, requiredInProduction: false, serverOnly: true, storage: 'platform_env', description: 'Enable Tavily extract', safeDefault: 'true' },
  { name: 'TAVILY_CRAWL_ENABLED', subsystem: 'search', secret: false, requiredInProduction: false, serverOnly: true, storage: 'platform_env', description: 'Enable Tavily crawl', safeDefault: 'true' },
  { name: 'TAVILY_RESEARCH_ENABLED', subsystem: 'search', secret: false, requiredInProduction: false, serverOnly: true, storage: 'platform_env', description: 'Enable Tavily research', safeDefault: 'true' },
  { name: 'OPENAI_API_KEY', subsystem: 'search', secret: true, requiredInProduction: false, serverOnly: true, storage: 'platform_env', description: 'Optional OpenAI for web search / generation fallback' },
  { name: 'OPENAI_MODEL', subsystem: 'search', secret: false, requiredInProduction: false, serverOnly: true, storage: 'platform_env', description: 'OpenAI model', safeDefault: 'gpt-4o', aliases: ['OPENAI_CHAT_MODEL'] },
  { name: 'OPENAI_BASE_URL', subsystem: 'search', secret: false, requiredInProduction: false, serverOnly: true, storage: 'platform_env', description: 'OpenAI base URL', safeDefault: 'https://api.openai.com/v1' },
  { name: 'OPENAI_WEB_SEARCH_ENABLED', subsystem: 'search', secret: false, requiredInProduction: false, serverOnly: true, storage: 'platform_env', description: 'OpenAI Responses web search', safeDefault: 'true' },

  // Optional alternate generation (xAI) — not primary
  { name: 'XAI_API_KEY', subsystem: 'ai_optional', secret: true, requiredInProduction: false, serverOnly: true, storage: 'platform_env', description: 'Optional xAI key', aliases: ['GROK_API_KEY'] },
  { name: 'XAI_MODEL', subsystem: 'ai_optional', secret: false, requiredInProduction: false, serverOnly: true, storage: 'platform_env', description: 'xAI chat model', aliases: ['XAI_CHAT_MODEL'] },
  { name: 'XAI_BASE_URL', subsystem: 'ai_optional', secret: false, requiredInProduction: false, serverOnly: true, storage: 'platform_env', description: 'xAI API base', safeDefault: 'https://api.x.ai/v1' },
  { name: 'XAI_WEB_SEARCH_ENABLED', subsystem: 'ai_optional', secret: false, requiredInProduction: false, serverOnly: true, storage: 'platform_env', description: 'xAI web search policy flag', safeDefault: 'true' },
  { name: 'XAI_X_SEARCH_ENABLED', subsystem: 'ai_optional', secret: false, requiredInProduction: false, serverOnly: true, storage: 'platform_env', description: 'xAI X search policy flag', safeDefault: 'true' },
  { name: 'TRADEOPS_AI_MODE', subsystem: 'ai_optional', secret: false, requiredInProduction: false, serverOnly: true, storage: 'platform_env', description: 'Legacy xAI mode gate', deprecated: true, replacement: 'AI_PROVIDER' },

  // Platform billing (Stripe) — platform-level
  { name: 'STRIPE_SECRET_KEY', subsystem: 'billing', secret: true, requiredInProduction: false, serverOnly: true, storage: 'platform_env', description: 'Stripe secret (SaaS billing)' },
  { name: 'STRIPE_WEBHOOK_SECRET', subsystem: 'billing', secret: true, requiredInProduction: false, serverOnly: true, storage: 'platform_env', description: 'Stripe webhook signing secret' },

  // Observability
  { name: 'OTEL_EXPORTER_OTLP_ENDPOINT', subsystem: 'observability', secret: false, requiredInProduction: false, serverOnly: true, storage: 'platform_env', description: 'OpenTelemetry OTLP endpoint' },

  // Storage
  { name: 'TRADEOPS_STORAGE_DIR', subsystem: 'storage', secret: false, requiredInProduction: false, serverOnly: true, storage: 'platform_env', description: 'Local artifact storage root' },
  { name: 'ARTIFACT_STORAGE_ROOT', subsystem: 'storage', secret: false, requiredInProduction: false, serverOnly: true, storage: 'platform_env', description: 'Artifact root override' },

  // Simulation / capital gates
  { name: 'TRADEOPS_SIMULATION_MODE', subsystem: 'ops', secret: false, requiredInProduction: false, serverOnly: true, storage: 'platform_env', description: 'Simulation mode flag' },
  { name: 'NEXT_PUBLIC_TRADEOPS_SIMULATION_MODE', subsystem: 'ops', secret: false, requiredInProduction: false, serverOnly: false, storage: 'browser_public', description: 'Public simulation banner' },
];

/**
 * Credentials that may appear in paste templates but MUST live as encrypted tenant connector records
 * (not global platform secrets for multi-tenant production).
 */
export const TENANT_SCOPED_CREDENTIAL_NAMES = [
  'SHOPIFY_ACCESS_TOKEN',
  'SHOPIFY_SHOP_DOMAIN',
  'AMAZON_SP_CLIENT_ID',
  'AMAZON_SP_CLIENT_SECRET',
  'AMAZON_SP_REFRESH_TOKEN',
  'EBAY_ACCESS_TOKEN',
  'WOOCOMMERCE_URL',
  'WOOCOMMERCE_CONSUMER_KEY',
  'WOOCOMMERCE_CONSUMER_SECRET',
  'GA4_PROPERTY_ID',
  'EASYPOST_API_KEY',
  'SHIPSTATION_API_KEY',
  'SHIPSTATION_API_SECRET',
  'PAYPAL_CLIENT_ID',
  'PAYPAL_CLIENT_SECRET',
  'SQUARE_ACCESS_TOKEN',
  'GOOGLE_MERCHANT_ID',
  'GOOGLE_MERCHANT_ACCESS_TOKEN',
] as const;

export function listManifestSecrets(): string[] {
  return PLATFORM_ENV_MANIFEST.filter((v) => v.secret).map((v) => v.name);
}

export function listRequiredProductionEnv(): string[] {
  return PLATFORM_ENV_MANIFEST.filter((v) => v.requiredInProduction).map((v) => v.name);
}

export function environmentManifestPublicStatus(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
) {
  const present = (name: string) => Boolean((env[name] ?? '').toString().trim());
  const rows = PLATFORM_ENV_MANIFEST.map((v) => ({
    name: v.name,
    subsystem: v.subsystem,
    secret: v.secret,
    requiredInProduction: v.requiredInProduction,
    configured: present(v.name) || Boolean(v.aliases?.some((a) => present(a))),
    storage: v.storage,
    deprecated: Boolean(v.deprecated),
  }));
  const missingRequiredProd =
    env.NODE_ENV === 'production'
      ? rows.filter((r) => r.requiredInProduction && !r.configured).map((r) => r.name)
      : [];
  return {
    totalManifest: PLATFORM_ENV_MANIFEST.length,
    configured: rows.filter((r) => r.configured).length,
    missingRequiredProduction: missingRequiredProd,
    ai: {
      provider: (env.AI_PROVIDER ?? 'cohere').toString(),
      cohereKeyConfigured: present('COHERE_API_KEY'),
      webSearchEnabled: present('WEB_SEARCH_ENABLED')
        ? ['1', 'true', 'yes', 'on'].includes(String(env.WEB_SEARCH_ENABLED).toLowerCase())
        : false,
      tavilyConfigured: present('TAVILY_API_KEY'),
      openaiConfigured: present('OPENAI_API_KEY'),
    },
    tenantScopedNote:
      'Merchant Shopify/Amazon/Stripe Connect tokens belong in encrypted connector vault, not global .env for multi-tenant production.',
    rows,
  };
}
