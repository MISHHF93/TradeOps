/**
 * Cohere production adapter — Chat V2, Embed, Rerank.
 * Server-side only. Never logs API keys. Failures return blocked/failed with error codes.
 *
 * Models (defaults — override via env):
 *   COHERE_CHAT_MODEL=command-a-plus-05-2026
 *   COHERE_EMBED_MODEL=embed-v4.0
 *   COHERE_RERANK_MODEL=rerank-v3.5
 *
 * Uses Cohere HTTP Chat API V2 (`https://api.cohere.com/v2/chat`) — no browser SDK.
 * Structured Phase B: response_format.type = "json_object" + schema (required fields).
 */

import { getSchema } from './schema-registry';
import {
  registerAiProvider,
  resolveProviderFromEnv,
  setActiveAiProvider,
  type AiProviderAdapter,
  type EmbedRequest,
  type EmbedResult,
  type GenerationRequest,
  type GenerationResult,
  type RerankRequest,
  type RerankResult,
} from './provider-abstraction';

/** Stable diagnostic codes for startup + health (no secrets). */
export type CohereErrorCode =
  | 'COHERE_KEY_MISSING'
  | 'COHERE_KEY_INVALID'
  | 'COHERE_MODEL_INVALID'
  | 'COHERE_RATE_LIMITED'
  | 'COHERE_SCHEMA_INVALID'
  | 'COHERE_PROVIDER_UNAVAILABLE'
  | 'COHERE_OK';

export type CohereDeepHealth = {
  configured: boolean;
  authenticated: boolean;
  modelAvailable: boolean;
  structuredOutputHealthy: boolean;
  lastChecked: string;
  errorCode: CohereErrorCode | null;
  model: string;
  latencyMs?: number;
};

const COHERE_CHAT_URL = 'https://api.cohere.com/v2/chat';
const DEFAULT_CHAT_MODEL = 'command-a-plus-05-2026';
const DEFAULT_EMBED_MODEL = 'embed-v4.0';
const DEFAULT_RERANK_MODEL = 'rerank-v3.5';

/** Reject missing / whitespace-only keys. */
export function resolveCohereApiKey(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const raw = env.COHERE_API_KEY ?? env.CO_API_KEY;
  if (raw === undefined || raw === null) return undefined;
  const t = String(raw).trim();
  return t.length > 0 ? t : undefined;
}

export function cohereChatModel(env: NodeJS.ProcessEnv = process.env): string {
  return env.COHERE_CHAT_MODEL?.trim() || DEFAULT_CHAT_MODEL;
}
export function cohereEmbedModel(env: NodeJS.ProcessEnv = process.env): string {
  return env.COHERE_EMBED_MODEL?.trim() || DEFAULT_EMBED_MODEL;
}
export function cohereRerankModel(env: NodeJS.ProcessEnv = process.env): string {
  return env.COHERE_RERANK_MODEL?.trim() || DEFAULT_RERANK_MODEL;
}

export function classifyCohereHttpError(
  status: number,
  bodySnippet: string,
): CohereErrorCode {
  const b = bodySnippet.toLowerCase();
  if (status === 401 || status === 403) return 'COHERE_KEY_INVALID';
  if (status === 404 || (status === 400 && /model|not found|unknown model/i.test(b))) {
    return 'COHERE_MODEL_INVALID';
  }
  if (status === 429) return 'COHERE_RATE_LIMITED';
  if (status === 400 && /schema|json_schema|response_format|invalid/i.test(b)) {
    return 'COHERE_SCHEMA_INVALID';
  }
  if (status >= 500 || status === 0) return 'COHERE_PROVIDER_UNAVAILABLE';
  return 'COHERE_PROVIDER_UNAVAILABLE';
}

/**
 * Extract assistant text from Chat V2 response.
 * Command A+ may return `thinking` blocks before `text` — only use text blocks.
 */
function extractChatText(json: unknown): string {
  const j = json as {
    message?: {
      content?: Array<{ type?: string; text?: string; thinking?: string }>;
    };
    text?: string;
  };
  const parts = j.message?.content ?? [];
  const textParts = parts
    .filter((p) => p.type === 'text' || (p.text && p.type !== 'thinking'))
    .map((p) => p.text ?? '')
    .filter(Boolean);
  if (textParts.length) return textParts.join('\n');
  // Fallback: any part with text that is not pure thinking metadata
  const anyText = parts
    .map((p) => (p.type === 'thinking' ? '' : p.text ?? ''))
    .filter(Boolean);
  if (anyText.length) return anyText.join('\n');
  return j.text || '';
}

/**
 * Build Cohere V2 chat body. When schemaId is set, request JSON object structured output.
 * Does not use strict_tools here — that belongs to tool-selection phases only.
 */
export function buildCohereChatV2Body(
  req: GenerationRequest,
  env: NodeJS.ProcessEnv = process.env,
): Record<string, unknown> {
  const model = req.model ?? cohereChatModel(env);
  const system = req.system?.trim();
  const messages: Array<{ role: string; content: string }> = [];
  if (system) {
    messages.push({ role: 'system', content: system });
  }

  let userContent = req.prompt;
  const wantsJson = Boolean(req.schemaId);
  if (wantsJson && !/json/i.test(userContent)) {
    userContent = `${userContent}\n\nRespond with a single valid JSON object only (no markdown fences).`;
  }
  messages.push({ role: 'user', content: userContent });

  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: req.temperature ?? 0.3,
    max_tokens: req.maxTokens ?? 2048,
  };

  if (wantsJson) {
    const registered = getSchema(req.schemaId!);
    if (registered) {
      // Cohere Structured Outputs: every object must declare required[]
      body.response_format = {
        type: 'json_object',
        schema: registered.schema,
      };
    } else {
      body.response_format = { type: 'json_object' };
    }
  }

  return body;
}

/**
 * Effective env for Cohere calls.
 * Prefer live process.env (post loadEnv / .env file) so adapters registered early
 * still see keys applied by Nest bootstrap. Injected `env` used for unit tests.
 */
function effectiveCohereEnv(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  // process.env wins for non-empty values; fall back to injected env for tests.
  const merged: NodeJS.ProcessEnv = { ...env };
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined && String(v).trim() !== '') {
      merged[k] = v;
    }
  }
  return merged;
}

export function createCohereAdapter(env: NodeJS.ProcessEnv = process.env): AiProviderAdapter {
  return {
    id: 'cohere',
    isConfigured: () => Boolean(resolveCohereApiKey(effectiveCohereEnv(env))),
    async generate(req: GenerationRequest): Promise<GenerationResult> {
      const live = effectiveCohereEnv(env);
      const key = resolveCohereApiKey(live);
      const started = Date.now();
      if (!key) {
        return {
          provider: 'cohere',
          text: '',
          latencyMs: 0,
          offline: false,
          blocked: true,
          note: `COHERE_KEY_MISSING: AI generation blocked — set COHERE_API_KEY for Phase B narrative. Prompt length=${req.prompt.length}. Typed TradeOps tools remain available; no fixture narrative was substituted.`,
        };
      }
      try {
        if (req.schemaId && !getSchema(req.schemaId)) {
          return {
            provider: 'cohere',
            text: '',
            latencyMs: 0,
            offline: false,
            failed: true,
            note: `COHERE_SCHEMA_INVALID: unknown schemaId=${req.schemaId}`,
          };
        }
        const body = buildCohereChatV2Body(req, live);
        const res = await fetch(COHERE_CHAT_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(body),
        });
        const latencyMs = Date.now() - started;
        if (!res.ok) {
          const errBody = await res.text().catch(() => '');
          const code = classifyCohereHttpError(res.status, errBody);
          return {
            provider: 'cohere',
            text: '',
            latencyMs,
            offline: false,
            failed: true,
            note: `${code}: Cohere chat HTTP ${res.status}${errBody ? `: ${errBody.slice(0, 200)}` : ''}`,
          };
        }
        const json = await res.json();
        const text = extractChatText(json);
        if (!text.trim()) {
          return {
            provider: 'cohere',
            text: '',
            raw: { model: req.model ?? cohereChatModel(live), schemaId: req.schemaId },
            latencyMs,
            offline: false,
            failed: true,
            note: `COHERE_EMPTY_RESPONSE: HTTP 200 but no text content (schemaId=${req.schemaId ?? 'none'}; try higher max_tokens).`,
          };
        }
        return {
          provider: 'cohere',
          text,
          raw: { model: req.model ?? cohereChatModel(live), schemaId: req.schemaId },
          latencyMs,
          offline: false,
        };
      } catch (e) {
        return {
          provider: 'cohere',
          text: '',
          latencyMs: Date.now() - started,
          offline: false,
          failed: true,
          note: `COHERE_PROVIDER_UNAVAILABLE: ${e instanceof Error ? e.message : String(e)}`,
        };
      }
    },
    async embed(req: EmbedRequest): Promise<EmbedResult> {
      const live = effectiveCohereEnv(env);
      const key = resolveCohereApiKey(live);
      const started = Date.now();
      if (!key) {
        return {
          provider: 'cohere',
          embeddings: [],
          latencyMs: 0,
          blocked: true,
          note: 'COHERE_KEY_MISSING: set COHERE_API_KEY',
        };
      }
      try {
        const res = await fetch('https://api.cohere.com/v2/embed', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            texts: req.texts,
            model: req.model ?? cohereEmbedModel(live),
            input_type: 'search_document',
            embedding_types: ['float'],
          }),
        });
        const latencyMs = Date.now() - started;
        if (!res.ok) {
          const errBody = await res.text().catch(() => '');
          const code = classifyCohereHttpError(res.status, errBody);
          return {
            provider: 'cohere',
            embeddings: [],
            latencyMs,
            failed: true,
            note: `${code}: Cohere embed HTTP ${res.status}`,
          };
        }
        const json = (await res.json()) as {
          embeddings?: number[][] | { float?: number[][] };
        };
        const embeddings = Array.isArray(json.embeddings)
          ? json.embeddings
          : json.embeddings?.float ?? [];
        return { provider: 'cohere', embeddings, latencyMs };
      } catch (e) {
        return {
          provider: 'cohere',
          embeddings: [],
          latencyMs: Date.now() - started,
          failed: true,
          note: `COHERE_PROVIDER_UNAVAILABLE: ${e instanceof Error ? e.message : String(e)}`,
        };
      }
    },
    async rerank(req: RerankRequest): Promise<RerankResult> {
      const live = effectiveCohereEnv(env);
      const key = resolveCohereApiKey(live);
      const started = Date.now();
      if (!key) {
        return {
          provider: 'cohere',
          results: [],
          latencyMs: 0,
          blocked: true,
          note: 'COHERE_KEY_MISSING: set COHERE_API_KEY',
        };
      }
      try {
        const res = await fetch('https://api.cohere.com/v2/rerank', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: req.model ?? cohereRerankModel(live),
            query: req.query,
            documents: req.documents,
            top_n: req.topN ?? Math.min(10, req.documents.length),
          }),
        });
        const latencyMs = Date.now() - started;
        if (!res.ok) {
          const errBody = await res.text().catch(() => '');
          const code = classifyCohereHttpError(res.status, errBody);
          return {
            provider: 'cohere',
            results: [],
            latencyMs,
            failed: true,
            note: `${code}: Cohere rerank HTTP ${res.status}`,
          };
        }
        const json = (await res.json()) as {
          results?: Array<{ index: number; relevance_score: number }>;
        };
        return {
          provider: 'cohere',
          results: (json.results ?? []).map((r) => ({
            index: r.index,
            relevanceScore: r.relevance_score,
          })),
          latencyMs,
        };
      } catch (e) {
        return {
          provider: 'cohere',
          results: [],
          latencyMs: Date.now() - started,
          failed: true,
          note: `COHERE_PROVIDER_UNAVAILABLE: ${e instanceof Error ? e.message : String(e)}`,
        };
      }
    },
  };
}

/** Register Cohere adapter; activate when resolveProviderFromEnv selects cohere. */
export function bootstrapCohereProvider(env: NodeJS.ProcessEnv = process.env): void {
  const adapter = createCohereAdapter(env);
  registerAiProvider(adapter);
  if (resolveProviderFromEnv(env) === 'cohere' && adapter.isConfigured()) {
    setActiveAiProvider('cohere');
  }
}

/**
 * Startup / health diagnostics without exposing the key.
 */
export function diagnoseCohereConfig(env: NodeJS.ProcessEnv = process.env): {
  configured: boolean;
  errorCode: CohereErrorCode | null;
  model: string;
  keyLength: number;
} {
  const key = resolveCohereApiKey(env);
  const model = cohereChatModel(env);
  if (!key) {
    return { configured: false, errorCode: 'COHERE_KEY_MISSING', model, keyLength: 0 };
  }
  return { configured: true, errorCode: null, model, keyLength: key.length };
}

/**
 * Minimal Cohere Chat V2 probe for deep health (server-side only).
 * Does not return or log the API key.
 */
export async function probeCohereDeepHealth(
  env: NodeJS.ProcessEnv = process.env,
): Promise<CohereDeepHealth> {
  const lastChecked = new Date().toISOString();
  const model = cohereChatModel(env);
  const key = resolveCohereApiKey(env);
  if (!key) {
    return {
      configured: false,
      authenticated: false,
      modelAvailable: false,
      structuredOutputHealthy: false,
      lastChecked,
      errorCode: 'COHERE_KEY_MISSING',
      model,
    };
  }

  const started = Date.now();
  try {
    // 1) Auth + model availability (plain chat)
    // Command A+ may emit thinking tokens — budget enough room for text.
    const plain = await fetch(COHERE_CHAT_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'Reply with the single word: ok' }],
        temperature: 0,
        max_tokens: 128,
      }),
    });
    const plainBody = await plain.text().catch(() => '');
    if (!plain.ok) {
      return {
        configured: true,
        authenticated: plain.status !== 401 && plain.status !== 403,
        modelAvailable: false,
        structuredOutputHealthy: false,
        lastChecked,
        errorCode: classifyCohereHttpError(plain.status, plainBody),
        model,
        latencyMs: Date.now() - started,
      };
    }

    // 2) Structured JSON object (minimal schema — all properties required)
    const schema = {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Must be ok' },
        checked: { type: 'boolean', description: 'Always true' },
      },
      required: ['status', 'checked'],
    };
    const structured = await fetch(COHERE_CHAT_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content:
              'Respond with a single JSON object only: {"status":"ok","checked":true}. No markdown.',
          },
        ],
        temperature: 0,
        max_tokens: 256,
        response_format: { type: 'json_object', schema },
      }),
    });
    const structuredText = await structured.text().catch(() => '');
    if (!structured.ok) {
      return {
        configured: true,
        authenticated: true,
        modelAvailable: true,
        structuredOutputHealthy: false,
        lastChecked,
        errorCode: classifyCohereHttpError(structured.status, structuredText),
        model,
        latencyMs: Date.now() - started,
      };
    }

    let structuredOk = false;
    try {
      const j = JSON.parse(structuredText);
      const t = extractChatText(j)
        .replace(/^```json\s*/i, '')
        .replace(/```$/i, '')
        .trim();
      const parsed = JSON.parse(t) as { status?: string; checked?: boolean };
      structuredOk =
        String(parsed.status).toLowerCase() === 'ok' &&
        (parsed.checked === true || parsed.checked === ('true' as unknown));
    } catch {
      structuredOk = false;
    }

    return {
      configured: true,
      authenticated: true,
      modelAvailable: true,
      structuredOutputHealthy: structuredOk,
      lastChecked,
      errorCode: structuredOk ? 'COHERE_OK' : 'COHERE_SCHEMA_INVALID',
      model,
      latencyMs: Date.now() - started,
    };
  } catch {
    return {
      configured: true,
      authenticated: false,
      modelAvailable: false,
      structuredOutputHealthy: false,
      lastChecked,
      errorCode: 'COHERE_PROVIDER_UNAVAILABLE',
      model,
      latencyMs: Date.now() - started,
    };
  }
}
