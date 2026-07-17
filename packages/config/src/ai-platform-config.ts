/**
 * Unified AI platform configuration.
 * Architectural rule: xAI/Grok is the only LLM provider.
 * Tavily is the only dedicated public-web retrieval provider.
 */

function truthy(v: string | undefined | null, defaultTrue = false): boolean {
  if (v == null || v === '') return defaultTrue;
  const s = String(v).trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'on';
}

function num(v: string | undefined, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export type AiProviderId = 'xai';

export type SearchProviderId = 'xai_web' | 'xai_x' | 'tavily';

export type AiPlatformConfig = {
  /** Always xai — sole reasoning provider */
  aiProvider: AiProviderId;
  xaiApiKey: string | undefined;
  xaiModel: string;
  xaiBaseUrl: string;

  responseMode: 'json_schema' | 'json_object' | 'text';
  textOutputEnabled: boolean;
  structuredOutputEnabled: boolean;
  toolCallingEnabled: boolean;
  streamingEnabled: boolean;

  xaiWebSearchEnabled: boolean;
  xaiXSearchEnabled: boolean;
  xaiSearchMaxCalls: number;

  tavilyApiKey: string | undefined;
  tavilySearchEnabled: boolean;
  tavilyExtractEnabled: boolean;
  tavilyCrawlEnabled: boolean;
  tavilyResearchEnabled: boolean;
  tavilyConfigured: boolean;

  searchProviderPrimary: 'xai' | 'tavily';
  searchProviderRetrieval: 'tavily' | 'xai';
  searchRequireCitations: boolean;
  searchRequireSourceTimestamps: boolean;
  searchMaxQueriesPerRequest: number;
  searchMaxResultsPerQuery: number;
  searchDefaultCacheTtlSeconds: number;
  searchAllowedDomains: string[];
  searchBlockedDomains: string[];

  aiMaxToolCalls: number;
  aiMaxExecutionSeconds: number;
  aiRequireApprovalForWrites: boolean;
  aiRequireApprovalForPayments: boolean;
  aiRequireApprovalForRefunds: boolean;
  aiRequireApprovalForPublishing: boolean;

  outputSchemaVersion: string;
  includeTextOutput: boolean;
  includeJsonOutput: boolean;
  includeEvidence: boolean;
  includeActions: boolean;
  includeConfidence: boolean;
};

function csv(v: string | undefined): string[] {
  if (!v?.trim()) return [];
  return v
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function getAiPlatformConfig(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): AiPlatformConfig {
  const xaiApiKey = (env.XAI_API_KEY ?? env.GROK_API_KEY ?? '').trim() || undefined;
  const tavilyApiKey = (env.TAVILY_API_KEY ?? '').trim() || undefined;
  const model =
    (env.XAI_MODEL ?? env.XAI_CHAT_MODEL ?? 'grok-3').trim() || 'grok-3';

  return {
    aiProvider: 'xai',
    xaiApiKey,
    xaiModel: model,
    xaiBaseUrl: (env.XAI_BASE_URL ?? 'https://api.x.ai/v1').replace(/\/$/, ''),

    responseMode: (env.AI_RESPONSE_MODE ?? 'json_schema').toLowerCase() as AiPlatformConfig['responseMode'],
    textOutputEnabled: truthy(env.AI_TEXT_OUTPUT_ENABLED, true),
    structuredOutputEnabled: truthy(env.AI_STRUCTURED_OUTPUT_ENABLED, true),
    toolCallingEnabled: truthy(env.AI_TOOL_CALLING_ENABLED, true),
    streamingEnabled: truthy(env.AI_STREAMING_ENABLED, true),

    xaiWebSearchEnabled: truthy(env.XAI_WEB_SEARCH_ENABLED, true),
    xaiXSearchEnabled: truthy(env.XAI_X_SEARCH_ENABLED, true),
    xaiSearchMaxCalls: num(env.XAI_SEARCH_MAX_CALLS, 5),

    tavilyApiKey,
    tavilySearchEnabled: truthy(env.TAVILY_SEARCH_ENABLED, true) && Boolean(tavilyApiKey),
    tavilyExtractEnabled: truthy(env.TAVILY_EXTRACT_ENABLED, true) && Boolean(tavilyApiKey),
    tavilyCrawlEnabled: truthy(env.TAVILY_CRAWL_ENABLED, true) && Boolean(tavilyApiKey),
    tavilyResearchEnabled: truthy(env.TAVILY_RESEARCH_ENABLED, true) && Boolean(tavilyApiKey),
    tavilyConfigured: Boolean(tavilyApiKey),

    searchProviderPrimary: (env.SEARCH_PROVIDER_PRIMARY ?? 'xai').toLowerCase() === 'tavily' ? 'tavily' : 'xai',
    searchProviderRetrieval:
      (env.SEARCH_PROVIDER_RETRIEVAL ?? 'tavily').toLowerCase() === 'xai' ? 'xai' : 'tavily',
    searchRequireCitations: truthy(env.SEARCH_REQUIRE_CITATIONS, true),
    searchRequireSourceTimestamps: truthy(env.SEARCH_REQUIRE_SOURCE_TIMESTAMPS, true),
    searchMaxQueriesPerRequest: num(env.SEARCH_MAX_QUERIES_PER_REQUEST, 6),
    searchMaxResultsPerQuery: num(env.SEARCH_MAX_RESULTS_PER_QUERY, 10),
    searchDefaultCacheTtlSeconds: num(env.SEARCH_DEFAULT_CACHE_TTL_SECONDS, 3600),
    searchAllowedDomains: csv(env.SEARCH_ALLOWED_DOMAINS),
    searchBlockedDomains: csv(env.SEARCH_BLOCKED_DOMAINS),

    aiMaxToolCalls: num(env.AI_MAX_TOOL_CALLS, 15),
    aiMaxExecutionSeconds: num(env.AI_MAX_EXECUTION_SECONDS, 120),
    aiRequireApprovalForWrites: truthy(env.AI_REQUIRE_APPROVAL_FOR_WRITES, true),
    aiRequireApprovalForPayments: truthy(env.AI_REQUIRE_APPROVAL_FOR_PAYMENTS, true),
    aiRequireApprovalForRefunds: truthy(env.AI_REQUIRE_APPROVAL_FOR_REFUNDS, true),
    aiRequireApprovalForPublishing: truthy(env.AI_REQUIRE_APPROVAL_FOR_PUBLISHING, true),

    outputSchemaVersion: env.AI_OUTPUT_SCHEMA_VERSION?.trim() || '1.0',
    includeTextOutput: truthy(env.AI_INCLUDE_TEXT_OUTPUT, true),
    includeJsonOutput: truthy(env.AI_INCLUDE_JSON_OUTPUT, true),
    includeEvidence: truthy(env.AI_INCLUDE_EVIDENCE, true),
    includeActions: truthy(env.AI_INCLUDE_ACTIONS, true),
    includeConfidence: truthy(env.AI_INCLUDE_CONFIDENCE, true),
  };
}

export function aiPlatformPublicStatus(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
) {
  const c = getAiPlatformConfig(env);
  return {
    aiProvider: c.aiProvider,
    xaiConfigured: Boolean(c.xaiApiKey),
    xaiModel: c.xaiModel,
    xaiBaseUrl: c.xaiBaseUrl,
    tavilyConfigured: c.tavilyConfigured,
    search: {
      primary: c.searchProviderPrimary,
      retrieval: c.searchProviderRetrieval,
      xaiWeb: c.xaiWebSearchEnabled && Boolean(c.xaiApiKey),
      xaiX: c.xaiXSearchEnabled && Boolean(c.xaiApiKey),
      tavilySearch: c.tavilySearchEnabled,
      tavilyExtract: c.tavilyExtractEnabled,
      tavilyCrawl: c.tavilyCrawlEnabled,
    },
    responseContract: {
      schemaVersion: c.outputSchemaVersion,
      text: c.includeTextOutput,
      json: c.includeJsonOutput,
      evidence: c.includeEvidence,
      actions: c.includeActions,
      confidence: c.includeConfidence,
      mode: c.responseMode,
    },
    architecture: {
      rule: 'xAI is the only LLM. Tavily is the only dedicated web retrieval provider. Vendor APIs sit behind capabilities.',
      competingLlms: false,
      competingSearchApis: ['serpapi', 'brave', 'bing', 'google_cse'] as const,
      note: 'SerpAPI and other search APIs are not used by the unified Search Manager. Prefer Tavily + xAI search.',
    },
  };
}
