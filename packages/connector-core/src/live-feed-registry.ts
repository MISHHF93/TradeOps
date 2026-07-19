/**
 * Active connector registry — implementation truth only.
 *
 * maturity:
 *  - operational: live adapter exists; credentials may still be required
 *  - fixture: dev adapters with identical contracts
 *  - planned: roadmap only — never "connected", never executable
 *
 * Do not register speculative vendors as operational.
 */

export type LiveFeedAuthMode =
  | 'none'
  | 'oauth2'
  | 'api_key'
  | 'approval_required'
  | 'sandbox_only';

export type LiveFeedMaturity = 'operational' | 'fixture' | 'planned' | 'disabled';

export type LiveFeedRegistryEntry = {
  providerKey: string;
  displayName: string;
  family: string;
  docsUrl: string;
  apiVersion: string;
  authMode: LiveFeedAuthMode;
  capabilities: string[];
  isFixture: boolean;
  weekendAutomation: boolean;
  notes: string;
  /** Registry maturity — planned entries never claim live operations */
  maturity: LiveFeedMaturity;
};

const registry = new Map<string, LiveFeedRegistryEntry>();
const plannedOnly = new Map<string, LiveFeedRegistryEntry>();

export function registerLiveFeed(entry: LiveFeedRegistryEntry): void {
  if (entry.maturity === 'planned' || entry.maturity === 'disabled') {
    plannedOnly.set(entry.providerKey, entry);
    return;
  }
  registry.set(entry.providerKey, entry);
}

export function getLiveFeed(providerKey: string): LiveFeedRegistryEntry | undefined {
  return registry.get(providerKey) ?? plannedOnly.get(providerKey);
}

/** Active feeds only (operational + fixture) — used by health center / ops UI */
export function listLiveFeeds(): LiveFeedRegistryEntry[] {
  return [...registry.values()].sort((a, b) => a.providerKey.localeCompare(b.providerKey));
}

/** Planned/disabled roadmap entries — never executable */
export function listPlannedLiveFeeds(): LiveFeedRegistryEntry[] {
  return [...plannedOnly.values()].sort((a, b) => a.providerKey.localeCompare(b.providerKey));
}

export function listAllLiveFeedsIncludingPlanned(): LiveFeedRegistryEntry[] {
  return [...listLiveFeeds(), ...listPlannedLiveFeeds()];
}

// ─── OPERATIONAL + FIXTURE (active stack) ───────────────────────────────────

registerLiveFeed({
  providerKey: 'shopify-graphql-admin',
  displayName: 'Shopify Admin GraphQL',
  family: 'storefront',
  docsUrl: 'https://shopify.dev/docs/api/admin-graphql',
  apiVersion: '2025-01',
  authMode: 'oauth2',
  capabilities: ['products', 'inventory', 'orders', 'fulfillment', 'webhooks', 'customers'],
  isFixture: false,
  weekendAutomation: false,
  maturity: 'operational',
  notes: 'Primary live commerce vertical. GraphQL Admin only.',
});

registerLiveFeed({
  providerKey: 'fixture-supplier',
  displayName: 'Fixture Supplier (DEV)',
  family: 'supplier',
  docsUrl: 'https://localhost/tradeops/fixtures/supplier',
  apiVersion: '0.1.0',
  authMode: 'none',
  capabilities: ['searchProducts', 'readInventory', 'quoteShipping'],
  isFixture: true,
  weekendAutomation: false,
  maturity: 'fixture',
  notes: 'Development infrastructure — same contracts as live suppliers. Never label as live.',
});

registerLiveFeed({
  providerKey: 'fixture-marketplace',
  displayName: 'Fixture Marketplace (DEV)',
  family: 'marketplace',
  docsUrl: 'https://localhost/tradeops/fixtures/marketplace',
  apiVersion: '0.1.0',
  authMode: 'none',
  capabilities: ['createListing', 'readOrders', 'readFees'],
  isFixture: true,
  weekendAutomation: false,
  maturity: 'fixture',
  notes: 'Development infrastructure — same contracts as live marketplaces. Never label as live.',
});

registerLiveFeed({
  providerKey: 'stripe-api',
  displayName: 'Stripe Billing',
  family: 'payment',
  docsUrl: 'https://docs.stripe.com/api',
  apiVersion: '2024-11-20',
  authMode: 'api_key',
  capabilities: ['subscriptions', 'checkout', 'invoices', 'customers', 'webhooks'],
  isFixture: false,
  weekendAutomation: false,
  maturity: 'operational',
  notes: 'TradeOps SaaS billing only — not shopper channel custody.',
});

registerLiveFeed({
  providerKey: 'easypost-api',
  displayName: 'EasyPost',
  family: 'shipping',
  docsUrl: 'https://docs.easypost.com/',
  apiVersion: 'v2',
  authMode: 'api_key',
  capabilities: ['shipments', 'labels', 'tracking', 'rates', 'webhooks'],
  isFixture: false,
  weekendAutomation: false,
  maturity: 'operational',
  notes: 'Primary logistics provider (multi-carrier via EasyPost).',
});

registerLiveFeed({
  providerKey: 'tavily-search',
  displayName: 'Tavily Web Search',
  family: 'search',
  docsUrl: 'https://docs.tavily.com/',
  apiVersion: 'v1',
  authMode: 'api_key',
  capabilities: ['web_search', 'url_extract', 'documentation'],
  isFixture: false,
  weekendAutomation: false,
  maturity: 'operational',
  notes: 'Sole public web-search provider. Exposed as research.* capabilities only.',
});

registerLiveFeed({
  providerKey: 'cohere-ai',
  displayName: 'Cohere AI',
  family: 'ai',
  docsUrl: 'https://docs.cohere.com/',
  apiVersion: 'v2',
  authMode: 'api_key',
  capabilities: ['chat', 'embed', 'rerank'],
  isFixture: false,
  weekendAutomation: false,
  maturity: 'operational',
  notes: 'Sole active AI provider: Chat/Command, Embed, Rerank.',
});

registerLiveFeed({
  providerKey: 'google-analytics-4',
  displayName: 'Google Analytics 4',
  family: 'trend',
  docsUrl: 'https://developers.google.com/analytics/devguides/reporting/data/v1',
  apiVersion: 'v1beta',
  authMode: 'oauth2',
  capabilities: ['analytics', 'sessions', 'conversions', 'funnels'],
  isFixture: false,
  weekendAutomation: false,
  maturity: 'operational',
  notes: 'Tenant commerce analytics (OAuth property). Separate from product analytics.',
});

registerLiveFeed({
  providerKey: 'posthog-api',
  displayName: 'PostHog',
  family: 'trend',
  docsUrl: 'https://posthog.com/docs/api',
  apiVersion: 'v1',
  authMode: 'api_key',
  capabilities: ['product_analytics', 'events', 'feature_flags'],
  isFixture: false,
  weekendAutomation: false,
  maturity: 'operational',
  notes: 'TradeOps product usage analytics only — no sensitive tenant commerce PII.',
});

registerLiveFeed({
  providerKey: 'sentry',
  displayName: 'Sentry',
  family: 'observability',
  docsUrl: 'https://docs.sentry.io/',
  apiVersion: 'v0',
  authMode: 'api_key',
  capabilities: ['errors', 'performance'],
  isFixture: false,
  weekendAutomation: false,
  maturity: 'operational',
  notes: 'Application error tracking.',
});

registerLiveFeed({
  providerKey: 'opentelemetry-collector',
  displayName: 'OpenTelemetry',
  family: 'observability',
  docsUrl: 'https://opentelemetry.io/docs/',
  apiVersion: '1.0',
  authMode: 'none',
  capabilities: ['traces', 'metrics', 'logs'],
  isFixture: false,
  weekendAutomation: false,
  maturity: 'operational',
  notes: 'Traces/metrics abstraction. Grafana may visualize OTLP externally.',
});

// ─── PLANNED (roadmap only — not active) ────────────────────────────────────

const planned = (
  partial: Omit<LiveFeedRegistryEntry, 'maturity' | 'isFixture' | 'weekendAutomation'>,
): void => {
  registerLiveFeed({
    ...partial,
    isFixture: false,
    weekendAutomation: false,
    maturity: 'planned',
  });
};

planned({
  providerKey: 'amazon-sp-api',
  displayName: 'Amazon SP-API',
  family: 'marketplace',
  docsUrl: 'https://developer-docs.amazon.com/sp-api/',
  apiVersion: '2024-01',
  authMode: 'oauth2',
  capabilities: ['listings', 'orders'],
  notes: 'Planned marketplace extension — not operational.',
});

planned({
  providerKey: 'ebay-sell',
  displayName: 'eBay Sell APIs',
  family: 'marketplace',
  docsUrl: 'https://developer.ebay.com/develop',
  apiVersion: 'v1',
  authMode: 'oauth2',
  capabilities: ['inventory', 'orders'],
  notes: 'Planned marketplace extension — not operational.',
});

planned({
  providerKey: 'woocommerce-rest',
  displayName: 'WooCommerce REST',
  family: 'storefront',
  docsUrl: 'https://woocommerce.github.io/woocommerce-rest-api-docs/',
  apiVersion: 'v3',
  authMode: 'api_key',
  capabilities: ['products', 'orders'],
  notes: 'Planned storefront extension — not operational.',
});

planned({
  providerKey: 'bigcommerce-rest',
  displayName: 'BigCommerce REST',
  family: 'storefront',
  docsUrl: 'https://developer.bigcommerce.com/docs/rest-management',
  apiVersion: 'v3',
  authMode: 'oauth2',
  capabilities: ['products', 'orders'],
  notes: 'Planned storefront extension — not operational.',
});

planned({
  providerKey: 'google-merchant',
  displayName: 'Google Merchant Center',
  family: 'marketplace',
  docsUrl: 'https://developers.google.com/merchant/api',
  apiVersion: 'v1',
  authMode: 'oauth2',
  capabilities: ['product_inputs'],
  notes: 'Package exists for shadow weekend prep; not primary live vertical. Planned until OAuth productized.',
});

planned({
  providerKey: 'alibaba-open',
  displayName: 'Alibaba.com Open Platform',
  family: 'supplier',
  docsUrl: 'https://open.alibaba.com/',
  apiVersion: 'v1',
  authMode: 'oauth2',
  capabilities: ['products', 'quotes'],
  notes: 'Planned supplier network — not connected.',
});

planned({
  providerKey: 'aliexpress-dropshipping',
  displayName: 'AliExpress Dropshipping',
  family: 'supplier',
  docsUrl: 'https://openservice.aliexpress.com/',
  apiVersion: 'v1',
  authMode: 'oauth2',
  capabilities: ['products', 'orders'],
  notes: 'Planned supplier extension — not operational.',
});
