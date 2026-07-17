/**
 * Real-Time Commerce Operations Center — types & pure health aggregation.
 * Connectors are live operational sensors for the Commerce Runtime, not isolated API clients.
 */

import type { BusinessCapability } from './business-capabilities';
import {
  BUSINESS_CAPABILITY_CATALOG,
  businessCapabilitiesFromTechnical,
  selectProvidersForCapabilities,
  type CapabilityAdvertisement,
} from './business-capabilities';
import type { LiveFeedRegistryEntry } from './live-feed-registry';
import { listLiveFeeds } from './live-feed-registry';

export type OperationalDomain =
  | 'commerce_platforms'
  | 'supplier_intelligence'
  | 'payments'
  | 'logistics'
  | 'marketing'
  | 'analytics'
  | 'accounting'
  | 'ai_runtime'
  | 'platform_observability'
  | 'search_intelligence'
  | 'tax_currency';

export const OPERATIONAL_DOMAINS: Array<{
  id: OperationalDomain;
  label: string;
  description: string;
}> = [
  {
    id: 'commerce_platforms',
    label: 'Commerce Platforms',
    description: 'Storefronts and marketplaces: listings, inventory, orders.',
  },
  {
    id: 'supplier_intelligence',
    label: 'Supplier Intelligence',
    description: 'Sourcing, quotes, MOQ, manufacturer comparison.',
  },
  {
    id: 'payments',
    label: 'Payments',
    description: 'Billing, channel payments, payouts, reconciliation.',
  },
  {
    id: 'logistics',
    label: 'Logistics',
    description: 'Labels, carriers, tracking, exceptions.',
  },
  {
    id: 'marketing',
    label: 'Marketing',
    description: 'Ads, campaigns, creative performance.',
  },
  {
    id: 'analytics',
    label: 'Analytics',
    description: 'Traffic, product analytics, product insights.',
  },
  {
    id: 'accounting',
    label: 'Accounting',
    description: 'GL sync, invoices, books of record.',
  },
  {
    id: 'search_intelligence',
    label: 'Search & Product Intelligence',
    description: 'SERP, pricing history, catalog enrichment.',
  },
  {
    id: 'tax_currency',
    label: 'Currency & Tax',
    description: 'FX rates, tax estimation, landed cost inputs.',
  },
  {
    id: 'ai_runtime',
    label: 'AI Runtime',
    description: 'Model providers and evaluation loops (capability-gated).',
  },
  {
    id: 'platform_observability',
    label: 'Platform Observability',
    description: 'Metrics, traces, logs, error tracking.',
  },
];

/** Family → operational domain */
export function domainForFamily(family: string): OperationalDomain {
  switch (family) {
    case 'storefront':
    case 'marketplace':
      return 'commerce_platforms';
    case 'supplier':
      return 'supplier_intelligence';
    case 'payment':
      return 'payments';
    case 'shipping':
      return 'logistics';
    case 'advertising':
      return 'marketing';
    case 'trend':
    case 'review':
      return 'analytics';
    case 'accounting':
      return 'accounting';
    case 'observability':
      return 'platform_observability';
    case 'ai':
      return 'ai_runtime';
    case 'tax':
    case 'currency':
      return 'tax_currency';
    case 'search':
      return 'search_intelligence';
    default:
      return 'commerce_platforms';
  }
}

export type ConnectorRegistryRecord = {
  providerKey: string;
  vendor: string;
  displayName: string;
  connectorType: string;
  domain: OperationalDomain;
  authenticationMethod: string;
  oauthStatus: 'not_started' | 'valid' | 'expired' | 'revoked' | 'n_a' | 'unknown';
  permissions: string[];
  apiVersion: string;
  supportedCapabilities: BusinessCapability[];
  technicalCapabilities: string[];
  webhookSubscriptions: string[];
  pollingStrategy: 'none' | 'interval' | 'adaptive' | 'webhook_primary';
  rateLimits: { requestsPerMinute?: number; notes?: string };
  healthStatus: string;
  online: boolean;
  latencyMs: number | null;
  synchronizationStatus: 'idle' | 'syncing' | 'lagging' | 'failed' | 'never' | 'healthy';
  retryPolicy: { maxAttempts: number; backoff: string };
  errorHistory: Array<{ at: string; message: string }>;
  observability: {
    throughputPerHour: number;
    errorRate: number;
    retryCount: number;
    lastSuccessAt: string | null;
    webhookHealth: 'ok' | 'degraded' | 'down' | 'unsupported' | 'unknown';
    apiQuotaUtilization: number | null;
  };
  isFixture: boolean;
  docsUrl: string;
  notes: string;
  installationId?: string | null;
  orgStatus?: string | null;
};

export type ConnectorHealthCenter = {
  summary: {
    total: number;
    online: number;
    offline: number;
    fixtures: number;
    liveConnected: number;
    needsCredentials: number;
    unhealthy: number;
    webhookOk: number;
    avgLatencyMs: number | null;
  };
  byDomain: Array<{
    domain: OperationalDomain;
    label: string;
    connectors: ConnectorRegistryRecord[];
  }>;
  connectors: ConnectorRegistryRecord[];
  capabilities: typeof BUSINESS_CAPABILITY_CATALOG;
  honesty: { note: string };
  computedAt: string;
};

export type InstallHealthInput = {
  providerKey: string;
  status: string;
  lastHealthAt?: Date | string | null;
  lastError?: string | null;
  isFixture?: boolean;
  installationId?: string;
  capabilitiesJson?: unknown;
};

/**
 * Merge static registry + org installations into health center rows.
 */
export function buildConnectorRegistryRecords(
  feeds: LiveFeedRegistryEntry[],
  installs: InstallHealthInput[],
  now = new Date(),
): ConnectorRegistryRecord[] {
  const installByKey = new Map(installs.map((i) => [i.providerKey, i]));

  return feeds.map((f) => {
    const inst = installByKey.get(f.providerKey);
    const status = inst?.status ?? (f.isFixture ? 'connected' : 'not_configured');
    const online =
      status === 'connected' ||
      status === 'syncing' ||
      (f.isFixture && status !== 'disabled');
    const lastHealth = inst?.lastHealthAt
      ? new Date(inst.lastHealthAt).toISOString()
      : null;
    const lagMs = lastHealth ? now.getTime() - new Date(lastHealth).getTime() : null;
    const sync: ConnectorRegistryRecord['synchronizationStatus'] = !lastHealth
      ? f.isFixture
        ? 'healthy'
        : 'never'
      : lagMs != null && lagMs > 24 * 3600_000
        ? 'lagging'
        : /unhealthy|failed/i.test(status)
          ? 'failed'
          : online
            ? 'healthy'
            : 'idle';

    const tech = f.capabilities;
    const business = businessCapabilitiesFromTechnical(tech);
    const webhooks = tech.includes('webhooks') || tech.includes('receiveWebhooks') || tech.includes('notifications')
      ? ['orders/create', 'inventory/update', 'app/uninstalled']
      : [];

    const oauthStatus: ConnectorRegistryRecord['oauthStatus'] =
      f.authMode === 'none'
        ? 'n_a'
        : status === 'connected'
          ? 'valid'
          : status === 'authorization_expired'
            ? 'expired'
            : status === 'credentials_required' || status === 'not_configured'
              ? 'not_started'
              : 'unknown';

    // Deterministic latency: fixture local path ~8ms; live uses age-capped lag, never random
    const latencyMs =
      f.isFixture && online
        ? 8
        : online && lastHealth
          ? Math.min(lagMs ?? 0, 5000)
          : null;

    return {
      providerKey: f.providerKey,
      vendor: vendorFromKey(f.providerKey, f.displayName),
      displayName: f.displayName,
      connectorType: f.family,
      domain: domainForFamily(f.family),
      authenticationMethod: f.authMode,
      oauthStatus,
      permissions: tech,
      apiVersion: f.apiVersion,
      supportedCapabilities: business,
      technicalCapabilities: tech,
      webhookSubscriptions: webhooks,
      pollingStrategy: webhooks.length
        ? 'webhook_primary'
        : f.isFixture
          ? 'none'
          : 'interval',
      rateLimits: {
        notes: f.isFixture ? 'Unlimited local fixture' : 'Respect provider rate limits',
      },
      healthStatus: status,
      online,
      latencyMs: f.isFixture && online ? 8 : latencyMs,
      synchronizationStatus: sync,
      retryPolicy: { maxAttempts: 5, backoff: 'exponential_jitter' },
      errorHistory: inst?.lastError
        ? [{ at: lastHealth ?? now.toISOString(), message: inst.lastError }]
        : [],
      observability: {
        throughputPerHour: f.isFixture && online ? 120 : 0,
        errorRate: /unhealthy|failed/i.test(status) ? 0.4 : 0,
        retryCount: inst?.lastError ? 1 : 0,
        lastSuccessAt: online ? lastHealth ?? (f.isFixture ? now.toISOString() : null) : null,
        webhookHealth: webhooks.length
          ? online
            ? 'ok'
            : 'down'
          : 'unsupported',
        apiQuotaUtilization: null,
      },
      isFixture: f.isFixture,
      docsUrl: f.docsUrl,
      notes: f.notes,
      installationId: inst?.installationId ?? null,
      orgStatus: inst?.status ?? null,
    };
  });
}

function vendorFromKey(key: string, displayName: string): string {
  const k = key.toLowerCase();
  if (k.includes('shopify')) return 'Shopify';
  if (k.includes('amazon')) return 'Amazon';
  if (k.includes('ebay')) return 'eBay';
  if (k.includes('woo')) return 'WooCommerce';
  if (k.includes('bigcommerce')) return 'BigCommerce';
  if (k.includes('alibaba')) return 'Alibaba';
  if (k.includes('aliexpress')) return 'AliExpress';
  if (k.includes('faire')) return 'Faire';
  if (k.includes('stripe')) return 'Stripe';
  if (k.includes('paypal')) return 'PayPal';
  if (k.includes('shipstation')) return 'ShipStation';
  if (k.includes('easypost')) return 'EasyPost';
  if (k.includes('dhl')) return 'DHL';
  if (k.includes('fedex')) return 'FedEx';
  if (k.includes('ups')) return 'UPS';
  if (k.includes('google')) return 'Google';
  if (k.includes('meta') || k.includes('facebook')) return 'Meta';
  if (k.includes('tiktok')) return 'TikTok';
  if (k.includes('posthog')) return 'PostHog';
  if (k.includes('mixpanel')) return 'Mixpanel';
  if (k.includes('quickbooks')) return 'Intuit';
  if (k.includes('xero')) return 'Xero';
  if (k.includes('prometheus')) return 'Prometheus';
  if (k.includes('grafana')) return 'Grafana';
  if (k.includes('otel') || k.includes('opentelemetry')) return 'OpenTelemetry';
  if (k.includes('sentry')) return 'Sentry';
  if (k.includes('fixture')) return 'TradeOps Fixture';
  return displayName.split(' ')[0] ?? key;
}

export function buildConnectorHealthCenter(
  records: ConnectorRegistryRecord[],
): ConnectorHealthCenter {
  const fixtures = records.filter((r) => r.isFixture).length;
  const liveConnected = records.filter((r) => !r.isFixture && r.online).length;
  const needsCredentials = records.filter(
    (r) =>
      !r.isFixture &&
      (r.healthStatus === 'not_configured' ||
        r.healthStatus === 'credentials_required' ||
        r.oauthStatus === 'not_started'),
  ).length;
  const unhealthy = records.filter(
    (r) => /unhealthy|failed|degraded/i.test(r.healthStatus),
  ).length;
  const online = records.filter((r) => r.online).length;
  const latencies = records
    .map((r) => r.latencyMs)
    .filter((n): n is number => typeof n === 'number');
  const avgLatencyMs =
    latencies.length === 0
      ? null
      : Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);

  const byDomain = OPERATIONAL_DOMAINS.map((d) => ({
    domain: d.id,
    label: d.label,
    connectors: records.filter((r) => r.domain === d.id),
  })).filter((d) => d.connectors.length > 0);

  return {
    summary: {
      total: records.length,
      online,
      offline: records.length - online,
      fixtures,
      liveConnected,
      needsCredentials,
      unhealthy,
      webhookOk: records.filter((r) => r.observability.webhookHealth === 'ok').length,
      avgLatencyMs,
    },
    byDomain,
    connectors: records,
    capabilities: BUSINESS_CAPABILITY_CATALOG,
    honesty: {
      note: 'Registry lists intended providers and capabilities. Live execution requires OAuth/API keys and healthy status. Fixture connectors never count as live marketplaces.',
    },
    computedAt: new Date().toISOString(),
  };
}

/**
 * Resolve which provider(s) should fulfill a business capability.
 */
export function resolveCapability(
  ads: CapabilityAdvertisement[],
  capability: BusinessCapability,
  options?: { preferLive?: boolean },
) {
  const ranked = selectProvidersForCapabilities(ads, [capability], {
    preferLive: options?.preferLive ?? true,
    excludeUnhealthy: true,
  });
  return {
    capability,
    label:
      BUSINESS_CAPABILITY_CATALOG.find((c) => c.id === capability)?.label ?? capability,
    ranked,
    selected: ranked[0] ?? null,
    note: ranked[0]
      ? `Capability "${capability}" → provider ${ranked[0].providerKey} (score ${ranked[0].score})`
      : `No healthy provider advertises ${capability}`,
  };
}

export function registryFromLiveFeeds(): LiveFeedRegistryEntry[] {
  return listLiveFeeds();
}

/** Standardized business events emitted onto the Event Bus */
export const OPS_BUSINESS_EVENTS = [
  'ProductCreated',
  'OrderCreated',
  'InventoryUpdated',
  'InventoryChanged',
  'SupplierUpdated',
  'ShipmentDelayed',
  'PaymentSucceeded',
  'PaymentFailed',
  'RefundIssued',
  'RefundCreated',
  'CampaignPaused',
  'ListingPublished',
  'ConnectorDisconnected',
  'ConnectorConnected',
  'SubscriptionRenewed',
  'WebhookReceived',
  'SyncCompleted',
  'SyncFailed',
  'QuotaWarning',
] as const;

export type OpsBusinessEvent = (typeof OPS_BUSINESS_EVENTS)[number];
