/**
 * Internet Search Manager — centralized public-web / social retrieval.
 * Does NOT replace authenticated connectors for operational truth.
 */

import { getAiPlatformConfig, type AiPlatformConfig, type SearchProviderId } from '@tradeops/config';
import type { TradeOpsEvidence } from './response-envelope';
import { tavilyExtract, tavilySearch } from './tavily-client';

export type InformationNeed =
  | 'no_search'
  | 'public_web'
  | 'current_news'
  | 'social_signal'
  | 'official_documentation'
  | 'product_discovery'
  | 'supplier_discovery'
  | 'authenticated_operational_data'
  | 'mixed_research';

export type SearchPolicy = {
  allowed: boolean;
  providers: SearchProviderId[];
  maxQueries: number;
  maxResultsPerQuery: number;
  includeDomains?: string[];
  excludeDomains?: string[];
  freshness?: 'day' | 'week' | 'month' | 'year' | 'any';
  requireOfficialSources: boolean;
  requireCitations: boolean;
  cacheTtlSeconds: number;
  reason: string;
};

export type SearchManagerResult = {
  informationNeed: InformationNeed;
  policy: SearchPolicy;
  evidence: TradeOpsEvidence[];
  warnings: string[];
  queriesRun: string[];
};

const OPERATIONAL_RE =
  /\b(inventory|stock|order|orders|payment|payments|refund|shipment|shipments|revenue|my sales|our sales|stripe|shopify|fulfillment|warehouse|ga4 conversion)\b/i;

const SOCIAL_RE =
  /\b(trending|sentiment|twitter| on x\b|social|complaints|buzz|viral)\b/i;

const DISCOVERY_RE =
  /\b(find|discover|market|competitor|supplier|trend|demand|pricing|review|news|research|what is|who sells)\b/i;

/**
 * Classify whether the objective needs public web, social, or only operational data.
 */
export function classifyInformationNeed(objective: string): InformationNeed {
  const o = objective.trim();
  if (!o) return 'no_search';
  const operational = OPERATIONAL_RE.test(o);
  // First-person / tenant operational questions win over generic "what is"
  const tenantOps =
    operational &&
    /\b(our|my|we|tenant|sku-|order #|inventory for)\b/i.test(o);
  if (tenantOps || (operational && !/\b(find|discover|market|competitor|trend|demand)\b/i.test(o))) {
    return 'authenticated_operational_data';
  }
  if (operational && /\b(find|discover|market|competitor|trend)\b/i.test(o)) {
    return 'mixed_research';
  }
  if (SOCIAL_RE.test(o)) return 'social_signal';
  if (/\b(news|breaking|today|this week|latest)\b/i.test(o)) return 'current_news';
  if (/\b(spec|datasheet|manual|certification|regulation|oem)\b/i.test(o)) {
    return 'official_documentation';
  }
  if (/\bsupplier|manufacturer|wholesale|rfq\b/i.test(o)) return 'supplier_discovery';
  if (/\bproduct|sku|part|bmw|amazon|ebay|listing\b/i.test(o)) return 'product_discovery';
  if (DISCOVERY_RE.test(o)) return 'public_web';
  return 'no_search';
}

export function buildSearchPolicy(
  need: InformationNeed,
  cfg: AiPlatformConfig = getAiPlatformConfig(),
): SearchPolicy {
  const base: SearchPolicy = {
    allowed: false,
    providers: [],
    maxQueries: Math.min(cfg.searchMaxQueriesPerRequest, 6),
    maxResultsPerQuery: cfg.searchMaxResultsPerQuery,
    includeDomains: cfg.searchAllowedDomains.length ? cfg.searchAllowedDomains : undefined,
    excludeDomains: cfg.searchBlockedDomains.length ? cfg.searchBlockedDomains : undefined,
    freshness: 'any',
    requireOfficialSources: false,
    requireCitations: cfg.searchRequireCitations,
    cacheTtlSeconds: cfg.searchDefaultCacheTtlSeconds,
    reason: need,
  };

  switch (need) {
    case 'no_search':
    case 'authenticated_operational_data':
      return {
        ...base,
        allowed: false,
        reason: `${need}: use authenticated connectors / database, not public search`,
      };
    case 'social_signal':
      return {
        ...base,
        allowed: true,
        providers: cfg.xaiXSearchEnabled ? ['xai_x', 'tavily'] : ['tavily'],
        freshness: 'week',
        maxQueries: 4,
        reason: 'social_signal → X search + optional web',
      };
    case 'current_news':
      return {
        ...base,
        allowed: true,
        providers: ['xai_web', 'tavily'],
        freshness: 'day',
        maxQueries: 6,
        reason: 'current_news → web + tavily',
      };
    case 'official_documentation':
      return {
        ...base,
        allowed: true,
        providers: ['tavily'],
        requireOfficialSources: true,
        cacheTtlSeconds: 86400,
        maxQueries: 4,
        reason: 'official docs prefer controlled Tavily retrieval',
      };
    case 'product_discovery':
    case 'supplier_discovery':
    case 'public_web':
    case 'mixed_research':
      return {
        ...base,
        allowed: true,
        providers: ['tavily', 'xai_web'],
        maxQueries: 5,
        reason: `${need} → Tavily retrieval + optional xAI web`,
      };
    default:
      return base;
  }
}

/**
 * Execute search according to policy. Operational data is never fabricated here.
 */
export async function runSearchManager(input: {
  objective: string;
  policy?: Partial<SearchPolicy>;
  env?: NodeJS.ProcessEnv;
}): Promise<SearchManagerResult> {
  const cfg = getAiPlatformConfig(input.env);
  const informationNeed = classifyInformationNeed(input.objective);
  const policy: SearchPolicy = {
    ...buildSearchPolicy(informationNeed, cfg),
    ...input.policy,
    providers: input.policy?.providers ?? buildSearchPolicy(informationNeed, cfg).providers,
  };

  const warnings: string[] = [];
  const evidence: TradeOpsEvidence[] = [];
  const queriesRun: string[] = [];

  if (!policy.allowed) {
    return { informationNeed, policy, evidence, warnings, queriesRun };
  }

  const query = input.objective.slice(0, 400);
  queriesRun.push(query);

  // Prefer Tavily for controlled retrieval
  if (policy.providers.includes('tavily') && cfg.tavilySearchEnabled) {
    const result = await tavilySearch({
      query,
      maxResults: policy.maxResultsPerQuery,
      includeDomains: policy.includeDomains,
      excludeDomains: policy.excludeDomains,
      apiKey: cfg.tavilyApiKey,
    });
    if (result.ok && result.results) {
      for (const r of result.results) {
        evidence.push({
          sourceType: 'web',
          provider: 'tavily',
          title: r.title,
          url: r.url,
          retrievedAt: new Date().toISOString(),
          freshness: 'live',
          snippet: r.content?.slice(0, 400),
        });
      }
    } else if (!result.ok) {
      warnings.push(`Tavily search: ${result.error ?? 'failed'}`);
    }
  } else if (policy.providers.includes('tavily') && !cfg.tavilyApiKey) {
    warnings.push('Tavily not configured (set TAVILY_API_KEY) — public web retrieval limited');
  }

  // xAI web/X: recorded as intended providers when enabled (full agent tool loop is progressive)
  if (policy.providers.includes('xai_web') && cfg.xaiWebSearchEnabled && cfg.xaiApiKey) {
    evidence.push({
      sourceType: 'web',
      provider: 'xai_web',
      title: 'xAI Web Search available',
      retrievedAt: new Date().toISOString(),
      freshness: 'unknown',
      snippet: 'Grok may use xAI web search when tool-calling loop is active; Tavily results used when present.',
    });
  }
  if (policy.providers.includes('xai_x') && cfg.xaiXSearchEnabled && cfg.xaiApiKey) {
    evidence.push({
      sourceType: 'x',
      provider: 'xai_x',
      title: 'xAI X Search available',
      retrievedAt: new Date().toISOString(),
      freshness: 'unknown',
      snippet: 'Social/market signals via xAI X Search when tool-calling loop is active.',
    });
  }

  if (policy.requireCitations && evidence.length === 0 && policy.allowed) {
    warnings.push('Search allowed but no citations retrieved — check TAVILY_API_KEY or xAI credits');
  }

  return { informationNeed, policy, evidence, warnings, queriesRun };
}

export async function extractUrlEvidence(url: string, env?: NodeJS.ProcessEnv): Promise<TradeOpsEvidence[]> {
  const cfg = getAiPlatformConfig(env);
  if (!cfg.tavilyExtractEnabled || !cfg.tavilyApiKey) {
    return [];
  }
  const result = await tavilyExtract({ urls: [url], apiKey: cfg.tavilyApiKey });
  if (!result.ok || !result.results?.length) return [];
  return result.results.map((r) => ({
    sourceType: 'web' as const,
    provider: 'tavily',
    title: r.url,
    url: r.url,
    retrievedAt: new Date().toISOString(),
    freshness: 'live' as const,
    snippet: r.rawContent?.slice(0, 500),
  }));
}
