/**
 * Cohere client — enterprise retrieval, embeddings, classification, rerank.
 * Not the sole generation runtime (OpenAI remains generation primary via AI Adapter).
 *
 * https://docs.cohere.com/reference/embed
 * https://docs.cohere.com/reference/rerank
 */

export type CohereClientOptions = {
  apiKey?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  embedModel?: string;
  rerankModel?: string;
  chatModel?: string;
};

export type CohereEmbedResult = {
  ok: boolean;
  error?: string;
  vectors?: number[][];
  model?: string;
  latencyMs: number;
};

export type CohereRerankHit = {
  index: number;
  relevanceScore: number;
  text?: string;
};

export type CohereRerankResult = {
  ok: boolean;
  error?: string;
  results?: CohereRerankHit[];
  latencyMs: number;
};

export type CohereClassifyResult = {
  ok: boolean;
  error?: string;
  label?: string;
  confidence?: number;
  latencyMs: number;
};

function resolveKey(options: CohereClientOptions): string | undefined {
  const fromEnv = process.env.COHERE_API_KEY?.trim();
  return options.apiKey ?? (fromEnv || undefined);
}

function base(options: CohereClientOptions): string {
  return (options.baseUrl ?? process.env.COHERE_BASE_URL ?? 'https://api.cohere.com').replace(
    /\/$/,
    '',
  );
}

/**
 * Embed texts (search_query or search_document input types).
 */
export async function cohereEmbed(input: {
  texts: string[];
  inputType?: 'search_query' | 'search_document' | 'classification' | 'clustering';
  model?: string;
  options?: CohereClientOptions;
}): Promise<CohereEmbedResult> {
  const t0 = Date.now();
  const opts = input.options ?? {};
  const apiKey = resolveKey(opts);
  if (!apiKey) {
    return { ok: false, error: 'COHERE_API_KEY not set', latencyMs: Date.now() - t0 };
  }
  const model =
    input.model ??
    opts.embedModel ??
    process.env.COHERE_EMBED_MODEL ??
    'embed-v4.0';
  const texts = input.texts.map((t) => t.slice(0, 8000)).filter(Boolean).slice(0, 96);
  if (!texts.length) {
    return { ok: false, error: 'no texts to embed', latencyMs: Date.now() - t0 };
  }

  const fetchFn = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 45_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetchFn(`${base(opts)}/v2/embed`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        model,
        texts,
        input_type: input.inputType ?? 'search_document',
        embedding_types: ['float'],
      }),
      signal: controller.signal,
    });
    const raw = (await res.json().catch(() => ({}))) as {
      embeddings?: { float?: number[][] } | number[][];
      error?: string | { message?: string };
      message?: string;
    };
    if (!res.ok) {
      const err =
        typeof raw.error === 'string'
          ? raw.error
          : raw.error?.message ?? raw.message ?? `Cohere embed HTTP ${res.status}`;
      return { ok: false, error: err, model, latencyMs: Date.now() - t0 };
    }

    let vectors: number[][] | undefined;
    if (raw.embeddings && !Array.isArray(raw.embeddings) && Array.isArray(raw.embeddings.float)) {
      vectors = raw.embeddings.float;
    } else if (Array.isArray(raw.embeddings)) {
      vectors = raw.embeddings as number[][];
    }

    if (!vectors?.length) {
      return {
        ok: false,
        error: 'Empty embeddings response',
        model,
        latencyMs: Date.now() - t0,
      };
    }
    return { ok: true, vectors, model, latencyMs: Date.now() - t0 };
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

/**
 * Rerank documents for a query (enterprise retrieval quality).
 */
export async function cohereRerank(input: {
  query: string;
  documents: string[];
  topN?: number;
  model?: string;
  options?: CohereClientOptions;
}): Promise<CohereRerankResult> {
  const t0 = Date.now();
  const opts = input.options ?? {};
  const apiKey = resolveKey(opts);
  if (!apiKey) {
    return { ok: false, error: 'COHERE_API_KEY not set', latencyMs: Date.now() - t0 };
  }
  const docs = input.documents.map((d) => d.slice(0, 4000)).filter(Boolean).slice(0, 100);
  if (!docs.length) {
    return { ok: false, error: 'no documents to rerank', latencyMs: Date.now() - t0 };
  }

  const model =
    input.model ??
    opts.rerankModel ??
    process.env.COHERE_RERANK_MODEL ??
    'rerank-v3.5';
  const fetchFn = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 45_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetchFn(`${base(opts)}/v2/rerank`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        model,
        query: input.query.slice(0, 2000),
        documents: docs,
        top_n: Math.min(input.topN ?? 8, docs.length),
      }),
      signal: controller.signal,
    });
    const raw = (await res.json().catch(() => ({}))) as {
      results?: Array<{ index?: number; relevance_score?: number }>;
      error?: string | { message?: string };
      message?: string;
    };
    if (!res.ok) {
      const err =
        typeof raw.error === 'string'
          ? raw.error
          : raw.error?.message ?? raw.message ?? `Cohere rerank HTTP ${res.status}`;
      return { ok: false, error: err, latencyMs: Date.now() - t0 };
    }
    const results: CohereRerankHit[] = (raw.results ?? []).map((r) => ({
      index: r.index ?? 0,
      relevanceScore: r.relevance_score ?? 0,
      text: docs[r.index ?? 0],
    }));
    return { ok: true, results, latencyMs: Date.now() - t0 };
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

/**
 * Lightweight classification via Command chat (no separate train set required).
 * For production zero-shot labels over commerce intents.
 */
export async function cohereClassifyZeroShot(input: {
  text: string;
  labels: string[];
  options?: CohereClientOptions;
}): Promise<CohereClassifyResult> {
  const t0 = Date.now();
  const opts = input.options ?? {};
  const apiKey = resolveKey(opts);
  if (!apiKey) {
    return { ok: false, error: 'COHERE_API_KEY not set', latencyMs: Date.now() - t0 };
  }
  const model =
    opts.chatModel ?? process.env.COHERE_CHAT_MODEL ?? 'command-a-03-2025';
  const labels = input.labels.filter(Boolean).slice(0, 20);
  if (!labels.length) {
    return { ok: false, error: 'labels required', latencyMs: Date.now() - t0 };
  }

  const fetchFn = opts.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 30_000);

  try {
    const res = await fetchFn(`${base(opts)}/v2/chat`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content:
              'You are a classifier. Reply with JSON only: {"label":"<one of labels>","confidence":0-1}',
          },
          {
            role: 'user',
            content: `Labels: ${labels.join(', ')}\n\nText:\n${input.text.slice(0, 4000)}`,
          },
        ],
        temperature: 0,
      }),
      signal: controller.signal,
    });
    const raw = (await res.json().catch(() => ({}))) as {
      message?: { content?: Array<{ type?: string; text?: string }> };
      error?: string | { message?: string };
    };
    if (!res.ok) {
      const err =
        typeof raw.error === 'string'
          ? raw.error
          : raw.error?.message ?? `Cohere chat HTTP ${res.status}`;
      return { ok: false, error: err, latencyMs: Date.now() - t0 };
    }
    const text =
      raw.message?.content?.map((c) => c.text ?? '').join('') ?? '';
    try {
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      const json = JSON.parse(text.slice(start, end + 1)) as {
        label?: string;
        confidence?: number;
      };
      return {
        ok: true,
        label: json.label,
        confidence: typeof json.confidence === 'number' ? json.confidence : undefined,
        latencyMs: Date.now() - t0,
      };
    } catch {
      return {
        ok: true,
        label: text.trim().slice(0, 80) || undefined,
        latencyMs: Date.now() - t0,
      };
    }
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

export async function probeCohere(options: CohereClientOptions = {}): Promise<{
  ok: boolean;
  configured: boolean;
  error?: string;
  latencyMs: number;
  provider: 'cohere';
}> {
  const t0 = Date.now();
  const apiKey = resolveKey(options);
  if (!apiKey) {
    return {
      ok: false,
      configured: false,
      error: 'COHERE_API_KEY not set',
      latencyMs: Date.now() - t0,
      provider: 'cohere',
    };
  }
  const emb = await cohereEmbed({
    texts: ['tradeops probe'],
    inputType: 'search_query',
    options: { ...options, timeoutMs: 15_000 },
  });
  return {
    ok: emb.ok,
    configured: true,
    error: emb.error,
    latencyMs: emb.latencyMs,
    provider: 'cohere',
  };
}
