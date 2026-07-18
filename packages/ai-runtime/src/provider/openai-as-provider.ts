/**
 * OpenAI mapped onto AIProvider for optional generation fallback.
 * Does not implement full enterprise retrieval (use Cohere for embed/rerank when available).
 */

import { getAiPlatformConfig } from '@tradeops/config';
import { completeWithOpenAi } from '../openai-client';
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

function parseJsonLoose(text: string): unknown {
  try {
    return JSON.parse(text.trim());
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

export function createOpenAiAsProvider(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): AIProvider {
  const cfg = getAiPlatformConfig(env);
  const apiKey = cfg.openaiApiKey;

  return {
    id: 'openai',
    configured: Boolean(apiKey),

    async generateText(input: GenerateTextInput): Promise<GenerateTextResult> {
      if (!apiKey) {
        return {
          ok: false,
          error: 'OPENAI_API_KEY not configured',
          code: 'AINotConfigured',
          latencyMs: 0,
        };
      }
      const r = await completeWithOpenAi(
        {
          system: input.system,
          user: input.user,
          temperature: input.temperature,
          maxTokens: input.maxTokens,
          model: input.model ?? cfg.openaiModel,
        },
        { apiKey, baseUrl: cfg.openaiBaseUrl, defaultModel: cfg.openaiModel },
      );
      return {
        ok: r.ok,
        text: r.text,
        model: r.model,
        latencyMs: r.latencyMs,
        error: r.error,
        code: r.code,
      };
    },

    async generateStructured<T>(
      input: StructuredGenerationInput,
    ): Promise<StructuredGenerationResult<T>> {
      if (!apiKey) {
        return { ok: false, error: 'OPENAI_API_KEY not configured', code: 'AINotConfigured', latencyMs: 0 };
      }
      const r = await completeWithOpenAi(
        {
          system: `${input.system}\nReturn JSON only for schema ${input.schemaName}.`,
          user: input.user,
          temperature: input.temperature ?? 0.1,
          maxTokens: input.maxTokens,
          model: input.model ?? cfg.openaiModel,
          jsonSchema: {
            name: input.schemaName,
            schema: input.schema,
            strict: true,
          },
        },
        { apiKey, baseUrl: cfg.openaiBaseUrl, defaultModel: cfg.openaiModel },
      );
      if (!r.ok || !r.text) {
        return { ok: false, error: r.error, code: r.code, latencyMs: r.latencyMs, model: r.model };
      }
      const parsed = parseJsonLoose(r.text);
      if (!parsed) {
        return {
          ok: false,
          error: 'malformed structured JSON',
          code: 'AIResponseMalformed',
          rawText: r.text,
          latencyMs: r.latencyMs,
          model: r.model,
        };
      }
      return { ok: true, value: parsed as T, rawText: r.text, latencyMs: r.latencyMs, model: r.model };
    },

    async selectTools(input: ToolSelectionInput): Promise<ToolSelectionResult> {
      const tools = input.tools
        .map((t) => `- ${t.name}: ${t.description}`)
        .join('\n');
      const r = await this.generateText({
        system: `${input.system}\nReturn JSON {"calls":[{"name":"...","arguments":{}}]}. Tools:\n${tools}`,
        user: input.user,
        temperature: 0,
        maxTokens: 1200,
      });
      if (!r.ok || !r.text) {
        return { ok: false, calls: [], error: r.error, latencyMs: r.latencyMs };
      }
      const parsed = parseJsonLoose(r.text) as {
        calls?: Array<{ name?: string; arguments?: Record<string, unknown> }>;
      } | null;
      const allowed = new Set(input.tools.map((t) => t.name));
      const calls = (parsed?.calls ?? [])
        .filter((c) => c.name && allowed.has(c.name))
        .map((c) => ({ name: c.name as string, arguments: c.arguments ?? {} }));
      return { ok: true, calls, rawText: r.text, latencyMs: r.latencyMs };
    },

    async embed(_input: EmbedInput): Promise<EmbedResult> {
      return {
        ok: false,
        error: 'OpenAI embed not used — configure Cohere for enterprise embeddings',
        latencyMs: 0,
      };
    },

    async rerank(_input: RerankInput): Promise<RerankResult> {
      return {
        ok: false,
        error: 'OpenAI rerank not used — configure Cohere for enterprise rerank',
        latencyMs: 0,
      };
    },

    async healthCheck(): Promise<ProviderHealth> {
      const checkedAt = new Date().toISOString();
      if (!apiKey) {
        return {
          ok: false,
          configured: false,
          provider: 'openai',
          latencyMs: 0,
          error: 'OPENAI_API_KEY not set',
          checkedAt,
        };
      }
      const r = await this.generateText({
        system: 'Reply with exactly: ok',
        user: 'ping',
        maxTokens: 8,
        temperature: 0,
      });
      return {
        ok: r.ok,
        configured: true,
        provider: 'openai',
        model: r.model,
        latencyMs: r.latencyMs,
        error: r.error,
        checkedAt,
      };
    },
  };
}
