/**
 * Provider-independent public web search.
 * Production: Tavily is the sole active provider.
 *
 * Canonical capabilities (never vendor ops):
 *  - research.search_public_web
 *  - research.extract_url
 *  - research.search_official_documentation
 */

export type WebSearchProviderId = 'tavily' | 'none';

export type WebSearchHit = {
  title: string;
  url: string;
  snippet: string;
  score?: number;
  publishedAt?: string;
};

export type WebSearchResult = {
  provider: WebSearchProviderId;
  query: string;
  hits: WebSearchHit[];
  latencyMs: number;
  blocked?: boolean;
  failed?: boolean;
  note?: string;
  capability: 'research.search_public_web' | 'research.extract_url' | 'research.search_official_documentation';
};

export type WebSearchProvider = {
  id: WebSearchProviderId;
  isConfigured(): boolean;
  searchPublicWeb(query: string, opts?: { maxResults?: number }): Promise<WebSearchResult>;
  extractUrl(url: string): Promise<WebSearchResult>;
  searchOfficialDocumentation(query: string, opts?: { maxResults?: number }): Promise<WebSearchResult>;
};

function tavilyKey(env: NodeJS.ProcessEnv = process.env): string | undefined {
  return env.TAVILY_API_KEY?.trim() || undefined;
}

export function createTavilyProvider(env: NodeJS.ProcessEnv = process.env): WebSearchProvider {
  return {
    id: 'tavily',
    isConfigured: () => Boolean(tavilyKey(env)),
    async searchPublicWeb(query, opts) {
      return tavilySearch(env, query, 'research.search_public_web', {
        maxResults: opts?.maxResults ?? 8,
        includeRaw: false,
      });
    },
    async extractUrl(url) {
      return tavilyExtract(env, url);
    },
    async searchOfficialDocumentation(query, opts) {
      const q = `${query} site:docs OR official documentation API`;
      return tavilySearch(env, q, 'research.search_official_documentation', {
        maxResults: opts?.maxResults ?? 6,
        includeRaw: false,
      });
    },
  };
}

async function tavilySearch(
  env: NodeJS.ProcessEnv,
  query: string,
  capability: WebSearchResult['capability'],
  opts: { maxResults: number; includeRaw: boolean },
): Promise<WebSearchResult> {
  const key = tavilyKey(env);
  const started = Date.now();
  if (!key) {
    return {
      provider: 'tavily',
      query,
      hits: [],
      latencyMs: 0,
      blocked: true,
      capability,
      note: 'TAVILY_API_KEY not set — public web search blocked (no demo results).',
    };
  }
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: key,
        query,
        max_results: opts.maxResults,
        include_answer: false,
        search_depth: 'basic',
      }),
    });
    const latencyMs = Date.now() - started;
    if (!res.ok) {
      return {
        provider: 'tavily',
        query,
        hits: [],
        latencyMs,
        failed: true,
        capability,
        note: `Tavily search HTTP ${res.status}`,
      };
    }
    const json = (await res.json()) as {
      results?: Array<{ title?: string; url?: string; content?: string; score?: number }>;
    };
    return {
      provider: 'tavily',
      query,
      hits: (json.results ?? []).map((r) => ({
        title: r.title ?? 'untitled',
        url: r.url ?? '',
        snippet: r.content ?? '',
        score: r.score,
      })),
      latencyMs,
      capability,
    };
  } catch (e) {
    return {
      provider: 'tavily',
      query,
      hits: [],
      latencyMs: Date.now() - started,
      failed: true,
      capability,
      note: e instanceof Error ? e.message : String(e),
    };
  }
}

async function tavilyExtract(env: NodeJS.ProcessEnv, url: string): Promise<WebSearchResult> {
  const key = tavilyKey(env);
  const started = Date.now();
  if (!key) {
    return {
      provider: 'tavily',
      query: url,
      hits: [],
      latencyMs: 0,
      blocked: true,
      capability: 'research.extract_url',
      note: 'TAVILY_API_KEY not set — URL extraction blocked.',
    };
  }
  try {
    const res = await fetch('https://api.tavily.com/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: key,
        urls: [url],
      }),
    });
    const latencyMs = Date.now() - started;
    if (!res.ok) {
      return {
        provider: 'tavily',
        query: url,
        hits: [],
        latencyMs,
        failed: true,
        capability: 'research.extract_url',
        note: `Tavily extract HTTP ${res.status}`,
      };
    }
    const json = (await res.json()) as {
      results?: Array<{ url?: string; raw_content?: string }>;
    };
    return {
      provider: 'tavily',
      query: url,
      hits: (json.results ?? []).map((r) => ({
        title: r.url ?? url,
        url: r.url ?? url,
        snippet: (r.raw_content ?? '').slice(0, 2000),
      })),
      latencyMs,
      capability: 'research.extract_url',
    };
  } catch (e) {
    return {
      provider: 'tavily',
      query: url,
      hits: [],
      latencyMs: Date.now() - started,
      failed: true,
      capability: 'research.extract_url',
      note: e instanceof Error ? e.message : String(e),
    };
  }
}

let active: WebSearchProvider = createTavilyProvider();

export function getWebSearchProvider(): WebSearchProvider {
  return active;
}

export function setWebSearchProvider(p: WebSearchProvider): void {
  active = p;
}

export function bootstrapWebSearchProvider(env: NodeJS.ProcessEnv = process.env): void {
  active = createTavilyProvider(env);
}

export function describeWebSearchProviders(): Array<{
  id: WebSearchProviderId;
  configured: boolean;
  active: boolean;
  role: string;
}> {
  return [
    {
      id: 'tavily',
      configured: Boolean(tavilyKey()),
      active: active.id === 'tavily',
      role: 'sole_public_web_search',
    },
  ];
}

/** Canonical capability dispatcher */
export async function invokeResearchCapability(
  capability:
    | 'research.search_public_web'
    | 'research.extract_url'
    | 'research.search_official_documentation',
  input: { query?: string; url?: string; maxResults?: number },
): Promise<WebSearchResult> {
  const p = getWebSearchProvider();
  switch (capability) {
    case 'research.search_public_web':
      return p.searchPublicWeb(input.query ?? '', { maxResults: input.maxResults });
    case 'research.extract_url':
      return p.extractUrl(input.url ?? input.query ?? '');
    case 'research.search_official_documentation':
      return p.searchOfficialDocumentation(input.query ?? '', {
        maxResults: input.maxResults,
      });
    default:
      return {
        provider: 'none',
        query: input.query ?? '',
        hits: [],
        latencyMs: 0,
        failed: true,
        capability: 'research.search_public_web',
        note: `Unknown research capability`,
      };
  }
}
