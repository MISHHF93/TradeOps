/**
 * Optional free-form LLM client — SpaceXAI / xAI (OpenAI-compatible).
 *
 * TradeOps default AI path does NOT require an LLM (typed tools + navigator).
 * When XAI_API_KEY is set, RAG can ground completions on retrieved chunks.
 *
 * Never call from browser. Never hardcode keys.
 */

export type LlmCompleteInput = {
  system: string;
  user: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
};

export type LlmCompleteResult = {
  ok: boolean;
  text?: string;
  model?: string;
  error?: string;
  provider: 'xai';
  latencyMs: number;
  usedKey: boolean;
};

export type LlmClientOptions = {
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
  fetchImpl?: typeof fetch;
};

export function resolveXaiApiKey(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): string | undefined {
  const key = (env.XAI_API_KEY ?? env.GROK_API_KEY ?? '').trim();
  return key || undefined;
}

export function isLlmConfigured(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  return Boolean(resolveXaiApiKey(env));
}

/**
 * Chat completion against xAI OpenAI-compatible API.
 * Fail closed when key missing — never invents a model reply.
 */
export async function completeWithXai(
  input: LlmCompleteInput,
  options: LlmClientOptions = {},
): Promise<LlmCompleteResult> {
  const t0 = Date.now();
  const apiKey = options.apiKey ?? resolveXaiApiKey();
  if (!apiKey) {
    return {
      ok: false,
      error: 'XAI_API_KEY not configured — retrieval-only mode',
      provider: 'xai',
      latencyMs: Date.now() - t0,
      usedKey: false,
    };
  }

  const baseUrl = (options.baseUrl ?? 'https://api.x.ai/v1').replace(/\/$/, '');
  const model = input.model ?? options.defaultModel ?? 'grok-4.5';
  const fetchFn = options.fetchImpl ?? fetch;

  try {
    const res = await fetchFn(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: input.temperature ?? 0.2,
        max_tokens: input.maxTokens ?? 1200,
        messages: [
          { role: 'system', content: input.system },
          { role: 'user', content: input.user },
        ],
      }),
    });
    const latencyMs = Date.now() - t0;
    if (!res.ok) {
      return {
        ok: false,
        error: `xAI HTTP ${res.status}`,
        provider: 'xai',
        model,
        latencyMs,
        usedKey: true,
      };
    }
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = json.choices?.[0]?.message?.content?.trim();
    if (!text) {
      return {
        ok: false,
        error: 'Empty model response',
        provider: 'xai',
        model,
        latencyMs,
        usedKey: true,
      };
    }
    return {
      ok: true,
      text,
      model,
      provider: 'xai',
      latencyMs,
      usedKey: true,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      provider: 'xai',
      latencyMs: Date.now() - t0,
      usedKey: true,
    };
  }
}

export type EmbedResult = {
  ok: boolean;
  vectors?: number[][];
  model?: string;
  error?: string;
  provider: 'xai' | 'local';
  latencyMs: number;
};

/**
 * Try xAI OpenAI-compatible embeddings. On failure, caller should use localDenseEmbed.
 * Some xAI deployments may not expose embeddings — fail closed, never invent vectors.
 */
export async function embedWithXai(
  texts: string[],
  options: LlmClientOptions & { model?: string } = {},
): Promise<EmbedResult> {
  const t0 = Date.now();
  const apiKey = options.apiKey ?? resolveXaiApiKey();
  if (!apiKey) {
    return {
      ok: false,
      error: 'XAI_API_KEY not configured',
      provider: 'xai',
      latencyMs: Date.now() - t0,
    };
  }
  if (!texts.length) {
    return {
      ok: true,
      vectors: [],
      provider: 'xai',
      latencyMs: Date.now() - t0,
    };
  }

  const baseUrl = (options.baseUrl ?? 'https://api.x.ai/v1').replace(/\/$/, '');
  const model = options.model ?? options.defaultModel ?? 'text-embedding-3-small';
  const fetchFn = options.fetchImpl ?? fetch;

  try {
    const res = await fetchFn(`${baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, input: texts }),
    });
    const latencyMs = Date.now() - t0;
    if (!res.ok) {
      return {
        ok: false,
        error: `xAI embeddings HTTP ${res.status}`,
        provider: 'xai',
        model,
        latencyMs,
      };
    }
    const json = (await res.json()) as {
      data?: Array<{ embedding?: number[]; index?: number }>;
    };
    const data = json.data ?? [];
    if (!data.length) {
      return {
        ok: false,
        error: 'Empty embeddings response',
        provider: 'xai',
        model,
        latencyMs,
      };
    }
    const sorted = [...data].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    const vectors = sorted.map((d) => {
      const v = d.embedding ?? [];
      const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
      return v.map((x) => x / norm);
    });
    return {
      ok: true,
      vectors,
      model,
      provider: 'xai',
      latencyMs,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      provider: 'xai',
      latencyMs: Date.now() - t0,
    };
  }
}

export const RAG_SYSTEM_PROMPT = `You are the TradeOps commerce operator assistant.
Rules:
- Answer ONLY using the provided retrieved context and the user objective.
- Never invent products, prices, connector success, or live marketplace claims.
- Label TEST FIXTURE data when present.
- Prefer structured next actions over chatty filler.
- If context is insufficient, say what is missing and recommend RAG retrain or data import.
- Revenue is never profit. Contribution profit requires full cost stack.`;
