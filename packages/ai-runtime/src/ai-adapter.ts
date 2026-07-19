/**
 * TradeOps AI Adapter — sole entry for model I/O.
 *
 * Application code must not call OpenAI / xAI / Gemini SDKs directly.
 * Swap AI_PROVIDER (or adapter implementation) without changing gateway, UI, or capabilities.
 *
 * Interface surface (generation runtime):
 *   generate · search · classify · extract · plan · toolCall · stream
 *
 * Enterprise retrieval (Cohere) is a separate Retrieval Engine — see retrieval-engine.ts.
 * Do not make Cohere the sole generation runtime.
 */

import {
  getAiPlatformConfig,
  type AiProviderId,
  type AiPlatformConfig,
} from '@tradeops/config';
import { completeWithOpenAi, openAiWebSearch, probeOpenAi } from './openai-client';
import { completeWithXai, probeXai } from './llm-client';

export type AiAdapterMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type AiGenerateInput = {
  system: string;
  user: string;
  messages?: AiAdapterMessage[];
  temperature?: number;
  maxTokens?: number;
  /** Prefer strict JSON Schema (OpenAI Structured Outputs) */
  jsonSchema?: {
    name: string;
    schema: Record<string, unknown>;
    strict?: boolean;
  };
  jsonObject?: boolean;
  model?: string;
};

export type AiGenerateResult = {
  ok: boolean;
  text?: string;
  model?: string;
  error?: string;
  code?: string;
  provider: AiProviderId;
  latencyMs: number;
  usedKey: boolean;
};

export type AiSearchInput = {
  query: string;
  maxResults?: number;
};

export type AiSearchResult = {
  ok: boolean;
  error?: string;
  text?: string;
  sources: Array<{ title?: string; url?: string; snippet?: string }>;
  provider: string;
  latencyMs: number;
};

export type AiAdapter = {
  id: AiProviderId;
  configured: boolean;
  model: string;
  generate(input: AiGenerateInput): Promise<AiGenerateResult>;
  /** Provider-native web search when available (OpenAI Responses, etc.) */
  search?(input: AiSearchInput): Promise<AiSearchResult>;
  probe(): Promise<{
    ok: boolean;
    configured: boolean;
    model?: string;
    error?: string;
    provider: AiProviderId;
    latencyMs: number;
  }>;
};

function openaiAdapter(cfg: AiPlatformConfig): AiAdapter {
  return {
    id: 'openai',
    configured: cfg.openaiConfigured,
    model: cfg.openaiModel,
    async generate(input) {
      if (!cfg.openaiConfigured) {
        return {
          ok: false,
          error: 'OPENAI_API_KEY not configured',
          code: 'missing_key',
          provider: 'openai',
          latencyMs: 0,
          usedKey: false,
        };
      }
      const result = await completeWithOpenAi(
        {
          system: input.system,
          user: input.user,
          messages: input.messages,
          temperature: input.temperature,
          maxTokens: input.maxTokens,
          model: input.model ?? cfg.openaiModel,
          jsonSchema: input.jsonSchema,
          jsonObject: input.jsonObject ?? cfg.responseMode === 'json_object',
        },
        {
          apiKey: cfg.openaiApiKey,
          baseUrl: cfg.openaiBaseUrl,
          defaultModel: cfg.openaiModel,
        },
      );
      return {
        ok: result.ok,
        text: result.text,
        model: result.model,
        error: result.error,
        code: result.code,
        provider: 'openai',
        latencyMs: result.latencyMs,
        usedKey: result.usedKey,
      };
    },
    async search(input) {
      if (!cfg.openaiConfigured || !cfg.openaiWebSearchEnabled) {
        return {
          ok: false,
          error: 'OpenAI web search unavailable',
          sources: [],
          provider: 'openai_web',
          latencyMs: 0,
        };
      }
      const r = await openAiWebSearch(input.query, {
        apiKey: cfg.openaiApiKey,
        baseUrl: cfg.openaiBaseUrl,
        defaultModel: cfg.openaiModel,
      });
      return {
        ok: r.ok,
        error: r.error,
        text: r.text,
        sources: r.sources ?? [],
        provider: 'openai_web',
        latencyMs: r.latencyMs,
      };
    },
    async probe() {
      const p = await probeOpenAi({
        apiKey: cfg.openaiApiKey,
        baseUrl: cfg.openaiBaseUrl,
        defaultModel: cfg.openaiModel,
      });
      return {
        ok: p.ok,
        configured: p.configured,
        model: p.model,
        error: p.error,
        provider: 'openai',
        latencyMs: p.latencyMs,
      };
    },
  };
}

function xaiAdapter(cfg: AiPlatformConfig): AiAdapter {
  return {
    id: 'xai',
    configured: cfg.xaiConfigured,
    model: cfg.xaiModel,
    async generate(input) {
      if (!cfg.xaiConfigured) {
        return {
          ok: false,
          error: 'XAI_API_KEY not configured',
          code: 'missing_key',
          provider: 'xai',
          latencyMs: 0,
          usedKey: false,
        };
      }
      // completeWithXai still gates on TRADEOPS_AI_MODE; pass allow via options when key present
      const result = await completeWithXai(
        {
          system: input.system,
          user: input.user,
          messages: input.messages,
          temperature: input.temperature,
          maxTokens: input.maxTokens,
          model: input.model ?? cfg.xaiModel,
        },
        {
          apiKey: cfg.xaiApiKey,
          baseUrl: cfg.xaiBaseUrl,
          defaultModel: cfg.xaiModel,
          allowXai: true,
        },
      );
      return {
        ok: result.ok,
        text: result.text,
        model: result.model,
        error: result.error,
        code: result.code,
        provider: 'xai',
        latencyMs: result.latencyMs,
        usedKey: result.usedKey,
      };
    },
    async probe() {
      const p = await probeXai({
        apiKey: cfg.xaiApiKey,
        baseUrl: cfg.xaiBaseUrl,
        defaultModel: cfg.xaiModel,
        allowXai: true,
      });
      return {
        ok: p.ok,
        configured: p.configured,
        model: p.model,
        error: p.error,
        provider: 'xai',
        latencyMs: p.latencyMs,
      };
    },
  };
}

/**
 * Gemini adapter stub — configured when key present; generate not fully wired until needed.
 * Keeps the adapter surface ready without forcing Gemini as a product dependency.
 */
function geminiAdapter(cfg: AiPlatformConfig): AiAdapter {
  return {
    id: 'gemini',
    configured: cfg.geminiConfigured,
    model: cfg.geminiModel,
    async generate() {
      return {
        ok: false,
        error: 'Gemini adapter not fully enabled — set AI_PROVIDER=openai (recommended) or implement gemini generate()',
        code: 'disabled',
        provider: 'gemini',
        latencyMs: 0,
        usedKey: false,
      };
    },
    async probe() {
      return {
        ok: false,
        configured: cfg.geminiConfigured,
        model: cfg.geminiModel,
        error: cfg.geminiConfigured
          ? 'Gemini probe not implemented'
          : 'GEMINI_API_KEY not set',
        provider: 'gemini',
        latencyMs: 0,
      };
    },
  };
}

/**
 * Resolve the active AI Adapter from platform config.
 * Fallback: if primary not configured, try OpenAI then xAI.
 */
export function getAiAdapter(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): AiAdapter {
  const cfg = getAiPlatformConfig(env);
  const primary = cfg.aiProvider;

  const openai = openaiAdapter(cfg);
  const xai = xaiAdapter(cfg);
  const gemini = geminiAdapter(cfg);

  if (primary === 'openai') {
    if (openai.configured) return openai;
    if (xai.configured) return xai;
    return openai; // fail closed with missing_key
  }
  if (primary === 'xai') {
    if (xai.configured) return xai;
    if (openai.configured) return openai;
    return xai;
  }
  if (primary === 'gemini') {
    if (gemini.configured) return gemini;
    if (openai.configured) return openai;
    return gemini;
  }
  return openai;
}

/** List adapter availability without secrets (for /ai/gateway catalog). */
export function listAiAdaptersPublic(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
) {
  const cfg = getAiPlatformConfig(env);
  const active = getAiAdapter(env);
  return {
    active: active.id,
    activeModel: active.model,
    activeConfigured: active.configured,
    adapters: [
      {
        id: 'openai' as const,
        configured: cfg.openaiConfigured,
        model: cfg.openaiModel,
        role: 'primary_recommended' as const,
        capabilities: ['generate', 'structured_outputs', 'function_calling', 'web_search', 'streaming'],
      },
      {
        id: 'xai' as const,
        configured: cfg.xaiConfigured,
        model: cfg.xaiModel,
        role: 'optional' as const,
        capabilities: ['generate', 'function_calling', 'web_search', 'x_search'],
      },
      {
        id: 'gemini' as const,
        configured: cfg.geminiConfigured,
        model: cfg.geminiModel,
        role: 'optional_stub' as const,
        capabilities: ['generate'],
      },
    ],
    interface: ['generate', 'search', 'classify', 'extract', 'plan', 'toolCall', 'stream'] as const,
    note: 'Generation: getAiAdapter(). Retrieval/RAG: getRetrievalEngine() (Cohere). Swap either without rewriting the Capability Gateway or UI.',
  };
}

/** Convenience: generate via active adapter. */
export async function adapterGenerate(
  input: AiGenerateInput,
  env?: NodeJS.ProcessEnv,
): Promise<AiGenerateResult> {
  return getAiAdapter(env).generate(input);
}
