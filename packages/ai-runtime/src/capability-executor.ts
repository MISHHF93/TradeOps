/**
 * Capability Gateway executor — Grok selects a normalized capability;
 * adapters / search / operational context fulfill it. Vendor REST stays hidden.
 */

import { getAiPlatformConfig } from '@tradeops/config';
import {
  getCapability,
  type CapabilityDescriptor,
} from './capability-catalog';
import type { TradeOpsAiAction, TradeOpsEvidence } from './response-envelope';
import { extractUrlEvidence, runSearchManager } from './search-manager';
import { tavilyCrawl, tavilyResearch } from './tavily-client';
import { getToolPolicy, resolveApprovalRequired } from './tool-policies';
import { providerToolsForSelect } from './tools/provider-tools';

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

/**
 * OpenAI-compatible tools array for legacy adapters.
 * Parameter schemas come from tool-policies (TradeOps source), not ad-hoc free-form.
 */
export function capabilitiesAsXaiTools() {
  return providerToolsForSelect({ includeWrites: true }).map((t) => {
    const cap = getCapability(t.name);
    const approval = resolveApprovalRequired(t.name);
    return {
      type: 'function' as const,
      function: {
        name: t.name.replace(/\./g, '_'),
        description: `${t.description} [${cap?.informationClass ?? 'unknown'}${cap?.write ? ', write' : ''}${approval ? ', approval' : ''}]`,
        parameters: t.parameters,
      },
    };
  });
}

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
    // Single source of truth: tool-policies + platform approval gates
    const requiresApproval = resolveApprovalRequired(cap.name);
    const policy = getToolPolicy(cap.name);

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
        parameterSchema: policy?.parameterSchema ?? null,
        policyOwner: 'tradeops_source_code',
      },
      evidence,
      actions,
      warnings: requiresApproval
        ? ['Write actions require human approval (tool-policies)']
        : [],
    };
  }

  // --- Research (public) ---
  if (cap.domain === 'research') {
    return invokeResearchCapability(cap, params, warnings);
  }

  // --- Operational / calculation: only from authenticated context ---
  if (cap.informationClass === 'operational' || cap.informationClass === 'calculation') {
    const fromContext = pickOperationalSlice(cap.name, input.operationalContext);
    if (fromContext !== null && fromContext !== undefined) {
      const meta =
        input.operationalContext &&
        typeof input.operationalContext.meta === 'object' &&
        input.operationalContext.meta
          ? (input.operationalContext.meta as Record<string, unknown>)
          : {};
      const dataClass =
        typeof meta.dataClass === 'string' ? meta.dataClass : 'unknown';
      if (dataClass === 'TEST_FIXTURE') {
        warnings.push(
          `${cap.name}: dataClass=TEST_FIXTURE — results are fixture/demo catalog data, not live marketplace connectors.`,
        );
      } else if (dataClass === 'MIXED') {
        warnings.push(
          `${cap.name}: dataClass=MIXED — catalog includes both live and fixture products; do not claim all rows are live.`,
        );
      } else if (dataClass === 'EMPTY') {
        warnings.push(
          `${cap.name}: tenant snapshot is EMPTY (no products/orders). Answer must say data is missing, not invent metrics.`,
        );
      }

      const emptyArray = Array.isArray(fromContext) && fromContext.length === 0;
      const emptyObject =
        !Array.isArray(fromContext) &&
        typeof fromContext === 'object' &&
        fromContext !== null &&
        'empty' in (fromContext as object) &&
        (fromContext as { empty?: boolean }).empty === true;

      evidence.push({
        sourceType: 'database',
        provider: 'tenant_operational_snapshot',
        title: cap.name,
        retrievedAt: new Date().toISOString(),
        freshness: dataClass === 'TEST_FIXTURE' ? 'cached' : 'live',
        snippet: JSON.stringify(fromContext).slice(0, 500),
      });
      return {
        ok: true,
        capability: cap.name,
        informationClass: cap.informationClass,
        write: false,
        requiresApproval: false,
        data: {
          result: fromContext,
          source: 'tenant_operational_snapshot',
          dataClass,
          empty: emptyArray || emptyObject,
        },
        evidence,
        actions,
        warnings,
      };
    }

    const connectorHint = summarizeConnectors(input.operationalContext);
    warnings.push(
      `${cap.name}: no authenticated operational data in context for this capability${
        connectorHint ? ` (${connectorHint})` : ''
      }. Connect a provider adapter or ensure the tenant snapshot includes this domain. Public web search must not invent this.`,
    );
    return {
      ok: false,
      capability: cap.name,
      informationClass: cap.informationClass,
      write: false,
      requiresApproval: false,
      data: {
        error: 'operational_data_required',
        errorCode: 'OPERATIONAL_DATA_REQUIRED',
        message:
          'Authenticated connector or tenant operational context required. Internet search cannot replace inventory, orders, payments, or shipments.',
        capability: cap.name,
        parameters: params,
        connectors: connectorHint,
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

function summarizeConnectors(ctx?: Record<string, unknown>): string | null {
  if (!ctx) return null;
  const list = (ctx.connectors ?? ctx.connectorHealth) as
    | Array<{ providerKey?: string; status?: string; isFixture?: boolean }>
    | undefined;
  if (!Array.isArray(list) || list.length === 0) {
    const meta = ctx.meta as { connectorCount?: number } | undefined;
    if (meta?.connectorCount === 0) return 'no connectors installed';
    return null;
  }
  return list
    .slice(0, 8)
    .map(
      (c) =>
        `${c.providerKey ?? '?'}:${c.status ?? '?'}${c.isFixture ? '(fixture)' : ''}`,
    )
    .join(', ');
}

function pickOperationalSlice(
  capability: string,
  ctx?: Record<string, unknown>,
): unknown | null {
  if (!ctx || Object.keys(ctx).length === 0) return null;

  const keyHints: Record<string, string[]> = {
    'commerce.search_products': ['products', 'catalog', 'searchProducts', 'inventory'],
    'commerce.get_product': ['product', 'products'],
    'commerce.get_orders': ['orders', 'orderList'],
    'payments.get_transactions': ['transactions', 'payments', 'stripe'],
    'payments.get_subscription': ['subscription', 'billing'],
    'logistics.get_rates': ['shippingRates', 'rates', 'logistics', 'shipments'],
    'logistics.track_shipment': ['shipments', 'tracking'],
    'analytics.get_revenue': ['revenue', 'analytics', 'ga4', 'orders', 'payments'],
    'analytics.get_conversion_funnel': ['funnel', 'conversions', 'analytics'],
    'analytics.get_traffic': ['traffic', 'analytics'],
    'analytics.compare_periods': ['periods', 'analytics', 'compare', 'revenue'],
    'procurement.search_suppliers': ['suppliers', 'procurement'],
    'procurement.compare_quotes': ['quotes', 'procurement', 'suppliers'],
  };

  const hints = keyHints[capability] ?? [];
  for (const h of hints) {
    if (h in ctx && ctx[h] != null) {
      // Prefer non-empty arrays when multiple keys match
      const v = ctx[h];
      if (Array.isArray(v) && v.length === 0) continue;
      if (typeof v === 'object' && v !== null && 'productCount' in v) {
        const inv = v as { productCount?: number; items?: unknown[] };
        if (
          inv.productCount === 0 &&
          Array.isArray(inv.items) &&
          inv.items.length === 0
        ) {
          continue;
        }
      }
      return v;
    }
  }
  // Empty arrays still count as present (catalog exists, zero rows)
  for (const h of hints) {
    if (h in ctx && ctx[h] != null) return ctx[h];
  }
  // Whole context if caller scoped it tightly
  if (ctx[capability] != null) return ctx[capability];
  if (ctx.data != null) return ctx.data;

  // Inventory-style questions: fall back to product stock when inventory key missing
  if (
    capability.startsWith('commerce.') &&
    Array.isArray(ctx.products) &&
    ctx.products.length > 0
  ) {
    return ctx.products;
  }
  return null;
}

/**
 * Suggest which read capabilities to pre-run for an objective (no LLM).
 */
export function suggestCapabilitiesForObjective(objective: string): string[] {
  const o = objective.toLowerCase();
  const out: string[] = [];
  if (/\b(inventory|stock|product|sku|catalog|listing|risk)\b/.test(o)) {
    out.push('commerce.search_products');
  }
  if (/\b(order|orders|fulfillment)\b/.test(o)) out.push('commerce.get_orders');
  if (/\b(payment|refund|stripe|revenue|transaction)\b/.test(o)) {
    out.push('payments.get_transactions');
    out.push('analytics.get_revenue');
  }
  if (/\b(ship|shipping|carrier|track|logistics)\b/.test(o)) {
    out.push('logistics.track_shipment');
    out.push('logistics.get_rates');
  }
  if (/\b(supplier|rfq|wholesale|procure)\b/.test(o)) {
    out.push('procurement.search_suppliers');
  }
  if (/\b(case|pipeline|blocker|stage|opportunit)\b/.test(o)) {
    out.push('commerce.search_products');
  }
  if (/\b(trend|market|competitor|demand|research|news|find|discover|tariff)\b/.test(o)) {
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
