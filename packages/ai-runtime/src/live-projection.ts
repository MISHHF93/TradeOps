/**
 * Live data projection pipeline — progressive product discovery.
 *
 * External/catalog sources → normalize → dedupe → optional Cohere rerank → SSE events.
 * Cohere is the ranker/synthesizer, not the source of items.
 */

import { getAiPlatformConfig } from '@tradeops/config';
import { resolveAIProvider } from './provider/resolve-provider';
import { runSearchManager } from './search-manager';

// ─── Types ───────────────────────────────────────────────────────────

export type LiveItemAvailability =
  | 'in_stock'
  | 'out_of_stock'
  | 'limited'
  | 'unknown';

export type NormalizedLiveItem = {
  id: string;
  sourceId: string;
  source: string;
  title: string;
  description?: string;
  url: string;
  imageUrl?: string;
  price?: { amount: number; currency: string };
  seller?: { name: string; rating?: number };
  availability: LiveItemAvailability;
  identifiers?: { sku?: string; gtin?: string; mpn?: string; oemPartNumber?: string };
  score?: number;
  retrievedAt: string;
  dataMode: 'live' | 'cached' | 'fixture';
};

export type LiveProjectionEvent =
  | { type: 'query.started'; queryId: string; query: string; startedAt: string }
  | { type: 'source.started'; queryId: string; source: string; label?: string }
  | {
      type: 'item.discovered';
      queryId: string;
      source: string;
      item: NormalizedLiveItem;
    }
  | {
      type: 'item.normalized';
      queryId: string;
      source: string;
      item: NormalizedLiveItem;
    }
  | {
      type: 'item.reranked';
      queryId: string;
      item: NormalizedLiveItem;
    }
  | {
      type: 'item.projected';
      queryId: string;
      item: NormalizedLiveItem;
      rank: number;
    }
  | {
      type: 'source.failed';
      queryId: string;
      source: string;
      errorCode: string;
      message: string;
    }
  | {
      type: 'source.completed';
      queryId: string;
      source: string;
      itemCount: number;
    }
  | {
      type: 'query.completed';
      queryId: string;
      itemCount: number;
      completedAt: string;
      summary?: string;
    }
  | {
      type: 'query.failed';
      queryId: string;
      errorCode: string;
      message: string;
    };

export type LiveSourceAdapter = {
  id: string;
  label: string;
  /** Yield items as they are found (or return a batch). */
  discover: (ctx: {
    query: string;
    maxItems: number;
    signal?: AbortSignal;
  }) => AsyncIterable<NormalizedLiveItem> | Promise<NormalizedLiveItem[]>;
};

export type LiveProjectionInput = {
  queryId: string;
  query: string;
  sources: LiveSourceAdapter[];
  maxItems?: number;
  timeoutMs?: number;
  /** When true and Cohere is configured, rerank projected items */
  enableRerank?: boolean;
  env?: NodeJS.ProcessEnv;
  signal?: AbortSignal;
};

// ─── Helpers ─────────────────────────────────────────────────────────

function hrefKey(item: NormalizedLiveItem): string {
  const url = (item.url || '').toLowerCase().split('?')[0] ?? '';
  const title = (item.title || '').toLowerCase().trim();
  return url || `${item.source}:${item.sourceId}:${title}`;
}

function tokenScore(query: string, text: string): number {
  const q = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2);
  if (!q.length) return 0.5;
  const hay = text.toLowerCase();
  let hit = 0;
  for (const t of q) if (hay.includes(t)) hit += 1;
  return Math.min(1, hit / Math.max(1, q.length));
}

/** Build a catalog/source item from loose fields (API injects org products). */
export function normalizeCatalogProduct(
  row: {
    id: string;
    title: string;
    description?: string | null;
    primaryImageUrl?: string | null;
    targetPriceMinor?: number | null;
    currency?: string | null;
    brand?: string | null;
    isFixture?: boolean;
    sourcePlatform?: string | null;
  },
  source = 'internal_catalog',
): NormalizedLiveItem {
  const amount =
    typeof row.targetPriceMinor === 'number' ? row.targetPriceMinor / 100 : undefined;
  return {
    id: `${source}:${row.id}`,
    sourceId: row.id,
    source,
    title: row.title,
    description: row.description ?? undefined,
    url: `/terminal/products/${row.id}`,
    imageUrl: row.primaryImageUrl ?? undefined,
    price:
      amount != null
        ? { amount, currency: (row.currency ?? 'USD').toUpperCase() }
        : undefined,
    seller: row.brand ? { name: row.brand } : undefined,
    availability: 'unknown',
    retrievedAt: new Date().toISOString(),
    dataMode: row.isFixture ? 'fixture' : 'live',
  };
}

/** Convert Search Manager evidence into projected product-like cards. */
export function evidenceToLiveItem(
  e: {
    title?: string;
    url?: string;
    snippet?: string;
    provider?: string;
    retrievedAt?: string;
  },
  index: number,
): NormalizedLiveItem | null {
  const url = e.url?.trim();
  const title = (e.title ?? e.snippet ?? '').trim();
  if (!url && !title) return null;
  const source = e.provider ?? 'web_search';
  return {
    id: `${source}:${index}:${(url || title).slice(0, 80)}`,
    sourceId: url || String(index),
    source,
    title: title || url || 'Untitled',
    description: e.snippet,
    url: url || '#',
    availability: 'unknown',
    retrievedAt: e.retrievedAt ?? new Date().toISOString(),
    dataMode: 'live',
  };
}

/** Simple in-memory catalog adapter (products already loaded by host). */
export function createCatalogAdapter(
  products: Array<Parameters<typeof normalizeCatalogProduct>[0]>,
  opts?: { id?: string; label?: string },
): LiveSourceAdapter {
  const id = opts?.id ?? 'internal_catalog';
  return {
    id,
    label: opts?.label ?? 'TradeOps catalog',
    async *discover({ query, maxItems }) {
      const scored = products
        .map((p) => {
          const item = normalizeCatalogProduct(p, id);
          const score = tokenScore(query, `${p.title} ${p.description ?? ''} ${p.brand ?? ''}`);
          return { item: { ...item, score }, score };
        })
        .sort((a, b) => b.score - a.score);
      // Prefer matches; if none, still project top catalog rows so UI is never empty for seeded orgs
      const matched = scored.filter((x) => x.score > 0);
      const pool = matched.length > 0 ? matched : scored;
      for (const row of pool.slice(0, maxItems)) {
        yield row.item;
      }
    },
  };
}

/** Public web search adapter via Search Manager (keys stay server-side). */
export function createWebSearchAdapter(env?: NodeJS.ProcessEnv): LiveSourceAdapter {
  return {
    id: 'web_search',
    label: 'Public web search',
    async *discover({ query, maxItems }) {
      const cfg = getAiPlatformConfig(env);
      if (!cfg.webSearchEnabled) {
        return;
      }
      const result = await runSearchManager({
        objective: query,
        env,
        policy: { allowed: true, maxResultsPerQuery: maxItems },
      });
      let i = 0;
      for (const e of result.evidence) {
        if (e.sourceType !== 'web' && e.sourceType !== 'x') continue;
        const item = evidenceToLiveItem(e, i++);
        if (!item) continue;
        item.score = tokenScore(query, `${item.title} ${item.description ?? ''}`);
        yield item;
        if (i >= maxItems) break;
      }
    },
  };
}

async function toAsyncIterable<T>(
  value: AsyncIterable<T> | Promise<T[]>,
): Promise<AsyncIterable<T>> {
  if (value && typeof (value as AsyncIterable<T>)[Symbol.asyncIterator] === 'function') {
    return value as AsyncIterable<T>;
  }
  const arr = await (value as Promise<T[]>);
  return (async function* () {
    for (const x of arr) yield x;
  })();
}

/**
 * Run the live projection pipeline as an async event stream.
 */
export async function* runLiveProjection(
  input: LiveProjectionInput,
): AsyncGenerator<LiveProjectionEvent> {
  const queryId = input.queryId;
  const query = input.query.trim();
  const maxItems = Math.max(1, Math.min(input.maxItems ?? 50, 100));
  const timeoutMs = Math.max(5_000, Math.min(input.timeoutMs ?? 120_000, 300_000));
  const startedAt = new Date().toISOString();
  const deadline = Date.now() + timeoutMs;

  yield {
    type: 'query.started',
    queryId,
    query,
    startedAt,
  };

  if (!query) {
    yield {
      type: 'query.failed',
      queryId,
      errorCode: 'empty_query',
      message: 'Query is required',
    };
    return;
  }

  const seen = new Set<string>();
  const projected: NormalizedLiveItem[] = [];
  let rank = 0;

  const sources =
    input.sources.length > 0
      ? input.sources
      : [createWebSearchAdapter(input.env)];

  for (const source of sources) {
    if (input.signal?.aborted || Date.now() > deadline) break;
    if (projected.length >= maxItems) break;

    yield {
      type: 'source.started',
      queryId,
      source: source.id,
      label: source.label,
    };

    let sourceCount = 0;
    try {
      const iter = await toAsyncIterable(
        source.discover({
          query,
          maxItems: maxItems - projected.length,
          signal: input.signal,
        }),
      );
      for await (const raw of iter) {
        if (input.signal?.aborted || Date.now() > deadline) break;
        if (projected.length >= maxItems) break;

        yield {
          type: 'item.discovered',
          queryId,
          source: source.id,
          item: raw,
        };

        const item: NormalizedLiveItem = {
          ...raw,
          score: raw.score ?? tokenScore(query, `${raw.title} ${raw.description ?? ''}`),
          retrievedAt: raw.retrievedAt || new Date().toISOString(),
        };

        yield {
          type: 'item.normalized',
          queryId,
          source: source.id,
          item,
        };

        const key = hrefKey(item);
        if (seen.has(key)) continue;
        seen.add(key);

        projected.push(item);
        sourceCount += 1;
        rank += 1;

        yield {
          type: 'item.projected',
          queryId,
          item,
          rank,
        };
      }

      yield {
        type: 'source.completed',
        queryId,
        source: source.id,
        itemCount: sourceCount,
      };
    } catch (e) {
      yield {
        type: 'source.failed',
        queryId,
        source: source.id,
        errorCode: 'source_error',
        message: e instanceof Error ? e.message.slice(0, 200) : 'Source failed',
      };
    }
  }

  // Optional Cohere rerank of projected set
  if (input.enableRerank !== false && projected.length > 1) {
    try {
      const provider = resolveAIProvider(input.env);
      if (provider.configured) {
        const docs = projected.map(
          (p) => `${p.title}\n${p.description ?? ''}\n${p.url}`.slice(0, 1000),
        );
        const rr = await provider.rerank({
          query,
          documents: docs,
          topN: projected.length,
        });
        if (rr.ok && rr.results?.length) {
          type RankHit = { index: number; relevanceScore: number };
          const ranked = rr.results
            .slice()
            .sort((a: RankHit, b: RankHit) => b.relevanceScore - a.relevanceScore)
            .map((r: RankHit) => {
              const item = projected[r.index];
              if (!item) return null;
              return {
                ...item,
                score: r.relevanceScore,
              };
            })
            .filter(Boolean) as NormalizedLiveItem[];

          if (ranked.length) {
            projected.length = 0;
            projected.push(...ranked);
            let rnk = 0;
            for (const item of projected) {
              rnk += 1;
              yield { type: 'item.reranked', queryId, item };
              yield { type: 'item.projected', queryId, item, rank: rnk };
            }
          }
        }
      }
    } catch {
      // Rerank is best-effort — projection already streamed
    }
  }

  yield {
    type: 'query.completed',
    queryId,
    itemCount: projected.length,
    completedAt: new Date().toISOString(),
    summary:
      projected.length === 0
        ? 'No items projected. Enable WEB_SEARCH or import catalog products.'
        : `Projected ${projected.length} item(s) from ${sources.length} source(s).`,
  };
}

export function getLiveProjectionEnv(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
) {
  const truthy = (v: string | undefined, d = false) => {
    if (v == null || v === '') return d;
    const s = v.trim().toLowerCase();
    return s === '1' || s === 'true' || s === 'yes' || s === 'on';
  };
  const num = (v: string | undefined, d: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : d;
  };
  return {
    enabled: truthy(env.LIVE_PROJECTION_ENABLED, true),
    transport: (env.LIVE_PROJECTION_TRANSPORT ?? 'sse').trim().toLowerCase() === 'websocket'
      ? 'websocket'
      : 'sse',
    maxSources: num(env.LIVE_PROJECTION_MAX_SOURCES, 6),
    maxItems: num(env.LIVE_PROJECTION_MAX_ITEMS, 50),
    timeoutMs: num(env.LIVE_PROJECTION_TIMEOUT_MS, 120_000),
  };
}
