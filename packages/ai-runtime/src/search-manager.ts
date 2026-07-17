/**
 * Internet Search Manager — centralized public-web / social retrieval.
 * Does NOT replace authenticated connectors for operational truth.
 *
 * Pipeline: Intent → Policy → Provider Router → Search → Deduplicate → Rank → Cite
 */

import { getAiPlatformConfig, type AiPlatformConfig, type SearchProviderId } from '@tradeops/config';
import { getAiAdapter } from './ai-adapter';
import type { TradeOpsEvidence } from './response-envelope';
import { tavilyExtract, tavilySearch } from './tavily-client';

/** Prefer OpenAI web, then Tavily, then xAI — based on platform search primary. */
function defaultWebProviders(cfg: AiPlatformConfig): SearchProviderId[] {
  if (cfg.searchProviderPrimary === 'tavily') {
    return ['tavily', 'openai_web'];
  }
  if (cfg.searchProviderPrimary === 'xai') {
    return ['xai_web', 'openai_web', 'tavily'];
  }
  // openai default
  return ['openai_web', 'tavily'];
}

/**
 * Source hierarchy (lower rank = higher trust).
 * Social may identify trends but must not sole-source safety/pricing/inventory claims.
 */
export const SOURCE_TRUST_RANK: Record<TradeOpsEvidence['sourceType'], number> = {
  connector: 1,
  database: 1,
  document: 3,
  calculation: 2,
  web: 6,
  x: 7,
  rag: 4,
};

const OFFICIAL_DOMAIN_HINTS =
  /\.(gov|mil)(\/|$)|manufacturer|oem|official|docs\.|support\.|help\.|fda\.|nhtsa|iso\.org|astm\.org/i;

const MARKETPLACE_DOMAIN_HINTS =
  /amazon\.|ebay\.|walmart\.|shopify\.|alibaba\.|aliexpress\./i;

const INDUSTRY_PUB_HINTS =
  /reuters\.|bloomberg\.|wsj\.|ft\.com|automotive|aftermarket|s&p|gartner|forrester/i;

export function evidenceTrustScore(e: TradeOpsEvidence): number {
  let score = SOURCE_TRUST_RANK[e.sourceType] ?? 9;
  const url = e.url ?? '';
  const title = e.title ?? '';
  if (e.sourceType === 'connector' || e.sourceType === 'database') return 1;
  if (OFFICIAL_DOMAIN_HINTS.test(url) || OFFICIAL_DOMAIN_HINTS.test(title)) score = Math.min(score, 2);
  else if (MARKETPLACE_DOMAIN_HINTS.test(url)) score = Math.min(score, 4);
  else if (INDUSTRY_PUB_HINTS.test(url) || INDUSTRY_PUB_HINTS.test(title)) score = Math.min(score, 5);
  if (e.provider === 'tavily' && e.freshness === 'live') score = Math.min(score, score);
  return score;
}

/** Deduplicate by URL/title and sort by trust (best first). */
export function rankAndDeduplicateEvidence(items: TradeOpsEvidence[]): TradeOpsEvidence[] {
  const seen = new Set<string>();
  const out: TradeOpsEvidence[] = [];
  for (const e of items) {
    const key = (e.url || `${e.provider}:${e.title || e.snippet || ''}`).toLowerCase().trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out.sort((a, b) => evidenceTrustScore(a) - evidenceTrustScore(b));
}

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
        providers: cfg.xaiXSearchEnabled
          ? ['xai_x', ...defaultWebProviders(cfg)]
          : defaultWebProviders(cfg),
        freshness: 'week',
        maxQueries: 4,
        reason: 'social_signal → X search + web adapters',
      };
    case 'current_news':
      return {
        ...base,
        allowed: true,
        providers: defaultWebProviders(cfg),
        freshness: 'day',
        maxQueries: 6,
        reason: 'current_news → Search Manager web providers',
      };
    case 'official_documentation':
      return {
        ...base,
        allowed: true,
        // Controlled retrieval: Tavily when configured, else OpenAI web
        providers: cfg.tavilyConfigured ? ['tavily', 'openai_web'] : ['openai_web', 'tavily'],
        requireOfficialSources: true,
        cacheTtlSeconds: 86400,
        maxQueries: 4,
        reason: 'official docs prefer controlled retrieval adapters',
      };
    case 'product_discovery':
    case 'supplier_discovery':
    case 'public_web':
    case 'mixed_research':
      return {
        ...base,
        allowed: true,
        providers: defaultWebProviders(cfg),
        maxQueries: 5,
        reason: `${need} → Search Manager (OpenAI web / Tavily adapters)`,
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

  // --- Provider router (one Search Manager; adapters only) ---

  // 1) OpenAI native web search (primary when configured)
  if (policy.providers.includes('openai_web') && cfg.openaiWebSearchEnabled && cfg.openaiConfigured) {
    const adapter = getAiAdapter(input.env);
    if (adapter.id === 'openai' && adapter.search) {
      const result = await adapter.search({ query, maxResults: policy.maxResultsPerQuery });
      if (result.ok) {
        if (result.text) {
          evidence.push({
            sourceType: 'web',
            provider: 'openai_web',
            title: 'OpenAI Web Search',
            retrievedAt: new Date().toISOString(),
            freshness: 'live',
            snippet: result.text.slice(0, 500),
          });
        }
        for (const s of result.sources) {
          evidence.push({
            sourceType: 'web',
            provider: 'openai_web',
            title: s.title ?? s.url,
            url: s.url,
            retrievedAt: new Date().toISOString(),
            freshness: 'live',
            snippet: s.snippet?.slice(0, 400),
          });
        }
      } else {
        warnings.push(`OpenAI web search: ${result.error ?? 'failed'}`);
      }
    } else if (adapter.search) {
      // Active adapter is not OpenAI but still has search — use it
      const result = await adapter.search({ query });
      if (result.ok) {
        for (const s of result.sources) {
          evidence.push({
            sourceType: 'web',
            provider: result.provider,
            title: s.title ?? s.url,
            url: s.url,
            retrievedAt: new Date().toISOString(),
            freshness: 'live',
            snippet: s.snippet?.slice(0, 400),
          });
        }
      }
    }
  } else if (policy.providers.includes('openai_web') && !cfg.openaiConfigured) {
    warnings.push('OpenAI web search preferred but OPENAI_API_KEY not set');
  }

  // 2) Tavily — optional dedicated retrieval adapter (domain filters, extract, crawl)
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
    warnings.push('Tavily adapter not configured (optional — set TAVILY_API_KEY for domain-filtered retrieval)');
  }

  // 3) xAI web/X: progressive placeholders when enabled
  if (policy.providers.includes('xai_web') && cfg.xaiWebSearchEnabled && cfg.xaiApiKey) {
    evidence.push({
      sourceType: 'web',
      provider: 'xai_web',
      title: 'xAI Web Search available',
      retrievedAt: new Date().toISOString(),
      freshness: 'unknown',
      snippet: 'Optional xAI web search adapter when AI_PROVIDER=xai or multi-tool loop is active.',
    });
  }
  if (policy.providers.includes('xai_x') && cfg.xaiXSearchEnabled && cfg.xaiApiKey) {
    evidence.push({
      sourceType: 'x',
      provider: 'xai_x',
      title: 'xAI X Search available',
      retrievedAt: new Date().toISOString(),
      freshness: 'unknown',
      snippet: 'Social/market signals via xAI X Search adapter when enabled.',
    });
  }

  if (policy.requireCitations && evidence.length === 0 && policy.allowed) {
    warnings.push('Search allowed but no citations retrieved — check TAVILY_API_KEY or xAI credits');
  }

  // Prefer official domains when policy requires them (soft filter + re-rank)
  let ranked = rankAndDeduplicateEvidence(evidence);
  if (policy.requireOfficialSources) {
    const official = ranked.filter(
      (e) => evidenceTrustScore(e) <= 3 || OFFICIAL_DOMAIN_HINTS.test(e.url ?? '') || OFFICIAL_DOMAIN_HINTS.test(e.title ?? ''),
    );
    if (official.length > 0) {
      ranked = official;
    } else {
      warnings.push('requireOfficialSources: no high-trust official domains found; returning ranked general results');
    }
  }

  // Social evidence alone is never enough for safety / inventory / finance claims
  const onlySocial = ranked.length > 0 && ranked.every((e) => e.sourceType === 'x');
  if (onlySocial) {
    warnings.push(
      'Evidence is social-only — do not treat as sole proof for compatibility, safety, pricing, certification, inventory, or financial actions',
    );
  }

  return { informationNeed, policy, evidence: ranked, warnings, queriesRun };
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
