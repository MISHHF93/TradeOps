/**
 * Central live-feed / API registry for TradeOps.
 * Connectors declare official API capabilities; never claim live without auth success.
 */

export type LiveFeedAuthMode =
  | 'none'
  | 'oauth2'
  | 'api_key'
  | 'approval_required'
  | 'sandbox_only';

export type LiveFeedMode = 'development' | 'shadow' | 'controlled_live' | 'automated_live';

export type LiveFeedRegistryEntry = {
  providerKey: string;
  displayName: string;
  family: string;
  /** Official docs URL */
  docsUrl: string;
  apiVersion: string;
  authMode: LiveFeedAuthMode;
  capabilities: string[];
  /** When true, this entry is a local test adapter only */
  isFixture: boolean;
  /** Weekend automation supported */
  weekendAutomation: boolean;
  notes: string;
};

const registry = new Map<string, LiveFeedRegistryEntry>();

export function registerLiveFeed(entry: LiveFeedRegistryEntry): void {
  registry.set(entry.providerKey, entry);
}

export function getLiveFeed(providerKey: string): LiveFeedRegistryEntry | undefined {
  return registry.get(providerKey);
}

export function listLiveFeeds(): LiveFeedRegistryEntry[] {
  return [...registry.values()].sort((a, b) => a.providerKey.localeCompare(b.providerKey));
}

// Built-in registry entries (authorization still required for live use).
registerLiveFeed({
  providerKey: 'shopify-graphql-admin',
  displayName: 'Shopify GraphQL Admin API',
  family: 'storefront',
  docsUrl: 'https://shopify.dev/docs/api/admin-graphql',
  apiVersion: '2025-01',
  authMode: 'oauth2',
  capabilities: ['products', 'inventory', 'orders', 'fulfillment', 'webhooks', 'customers'],
  isFixture: false,
  weekendAutomation: false,
  notes: 'Prefer GraphQL Admin API for new public apps; do not base new work on legacy REST Admin API.',
});

registerLiveFeed({
  providerKey: 'amazon-sp-api',
  displayName: 'Amazon Selling Partner API',
  family: 'marketplace',
  docsUrl: 'https://developer-docs.amazon.com/sp-api/',
  apiVersion: '2024-01',
  authMode: 'oauth2',
  capabilities: ['listings', 'orders', 'reports', 'payments', 'shipments', 'notifications'],
  isFixture: false,
  weekendAutomation: false,
  notes: 'Requires seller authorization, app roles, and registered SP-API permissions.',
});

registerLiveFeed({
  providerKey: 'ebay-sell',
  displayName: 'eBay Sell APIs',
  family: 'marketplace',
  docsUrl: 'https://developer.ebay.com/develop',
  apiVersion: 'v1',
  authMode: 'oauth2',
  capabilities: ['inventory', 'orders', 'fulfillment', 'analytics', 'feeds'],
  isFixture: false,
  weekendAutomation: false,
  notes: 'Inventory Mapping API can recommend listings from existing product data.',
});

registerLiveFeed({
  providerKey: 'aliexpress-dropshipping',
  displayName: 'AliExpress Dropshipping APIs',
  family: 'supplier',
  docsUrl: 'https://openservice.aliexpress.com/',
  apiVersion: 'v1',
  authMode: 'oauth2',
  capabilities: ['products', 'orders', 'logistics', 'tracking', 'sales_sync'],
  isFixture: false,
  weekendAutomation: false,
  notes: 'Some operations only for authorized accounts / designated buyers.',
});

registerLiveFeed({
  providerKey: 'google-merchant',
  displayName: 'Google Merchant API',
  family: 'marketplace',
  docsUrl: 'https://developers.google.com/merchant/api',
  apiVersion: 'v1',
  authMode: 'oauth2',
  capabilities: [
    'product_inputs',
    'processed_products',
    'product_issues',
    'data_sources',
    'reports',
    'reviews',
  ],
  isFixture: false,
  weekendAutomation: true,
  notes:
    'Weekend automation prepares product feeds. Live posts require OAuth + Merchant Center ID. Preserve ProductInput vs processed Product separation.',
});

registerLiveFeed({
  providerKey: 'google-trends',
  displayName: 'Google Trends API',
  family: 'trend',
  docsUrl: 'https://developers.google.com/search/apis/trends',
  apiVersion: 'alpha',
  authMode: 'approval_required',
  capabilities: ['search_interest', 'geo_filters', 'time_aggregation'],
  isFixture: false,
  weekendAutomation: false,
  notes: 'Alpha access approval required. Do not use unofficial scraping as foundational dependency.',
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
  notes: 'Local development adapter only — never claim production API.',
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
  notes: 'Local development adapter only — never claim production API.',
});
