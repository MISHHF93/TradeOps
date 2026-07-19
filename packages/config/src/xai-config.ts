/**
 * xAI (SpaceXAI / Grok) configuration — primary LLM provider for TradeOps free-form AI.
 * Keys never leave the server; public status never returns secret values.
 */

export type TradeOpsAiMode =
  | 'auto'
  | 'tools_only'
  | 'xai_rag'
  | 'xai_rag_tools'
  | 'xai_disabled';

export type ResolvedAiMode =
  | 'tools_only'
  | 'xai_rag'
  | 'xai_rag_tools'
  | 'xai_disabled';

export type XaiConfig = {
  apiKey: string | undefined;
  baseUrl: string;
  chatModel: string;
  embedModel: string | undefined;
  aiMode: TradeOpsAiMode;
  resolvedMode: ResolvedAiMode;
  defaultGenerate: boolean;
  timeoutMs: number;
  configured: boolean;
  provider: 'xai';
};

function truthy(v: string | undefined | null): boolean {
  if (v == null) return false;
  const s = String(v).trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'on';
}

export function parseAiMode(raw: string | undefined | null): TradeOpsAiMode {
  const s = (raw ?? 'auto').trim().toLowerCase();
  if (
    s === 'tools_only' ||
    s === 'xai_rag' ||
    s === 'xai_rag_tools' ||
    s === 'xai_disabled' ||
    s === 'auto'
  ) {
    return s;
  }
  return 'auto';
}

export function resolveXaiApiKey(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): string | undefined {
  const key = (env.XAI_API_KEY ?? env.GROK_API_KEY ?? '').trim();
  return key || undefined;
}

export function isXaiConfigured(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  return Boolean(resolveXaiApiKey(env));
}

/**
 * Resolve concrete AI mode from env.
 * auto → xai_rag when key present, else tools_only.
 * xai_disabled always wins (even with key).
 */
export function resolveAiMode(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): ResolvedAiMode {
  const mode = parseAiMode(env.TRADEOPS_AI_MODE);
  if (mode === 'xai_disabled') return 'xai_disabled';
  if (mode === 'tools_only') return 'tools_only';
  const hasKey = isXaiConfigured(env);
  if (mode === 'xai_rag') return hasKey ? 'xai_rag' : 'tools_only';
  if (mode === 'xai_rag_tools') return hasKey ? 'xai_rag_tools' : 'tools_only';
  // auto
  return hasKey ? 'xai_rag' : 'tools_only';
}

export function shouldUseXai(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  const m = resolveAiMode(env);
  return m === 'xai_rag' || m === 'xai_rag_tools';
}

export function shouldDefaultGenerate(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  if (!shouldUseXai(env)) return false;
  const raw = env.TRADEOPS_AI_DEFAULT_GENERATE;
  if (raw === undefined || raw === '') return true; // default on when xAI mode active
  return truthy(raw);
}

export function getXaiConfig(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): XaiConfig {
  const apiKey = resolveXaiApiKey(env);
  const baseUrl = (env.XAI_BASE_URL ?? 'https://api.x.ai/v1').replace(/\/$/, '');
  const chatModel =
    (env.XAI_MODEL ?? env.XAI_CHAT_MODEL ?? 'grok-3').trim() || 'grok-3';
  const embedRaw = (env.XAI_EMBED_MODEL ?? '').trim();
  const timeoutMs = Math.max(
    5_000,
    Number(env.TRADEOPS_AI_TIMEOUT_MS ?? 60_000) || 60_000,
  );
  const aiMode = parseAiMode(env.TRADEOPS_AI_MODE);
  const resolvedMode = resolveAiMode(env);

  return {
    apiKey,
    baseUrl,
    chatModel,
    embedModel: embedRaw || undefined,
    aiMode,
    resolvedMode,
    defaultGenerate: shouldDefaultGenerate(env),
    timeoutMs,
    configured: Boolean(apiKey),
    provider: 'xai',
  };
}

/** Safe for API/UI — never includes the API key. */
export function xaiPublicStatus(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): {
  provider: 'xai';
  configured: boolean;
  mode: ResolvedAiMode;
  requestedMode: TradeOpsAiMode;
  chatModel: string;
  embedModel: string | null;
  baseUrl: string;
  defaultGenerate: boolean;
  timeoutMs: number;
  note: string;
} {
  const c = getXaiConfig(env);
  return {
    provider: 'xai',
    configured: c.configured,
    mode: c.resolvedMode,
    requestedMode: c.aiMode,
    chatModel: c.chatModel,
    embedModel: c.embedModel ?? null,
    baseUrl: c.baseUrl,
    defaultGenerate: c.defaultGenerate,
    timeoutMs: c.timeoutMs,
    note: c.configured
      ? 'xAI configured. Free-form answers use RAG-grounded Grok when mode allows.'
      : 'XAI_API_KEY not set — tools + local RAG only. Get a key at https://console.x.ai',
  };
}
