/**
 * Unified Search Layer — one orchestration surface for all evidence sources.
 *
 * Every user request can route through this engine; callers receive
 * provenance, confidence, connector attribution, and timestamps.
 */

export type SearchSourceKind =
  | 'internal_product'
  | 'internal_case'
  | 'internal_order'
  | 'internal_connector'
  | 'connector_catalog'
  | 'knowledge_graph'
  | 'documentation'
  | 'ai_run'
  | 'public_web'
  | 'mixed';

export type SearchProvenance = {
  sourceKind: SearchSourceKind;
  sourceId?: string;
  connectorKey?: string;
  isFixture?: boolean;
  collectedAt: string;
  confidence: number;
  note?: string;
};

export type SearchHit = {
  id: string;
  objectType: string;
  title: string;
  summary: string;
  href: string;
  score: number;
  provenance: SearchProvenance;
  evidence?: Record<string, unknown>;
};

export type SearchPlan = {
  query: string;
  normalizedQuery: string;
  intents: string[];
  sources: SearchSourceKind[];
  preferInternal: boolean;
};

export type SearchResponse = {
  query: string;
  plan: SearchPlan;
  hits: SearchHit[];
  total: number;
  executionMs: number;
  honesty: {
    note: string;
    mixedEvidence: boolean;
  };
};

/**
 * Classify query into search intents (deterministic — no external LLM required).
 */
export function planSearch(query: string): SearchPlan {
  const q = query.trim();
  const lower = q.toLowerCase();
  const intents: string[] = [];
  const sources: SearchSourceKind[] = ['internal_product', 'internal_case'];

  if (/\b(order|orders|fulfill|ship)\b/.test(lower)) {
    intents.push('orders');
    sources.push('internal_order');
  }
  if (/\b(connector|shopify|amazon|ebay|supplier|credential)\b/.test(lower)) {
    intents.push('connectors');
    sources.push('internal_connector', 'connector_catalog');
  }
  if (/\b(case|process|lifecycle|stage)\b/.test(lower)) {
    intents.push('cases');
  }
  if (/\b(ai|objective|run|recommend)\b/.test(lower)) {
    intents.push('ai');
    sources.push('ai_run');
  }
  if (/\b(doc|policy|how|what is)\b/.test(lower)) {
    intents.push('docs');
    sources.push('documentation');
  }
  if (/\b(graph|related|link)\b/.test(lower)) {
    intents.push('graph');
    sources.push('knowledge_graph');
  }
  if (intents.length === 0) {
    intents.push('general_commerce');
  }

  // Prefer internal evidence; external/public only when explicitly asked or no internal path.
  const preferInternal = !/\b(web|internet|google|public)\b/.test(lower);

  return {
    query: q,
    normalizedQuery: lower.replace(/\s+/g, ' '),
    intents,
    sources: [...new Set(sources)],
    preferInternal,
  };
}

export type InternalSearchDocs = {
  products?: Array<{
    id: string;
    title: string;
    category?: string;
    sourcePlatform?: string;
    dataConfidence?: number;
    dataFreshnessAt?: string | Date;
    primaryImageUrl?: string | null;
  }>;
  cases?: Array<{
    id: string;
    productId: string;
    productTitle?: string;
    currentStage: string;
    stageStatus: string;
    opportunityScore?: number | null;
    primaryImageUrl?: string | null;
  }>;
  orders?: Array<{
    id: string;
    status: string;
    externalId?: string | null;
    totalMinor?: number;
    currency?: string;
  }>;
  connectors?: Array<{
    providerKey: string;
    status: string;
    isFixture?: boolean;
    displayName?: string;
  }>;
  aiRuns?: Array<{
    id: string;
    objective: string;
    status: string;
    completedAt?: string | Date | null;
  }>;
};

function textMatch(hay: string, needle: string): number {
  const h = hay.toLowerCase();
  const n = needle.toLowerCase();
  if (!n) return 0;
  if (h === n) return 1;
  if (h.includes(n)) return 0.85;
  const parts = n.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 0;
  const hits = parts.filter((p) => h.includes(p)).length;
  return hits / parts.length;
}

/**
 * Execute search against internal documents (host loads DB; this ranks).
 * Connector live search is host-injected separately and merged with provenance.
 */
export function executeInternalSearch(
  plan: SearchPlan,
  docs: InternalSearchDocs,
  startedAt = Date.now(),
): SearchResponse {
  const hits: SearchHit[] = [];
  const q = plan.normalizedQuery;
  const now = new Date().toISOString();

  if (plan.sources.includes('internal_product')) {
    for (const p of docs.products ?? []) {
      const score = Math.max(
        textMatch(p.title, q),
        textMatch(p.category ?? '', q),
        textMatch(p.sourcePlatform ?? '', q),
      );
      if (score < 0.25 && q.length > 0) continue;
      hits.push({
        id: p.id,
        objectType: 'product',
        title: p.title,
        summary: `${p.category ?? 'product'} · ${p.sourcePlatform ?? 'unknown'}`,
        href: `/terminal/products/${p.id}`,
        score: score * (p.dataConfidence ?? 0.7),
        provenance: {
          sourceKind: 'internal_product',
          sourceId: p.id,
          connectorKey: p.sourcePlatform,
          isFixture: Boolean(p.sourcePlatform?.startsWith('fixture')),
          collectedAt:
            p.dataFreshnessAt instanceof Date
              ? p.dataFreshnessAt.toISOString()
              : String(p.dataFreshnessAt ?? now),
          confidence: p.dataConfidence ?? 0.7,
        },
        evidence: p.primaryImageUrl
          ? { imageUrl: p.primaryImageUrl, kind: 'product_image' }
          : undefined,
      });
    }
  }

  if (plan.sources.includes('internal_case')) {
    for (const c of docs.cases ?? []) {
      const label = c.productTitle ?? c.productId;
      const score = Math.max(
        textMatch(label, q),
        textMatch(c.currentStage, q),
        textMatch(c.stageStatus, q),
        textMatch('case process lifecycle', q) * 0.3,
      );
      if (score < 0.2 && q.length > 0 && !plan.intents.includes('cases')) continue;
      hits.push({
        id: c.id,
        objectType: 'commerce_case',
        title: label,
        summary: `Case · ${c.currentStage} · ${c.stageStatus}`,
        href: `/terminal/process/${c.id}`,
        score: score + (Number(c.opportunityScore ?? 0) / 500),
        provenance: {
          sourceKind: 'internal_case',
          sourceId: c.id,
          collectedAt: now,
          confidence: 0.9,
        },
        evidence: c.primaryImageUrl
          ? { imageUrl: c.primaryImageUrl, kind: 'product_image' }
          : undefined,
      });
    }
  }

  if (plan.sources.includes('internal_order')) {
    for (const o of docs.orders ?? []) {
      const score = Math.max(
        textMatch(o.id, q),
        textMatch(o.externalId ?? '', q),
        textMatch(o.status, q),
        plan.intents.includes('orders') ? 0.4 : 0,
      );
      if (score < 0.25) continue;
      hits.push({
        id: o.id,
        objectType: 'order',
        title: o.externalId ? `Order ${o.externalId}` : `Order ${o.id.slice(0, 8)}`,
        summary: `${o.status}${o.totalMinor != null ? ` · ${o.totalMinor} ${o.currency ?? ''}` : ''}`,
        href: '/terminal/orders',
        score,
        provenance: {
          sourceKind: 'internal_order',
          sourceId: o.id,
          collectedAt: now,
          confidence: 0.85,
        },
      });
    }
  }

  if (plan.sources.includes('internal_connector') || plan.sources.includes('connector_catalog')) {
    for (const c of docs.connectors ?? []) {
      const name = c.displayName ?? c.providerKey;
      const score = Math.max(
        textMatch(c.providerKey, q),
        textMatch(name, q),
        textMatch(c.status, q),
        plan.intents.includes('connectors') ? 0.35 : 0,
      );
      if (score < 0.25) continue;
      hits.push({
        id: c.providerKey,
        objectType: 'connector',
        title: name,
        summary: `${c.status}${c.isFixture ? ' · TEST FIXTURE' : ''}`,
        href: '/terminal/connectors',
        score,
        provenance: {
          sourceKind: c.isFixture ? 'internal_connector' : 'connector_catalog',
          connectorKey: c.providerKey,
          isFixture: Boolean(c.isFixture),
          collectedAt: now,
          confidence: c.isFixture ? 1 : 0.75,
          note: c.isFixture
            ? 'Fixture adapter — same contract as live providers.'
            : undefined,
        },
      });
    }
  }

  if (plan.sources.includes('ai_run')) {
    for (const r of docs.aiRuns ?? []) {
      const score = Math.max(textMatch(r.objective, q), plan.intents.includes('ai') ? 0.3 : 0);
      if (score < 0.25) continue;
      hits.push({
        id: r.id,
        objectType: 'ai_run',
        title: r.objective.slice(0, 80),
        summary: r.status,
        href: `/terminal/objectives/${r.id}`,
        score,
        provenance: {
          sourceKind: 'ai_run',
          sourceId: r.id,
          collectedAt:
            r.completedAt instanceof Date
              ? r.completedAt.toISOString()
              : String(r.completedAt ?? now),
          confidence: 0.8,
        },
      });
    }
  }

  hits.sort((a, b) => b.score - a.score);
  const top = hits.slice(0, 40);
  const mixed = new Set(top.map((h) => h.provenance.sourceKind)).size > 1;

  return {
    query: plan.query,
    plan,
    hits: top,
    total: top.length,
    executionMs: Date.now() - startedAt,
    honesty: {
      note: 'Internal search ranks canonical TradeOps objects with provenance. Live connector search merges only when authorized.',
      mixedEvidence: mixed,
    },
  };
}

export function mergeSearchResponses(
  primary: SearchResponse,
  extras: SearchHit[],
): SearchResponse {
  const hits = [...primary.hits, ...extras].sort((a, b) => b.score - a.score).slice(0, 50);
  return {
    ...primary,
    hits,
    total: hits.length,
    honesty: {
      ...primary.honesty,
      mixedEvidence:
        primary.honesty.mixedEvidence ||
        new Set(hits.map((h) => h.provenance.sourceKind)).size > 1,
    },
  };
}
