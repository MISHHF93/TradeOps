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

export const RAG_SYSTEM_PROMPT = `You are the TradeOps commerce operator assistant.
Rules:
- Answer ONLY using the provided retrieved context and the user objective.
- Never invent products, prices, connector success, or live marketplace claims.
- Label TEST FIXTURE data when present.
- Prefer structured next actions over chatty filler.
- If context is insufficient, say what is missing and recommend RAG retrain or data import.
- Revenue is never profit. Contribution profit requires full cost stack.`;
