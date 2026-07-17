/**
 * xAI (SpaceXAI / Grok) client — primary free-form LLM for TradeOps.
 * OpenAI-compatible API at https://api.x.ai/v1
 *
 * Never call from browser. Never hardcode keys.
 * When not configured or mode disabled, fail closed — no invented replies.
 */

import {
  getXaiConfig,
  resolveXaiApiKey,
  shouldUseXai,
  type XaiConfig,
} from '@tradeops/config';

export type LlmMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export type LlmCompleteInput = {
  system: string;
  user: string;
  messages?: LlmMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
};

export type LlmCompleteResult = {
  ok: boolean;
  text?: string;
  model?: string;
  error?: string;
  code?: 'missing_key' | 'disabled' | 'http' | 'empty' | 'timeout' | 'network';
  provider: 'xai';
  latencyMs: number;
  usedKey: boolean;
};

export type LlmClientOptions = {
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  /** When false, refuse even if key present */
  allowXai?: boolean;
  config?: XaiConfig;
};

export type EmbedResult = {
  ok: boolean;
  vectors?: number[][];
  model?: string;
  error?: string;
  provider: 'xai' | 'local';
  latencyMs: number;
};

export type XaiProbeResult = {
  ok: boolean;
  configured: boolean;
  model?: string;
  latencyMs: number;
  error?: string;
  provider: 'xai';
};

export function resolveXaiApiKeyFromEnv(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): string | undefined {
  return resolveXaiApiKey(env);
}

export function isLlmConfigured(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  return Boolean(resolveXaiApiKey(env)) && shouldUseXai(env);
}

function resolveRuntimeConfig(options: LlmClientOptions = {}): {
  apiKey: string | undefined;
  baseUrl: string;
  chatModel: string;
  embedModel: string | undefined;
  timeoutMs: number;
  allow: boolean;
} {
  const cfg = options.config ?? getXaiConfig();
  const allow =
    options.allowXai !== false &&
    (options.config ? shouldUseXaiFromConfig(cfg) : shouldUseXai());
  return {
    apiKey: options.apiKey ?? cfg.apiKey,
    baseUrl: (options.baseUrl ?? cfg.baseUrl).replace(/\/$/, ''),
    chatModel: options.defaultModel ?? cfg.chatModel,
    embedModel: cfg.embedModel,
    timeoutMs: options.timeoutMs ?? cfg.timeoutMs,
    allow,
  };
}

function shouldUseXaiFromConfig(cfg: XaiConfig): boolean {
  return (
    Boolean(cfg.apiKey) &&
    (cfg.resolvedMode === 'xai_rag' || cfg.resolvedMode === 'xai_rag_tools')
  );
}

/**
 * Chat completion against xAI OpenAI-compatible API.
 */
export async function completeWithXai(
  input: LlmCompleteInput,
  options: LlmClientOptions = {},
): Promise<LlmCompleteResult> {
  const t0 = Date.now();
  const rt = resolveRuntimeConfig(options);
  if (!rt.allow) {
    return {
      ok: false,
      error: 'xAI disabled by TRADEOPS_AI_MODE',
      code: 'disabled',
      provider: 'xai',
      latencyMs: Date.now() - t0,
      usedKey: false,
    };
  }
  if (!rt.apiKey) {
    return {
      ok: false,
      error: 'XAI_API_KEY not configured — retrieval/tools only mode',
      code: 'missing_key',
      provider: 'xai',
      latencyMs: Date.now() - t0,
      usedKey: false,
    };
  }

  const model = input.model ?? rt.chatModel;
  const fetchFn = options.fetchImpl ?? fetch;
  const messages: LlmMessage[] =
    input.messages?.length && input.messages.length > 0
      ? input.messages
      : [
          { role: 'system', content: input.system },
          { role: 'user', content: input.user },
        ];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), rt.timeoutMs);

  try {
    const res = await fetchFn(`${rt.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${rt.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: input.temperature ?? 0.2,
        max_tokens: input.maxTokens ?? 1200,
        messages,
      }),
      signal: controller.signal,
    });
    const latencyMs = Date.now() - t0;
    if (!res.ok) {
      return {
        ok: false,
        error: `xAI HTTP ${res.status}`,
        code: 'http',
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
        code: 'empty',
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
    const msg = e instanceof Error ? e.message : String(e);
    const aborted = /abort/i.test(msg);
    return {
      ok: false,
      error: msg,
      code: aborted ? 'timeout' : 'network',
      provider: 'xai',
      latencyMs: Date.now() - t0,
      usedKey: true,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Lightweight connectivity probe (tiny completion).
 */
export async function probeXai(
  options: LlmClientOptions = {},
): Promise<XaiProbeResult> {
  const t0 = Date.now();
  const rt = resolveRuntimeConfig(options);
  if (!rt.apiKey) {
    return {
      ok: false,
      configured: false,
      error: 'XAI_API_KEY not set',
      provider: 'xai',
      latencyMs: Date.now() - t0,
    };
  }
  if (!rt.allow) {
    return {
      ok: false,
      configured: true,
      error: 'xAI disabled by TRADEOPS_AI_MODE',
      provider: 'xai',
      latencyMs: Date.now() - t0,
    };
  }
  const result = await completeWithXai(
    {
      system: 'Reply with exactly: ok',
      user: 'ping',
      maxTokens: 8,
      temperature: 0,
    },
    { ...options, timeoutMs: Math.min(rt.timeoutMs, 15_000) },
  );
  return {
    ok: result.ok,
    configured: true,
    model: result.model,
    latencyMs: result.latencyMs,
    error: result.error,
    provider: 'xai',
  };
}

/**
 * Try xAI embeddings. On failure, caller should use localDenseEmbed.
 */
export async function embedWithXai(
  texts: string[],
  options: LlmClientOptions & { model?: string } = {},
): Promise<EmbedResult> {
  const t0 = Date.now();
  const rt = resolveRuntimeConfig(options);
  if (!rt.apiKey || !rt.allow) {
    return {
      ok: false,
      error: !rt.apiKey ? 'XAI_API_KEY not configured' : 'xAI disabled',
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

  const model =
    options.model ?? rt.embedModel ?? options.defaultModel ?? 'text-embedding-3-small';
  const fetchFn = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), rt.timeoutMs);

  try {
    const res = await fetchFn(`${rt.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${rt.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, input: texts }),
      signal: controller.signal,
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
  } finally {
    clearTimeout(timer);
  }
}

/** Synthesize operator narrative from RAG + execution package (approval does not change). */
export async function synthesizeWithXai(input: {
  objective: string;
  groundedContext: string;
  packageSummary: string;
  recommendationsJson?: string;
}): Promise<LlmCompleteResult> {
  return completeWithXai({
    system: OPERATOR_SYNTHESIS_PROMPT,
    user: [
      `Objective:\n${input.objective}`,
      '',
      input.groundedContext,
      '',
      `Execution package summary:\n${input.packageSummary}`,
      input.recommendationsJson
        ? `\nRecommendations JSON:\n${input.recommendationsJson.slice(0, 4000)}`
        : '',
      '',
      'Write: (1) concise situation assessment, (2) evidence-backed next actions, (3) risks/approvals still required. Cite retrieval titles when used. Do not claim live marketplace success without evidence.',
    ]
      .filter(Boolean)
      .join('\n'),
    temperature: 0.25,
    maxTokens: 1400,
  });
}

export const RAG_SYSTEM_PROMPT = `You are the TradeOps commerce operator assistant powered by xAI Grok when configured.
Rules:
- Answer ONLY using the provided retrieved context and the user objective.
- Never invent products, prices, connector success, or live marketplace claims.
- Label TEST FIXTURE data when present.
- Cite retrieved chunk titles as evidence.
- Prefer structured next actions over chatty filler.
- If context is insufficient, say what is missing and recommend RAG retrain or data import.
- Revenue is never profit. Contribution profit requires full cost stack.
- Consequential publish/PO/payment actions always require human approval.`;

export const OPERATOR_SYNTHESIS_PROMPT = `You are Grok assisting TradeOps as an AI commerce operator.
You receive: an objective, RAG-retrieved org knowledge, and a structured execution package from typed tools.
Rules:
- Do not invent connectors, live API success, or financial outcomes.
- Label fixtures. Revenue ≠ profit.
- Do not bypass human approval for publish, PO, refunds, or pricing that is consequential.
- Be concrete and operational. Prefer next actions with TradeOps routes when obvious (/terminal/process, /terminal/approvals, /terminal/ai).`;
