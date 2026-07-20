/**
 * Single browser client for the AI Operator path.
 * All UI entry points (right panel, /terminal/objectives console, side panel) must use this
 * so forceShadow / navigate / SSE behavior cannot drift.
 */
import { getApiBaseUrl } from './api';

export type OperatorProgressEvent = {
  state?: string;
  step?: string;
  detail?: string;
  at?: string;
  message?: string;
  code?: string;
};

export type OperatorRunResult = {
  runId?: string;
  status?: string;
  loopMode?: string;
  decision?: string;
  decisionNote?: string;
  responseSummary?: string;
  briefingSource?: string;
  objectiveType?: string;
  riskClass?: string;
  approvalRequired?: boolean;
  timeline?: Array<{ at: string; step: string; status: string; detail?: string }>;
  liveProgress?: OperatorProgressEvent[];
  recommendations?: unknown[];
  /** Cycle 3/4 structured comparison */
  productComparison?: Array<{
    rank?: number;
    product?: string;
    priceBand?: string | null;
    why?: string | null;
    risk?: string | null;
    confidence?: number;
    sourceUrl?: string | null;
  }>;
  resultsPath?: string;
  objectivePath?: string;
  processPath?: string;
  requestId?: string;
  correlationId?: string;
  casesSynced?: number;
  dataSourcePlan?: unknown;
  learning?: unknown;
  harmonization?: unknown;
  honesty?: { note?: string; dataMode?: string; forceShadow?: boolean; path?: string };
  envelope?: {
    meta?: { dataMode?: string; requestId?: string; state?: string };
    text?: string;
    artifactType?: string;
    artifact?: unknown;
  };
  message?: string;
  code?: string;
  candidateStats?: { retrieved?: number; ranked?: number };
  toolTrace?: unknown[];
  /** Optional source list from agent / operator path */
  sources?: Array<{ name?: string; status?: string; detail?: string; provider?: string }>;
  risks?: unknown[];
  /** Cycle 7 — merchant decision pack */
  merchantDecision?: {
    headline?: string;
    summary?: string;
    topPick?: {
      rank?: number;
      product?: string;
      priceBand?: string | null;
      why?: string;
      risk?: string | null;
      confidence?: number;
    };
    runnersUp?: Array<{
      rank?: number;
      product?: string;
      priceBand?: string | null;
      why?: string;
    }>;
    pass?: Array<{ product?: string; reason?: string }>;
    nextSteps?: string[];
  };
  listingBrief?: {
    product?: string;
    listingTitle?: string;
    bullets?: string[];
    wholesaleBand?: string | null;
    suggestedRetail?: string;
    risk?: string | null;
    channelNote?: string;
    status?: string;
  };
};

export type ResearchToCasesResult = {
  created: number;
  reused: number;
  cases: Array<{ caseId: string; productId: string; title: string; href: string }>;
  error?: string;
  message?: string;
};

/** Persist AI productComparison rows as Product + CommerceCase (ai-research). */
export async function persistResearchToCases(input: {
  runId?: string;
  products: NonNullable<OperatorRunResult['productComparison']>;
}): Promise<ResearchToCasesResult> {
  let res: Response;
  try {
    res = await fetch(`${getApiBaseUrl()}/api/v1/ai/operator/research-to-cases`, {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        runId: input.runId,
        products: input.products,
      }),
    });
  } catch (e) {
    throw networkOperatorError(e);
  }
  const body = (await res.json().catch(() => ({}))) as ResearchToCasesResult;
  if (!res.ok) {
    throw Object.assign(new Error(body.message || `HTTP ${res.status}`), {
      status: res.status,
      body,
    });
  }
  return body;
}

export type ResearchToListingDraftResult = {
  created?: boolean;
  productId?: string;
  caseId?: string;
  listingId?: string;
  listingStatus?: string;
  sku?: string;
  priceMinor?: number;
  currency?: string;
  href?: string;
  productHref?: string;
  listingBrief?: OperatorRunResult['listingBrief'];
  note?: string;
  error?: string;
  message?: string;
};

/** Cycle 7: top research product → Product + Case + internal listing draft (not published). */
export async function draftListingFromResearch(input: {
  runId?: string;
  product?: NonNullable<OperatorRunResult['productComparison']>[number];
  products?: NonNullable<OperatorRunResult['productComparison']>;
}): Promise<ResearchToListingDraftResult> {
  let res: Response;
  try {
    res = await fetch(
      `${getApiBaseUrl()}/api/v1/ai/operator/research-to-listing-draft`,
      {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          runId: input.runId,
          product: input.product,
          products: input.products,
        }),
      },
    );
  } catch (e) {
    throw networkOperatorError(e);
  }
  const body = (await res.json().catch(() => ({}))) as ResearchToListingDraftResult;
  if (!res.ok || body.error) {
    throw Object.assign(
      new Error(body.message || body.error || `HTTP ${res.status}`),
      { status: res.status, body },
    );
  }
  return body;
}

export type ShopifyGoLivePack = {
  headline: string;
  summary: string;
  checklist: Array<{
    id: string;
    ok: boolean;
    label: string;
    detail?: string;
    missing?: string[];
  }>;
  publishPayloadPreview?: {
    title: string;
    descriptionHtml: string;
    price: string;
    currency: string;
    sku: string;
    channel: string;
    status: string;
  };
  approval?: {
    id: string;
    status: string;
    kind: string;
    listingId: string;
    href: string;
    deduped: boolean;
  } | null;
  listing?: {
    id: string;
    status: string;
    productId: string;
    caseId: string | null;
    href: string;
  };
  shopify?: {
    envConfigured: boolean;
    missingKeys: string[];
    probeOk: boolean | null;
    probeDetail: string | null;
    liveProductCount: number | null;
  };
  nextSteps?: string[];
  connectorsHref?: string;
  approvalsHref?: string;
  honesty?: { publishedToShopify: boolean; note: string };
};

export type PrepareShopifyGoLiveResult = {
  goLivePack?: ShopifyGoLivePack;
  error?: string;
  message?: string;
};

/** Cycle 8: draft (+ optional products) → Shopify go-live readiness (no productCreate). */
export async function prepareShopifyGoLive(input: {
  runId?: string;
  listingId?: string;
  caseId?: string;
  product?: NonNullable<OperatorRunResult['productComparison']>[number];
  products?: NonNullable<OperatorRunResult['productComparison']>;
}): Promise<PrepareShopifyGoLiveResult> {
  let res: Response;
  try {
    res = await fetch(
      `${getApiBaseUrl()}/api/v1/ai/operator/prepare-shopify-golive`,
      {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          runId: input.runId,
          listingId: input.listingId,
          caseId: input.caseId,
          product: input.product,
          products: input.products,
        }),
      },
    );
  } catch (e) {
    throw networkOperatorError(e);
  }
  const body = (await res.json().catch(() => ({}))) as PrepareShopifyGoLiveResult;
  if (!res.ok || body.error || !body.goLivePack) {
    throw Object.assign(
      new Error(body.message || body.error || `HTTP ${res.status}`),
      { status: res.status, body },
    );
  }
  return body;
}

export type PushListingToShopifyResult = {
  status?: string;
  publishedToShopify?: boolean;
  shopifyProductId?: string | null;
  shopifyHandle?: string | null;
  listing?: {
    id: string;
    status: string;
    externalId: string | null;
    productId: string;
    href: string;
  };
  approval?: { id: string; status: string } | null;
  payloadPreview?: {
    title: string;
    descriptionHtml: string;
    status: string;
    vendor: string;
    productType: string;
    tags: string[];
    price: string;
    sku: string;
  };
  shopify?: {
    envConfigured: boolean;
    missingKeys: string[];
    probeOk: boolean | null;
    probeDetail: string | null;
  };
  nextSteps?: string[];
  connectorsHref?: string;
  honesty?: { note: string };
  error?: string;
  message?: string;
  /** Cycle 10 */
  shopifyAdminUrl?: string | null;
  variant?: { id: string; price: string; sku: string | null } | null;
  media?: {
    attempted: boolean;
    attached: boolean;
    sourceUrl: string | null;
    mediaId: string | null;
    plannedCount?: number;
    attachedCount?: number;
    sources?: string[];
    mediaIds?: string[];
    error?: string;
  } | null;
  launchReport?: {
    headline: string;
    checklist: Array<{
      id: string;
      ok: boolean;
      label: string;
      detail?: string;
    }>;
    shopifyAdminUrl: string | null;
    priceSynced: boolean | null;
    skuSynced: boolean | null;
    mediaAttached?: boolean | null;
    mediaAttachedCount?: number | null;
    mediaPlannedCount?: number | null;
  };
};

export type PublishShopifyActiveResult = {
  status?: string;
  storefrontActive?: boolean;
  shopifyProductId?: string | null;
  shopifyStatus?: string | null;
  shopifyHandle?: string | null;
  shopifyAdminUrl?: string | null;
  listing?: {
    id: string;
    status: string;
    productId: string;
    href: string;
  } | null;
  publishReport?: {
    headline: string;
    checklist: Array<{
      id: string;
      ok: boolean;
      label: string;
      detail?: string;
    }>;
  };
  nextSteps?: string[];
  honesty?: { note: string };
  error?: string;
  message?: string;
};

export type ShopifyPostActiveOpsResult = {
  status?: string;
  shopifyProductId?: string | null;
  shopifyAdminUrl?: string | null;
  inventory?: {
    attempted: boolean;
    ok: boolean;
    quantity: number | null;
    locationName: string | null;
    error?: string;
  };
  collection?: {
    attempted: boolean;
    ok: boolean;
    title: string | null;
    collectionId: string | null;
    created: boolean | null;
    error?: string;
  };
  opsReport?: {
    headline: string;
    checklist: Array<{
      id: string;
      ok: boolean;
      label: string;
      detail?: string;
    }>;
  };
  listing?: {
    id: string;
    status: string;
    productId: string;
    href: string;
  } | null;
  nextSteps?: string[];
  honesty?: { note: string };
  error?: string;
  message?: string;
};

/** Cycle 14: inventory + collection on linked Shopify product. */
export async function applyShopifyPostActiveOps(input: {
  listingId?: string;
  shopifyProductId?: string;
  confirmOps: boolean;
  dryRun?: boolean;
  inventoryQuantity?: number | null;
  collectionTitle?: string | null;
}): Promise<ShopifyPostActiveOpsResult> {
  let res: Response;
  try {
    res = await fetch(
      `${getApiBaseUrl()}/api/v1/ai/operator/shopify-post-active-ops`,
      {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingId: input.listingId,
          shopifyProductId: input.shopifyProductId,
          confirmOps: input.confirmOps,
          dryRun: input.dryRun,
          inventoryQuantity: input.inventoryQuantity,
          collectionTitle: input.collectionTitle,
        }),
      },
    );
  } catch (e) {
    throw networkOperatorError(e);
  }
  const body = (await res.json().catch(() => ({}))) as ShopifyPostActiveOpsResult;
  if (!res.ok || (body.error && !body.status)) {
    throw Object.assign(
      new Error(body.message || body.error || `HTTP ${res.status}`),
      { status: res.status, body },
    );
  }
  return body;
}

/** Cycle 13: set Shopify product ACTIVE (storefront). Requires phrase gate. */
export async function publishShopifyActive(input: {
  listingId?: string;
  shopifyProductId?: string;
  confirmPublish: boolean;
  confirmPhrase?: string;
  dryRun?: boolean;
}): Promise<PublishShopifyActiveResult> {
  let res: Response;
  try {
    res = await fetch(
      `${getApiBaseUrl()}/api/v1/ai/operator/publish-shopify-active`,
      {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingId: input.listingId,
          shopifyProductId: input.shopifyProductId,
          confirmPublish: input.confirmPublish,
          confirmPhrase: input.confirmPhrase,
          dryRun: input.dryRun,
        }),
      },
    );
  } catch (e) {
    throw networkOperatorError(e);
  }
  const body = (await res.json().catch(() => ({}))) as PublishShopifyActiveResult;
  if (!res.ok || (body.error && !body.status)) {
    throw Object.assign(
      new Error(body.message || body.error || `HTTP ${res.status}`),
      { status: res.status, body },
    );
  }
  return body;
}

/** Cycle 9: approve (optional) + explicit productCreate (confirmPush required). */
export async function pushListingToShopify(input: {
  listingId?: string;
  approvalId?: string;
  confirmPush: boolean;
  approveIfPending?: boolean;
  dryRun?: boolean;
  imageUrl?: string;
  imageUrls?: string[];
}): Promise<PushListingToShopifyResult> {
  let res: Response;
  try {
    res = await fetch(
      `${getApiBaseUrl()}/api/v1/ai/operator/push-listing-to-shopify`,
      {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingId: input.listingId,
          approvalId: input.approvalId,
          confirmPush: input.confirmPush,
          approveIfPending: input.approveIfPending,
          dryRun: input.dryRun,
          imageUrl: input.imageUrl,
          imageUrls: input.imageUrls,
        }),
      },
    );
  } catch (e) {
    throw networkOperatorError(e);
  }
  const body = (await res.json().catch(() => ({}))) as PushListingToShopifyResult;
  if (!res.ok || (body.error && !body.status)) {
    throw Object.assign(
      new Error(body.message || body.error || `HTTP ${res.status}`),
      { status: res.status, body },
    );
  }
  return body;
}

export type RunOperatorOptions = {
  objective: string;
  commerceCaseId?: string;
  /**
   * Opt-in only. Omit for normal sidebar/console runs (server resolves development).
   * Live examples may set true deliberately.
   */
  forceShadow?: boolean;
  /** Prefer SSE stream (default true). Falls back to JSON automatically. */
  preferStream?: boolean;
  onProgress?: (ev: OperatorProgressEvent) => void;
};

function operatorBody(opts: RunOperatorOptions): Record<string, unknown> {
  const body: Record<string, unknown> = {
    objective: opts.objective,
    // Sidebar / console fast path — never force navigate navigator package.
    navigate: false,
    // Explicitly refuse shadow lock unless caller opts in
    forceShadow: opts.forceShadow === true,
  };
  if (opts.commerceCaseId) body.commerceCaseId = opts.commerceCaseId;
  return body;
}

function networkOperatorError(err: unknown): Error {
  const msg = err instanceof Error ? err.message : String(err);
  const offline =
    msg.includes('Failed to fetch') ||
    msg.includes('NetworkError') ||
    msg.includes('ECONNREFUSED') ||
    msg.includes('Load failed') ||
    msg.includes('Network request failed');
  if (offline) {
    return Object.assign(
      new Error(
        'API unreachable (connection refused). Start the stack: pnpm stack:up — then hard-refresh the browser.',
      ),
      { status: 0, body: { code: 'api_unreachable', message: msg } satisfies OperatorRunResult },
    );
  }
  return err instanceof Error ? err : new Error(msg);
}

export async function runOperatorJson(
  opts: RunOperatorOptions,
): Promise<OperatorRunResult> {
  let res: Response;
  try {
    res = await fetch(`${getApiBaseUrl()}/api/v1/ai/operator/run`, {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(operatorBody(opts)),
    });
  } catch (e) {
    throw networkOperatorError(e);
  }
  const body = (await res.json().catch(() => ({}))) as OperatorRunResult;
  if (!res.ok) {
    throw Object.assign(
      new Error(humanOperatorError(res.status, body)),
      { status: res.status, body },
    );
  }
  return body;
}

export async function runOperatorStream(
  opts: RunOperatorOptions,
): Promise<OperatorRunResult> {
  let res: Response;
  try {
    res = await fetch(`${getApiBaseUrl()}/api/v1/ai/operator/run/stream`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: 'text/event-stream',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(operatorBody(opts)),
    });
  } catch (e) {
    throw networkOperatorError(e);
  }

  if (!res.ok || !res.body) {
    // Fall through to JSON path caller
    const body = (await res.json().catch(() => ({}))) as OperatorRunResult;
    throw Object.assign(
      new Error(humanOperatorError(res.status, body)),
      { status: res.status, body },
    );
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalResult: OperatorRunResult | null = null;
  let eventName = 'message';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';
    for (const chunk of parts) {
      // Reset event name per SSE frame so a prior "error" cannot poison "result"
      eventName = 'message';
      let dataLine = '';
      for (const line of chunk.split(/\r?\n/)) {
        if (line.startsWith('event:')) eventName = line.slice(6).trim();
        if (line.startsWith('data:')) dataLine += line.slice(5).trim();
      }
      if (!dataLine) continue;
      try {
        const data = JSON.parse(dataLine) as OperatorProgressEvent & OperatorRunResult;
        if (eventName === 'state') {
          opts.onProgress?.(data);
        } else if (eventName === 'result') {
          finalResult = data as OperatorRunResult;
        } else if (eventName === 'error') {
          throw Object.assign(new Error(data.message || data.step || 'Stream error'), {
            status: 503,
            body: data,
          });
        } else if (
          // Some proxies strip event: lines — accept bare JSON that looks like a result
          data &&
          (data.runId || data.responseSummary || data.recommendations)
        ) {
          finalResult = data as OperatorRunResult;
        }
      } catch (e) {
        if (e instanceof SyntaxError) continue;
        throw e;
      }
    }
  }

  if (!finalResult) {
    throw new Error('Operator stream ended without a result event');
  }
  return finalResult;
}

/**
 * Canonical entry: JSON first (reliable, no stream proxy drops), optional SSE.
 * Never defaults forceShadow.
 */
export async function runOperator(
  opts: RunOperatorOptions,
): Promise<{ result: OperatorRunResult; transport: 'sse' | 'json' }> {
  // Prefer JSON — long operator runs + Windows PGlite were losing SSE mid-flight
  // and the UI never received result events.
  if (opts.preferStream === true) {
    try {
      const result = await runOperatorStream(opts);
      return { result, transport: 'sse' };
    } catch (e) {
      const status = (e as { status?: number })?.status;
      if (status === 0) throw e;
      /* fall back to JSON */
    }
  }
  const result = await runOperatorJson(opts);
  return { result, transport: 'json' };
}

export function humanOperatorError(status: number, body: OperatorRunResult): string {
  if (status === 0 || body.code === 'api_unreachable') {
    return (
      body.message ??
      'API unreachable (connection refused). Start the stack: pnpm stack:up — then hard-refresh.'
    );
  }
  if (status === 503 || body.code === 'database_unavailable') {
    return (
      body.message ??
      'Database unavailable. Run `pnpm stack:up` (PGlite + API), then retry.'
    );
  }
  if (status === 500) {
    return (
      body.message ??
      'Operator server error (HTTP 500). Often means the database dropped mid-request — run `pnpm stack:up` and retry.'
    );
  }
  if (status === 401 || status === 403) {
    return body.message ?? 'Not authorized for AI operator.';
  }
  return body.message ?? `Operator failed (HTTP ${status})`;
}
