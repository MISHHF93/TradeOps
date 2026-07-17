/**
 * Capability Gateway executor — Grok selects a normalized capability;
 * adapters / search / operational context fulfill it. Vendor REST stays hidden.
 */

import { getAiPlatformConfig } from '@tradeops/config';
import {
  getCapability,
  listCapabilitiesPublic,
  type CapabilityDescriptor,
} from './capability-catalog';
import type { TradeOpsAiAction, TradeOpsEvidence } from './response-envelope';
import { extractUrlEvidence, runSearchManager } from './search-manager';
import { tavilyCrawl, tavilyResearch } from './tavily-client';

export type CapabilityInvokeInput = {
  capability: string;
  parameters?: Record<string, unknown>;
  tenantId: string;
  /** Tenant-scoped operational snapshots (orders, inventory, payments) */
  operationalContext?: Record<string, unknown>;
};

export type CapabilityInvokeResult = {
  ok: boolean;
  capability: string;
  informationClass: CapabilityDescriptor['informationClass'] | 'unknown';
  write: boolean;
  requiresApproval: boolean;
  /** Machine result for Grok / JSON */
  data: Record<string, unknown>;
  evidence: TradeOpsEvidence[];
  /** Queued write actions (never auto-executed) */
  actions: TradeOpsAiAction[];
  warnings: string[];
};

/** OpenAI-compatible tools array for xAI function calling over TradeOps capabilities. */
export function capabilitiesAsXaiTools() {
  return TRADEOPS_XAI_TOOLS;
}

const TRADEOPS_XAI_TOOLS = listCapabilitiesPublic().map((c) => ({
  type: 'function' as const,
  function: {
    name: c.name.replace(/\./g, '_'),
    description: `${c.description} [${c.informationClass}${c.write ? ', write' : ''}${c.requiresApproval ? ', approval' : ''}]`,
    parameters: {
      type: 'object',
      additionalProperties: true,
      properties: {
        query: { type: 'string', description: 'Search query or free-text filter' },
        url: { type: 'string', description: 'URL for extract/crawl' },
        dateFrom: { type: 'string' },
        dateTo: { type: 'string' },
        status: { type: 'string' },
        productId: { type: 'string' },
        limit: { type: 'number' },
        parameters: { type: 'object', description: 'Additional capability parameters' },
      },
    },
  },
}));

export function xaiToolNameToCapability(toolName: string): string {
  // research_web_search → research.web_search
  if (toolName.includes('.')) return toolName;
  const parts = toolName.split('_');
  if (parts.length < 2) return toolName;
  return `${parts[0]}.${parts.slice(1).join('_')}`;
}

/**
 * Execute one normalized capability. Writes never mutate production state here —
 * they return awaiting_approval actions.
 */
export async function invokeCapability(
  input: CapabilityInvokeInput,
): Promise<CapabilityInvokeResult> {
  const cap = getCapability(input.capability);
  const warnings: string[] = [];
  const evidence: TradeOpsEvidence[] = [];
  const actions: TradeOpsAiAction[] = [];
  const params = {
    ...(input.parameters ?? {}),
  };

  if (!cap) {
    return {
      ok: false,
      capability: input.capability,
      informationClass: 'unknown',
      write: false,
      requiresApproval: false,
      data: { error: 'unknown_capability', capability: input.capability },
      evidence,
      actions,
      warnings: [`Unknown capability: ${input.capability}`],
    };
  }

  if (cap.write) {
    const platform = getAiPlatformConfig();
    const requiresApproval =
      cap.requiresApproval ||
      (cap.domain === 'payments' && platform.aiRequireApprovalForPayments) ||
      (cap.name.includes('refund') && platform.aiRequireApprovalForRefunds) ||
      (cap.name.includes('publish') && platform.aiRequireApprovalForPublishing) ||
      platform.aiRequireApprovalForWrites;

    actions.push({
      actionId: `action_${cap.name.replace(/\./g, '_')}_${Date.now().toString(36)}`,
      capability: cap.name,
      status: 'awaiting_approval',
      requiresApproval: true,
      parameters: params,
    });

    return {
      ok: true,
      capability: cap.name,
      informationClass: cap.informationClass,
      write: true,
      requiresApproval,
      data: {
        status: 'awaiting_approval',
        message: `Write capability ${cap.name} requires approval before execution.`,
        parameters: params,
      },
      evidence,
      actions,
      warnings: requiresApproval ? ['Write actions require human approval'] : [],
    };
  }

  // --- Research (public) ---
  if (cap.domain === 'research') {
    return invokeResearchCapability(cap, params, warnings);
  }

  // --- Operational / calculation: only from authenticated context ---
  if (cap.informationClass === 'operational' || cap.informationClass === 'calculation') {
    const fromContext = pickOperationalSlice(cap.name, input.operationalContext);
    if (fromContext) {
      evidence.push({
        sourceType: 'connector',
        provider: 'operational_context',
        title: cap.name,
        retrievedAt: new Date().toISOString(),
        freshness: 'live',
        snippet: JSON.stringify(fromContext).slice(0, 400),
      });
      return {
        ok: true,
        capability: cap.name,
        informationClass: cap.informationClass,
        write: false,
        requiresApproval: false,
        data: { result: fromContext, source: 'operational_context' },
        evidence,
        actions,
        warnings,
      };
    }

    warnings.push(
      `${cap.name}: no authenticated operational data in context — connect the provider adapter (Shopify/Stripe/etc.) or pass operationalContext. Public web search must not invent this.`,
    );
    return {
      ok: false,
      capability: cap.name,
      informationClass: cap.informationClass,
      write: false,
      requiresApproval: false,
      data: {
        error: 'operational_data_required',
        message:
          'Authenticated connector or tenant operational context required. Internet search cannot replace inventory, orders, payments, or shipments.',
        capability: cap.name,
        parameters: params,
      },
      evidence,
      actions,
      warnings,
    };
  }

  return {
    ok: false,
    capability: cap.name,
    informationClass: cap.informationClass,
    write: cap.write,
    requiresApproval: cap.requiresApproval,
    data: { error: 'not_implemented', capability: cap.name },
    evidence,
    actions,
    warnings: [`Capability ${cap.name} has no executor path`],
  };
}

async function invokeResearchCapability(
  cap: CapabilityDescriptor,
  params: Record<string, unknown>,
  warnings: string[],
): Promise<CapabilityInvokeResult> {
  const evidence: TradeOpsEvidence[] = [];
  const actions: TradeOpsAiAction[] = [];
  const query =
    (typeof params.query === 'string' && params.query) ||
    (typeof params.objective === 'string' && params.objective) ||
    '';

  if (cap.name === 'research.extract_url') {
    const url = typeof params.url === 'string' ? params.url : '';
    if (!url) {
      return failResearch(cap, 'url required', warnings);
    }
    const extracted = await extractUrlEvidence(url);
    evidence.push(...extracted);
    return {
      ok: extracted.length > 0,
      capability: cap.name,
      informationClass: 'public_research',
      write: false,
      requiresApproval: false,
      data: { urls: extracted.map((e) => e.url), count: extracted.length },
      evidence,
      actions,
      warnings: extracted.length ? warnings : [...warnings, 'extract returned no content'],
    };
  }

  if (cap.name === 'research.crawl_site') {
    const url = typeof params.url === 'string' ? params.url : '';
    if (!url) return failResearch(cap, 'url required for crawl', warnings);
    const cfg = getAiPlatformConfig();
    if (!cfg.tavilyCrawlEnabled) {
      return failResearch(cap, 'Tavily crawl disabled or TAVILY_API_KEY missing', warnings);
    }
    const crawl = await tavilyCrawl({
      url,
      instructions: typeof params.instructions === 'string' ? params.instructions : query || undefined,
      maxDepth: typeof params.maxDepth === 'number' ? params.maxDepth : 1,
      limit: typeof params.limit === 'number' ? params.limit : 15,
      apiKey: cfg.tavilyApiKey,
    });
    if (!crawl.ok || !crawl.results) {
      return failResearch(cap, crawl.error ?? 'crawl failed', warnings);
    }
    for (const r of crawl.results) {
      evidence.push({
        sourceType: 'web',
        provider: 'tavily',
        title: r.url,
        url: r.url,
        retrievedAt: new Date().toISOString(),
        freshness: 'live',
        snippet: r.rawContent?.slice(0, 400),
      });
    }
    return {
      ok: true,
      capability: cap.name,
      informationClass: 'public_research',
      write: false,
      requiresApproval: false,
      data: { baseUrl: url, pages: crawl.results.length },
      evidence,
      actions,
      warnings,
    };
  }

  if (cap.name === 'research.deep_research') {
    const cfg = getAiPlatformConfig();
    if (!cfg.tavilyResearchEnabled || !query) {
      // Fall back to multi-result search
      const search = await runSearchManager({ objective: query || 'deep research' });
      evidence.push(...search.evidence);
      warnings.push(...search.warnings);
      if (!cfg.tavilyResearchEnabled) {
        warnings.push('Tavily research disabled — used Search Manager instead');
      }
      return {
        ok: search.evidence.length > 0,
        capability: cap.name,
        informationClass: 'public_research',
        write: false,
        requiresApproval: false,
        data: {
          mode: 'search_manager_fallback',
          queriesRun: search.queriesRun,
          informationNeed: search.informationNeed,
        },
        evidence,
        actions,
        warnings,
      };
    }
    const research = await tavilyResearch({
      input: query,
      apiKey: cfg.tavilyApiKey,
    });
    if (!research.ok) {
      warnings.push(research.error ?? 'research failed');
      const search = await runSearchManager({ objective: query });
      evidence.push(...search.evidence);
      warnings.push(...search.warnings);
      return {
        ok: search.evidence.length > 0,
        capability: cap.name,
        informationClass: 'public_research',
        write: false,
        requiresApproval: false,
        data: { mode: 'search_fallback', researchError: research.error },
        evidence,
        actions,
        warnings,
      };
    }
    if (research.answer) {
      evidence.push({
        sourceType: 'web',
        provider: 'tavily',
        title: 'Tavily deep research',
        retrievedAt: new Date().toISOString(),
        freshness: 'live',
        snippet: research.answer.slice(0, 500),
      });
    }
    for (const s of research.sources ?? []) {
      evidence.push({
        sourceType: 'web',
        provider: 'tavily',
        title: s.title ?? s.url,
        url: s.url,
        retrievedAt: new Date().toISOString(),
        freshness: 'live',
        snippet: s.content?.slice(0, 400),
      });
    }
    return {
      ok: true,
      capability: cap.name,
      informationClass: 'public_research',
      write: false,
      requiresApproval: false,
      data: {
        mode: 'tavily_research',
        answer: research.answer?.slice(0, 4000),
        sourceCount: research.sources?.length ?? 0,
      },
      evidence,
      actions,
      warnings,
    };
  }

  // research.web_search | research.search_x
  const objective =
    query ||
    (cap.name === 'research.search_x' ? 'social market signals' : 'public web research');
  const search = await runSearchManager({
    objective,
    policy:
      cap.name === 'research.search_x'
        ? { allowed: true, providers: ['xai_x', 'tavily'] }
        : undefined,
  });
  evidence.push(...search.evidence);
  warnings.push(...search.warnings);
  return {
    ok: true,
    capability: cap.name,
    informationClass: 'public_research',
    write: false,
    requiresApproval: false,
    data: {
      informationNeed: search.informationNeed,
      policy: search.policy,
      queriesRun: search.queriesRun,
      resultCount: search.evidence.length,
    },
    evidence,
    actions,
    warnings,
  };
}

function failResearch(
  cap: CapabilityDescriptor,
  error: string,
  warnings: string[],
): CapabilityInvokeResult {
  return {
    ok: false,
    capability: cap.name,
    informationClass: 'public_research',
    write: false,
    requiresApproval: false,
    data: { error },
    evidence: [],
    actions: [],
    warnings: [...warnings, error],
  };
}

function pickOperationalSlice(
  capability: string,
  ctx?: Record<string, unknown>,
): unknown | null {
  if (!ctx || Object.keys(ctx).length === 0) return null;

  const keyHints: Record<string, string[]> = {
    'commerce.search_products': ['products', 'catalog', 'searchProducts'],
    'commerce.get_product': ['product', 'products'],
    'commerce.get_orders': ['orders', 'orderList'],
    'payments.get_transactions': ['transactions', 'payments', 'stripe'],
    'payments.get_subscription': ['subscription', 'billing'],
    'logistics.get_rates': ['shippingRates', 'rates', 'logistics'],
    'logistics.track_shipment': ['shipments', 'tracking'],
    'analytics.get_revenue': ['revenue', 'analytics', 'ga4'],
    'analytics.get_conversion_funnel': ['funnel', 'conversions', 'analytics'],
    'analytics.get_traffic': ['traffic', 'analytics'],
    'analytics.compare_periods': ['periods', 'analytics', 'compare'],
    'procurement.search_suppliers': ['suppliers', 'procurement'],
    'procurement.compare_quotes': ['quotes', 'procurement'],
  };

  const hints = keyHints[capability] ?? [];
  for (const h of hints) {
    if (h in ctx && ctx[h] != null) return ctx[h];
  }
  // Whole context if caller scoped it tightly
  if (ctx[capability] != null) return ctx[capability];
  if (ctx.data != null) return ctx.data;
  return null;
}

/**
 * Suggest which read capabilities to pre-run for an objective (no LLM).
 */
export function suggestCapabilitiesForObjective(objective: string): string[] {
  const o = objective.toLowerCase();
  const out: string[] = [];
  if (/\b(inventory|stock|product|sku|catalog|listing)\b/.test(o)) {
    out.push('commerce.search_products');
  }
  if (/\b(order|orders|fulfillment)\b/.test(o)) out.push('commerce.get_orders');
  if (/\b(payment|refund|stripe|revenue|transaction)\b/.test(o)) {
    out.push('payments.get_transactions');
    out.push('analytics.get_revenue');
  }
  if (/\b(ship|shipping|carrier|track|logistics)\b/.test(o)) {
    out.push('logistics.get_rates');
  }
  if (/\b(supplier|rfq|wholesale|procure)\b/.test(o)) {
    out.push('procurement.search_suppliers');
  }
  if (/\b(trend|market|competitor|demand|research|news|find|discover)\b/.test(o)) {
    out.push('research.web_search');
  }
  if (/\b(sentiment|twitter| on x\b|social|buzz)\b/.test(o)) {
    out.push('research.search_x');
  }
  if (/\b(ga4|conversion|traffic|analytics)\b/.test(o)) {
    out.push('analytics.get_conversion_funnel');
    out.push('analytics.compare_periods');
  }
  return [...new Set(out)].slice(0, 6);
}
