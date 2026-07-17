/**
 * Live Data Provenance — every KPI must declare how it was produced.
 * Never fabricate live values; label simulation explicitly.
 */

export type DataOrigin =
  | 'live_connector'
  | 'canonical_store'
  | 'derived_model'
  | 'fixture'
  | 'simulation'
  | 'unavailable';

export type SyncStatus =
  | 'fresh'
  | 'stale'
  | 'never'
  | 'error'
  | 'not_connected'
  | 'n_a';

/**
 * Attached to every production KPI / recommendation evidence item.
 */
export type DataProvenance = {
  origin: DataOrigin;
  /** Human-readable source */
  sourceLabel: string;
  /** Connector providerKey when applicable */
  sourceConnector?: string | null;
  /** Canonical model / table */
  canonicalModel?: string | null;
  /** ISO timestamp of source observation */
  observedAt: string;
  /** Age in seconds at computation time */
  ageSeconds: number;
  syncStatus: SyncStatus;
  /** 0–1 confidence in this figure */
  confidence: number;
  /** How the value was computed */
  lineage: string;
  /** When false, UI must not present as live commerce truth */
  isLiveOperational: boolean;
  /** Explicit simulation / fixture banner required */
  simulationLabel?: string | null;
  refreshHint?: string | null;
};

export type ProvenancedValue<T> = {
  value: T;
  provenance: DataProvenance;
};

export type LiveDataInventoryItem = {
  id: string;
  surface: string;
  metric: string;
  origin: DataOrigin;
  sourceLabel: string;
  sourceConnector?: string | null;
  canonicalModel?: string | null;
  isLiveOperational: boolean;
  notes: string;
  actionableEmptyState?: string;
  simulationLabel?: string | null;
};

/** Static inventory of major TradeOps surfaces (audit baseline). */
export const LIVE_DATA_INVENTORY: LiveDataInventoryItem[] = [
  {
    id: 'process.open_cases',
    surface: '/terminal/process',
    metric: 'Open Commerce Cases',
    origin: 'canonical_store',
    sourceLabel: 'CommerceCase table',
    canonicalModel: 'CommerceCase',
    isLiveOperational: true,
    notes: 'Count of non-closed cases for org; not marketplace live feed.',
  },
  {
    id: 'process.friction',
    surface: '/terminal/process',
    metric: 'Avg operational friction',
    origin: 'derived_model',
    sourceLabel: 'Commerce State Engine',
    canonicalModel: 'CommerceCase + Product',
    isLiveOperational: true,
    notes: 'Heuristic business friction; not external sensor data.',
  },
  {
    id: 'scanner.opportunities',
    surface: '/terminal',
    metric: 'Opportunity scores',
    origin: 'derived_model',
    sourceLabel: 'Opportunity + Product store',
    sourceConnector: 'fixture-supplier or live supplier when connected',
    canonicalModel: 'Opportunity',
    isLiveOperational: true,
    notes: 'Scores from import; fixture products labeled TEST FIXTURE.',
    actionableEmptyState: 'Import products or connect a supplier connector.',
  },
  {
    id: 'portfolio.revenue',
    surface: '/terminal/portfolio',
    metric: 'Revenue (orders)',
    origin: 'canonical_store',
    sourceLabel: 'CustomerOrder.totalMinor sum',
    canonicalModel: 'CustomerOrder',
    isLiveOperational: true,
    notes: 'Only from orders in DB; empty when no orders.',
    actionableEmptyState: 'Connect marketplace and ingest orders, or run fixture order ingest in simulation.',
  },
  {
    id: 'portfolio.pending_payouts',
    surface: '/terminal/portfolio',
    metric: 'Pending marketplace payouts',
    origin: 'unavailable',
    sourceLabel: 'Requires payment connector payout API',
    sourceConnector: 'stripe-api / marketplace payouts',
    canonicalModel: 'CommercePayout',
    isLiveOperational: false,
    notes: 'Must NOT invent as % of revenue.',
    actionableEmptyState: 'Connect a payment/payout connector and sync payouts.',
  },
  {
    id: 'cockpit.counts',
    surface: '/terminal/cockpit',
    metric: 'Products / orders / approvals counts',
    origin: 'canonical_store',
    sourceLabel: 'Prisma counts',
    canonicalModel: 'Product, CustomerOrder, Approval',
    isLiveOperational: true,
    notes: 'Org-scoped counts from DB.',
  },
  {
    id: 'ops.connector_health',
    surface: '/terminal/connectors',
    metric: 'Connector online / credentials',
    origin: 'canonical_store',
    sourceLabel: 'ConnectorInstallation + LiveFeed registry',
    canonicalModel: 'ConnectorInstallation',
    isLiveOperational: true,
    notes: 'Registry catalogs vendors; live = installed+connected only.',
  },
  {
    id: 'ops.production_catalog',
    surface: '/ops/connectors/production',
    metric: 'Production connector credential readiness',
    origin: 'live_connector',
    sourceLabel: 'PRODUCTION_CONNECTORS + env credential resolution',
    sourceConnector: 'multi',
    canonicalModel: 'ConnectorInstallation',
    isLiveOperational: true,
    notes: 'liveReady = env keys present; HTTP sync only for LIVE_HTTP_IMPLEMENTED adapters.',
    actionableEmptyState: 'Set connector credentials in env (e.g. SHOPIFY_ACCESS_TOKEN, STRIPE_SECRET_KEY).',
  },
  {
    id: 'ops.live_http_sync',
    surface: 'POST /ops/connectors/live-sync',
    metric: 'Live product/order/payout import',
    origin: 'live_connector',
    sourceLabel: '@tradeops/connector-live-http adapters',
    sourceConnector: 'shopify-graphql-admin | stripe-api | woo | easypost | fx | serpapi',
    canonicalModel: 'Product, CommerceEvent',
    isLiveOperational: true,
    notes: 'Never fabricates rows when credentials missing; empty result is honest empty state.',
    actionableEmptyState: 'Configure credentials and POST live-sync for connected providers.',
  },
  {
    id: 'channel.profitability',
    surface: 'product detail',
    metric: 'Channel fee comparison',
    origin: 'derived_model',
    sourceLabel: 'Modeled fee assumptions (not live channel API)',
    canonicalModel: 'Product',
    isLiveOperational: false,
    notes: 'Simulation/model until channel fee APIs connected.',
    simulationLabel: 'SIMULATION — modeled channel fees',
    actionableEmptyState: 'Connect Shopify/Amazon fee APIs for live channel economics.',
  },
  {
    id: 'ai.recommendations',
    surface: '/terminal/ai',
    metric: 'Operator recommendations',
    origin: 'derived_model',
    sourceLabel: 'AI Runtime over canonical Product store',
    canonicalModel: 'Product, Opportunity, OperatorRun',
    isLiveOperational: true,
    notes: 'Must cite productIds and evidence; fixture products labeled.',
  },
  {
    id: 'cashflow.ad_spend',
    surface: '/terminal/cashflow',
    metric: 'Advertising allocation',
    origin: 'canonical_store',
    sourceLabel: 'Product.adAllocationMinor (planning reserve)',
    canonicalModel: 'Product',
    isLiveOperational: false,
    notes: 'Planning allocation, not live ad platform spend until Google/Meta connected.',
    simulationLabel: 'PLANNING — not live ad platform spend',
  },
];

export function makeProvenance(input: {
  origin: DataOrigin;
  sourceLabel: string;
  sourceConnector?: string | null;
  canonicalModel?: string | null;
  observedAt?: Date | string | null;
  syncStatus?: SyncStatus;
  confidence?: number;
  lineage: string;
  isLiveOperational: boolean;
  simulationLabel?: string | null;
  refreshHint?: string | null;
  now?: Date;
}): DataProvenance {
  const now = input.now ?? new Date();
  const observed = input.observedAt
    ? typeof input.observedAt === 'string'
      ? new Date(input.observedAt)
      : input.observedAt
    : now;
  const ageSeconds = Math.max(0, Math.round((now.getTime() - observed.getTime()) / 1000));
  let syncStatus = input.syncStatus;
  if (!syncStatus) {
    if (input.origin === 'unavailable') syncStatus = 'not_connected';
    else if (ageSeconds > 86_400) syncStatus = 'stale';
    else syncStatus = 'fresh';
  }
  return {
    origin: input.origin,
    sourceLabel: input.sourceLabel,
    sourceConnector: input.sourceConnector ?? null,
    canonicalModel: input.canonicalModel ?? null,
    observedAt: observed.toISOString(),
    ageSeconds,
    syncStatus,
    confidence: input.confidence ?? (input.isLiveOperational ? 0.85 : 0.5),
    lineage: input.lineage,
    isLiveOperational: input.isLiveOperational,
    simulationLabel: input.simulationLabel ?? null,
    refreshHint: input.refreshHint ?? null,
  };
}

export function provenanceEnvelope<T>(
  value: T,
  provenance: DataProvenance,
): ProvenancedValue<T> {
  return { value, provenance };
}
