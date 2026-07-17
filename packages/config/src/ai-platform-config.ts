/**
 * TradeOps AI platform configuration.
 *
 * Architecture (retrieval-first split):
 * - TradeOps owns orchestration, Search Manager, Capability Gateway, response envelope.
 * - AI Adapter selects generation runtime (OpenAI primary; xAI/Gemini optional).
 * - Cohere is the enterprise retrieval engine (embed / rerank / classify / RAG) — not the sole runtime.
 * - Internet search stays pluggable (OpenAI web, optional Tavily).
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

/** Active reasoning runtime behind the AI Adapter. */
export type AiProviderId = 'openai' | 'xai' | 'gemini';

/** Search backends the Search Manager may route to. */
export type SearchProviderId =
  | 'openai_web'
  | 'xai_web'
  | 'xai_x'
  | 'tavily'
  | 'cohere_internal'
  | 'knowledge_graph';

export type AiPlatformConfig = {
  /** Primary generation runtime selected by AI Adapter */
  aiProvider: AiProviderId;

  openaiApiKey: string | undefined;
  openaiModel: string;
  openaiBaseUrl: string;
  openaiConfigured: boolean;
  openaiWebSearchEnabled: boolean;

  xaiApiKey: string | undefined;
  xaiModel: string;
  xaiBaseUrl: string;
  xaiConfigured: boolean;

  geminiApiKey: string | undefined;
  geminiModel: string;
  geminiConfigured: boolean;

  /** Cohere — enterprise retrieval (not sole generation runtime) */
  cohereApiKey: string | undefined;
  cohereBaseUrl: string;
  cohereEmbedModel: string;
  cohereRerankModel: string;
  cohereChatModel: string;
  cohereConfigured: boolean;
  cohereRetrievalEnabled: boolean;

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

  /** Preferred public-web search backend family */
  searchProviderPrimary: 'openai' | 'xai' | 'tavily';
  searchProviderRetrieval: 'openai' | 'tavily' | 'xai' | 'cohere';
  /** Internal enterprise retrieval engine */
  searchProviderInternal: 'cohere' | 'local';
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

function parseProvider(
  raw: string | undefined,
  env: NodeJS.ProcessEnv | Record<string, string | undefined>,
): AiProviderId {
  const s = (raw ?? 'openai').trim().toLowerCase();
  if (s === 'xai' || s === 'grok') return 'xai';
  if (s === 'gemini' || s === 'google') return 'gemini';
  if (s === 'openai' || s === 'oai') return 'openai';
  // auto: pick first configured, prefer OpenAI
  if (s === 'auto') {
    if ((env.OPENAI_API_KEY ?? '').trim()) return 'openai';
    if ((env.XAI_API_KEY ?? env.GROK_API_KEY ?? '').trim()) return 'xai';
    if ((env.GEMINI_API_KEY ?? env.GOOGLE_AI_API_KEY ?? '').trim()) return 'gemini';
    return 'openai';
  }
  return 'openai';
}

function parseSearchPrimary(raw: string | undefined): AiPlatformConfig['searchProviderPrimary'] {
  const s = (raw ?? 'openai').trim().toLowerCase();
  if (s === 'tavily') return 'tavily';
  if (s === 'xai') return 'xai';
  return 'openai';
}

function parseSearchRetrieval(raw: string | undefined): AiPlatformConfig['searchProviderRetrieval'] {
  const s = (raw ?? 'openai').trim().toLowerCase();
  if (s === 'tavily') return 'tavily';
  if (s === 'xai') return 'xai';
  if (s === 'cohere') return 'cohere';
  return 'openai';
}

export function getAiPlatformConfig(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): AiPlatformConfig {
  const openaiApiKey = (env.OPENAI_API_KEY ?? '').trim() || undefined;
  const xaiApiKey = (env.XAI_API_KEY ?? env.GROK_API_KEY ?? '').trim() || undefined;
  const geminiApiKey = (env.GEMINI_API_KEY ?? env.GOOGLE_AI_API_KEY ?? '').trim() || undefined;
  const tavilyApiKey = (env.TAVILY_API_KEY ?? '').trim() || undefined;
  const cohereApiKey = (env.COHERE_API_KEY ?? '').trim() || undefined;

  const aiProvider = parseProvider(env.AI_PROVIDER, env);

  return {
    aiProvider,

    openaiApiKey,
    openaiModel:
      (env.OPENAI_MODEL ?? env.OPENAI_CHAT_MODEL ?? 'gpt-4o').trim() || 'gpt-4o',
    openaiBaseUrl: (env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/$/, ''),
    openaiConfigured: Boolean(openaiApiKey),
    openaiWebSearchEnabled: truthy(env.OPENAI_WEB_SEARCH_ENABLED, true),

    xaiApiKey,
    xaiModel: (env.XAI_MODEL ?? env.XAI_CHAT_MODEL ?? 'grok-3').trim() || 'grok-3',
    xaiBaseUrl: (env.XAI_BASE_URL ?? 'https://api.x.ai/v1').replace(/\/$/, ''),
    xaiConfigured: Boolean(xaiApiKey),

    geminiApiKey,
    geminiModel: (env.GEMINI_MODEL ?? 'gemini-2.0-flash').trim() || 'gemini-2.0-flash',
    geminiConfigured: Boolean(geminiApiKey),

    cohereApiKey,
    cohereBaseUrl: (env.COHERE_BASE_URL ?? 'https://api.cohere.com').replace(/\/$/, ''),
    cohereEmbedModel: (env.COHERE_EMBED_MODEL ?? 'embed-v4.0').trim() || 'embed-v4.0',
    cohereRerankModel: (env.COHERE_RERANK_MODEL ?? 'rerank-v3.5').trim() || 'rerank-v3.5',
    cohereChatModel:
      (env.COHERE_CHAT_MODEL ?? 'command-a-03-2025').trim() || 'command-a-03-2025',
    cohereConfigured: Boolean(cohereApiKey),
    cohereRetrievalEnabled: truthy(env.COHERE_RETRIEVAL_ENABLED, true) && Boolean(cohereApiKey),

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

    searchProviderPrimary: parseSearchPrimary(env.SEARCH_PROVIDER_PRIMARY),
    searchProviderRetrieval: parseSearchRetrieval(env.SEARCH_PROVIDER_RETRIEVAL),
    searchProviderInternal:
      (env.SEARCH_PROVIDER_INTERNAL ?? 'cohere').trim().toLowerCase() === 'local'
        ? 'local'
        : 'cohere',
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

/** Active runtime has a key for the selected AI_PROVIDER. */
export function isAiRuntimeConfigured(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  const c = getAiPlatformConfig(env);
  if (c.aiProvider === 'openai') return c.openaiConfigured;
  if (c.aiProvider === 'xai') return c.xaiConfigured;
  if (c.aiProvider === 'gemini') return c.geminiConfigured;
  return false;
}

export function aiPlatformPublicStatus(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
) {
  const c = getAiPlatformConfig(env);
  return {
    aiProvider: c.aiProvider,
    runtimeConfigured: isAiRuntimeConfigured(env),
    openaiConfigured: c.openaiConfigured,
    openaiModel: c.openaiModel,
    openaiBaseUrl: c.openaiBaseUrl,
    xaiConfigured: c.xaiConfigured,
    xaiModel: c.xaiModel,
    xaiBaseUrl: c.xaiBaseUrl,
    geminiConfigured: c.geminiConfigured,
    geminiModel: c.geminiModel,
    cohereConfigured: c.cohereConfigured,
    cohereRetrievalEnabled: c.cohereRetrievalEnabled,
    cohereEmbedModel: c.cohereEmbedModel,
    tavilyConfigured: c.tavilyConfigured,
    search: {
      primary: c.searchProviderPrimary,
      retrieval: c.searchProviderRetrieval,
      internal: c.searchProviderInternal,
      openaiWeb: c.openaiWebSearchEnabled && c.openaiConfigured,
      xaiWeb: c.xaiWebSearchEnabled && c.xaiConfigured,
      xaiX: c.xaiXSearchEnabled && c.xaiConfigured,
      tavilySearch: c.tavilySearchEnabled,
      tavilyExtract: c.tavilyExtractEnabled,
      tavilyCrawl: c.tavilyCrawlEnabled,
      cohereInternal: c.cohereRetrievalEnabled,
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
      rule: 'TradeOps owns orchestration. Generation via AI Adapter (OpenAI primary). Cohere is enterprise retrieval (embed/rerank/classify), not the sole runtime.',
      aiAdapter: true,
      generationPrimary: 'openai',
      retrievalPrimary: 'cohere',
      optionalGenerationRuntimes: ['xai', 'gemini'] as const,
      competingSearchApis: ['serpapi', 'brave', 'bing', 'google_cse'] as const,
      note: 'Call models only through AI Adapter + Retrieval Engine + Search Manager — never from the frontend.',
    },
  };
}
