/**
 * Cohere AIProvider implementation.
 * Sole module that imports cohere-ai (or uses fetch against Cohere APIs).
 * Never log or return API keys.
 */

import { getAiPlatformConfig } from '@tradeops/config';
import type {
  AIProvider,
  EmbedInput,
  EmbedResult,
  GenerateTextInput,
  GenerateTextResult,
  ProviderHealth,
  RerankInput,
  RerankResult,
  StructuredGenerationInput,
  StructuredGenerationResult,
  ToolSelectionInput,
  ToolSelectionResult,
} from './ai-provider';
import { AiProviderError, mapHttpToAiError, mapUnknownToAiError } from './errors';

function resolveKey(env: NodeJS.ProcessEnv | Record<string, string | undefined>): string | undefined {
  const k = (env.COHERE_API_KEY ?? '').trim();
  return k || undefined;
}

function baseUrl(env: NodeJS.ProcessEnv | Record<string, string | undefined>): string {
  return (env.COHERE_BASE_URL ?? 'https://api.cohere.com').replace(/\/$/, '');
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      p,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new AiProviderError('AITimeout', `Timeout after ${ms}ms`, undefined, true)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function parseJsonLoose(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function extractChatText(raw: {
  message?: { content?: Array<{ type?: string; text?: string }> | string };
  text?: string;
}): string {
  if (typeof raw.text === 'string' && raw.text.trim()) return raw.text.trim();
  const content = raw.message?.content;
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((c) => c.text ?? '')
      .join('')
      .trim();
  }
  return '';
}

export function createCohereProvider(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): AIProvider {
  const cfg = getAiPlatformConfig(env);
  const apiKey = resolveKey(env);
  const chatModel = cfg.cohereChatModel || 'command-a-03-2025';
  const embedModel = cfg.cohereEmbedModel || 'embed-v4.0';
  const rerankModel = cfg.cohereRerankModel || 'rerank-v3.5';
  const base = baseUrl(env);
  const timeoutMs = Number(env.COHERE_TIMEOUT_MS) || 60_000;
  const temperatureDefault = Number(env.COHERE_TEMPERATURE);
  const temp =
    Number.isFinite(temperatureDefault) && temperatureDefault >= 0
      ? temperatureDefault
      : 0.2;
  const maxTokensDefault = Number(env.COHERE_MAX_TOKENS);
  const maxTok =
    Number.isFinite(maxTokensDefault) && maxTokensDefault > 0
      ? maxTokensDefault
      : 4000;

  async function cohereFetch(
    path: string,
    body: Record<string, unknown>,
  ): Promise<{ ok: boolean; status: number; json: Record<string, unknown>; latencyMs: number }> {
    if (!apiKey) {
      throw new AiProviderError('AINotConfigured', 'COHERE_API_KEY not configured', undefined, false);
    }
    const t0 = Date.now();
    const res = await withTimeout(
      fetch(`${base}${path}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
      }),
      timeoutMs,
    );
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: res.ok, status: res.status, json, latencyMs: Date.now() - t0 };
  }

  const provider: AIProvider = {
    id: 'cohere',
    configured: Boolean(apiKey),

    async generateText(input: GenerateTextInput): Promise<GenerateTextResult> {
      try {
        const model = input.model ?? chatModel;
        const { ok, status, json, latencyMs } = await cohereFetch('/v2/chat', {
          model,
          temperature: input.temperature ?? temp,
          max_tokens: input.maxTokens ?? maxTok,
          messages: [
            { role: 'system', content: input.system },
            { role: 'user', content: input.user },
          ],
        });
        if (!ok) {
          const msg =
            (json.message as string) ||
            (typeof json.error === 'string' ? json.error : undefined) ||
            `Cohere chat HTTP ${status}`;
          const err = mapHttpToAiError(status, msg);
          return { ok: false, error: err.message, code: err.code, latencyMs, model };
        }
        const text = extractChatText(json as Parameters<typeof extractChatText>[0]);
        if (!text) {
          return {
            ok: false,
            error: 'Empty model response',
            code: 'AIResponseEmpty',
            latencyMs,
            model,
          };
        }
        return { ok: true, text, model, latencyMs };
      } catch (e) {
        const err = mapUnknownToAiError(e);
        return { ok: false, error: err.message, code: err.code, latencyMs: 0 };
      }
    },

    async generateStructured<T>(
      input: StructuredGenerationInput,
    ): Promise<StructuredGenerationResult<T>> {
      const system = [
        input.system,
        '',
        'Return exactly one JSON object matching the schema. No markdown fences. No text outside the object.',
        `Schema name: ${input.schemaName}`,
        `JSON Schema: ${JSON.stringify(input.schema)}`,
      ].join('\n');
      const gen = await provider.generateText({
        system,
        user: input.user,
        temperature: input.temperature ?? 0.1,
        maxTokens: input.maxTokens ?? maxTok,
        model: input.model ?? chatModel,
      });
      if (!gen.ok || !gen.text) {
        return {
          ok: false,
          error: gen.error,
          code: gen.code,
          rawText: gen.text,
          latencyMs: gen.latencyMs,
          model: gen.model,
        };
      }
      const parsed = parseJsonLoose(gen.text);
      if (!parsed || typeof parsed !== 'object') {
        return {
          ok: false,
          error: 'Structured response was not valid JSON',
          code: 'AIResponseMalformed',
          rawText: gen.text,
          latencyMs: gen.latencyMs,
          model: gen.model,
        };
      }
      return {
        ok: true,
        value: parsed as T,
        rawText: gen.text,
        latencyMs: gen.latencyMs,
        model: gen.model,
      };
    },

    async selectTools(input: ToolSelectionInput): Promise<ToolSelectionResult> {
      const toolList = input.tools
        .map((t) => `- ${t.name}: ${t.description} params=${JSON.stringify(t.parameters)}`)
        .join('\n');
      const system = [
        input.system,
        '',
        'Select zero or more tools to gather evidence. TradeOps will execute them — do not invent results.',
        'Respond with JSON only: {"calls":[{"name":"tool_name","arguments":{...}}]}',
        'If no tools are needed, return {"calls":[]}.',
        'Available tools:',
        toolList || '(none)',
      ].join('\n');
      const gen = await provider.generateText({
        system,
        user: input.user,
        temperature: input.temperature ?? 0,
        maxTokens: input.maxTokens ?? 1200,
      });
      if (!gen.ok || !gen.text) {
        return {
          ok: false,
          calls: [],
          error: gen.error,
          latencyMs: gen.latencyMs,
          rawText: gen.text,
        };
      }
      const parsed = parseJsonLoose(gen.text) as {
        calls?: Array<{ name?: string; arguments?: Record<string, unknown> }>;
      } | null;
      const calls = Array.isArray(parsed?.calls)
        ? parsed!.calls
            .filter((c) => c && typeof c.name === 'string')
            .map((c) => ({
              name: c.name as string,
              arguments: c.arguments && typeof c.arguments === 'object' ? c.arguments : {},
            }))
        : [];
      // Only allow registered tool names
      const allowed = new Set(input.tools.map((t) => t.name));
      return {
        ok: true,
        calls: calls.filter((c) => allowed.has(c.name)),
        rawText: gen.text,
        latencyMs: gen.latencyMs,
      };
    },

    async embed(input: EmbedInput): Promise<EmbedResult> {
      try {
        const model = input.model ?? embedModel;
        const texts = input.texts.map((t) => t.slice(0, 8000)).filter(Boolean).slice(0, 96);
        if (!texts.length) {
          return { ok: false, error: 'no texts', latencyMs: 0 };
        }
        const { ok, status, json, latencyMs } = await cohereFetch('/v2/embed', {
          model,
          texts,
          input_type: input.inputType ?? 'search_document',
          embedding_types: ['float'],
        });
        if (!ok) {
          const msg = (json.message as string) || `Cohere embed HTTP ${status}`;
          const err = mapHttpToAiError(status, msg);
          return { ok: false, error: err.message, latencyMs, model };
        }
        const embeddings = json.embeddings as { float?: number[][] } | number[][] | undefined;
        let vectors: number[][] | undefined;
        if (embeddings && !Array.isArray(embeddings) && Array.isArray(embeddings.float)) {
          vectors = embeddings.float;
        } else if (Array.isArray(embeddings)) {
          vectors = embeddings as number[][];
        }
        if (!vectors?.length) {
          return { ok: false, error: 'Empty embeddings', latencyMs, model };
        }
        return { ok: true, vectors, model, latencyMs };
      } catch (e) {
        const err = mapUnknownToAiError(e);
        return { ok: false, error: err.message, latencyMs: 0 };
      }
    },

    async rerank(input: RerankInput): Promise<RerankResult> {
      try {
        const model = input.model ?? rerankModel;
        const documents = input.documents.map((d) => d.slice(0, 4000)).filter(Boolean).slice(0, 100);
        if (!documents.length) {
          return { ok: false, error: 'no documents', latencyMs: 0 };
        }
        const { ok, status, json, latencyMs } = await cohereFetch('/v2/rerank', {
          model,
          query: input.query.slice(0, 2000),
          documents,
          top_n: Math.min(input.topN ?? 8, documents.length),
        });
        if (!ok) {
          const msg = (json.message as string) || `Cohere rerank HTTP ${status}`;
          const err = mapHttpToAiError(status, msg);
          return { ok: false, error: err.message, latencyMs };
        }
        const results = ((json.results as Array<{ index?: number; relevance_score?: number }>) ?? []).map(
          (r) => ({
            index: r.index ?? 0,
            relevanceScore: r.relevance_score ?? 0,
          }),
        );
        return { ok: true, results, latencyMs };
      } catch (e) {
        const err = mapUnknownToAiError(e);
        return { ok: false, error: err.message, latencyMs: 0 };
      }
    },

    async healthCheck(): Promise<ProviderHealth> {
      const checkedAt = new Date().toISOString();
      if (!apiKey) {
        return {
          ok: false,
          configured: false,
          provider: 'cohere',
          model: chatModel,
          latencyMs: 0,
          error: 'COHERE_API_KEY not set',
          checkedAt,
        };
      }
      const emb = await provider.embed({
        texts: ['tradeops health'],
        inputType: 'search_query',
      });
      return {
        ok: emb.ok,
        configured: true,
        provider: 'cohere',
        model: chatModel,
        latencyMs: emb.latencyMs,
        error: emb.error,
        checkedAt,
      };
    },
  };

  return provider;
}
