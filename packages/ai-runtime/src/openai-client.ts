/**
 * OpenAI runtime client — primary reasoning backend behind the AI Adapter.
 * Uses Chat Completions + optional strict JSON Schema structured outputs.
 * Web search via Responses API when enabled.
 *
 * Never call from browser. Never hardcode keys.
 */

export type OpenAiMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export type OpenAiCompleteInput = {
  system: string;
  user: string;
  messages?: OpenAiMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /** Strict JSON Schema for Structured Outputs */
  jsonSchema?: {
    name: string;
    schema: Record<string, unknown>;
    strict?: boolean;
  };
  /** Soft json_object mode when schema not provided */
  jsonObject?: boolean;
};

export type OpenAiCompleteResult = {
  ok: boolean;
  text?: string;
  model?: string;
  error?: string;
  code?: 'missing_key' | 'disabled' | 'http' | 'empty' | 'timeout' | 'network';
  provider: 'openai';
  latencyMs: number;
  usedKey: boolean;
};

export type OpenAiClientOptions = {
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

export type OpenAiWebSearchResult = {
  ok: boolean;
  error?: string;
  text?: string;
  sources?: Array<{ title?: string; url?: string; snippet?: string }>;
  latencyMs: number;
};

function resolveKey(options: OpenAiClientOptions): string | undefined {
  const fromEnv = process.env.OPENAI_API_KEY?.trim();
  return options.apiKey ?? (fromEnv || undefined);
}

/**
 * Chat completion against OpenAI API (optionally with structured outputs).
 */
export async function completeWithOpenAi(
  input: OpenAiCompleteInput,
  options: OpenAiClientOptions = {},
): Promise<OpenAiCompleteResult> {
  const t0 = Date.now();
  const apiKey = resolveKey(options);
  if (!apiKey) {
    return {
      ok: false,
      error: 'OPENAI_API_KEY not configured',
      code: 'missing_key',
      provider: 'openai',
      latencyMs: Date.now() - t0,
      usedKey: false,
    };
  }

  const baseUrl = (options.baseUrl ?? process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1').replace(
    /\/$/,
    '',
  );
  const model =
    input.model ??
    options.defaultModel ??
    process.env.OPENAI_MODEL ??
    process.env.OPENAI_CHAT_MODEL ??
    'gpt-4o';
  const timeoutMs = options.timeoutMs ?? 60_000;
  const fetchFn = options.fetchImpl ?? fetch;

  const messages: OpenAiMessage[] =
    input.messages?.length && input.messages.length > 0
      ? input.messages
      : [
          { role: 'system', content: input.system },
          { role: 'user', content: input.user },
        ];

  const body: Record<string, unknown> = {
    model,
    temperature: input.temperature ?? 0.2,
    max_tokens: input.maxTokens ?? 2000,
    messages,
  };

  if (input.jsonSchema) {
    body.response_format = {
      type: 'json_schema',
      json_schema: {
        name: input.jsonSchema.name,
        strict: input.jsonSchema.strict !== false,
        schema: input.jsonSchema.schema,
      },
    };
  } else if (input.jsonObject) {
    body.response_format = { type: 'json_object' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetchFn(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const latencyMs = Date.now() - t0;
    const raw = (await res.json().catch(() => ({}))) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    };
    if (!res.ok) {
      return {
        ok: false,
        error: raw.error?.message ?? `OpenAI HTTP ${res.status}`,
        code: 'http',
        provider: 'openai',
        model,
        latencyMs,
        usedKey: true,
      };
    }
    const text = raw.choices?.[0]?.message?.content?.trim();
    if (!text) {
      return {
        ok: false,
        error: 'Empty model response',
        code: 'empty',
        provider: 'openai',
        model,
        latencyMs,
        usedKey: true,
      };
    }
    return {
      ok: true,
      text,
      model,
      provider: 'openai',
      latencyMs,
      usedKey: true,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      error: msg,
      code: /abort/i.test(msg) ? 'timeout' : 'network',
      provider: 'openai',
      latencyMs: Date.now() - t0,
      usedKey: true,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * OpenAI Responses API with web_search tool (when available).
 * Falls back gracefully if the endpoint/tool is not enabled for the key.
 */
export async function openAiWebSearch(
  query: string,
  options: OpenAiClientOptions & { model?: string } = {},
): Promise<OpenAiWebSearchResult> {
  const t0 = Date.now();
  const apiKey = resolveKey(options);
  if (!apiKey) {
    return { ok: false, error: 'OPENAI_API_KEY not set', latencyMs: Date.now() - t0 };
  }
  const baseUrl = (options.baseUrl ?? process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1').replace(
    /\/$/,
    '',
  );
  const model =
    options.model ??
    options.defaultModel ??
    process.env.OPENAI_MODEL ??
    'gpt-4o';
  const fetchFn = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 45_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Prefer Responses API + web_search
    const res = await fetchFn(`${baseUrl}/responses`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        tools: [{ type: 'web_search_preview' }],
        input: query,
      }),
      signal: controller.signal,
    });
    const raw = (await res.json().catch(() => ({}))) as {
      output_text?: string;
      output?: Array<{
        type?: string;
        content?: Array<{ type?: string; text?: string }>;
        result?: Array<{ title?: string; url?: string; snippet?: string }>;
      }>;
      error?: { message?: string };
    };
    if (!res.ok) {
      // Fallback: plain completion asking for search-style synthesis is NOT true search —
      // report failure so Search Manager can try Tavily.
      return {
        ok: false,
        error: raw.error?.message ?? `OpenAI web search HTTP ${res.status}`,
        latencyMs: Date.now() - t0,
      };
    }

    let text = raw.output_text?.trim();
    if (!text && Array.isArray(raw.output)) {
      const chunks: string[] = [];
      for (const item of raw.output) {
        if (item.content) {
          for (const c of item.content) {
            if (c.text) chunks.push(c.text);
          }
        }
      }
      text = chunks.join('\n').trim() || undefined;
    }

    const sources: Array<{ title?: string; url?: string; snippet?: string }> = [];
    // Best-effort extract of any URL-like citations in text
    if (text) {
      const urlRe = /https?:\/\/[^\s)\]>"']+/g;
      const seen = new Set<string>();
      for (const m of text.match(urlRe) ?? []) {
        if (seen.has(m)) continue;
        seen.add(m);
        sources.push({ url: m, title: m });
      }
    }

    return {
      ok: Boolean(text),
      text,
      sources: sources.slice(0, 12),
      latencyMs: Date.now() - t0,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      latencyMs: Date.now() - t0,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function probeOpenAi(options: OpenAiClientOptions = {}): Promise<{
  ok: boolean;
  configured: boolean;
  model?: string;
  latencyMs: number;
  error?: string;
  provider: 'openai';
}> {
  const t0 = Date.now();
  const apiKey = resolveKey(options);
  if (!apiKey) {
    return {
      ok: false,
      configured: false,
      error: 'OPENAI_API_KEY not set',
      provider: 'openai',
      latencyMs: Date.now() - t0,
    };
  }
  const result = await completeWithOpenAi(
    {
      system: 'Reply with exactly: ok',
      user: 'ping',
      maxTokens: 8,
      temperature: 0,
    },
    { ...options, timeoutMs: Math.min(options.timeoutMs ?? 15_000, 15_000) },
  );
  return {
    ok: result.ok,
    configured: true,
    model: result.model,
    latencyMs: result.latencyMs,
    error: result.error,
    provider: 'openai',
  };
}
