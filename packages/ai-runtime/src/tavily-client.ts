/**
 * Tavily — sole dedicated public-web retrieval provider.
 * Search / extract / crawl. Never used for authenticated operational truth.
 * https://docs.tavily.com
 */

export type TavilySearchResult = {
  title: string;
  url: string;
  content?: string;
  score?: number;
};

export type TavilyClientResult<T> = {
  ok: boolean;
  error?: string;
  results?: T;
  latencyMs: number;
};

export async function tavilySearch(input: {
  query: string;
  maxResults?: number;
  includeDomains?: string[];
  excludeDomains?: string[];
  apiKey?: string;
  fetchImpl?: typeof fetch;
}): Promise<TavilyClientResult<TavilySearchResult[]>> {
  const t0 = Date.now();
  const apiKey = input.apiKey ?? process.env.TAVILY_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, error: 'TAVILY_API_KEY not set', latencyMs: Date.now() - t0 };
  }
  const fetchImpl = input.fetchImpl ?? fetch;
  try {
    const res = await fetchImpl('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query: input.query,
        max_results: input.maxResults ?? 8,
        include_domains: input.includeDomains,
        exclude_domains: input.excludeDomains,
        search_depth: 'basic',
        include_answer: false,
      }),
    });
    const raw = (await res.json().catch(() => ({}))) as {
      results?: Array<{ title?: string; url?: string; content?: string; score?: number }>;
      detail?: { error?: string };
      error?: string;
    };
    if (!res.ok) {
      return {
        ok: false,
        error: raw.error ?? raw.detail?.error ?? `Tavily HTTP ${res.status}`,
        latencyMs: Date.now() - t0,
      };
    }
    const results = (raw.results ?? []).map((r) => ({
      title: r.title ?? r.url ?? 'result',
      url: r.url ?? '',
      content: r.content,
      score: r.score,
    }));
    return { ok: true, results, latencyMs: Date.now() - t0 };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      latencyMs: Date.now() - t0,
    };
  }
}

export async function tavilyExtract(input: {
  urls: string[];
  apiKey?: string;
  fetchImpl?: typeof fetch;
}): Promise<TavilyClientResult<Array<{ url: string; rawContent?: string }>>> {
  const t0 = Date.now();
  const apiKey = input.apiKey ?? process.env.TAVILY_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, error: 'TAVILY_API_KEY not set', latencyMs: Date.now() - t0 };
  }
  const fetchImpl = input.fetchImpl ?? fetch;
  try {
    const res = await fetchImpl('https://api.tavily.com/extract', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        api_key: apiKey,
        urls: input.urls.slice(0, 5),
      }),
    });
    const raw = (await res.json().catch(() => ({}))) as {
      results?: Array<{ url?: string; raw_content?: string }>;
      error?: string;
    };
    if (!res.ok) {
      return {
        ok: false,
        error: raw.error ?? `Tavily extract HTTP ${res.status}`,
        latencyMs: Date.now() - t0,
      };
    }
    return {
      ok: true,
      results: (raw.results ?? []).map((r) => ({
        url: r.url ?? '',
        rawContent: r.raw_content,
      })),
      latencyMs: Date.now() - t0,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      latencyMs: Date.now() - t0,
    };
  }
}

/**
 * Graph crawl from a base URL (manufacturer sites, docs hubs).
 * https://docs.tavily.com/documentation/api-reference/endpoint/crawl
 */
export async function tavilyCrawl(input: {
  url: string;
  instructions?: string;
  maxDepth?: number;
  limit?: number;
  apiKey?: string;
  fetchImpl?: typeof fetch;
}): Promise<TavilyClientResult<Array<{ url: string; rawContent?: string }>>> {
  const t0 = Date.now();
  const apiKey = input.apiKey ?? process.env.TAVILY_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, error: 'TAVILY_API_KEY not set', latencyMs: Date.now() - t0 };
  }
  const fetchImpl = input.fetchImpl ?? fetch;
  try {
    const res = await fetchImpl('https://api.tavily.com/crawl', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        url: input.url,
        instructions: input.instructions,
        max_depth: input.maxDepth ?? 1,
        limit: Math.min(input.limit ?? 20, 50),
        extract_depth: 'basic',
        format: 'markdown',
      }),
    });
    const raw = (await res.json().catch(() => ({}))) as {
      results?: Array<{ url?: string; raw_content?: string }>;
      detail?: { error?: string };
      error?: string;
    };
    if (!res.ok) {
      return {
        ok: false,
        error: raw.error ?? raw.detail?.error ?? `Tavily crawl HTTP ${res.status}`,
        latencyMs: Date.now() - t0,
      };
    }
    return {
      ok: true,
      results: (raw.results ?? []).map((r) => ({
        url: r.url ?? '',
        rawContent: r.raw_content,
      })),
      latencyMs: Date.now() - t0,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      latencyMs: Date.now() - t0,
    };
  }
}

/**
 * Deep research (comparative). Falls back gracefully when endpoint/plan unavailable.
 * https://docs.tavily.com — Research API
 */
export async function tavilyResearch(input: {
  input: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
  model?: string;
}): Promise<
  TavilyClientResult<never> & {
    answer?: string;
    sources?: Array<{ url?: string; title?: string; content?: string }>;
  }
> {
  const t0 = Date.now();
  const apiKey = input.apiKey ?? process.env.TAVILY_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, error: 'TAVILY_API_KEY not set', latencyMs: Date.now() - t0 };
  }
  const fetchImpl = input.fetchImpl ?? fetch;
  try {
    // Prefer research endpoint; if 404/not available, caller should search-fallback
    const res = await fetchImpl('https://api.tavily.com/research', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        input: input.input,
        model: input.model ?? 'mini',
      }),
    });
    const raw = (await res.json().catch(() => ({}))) as {
      output?: string;
      answer?: string;
      content?: string;
      sources?: Array<{ url?: string; title?: string; content?: string }>;
      results?: Array<{ url?: string; title?: string; content?: string }>;
      detail?: { error?: string };
      error?: string;
    };
    if (!res.ok) {
      return {
        ok: false,
        error: raw.error ?? raw.detail?.error ?? `Tavily research HTTP ${res.status}`,
        latencyMs: Date.now() - t0,
      };
    }
    const answer = raw.output ?? raw.answer ?? raw.content;
    const sources = raw.sources ?? raw.results;
    return {
      ok: true,
      answer,
      sources,
      latencyMs: Date.now() - t0,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      latencyMs: Date.now() - t0,
    };
  }
}
