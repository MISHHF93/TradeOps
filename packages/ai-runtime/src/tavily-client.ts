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
      headers: { 'Content-Type': 'application/json' },
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
