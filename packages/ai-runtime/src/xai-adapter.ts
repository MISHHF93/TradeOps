/**
 * xAI (Grok) adapter — retained for optional non-operator experiments only.
 *
 * Operator Phase B generative policy is Cohere-only.
 * bootstrapXaiProvider does NOT activate xAI for generateText / operator runs.
 * Never logs API keys.
 */

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

function xaiKey(env: NodeJS.ProcessEnv = process.env): string | undefined {
  return env.XAI_API_KEY?.trim() || undefined;
}

function xaiBase(env: NodeJS.ProcessEnv = process.env): string {
  return (env.XAI_BASE_URL?.trim() || 'https://api.x.ai/v1').replace(/\/$/, '');
}

function chatModel(env: NodeJS.ProcessEnv = process.env): string {
  return env.XAI_CHAT_MODEL?.trim() || env.XAI_MODEL?.trim() || 'grok-3';
}

export function createXaiAdapter(env: NodeJS.ProcessEnv = process.env): AiProviderAdapter {
  return {
    id: 'xai',
    isConfigured: () => Boolean(xaiKey(env)),
    async generate(req: GenerationRequest): Promise<GenerationResult> {
      const key = xaiKey(env);
      const started = Date.now();
      if (!key) {
        return {
          provider: 'xai',
          text: '',
          latencyMs: 0,
          offline: false,
          blocked: true,
          note: 'XAI_API_KEY not set',
        };
      }
      try {
        const messages: Array<{ role: string; content: string }> = [];
        if (req.system?.trim()) {
          messages.push({ role: 'system', content: req.system });
        }
        messages.push({ role: 'user', content: req.prompt });
        const res = await fetch(`${xaiBase(env)}/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            model: req.model ?? chatModel(env),
            messages,
            temperature: req.temperature ?? 0.2,
            max_tokens: req.maxTokens ?? 2048,
          }),
        });
        const latencyMs = Date.now() - started;
        if (!res.ok) {
          const body = await res.text().catch(() => '');
          return {
            provider: 'xai',
            text: '',
            latencyMs,
            offline: false,
            failed: true,
            note: `xAI chat HTTP ${res.status}${body ? `: ${body.slice(0, 240)}` : ''}`,
          };
        }
        const json = (await res.json()) as {
          choices?: Array<{ message?: { content?: string | null } }>;
        };
        const text = json.choices?.[0]?.message?.content?.trim() ?? '';
        return {
          provider: 'xai',
          text,
          raw: { model: req.model ?? chatModel(env) },
          latencyMs,
          offline: false,
        };
      } catch (e) {
        return {
          provider: 'xai',
          text: '',
          latencyMs: Date.now() - started,
          offline: false,
          failed: true,
          note: e instanceof Error ? e.message : String(e),
        };
      }
    },
    async embed(_req: EmbedRequest): Promise<EmbedResult> {
      return {
        provider: 'xai',
        embeddings: [],
        latencyMs: 0,
        blocked: true,
        note: 'xAI embed not wired — use COHERE_API_KEY for embeddings',
      };
    },
    async rerank(_req: RerankRequest): Promise<RerankResult> {
      return {
        provider: 'xai',
        results: [],
        latencyMs: 0,
        blocked: true,
        note: 'xAI rerank not wired — use COHERE_API_KEY for rerank',
      };
    },
  };
}

/**
 * Intentionally does not activate xAI for operator generation.
 * Cohere is the sole Phase B provider (see resolveProviderFromEnv).
 * Kept as a no-op so existing call sites stay compile-safe.
 */
export function bootstrapXaiProvider(_env: NodeJS.ProcessEnv = process.env): void {
  // Do not register/activate xAI for generateText — prevents HTTP 403 credit noise from leaking into operator briefings.
}
