/**
 * Provider-independent AI generation abstraction.
 *
 * Production policy (operator Phase B):
 * 1. COHERE_API_KEY / CO_API_KEY → Cohere (sole generative provider)
 * 2. else none (tools still run; generation blocked honestly)
 *
 * XAI_API_KEY is intentionally ignored for operator generation.
 * No silent mid-request failover to another model.
 */

export type AiProviderId = 'cohere' | 'xai' | 'none';

export type GenerationRequest = {
  system?: string;
  prompt: string;
  schemaId?: string;
  temperature?: number;
  maxTokens?: number;
  /** Model override (defaults from env / package defaults) */
  model?: string;
};

export type GenerationResult = {
  provider: AiProviderId;
  text: string;
  raw?: unknown;
  latencyMs: number;
  /** true only when no provider is configured — not a silent multi-model fallback */
  offline: boolean;
  blocked?: boolean;
  failed?: boolean;
  note?: string;
};

export type EmbedRequest = {
  texts: string[];
  model?: string;
};

export type EmbedResult = {
  provider: AiProviderId;
  embeddings: number[][];
  latencyMs: number;
  blocked?: boolean;
  failed?: boolean;
  note?: string;
};

export type RerankRequest = {
  query: string;
  documents: string[];
  topN?: number;
  model?: string;
};

export type RerankResult = {
  provider: AiProviderId;
  results: Array<{ index: number; relevanceScore: number }>;
  latencyMs: number;
  blocked?: boolean;
  failed?: boolean;
  note?: string;
};

export type AiProviderAdapter = {
  id: AiProviderId;
  isConfigured(): boolean;
  generate(req: GenerationRequest): Promise<GenerationResult>;
  embed?(req: EmbedRequest): Promise<EmbedResult>;
  rerank?(req: RerankRequest): Promise<RerankResult>;
};

/** No silent demo synthesis — tools still work without a generative provider. */
export const offlineAdapter: AiProviderAdapter = {
  id: 'none',
  isConfigured: () => true,
  async generate(req) {
    const started = Date.now();
    return {
      provider: 'none',
      text: '',
      latencyMs: Date.now() - started,
      offline: true,
      blocked: true,
      note: `COHERE_KEY_MISSING: AI generation blocked — set COHERE_API_KEY for Phase B narrative (Cohere is the sole generative provider). Prompt length=${req.prompt.length}. Typed TradeOps tools remain available; no fixture narrative was substituted.`,
    };
  },
  async embed(req) {
    return {
      provider: 'none',
      embeddings: [],
      latencyMs: 0,
      blocked: true,
      note: `Embed blocked: set COHERE_API_KEY. texts=${req.texts.length}`,
    };
  },
  async rerank(req) {
    return {
      provider: 'none',
      results: [],
      latencyMs: 0,
      blocked: true,
      note: `Rerank blocked: set COHERE_API_KEY. documents=${req.documents.length}`,
    };
  },
};

let active: AiProviderAdapter = offlineAdapter;
const adapters = new Map<AiProviderId, AiProviderAdapter>([['none', offlineAdapter]]);

export function registerAiProvider(adapter: AiProviderAdapter): void {
  if (adapter.id !== 'cohere' && adapter.id !== 'xai' && adapter.id !== 'none') {
    throw new Error(
      `Unsupported AI provider registration: ${adapter.id}. Allowed: cohere | xai | none.`,
    );
  }
  adapters.set(adapter.id, adapter);
}

export function setActiveAiProvider(id: AiProviderId): void {
  // Cohere-only generative policy: never activate xAI for operator generation.
  if (id === 'xai') {
    active = offlineAdapter;
    return;
  }
  const a = adapters.get(id);
  if (!a) throw new Error(`Unknown AI provider: ${id}`);
  active = a;
}

/**
 * Resolve which generative provider to use from env.
 * Cohere is the sole generative provider. XAI_API_KEY is ignored.
 * AI_PROVIDER=xai is treated as a no-op (still requires Cohere).
 */
export function resolveProviderFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): AiProviderId {
  const forced = (env.AI_PROVIDER ?? env.TRADEOPS_AI_PROVIDER ?? '').trim().toLowerCase();
  // Whitespace / empty strings do not count as configured
  const raw = env.COHERE_API_KEY ?? env.CO_API_KEY;
  const hasCohere = Boolean(raw && String(raw).trim().length > 0);

  if (forced === 'none') return 'none';
  // AI_PROVIDER=xai is intentionally ignored — Cohere-only policy
  if (forced === 'cohere' || forced === '' || forced === 'auto' || forced === 'xai') {
    return hasCohere ? 'cohere' : 'none';
  }
  // Any other force value still only allows cohere when keyed
  return hasCohere ? 'cohere' : 'none';
}

export function getActiveAiProvider(): AiProviderAdapter {
  return active;
}

/** Cohere is the sole active generative AI provider for operator Phase B. */
export function isCohereSoleActivePolicy(): boolean {
  return true;
}

function ensureActiveFromEnv(): void {
  const preferred = resolveProviderFromEnv();
  if (preferred === 'none') {
    active = offlineAdapter;
    return;
  }
  const adapter = adapters.get(preferred);
  if (adapter?.isConfigured() && preferred === 'cohere') {
    active = adapter;
  } else {
    active = offlineAdapter;
  }
}

export async function generateText(req: GenerationRequest): Promise<GenerationResult> {
  ensureActiveFromEnv();
  if (active.id === 'none' || active.id === 'xai' || !active.isConfigured()) {
    return offlineAdapter.generate(req);
  }
  try {
    return await active.generate(req);
  } catch (e) {
    return {
      provider: active.id,
      text: '',
      latencyMs: 0,
      offline: false,
      failed: true,
      note: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function embedTexts(req: EmbedRequest): Promise<EmbedResult> {
  ensureActiveFromEnv();
  const fn = active.embed?.bind(active) ?? offlineAdapter.embed!.bind(offlineAdapter);
  try {
    return await fn(req);
  } catch (e) {
    return {
      provider: active.id,
      embeddings: [],
      latencyMs: 0,
      failed: true,
      note: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function rerankDocuments(req: RerankRequest): Promise<RerankResult> {
  ensureActiveFromEnv();
  const fn = active.rerank?.bind(active) ?? offlineAdapter.rerank!.bind(offlineAdapter);
  try {
    return await fn(req);
  } catch (e) {
    return {
      provider: active.id,
      results: [],
      latencyMs: 0,
      failed: true,
      note: e instanceof Error ? e.message : String(e),
    };
  }
}

export function describeAiProviders(): Array<{
  id: AiProviderId;
  configured: boolean;
  active: boolean;
  role: string;
}> {
  ensureActiveFromEnv();
  const xaiKeyPresent = Boolean(process.env.XAI_API_KEY?.trim());
  return [
    {
      id: 'cohere',
      configured: Boolean(adapters.get('cohere')?.isConfigured()),
      active: active.id === 'cohere',
      role: 'sole_generative_provider',
    },
    {
      id: 'xai',
      // Report key presence for honesty, but never "configured" for operator generative use
      configured: false,
      active: false,
      role: xaiKeyPresent
        ? 'ignored_xai_key_present_not_used_for_operator'
        : 'not_used_for_operator',
    },
    {
      id: 'none',
      configured: true,
      active: active.id === 'none',
      role: 'blocked_when_cohere_unconfigured',
    },
  ];
}
