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

// ─── Expanded Ops Center registry (credential-gated until connected) ───────

registerLiveFeed({
  providerKey: 'woocommerce-rest',
  displayName: 'WooCommerce REST API',
  family: 'storefront',
  docsUrl: 'https://woocommerce.github.io/woocommerce-rest-api-docs/',
  apiVersion: 'v3',
  authMode: 'api_key',
  capabilities: ['products', 'inventory', 'orders', 'customers', 'webhooks'],
  isFixture: false,
  weekendAutomation: false,
  notes: 'Consumer key/secret over HTTPS; webhooks for order/product events.',
});

registerLiveFeed({
  providerKey: 'bigcommerce-rest',
  displayName: 'BigCommerce REST API',
  family: 'storefront',
  docsUrl: 'https://developer.bigcommerce.com/docs/rest-management',
  apiVersion: 'v3',
  authMode: 'oauth2',
  capabilities: ['products', 'inventory', 'orders', 'fulfillment', 'webhooks'],
  isFixture: false,
  weekendAutomation: false,
  notes: 'Store-level OAuth; prefer webhooks for catalog and order changes.',
});

registerLiveFeed({
  providerKey: 'alibaba-open',
  displayName: 'Alibaba.com Open Platform',
  family: 'supplier',
  docsUrl: 'https://open.alibaba.com/',
  apiVersion: 'v1',
  authMode: 'oauth2',
  capabilities: ['products', 'quotes', 'orders', 'logistics'],
  isFixture: false,
  weekendAutomation: false,
  notes: 'Supplier intelligence — quotes/MOQ require authorized partner apps.',
});

registerLiveFeed({
  providerKey: 'faire-api',
  displayName: 'Faire API',
  family: 'marketplace',
  docsUrl: 'https://faire.github.io/external-api-v2-docs/',
  apiVersion: 'v2',
  authMode: 'oauth2',
  capabilities: ['products', 'orders', 'inventory', 'brand'],
  isFixture: false,
  weekendAutomation: false,
  notes: 'Wholesale marketplace; brand/retailer authorization required.',
});

registerLiveFeed({
  providerKey: 'stripe-api',
  displayName: 'Stripe API',
  family: 'payment',
  docsUrl: 'https://docs.stripe.com/api',
  apiVersion: '2024-11-20.acacia',
  authMode: 'api_key',
  capabilities: ['payments', 'subscriptions', 'customers', 'webhooks', 'payouts', 'invoices'],
  isFixture: false,
  weekendAutomation: false,
  notes: 'SaaS billing + Connect patterns; never store raw card data. Webhook-first for payment state.',
});

registerLiveFeed({
  providerKey: 'paypal-rest',
  displayName: 'PayPal REST API',
  family: 'payment',
  docsUrl: 'https://developer.paypal.com/docs/api/overview/',
  apiVersion: 'v2',
  authMode: 'oauth2',
  capabilities: ['payments', 'orders', 'payouts', 'webhooks', 'subscriptions'],
  isFixture: false,
  weekendAutomation: false,
  notes: 'Channel/marketplace payouts; verify webhook signatures.',
});

registerLiveFeed({
  providerKey: 'shipstation-api',
  displayName: 'ShipStation API',
  family: 'shipping',
  docsUrl: 'https://www.shipstation.com/docs/api/',
  apiVersion: 'v1',
  authMode: 'api_key',
  capabilities: ['shipments', 'labels', 'tracking', 'orders', 'webhooks'],
  isFixture: false,
  weekendAutomation: false,
  notes: 'Multi-carrier shipping aggregation.',
});

registerLiveFeed({
  providerKey: 'easypost-api',
  displayName: 'EasyPost API',
  family: 'shipping',
  docsUrl: 'https://docs.easypost.com/',
  apiVersion: 'v2',
  authMode: 'api_key',
  capabilities: ['shipments', 'labels', 'tracking', 'rates', 'webhooks'],
  isFixture: false,
  weekendAutomation: false,
  notes: 'Carrier-agnostic labels and tracking webhooks.',
});

registerLiveFeed({
  providerKey: 'dhl-api',
  displayName: 'DHL APIs',
  family: 'shipping',
  docsUrl: 'https://developer.dhl.com/',
  apiVersion: 'v1',
  authMode: 'api_key',
  capabilities: ['shipments', 'tracking', 'rates'],
  isFixture: false,
  weekendAutomation: false,
  notes: 'Carrier-specific; often via aggregator in production.',
});

registerLiveFeed({
  providerKey: 'fedex-api',
  displayName: 'FedEx APIs',
  family: 'shipping',
  docsUrl: 'https://developer.fedex.com/',
  apiVersion: 'v1',
  authMode: 'oauth2',
  capabilities: ['shipments', 'tracking', 'rates'],
  isFixture: false,
  weekendAutomation: false,
  notes: 'OAuth2 carrier APIs; prefer ShipStation/EasyPost when multi-carrier.',
});

registerLiveFeed({
  providerKey: 'ups-api',
  displayName: 'UPS APIs',
  family: 'shipping',
  docsUrl: 'https://developer.ups.com/',
  apiVersion: 'v1',
  authMode: 'oauth2',
  capabilities: ['shipments', 'tracking', 'rates'],
  isFixture: false,
  weekendAutomation: false,
  notes: 'OAuth2 carrier APIs; prefer aggregator for multi-carrier ops.',
});

registerLiveFeed({
  providerKey: 'google-ads',
  displayName: 'Google Ads API',
  family: 'advertising',
  docsUrl: 'https://developers.google.com/google-ads/api/docs/start',
  apiVersion: 'v18',
  authMode: 'oauth2',
  capabilities: ['campaigns', 'reports', 'conversions', 'audiences'],
  isFixture: false,
  weekendAutomation: false,
  notes: 'Marketing domain; developer token + MCC access required.',
});

registerLiveFeed({
  providerKey: 'meta-marketing',
  displayName: 'Meta Marketing API',
  family: 'advertising',
  docsUrl: 'https://developers.facebook.com/docs/marketing-apis/',
  apiVersion: 'v21.0',
  authMode: 'oauth2',
  capabilities: ['campaigns', 'ads', 'insights', 'audiences'],
  isFixture: false,
  weekendAutomation: false,
  notes: 'Facebook/Instagram ads; app review for production scopes.',
});

registerLiveFeed({
  providerKey: 'tiktok-ads',
  displayName: 'TikTok Marketing API',
  family: 'advertising',
  docsUrl: 'https://business-api.tiktok.com/portal/docs',
  apiVersion: 'v1.3',
  authMode: 'oauth2',
  capabilities: ['campaigns', 'ads', 'reports', 'audiences'],
  isFixture: false,
  weekendAutomation: false,
  notes: 'Region-specific auth; marketing domain only.',
});

registerLiveFeed({
  providerKey: 'google-analytics-4',
  displayName: 'Google Analytics 4 Data API',
  family: 'trend',
  docsUrl: 'https://developers.google.com/analytics/devguides/reporting/data/v1',
  apiVersion: 'v1beta',
  authMode: 'oauth2',
  capabilities: ['analytics', 'reports', 'events'],
  isFixture: false,
  weekendAutomation: false,
  notes: 'Product analytics; property-level OAuth.',
});

registerLiveFeed({
  providerKey: 'posthog-api',
  displayName: 'PostHog API',
  family: 'trend',
  docsUrl: 'https://posthog.com/docs/api',
  apiVersion: 'v1',
  authMode: 'api_key',
  capabilities: ['analytics', 'events', 'feature_flags', 'session_replay'],
  isFixture: false,
  weekendAutomation: false,
  notes: 'Product analytics / feature flags.',
});

registerLiveFeed({
  providerKey: 'mixpanel-api',
  displayName: 'Mixpanel API',
  family: 'trend',
  docsUrl: 'https://developer.mixpanel.com/reference/overview',
  apiVersion: '2.0',
  authMode: 'api_key',
  capabilities: ['analytics', 'events', 'cohorts', 'reports'],
  isFixture: false,
  weekendAutomation: false,
  notes: 'Product analytics export/query.',
});

registerLiveFeed({
  providerKey: 'quickbooks-online',
  displayName: 'QuickBooks Online API',
  family: 'accounting',
  docsUrl: 'https://developer.intuit.com/app/developer/qbo/docs/get-started',
  apiVersion: 'v3',
  authMode: 'oauth2',
  capabilities: ['invoices', 'payments', 'customers', 'accounts'],
  isFixture: false,
  weekendAutomation: false,
  notes: 'Accounting books of record — never mix with channel payment truth.',
});

registerLiveFeed({
  providerKey: 'xero-api',
  displayName: 'Xero API',
  family: 'accounting',
  docsUrl: 'https://developer.xero.com/documentation/',
  apiVersion: 'v2',
  authMode: 'oauth2',
  capabilities: ['invoices', 'payments', 'contacts', 'accounts', 'webhooks'],
  isFixture: false,
  weekendAutomation: false,
  notes: 'Accounting domain; separate from commerce payout reconciliation.',
});

registerLiveFeed({
  providerKey: 'prometheus',
  displayName: 'Prometheus',
  family: 'observability',
  docsUrl: 'https://prometheus.io/docs/prometheus/latest/querying/api/',
  apiVersion: 'v1',
  authMode: 'none',
  capabilities: ['metrics', 'alerts'],
  isFixture: false,
  weekendAutomation: false,
  notes: 'Platform observability metrics scrape/query.',
});

registerLiveFeed({
  providerKey: 'grafana',
  displayName: 'Grafana',
  family: 'observability',
  docsUrl: 'https://grafana.com/docs/grafana/latest/developers/http_api/',
  apiVersion: 'v1',
  authMode: 'api_key',
  capabilities: ['dashboards', 'alerts', 'datasources'],
  isFixture: false,
  weekendAutomation: false,
  notes: 'Visualization and alert routing for ops metrics.',
});

registerLiveFeed({
  providerKey: 'opentelemetry-collector',
  displayName: 'OpenTelemetry Collector',
  family: 'observability',
  docsUrl: 'https://opentelemetry.io/docs/collector/',
  apiVersion: '1.0',
  authMode: 'none',
  capabilities: ['traces', 'metrics', 'logs'],
  isFixture: false,
  weekendAutomation: false,
  notes: 'OTLP ingest for end-to-end Commerce Case tracing.',
});

registerLiveFeed({
  providerKey: 'sentry',
  displayName: 'Sentry',
  family: 'observability',
  docsUrl: 'https://docs.sentry.io/api/',
  apiVersion: 'v0',
  authMode: 'api_key',
  capabilities: ['errors', 'performance', 'releases', 'alerts'],
  isFixture: false,
  weekendAutomation: false,
  notes: 'Error tracking and performance monitoring for TradeOps services.',
});

// ─── Production catalog completeness (currency, tax, search, AI, carriers) ───

registerLiveFeed({
  providerKey: 'inventory-source',
  displayName: 'Inventory Source',
  family: 'supplier',
  docsUrl: 'https://www.inventorysource.com/',
  apiVersion: 'v1',
  authMode: 'api_key',
  capabilities: ['products', 'inventory', 'pricing'],
  isFixture: false,
  weekendAutomation: false,
  notes: 'Supplier catalog aggregation — API key gated.',
});

registerLiveFeed({
  providerKey: 'square-api',
  displayName: 'Square API',
  family: 'payment',
  docsUrl: 'https://developer.squareup.com/docs',
  apiVersion: '2024-01',
  authMode: 'oauth2',
  capabilities: ['payments', 'orders', 'refunds', 'webhooks'],
  isFixture: false,
  weekendAutomation: false,
  notes: 'Channel payments; OAuth required for production.',
});

registerLiveFeed({
  providerKey: 'usps-api',
  displayName: 'USPS APIs',
  family: 'shipping',
  docsUrl: 'https://developers.usps.com/',
  apiVersion: 'v3',
  authMode: 'oauth2',
  capabilities: ['tracking', 'rates'],
  isFixture: false,
  weekendAutomation: false,
  notes: 'USPS OAuth; prefer aggregator for multi-carrier.',
});

registerLiveFeed({
  providerKey: 'canada-post-api',
  displayName: 'Canada Post API',
  family: 'shipping',
  docsUrl: 'https://www.canadapost-postescanada.ca/ac/support/api/',
  apiVersion: 'v8',
  authMode: 'api_key',
  capabilities: ['shipments', 'tracking', 'rates'],
  isFixture: false,
  weekendAutomation: false,
  notes: 'Canada Post shipping; basic auth credentials.',
});

registerLiveFeed({
  providerKey: 'open-exchange-rates',
  displayName: 'Open Exchange Rates',
  family: 'payment',
  docsUrl: 'https://docs.openexchangerates.org/',
  apiVersion: 'v1',
  authMode: 'api_key',
  capabilities: ['fx', 'rates'],
  isFixture: false,
  weekendAutomation: false,
  notes: 'FX table for landed cost — never fabricate rates.',
});

registerLiveFeed({
  providerKey: 'avalara',
  displayName: 'Avalara AvaTax',
  family: 'tax',
  docsUrl: 'https://developer.avalara.com/',
  apiVersion: 'v2',
  authMode: 'api_key',
  capabilities: ['tax', 'estimate'],
  isFixture: false,
  weekendAutomation: false,
  notes: 'Tax estimation — requires Avalara account credentials.',
});

registerLiveFeed({
  providerKey: 'taxjar',
  displayName: 'TaxJar',
  family: 'tax',
  docsUrl: 'https://developers.taxjar.com/api/reference/',
  apiVersion: 'v2',
  authMode: 'api_key',
  capabilities: ['tax', 'rates'],
  isFixture: false,
  weekendAutomation: false,
  notes: 'US sales tax rates and estimates.',
});

registerLiveFeed({
  providerKey: 'keepa-api',
  displayName: 'Keepa',
  family: 'trend',
  docsUrl: 'https://keepa.com/#!discuss/t/api',
  apiVersion: 'v1',
  authMode: 'api_key',
  capabilities: ['pricing', 'history', 'products'],
  isFixture: false,
  weekendAutomation: false,
  notes: 'Amazon pricing intelligence — token-gated.',
});

registerLiveFeed({
  providerKey: 'serpapi',
  displayName: 'SerpAPI',
  family: 'trend',
  docsUrl: 'https://serpapi.com/',
  apiVersion: 'v1',
  authMode: 'api_key',
  capabilities: ['search', 'shopping', 'trends'],
  isFixture: false,
  weekendAutomation: false,
  notes: 'SERP / shopping enrichment — never scrape Google directly.',
});

registerLiveFeed({
  providerKey: 'openai',
  displayName: 'OpenAI',
  family: 'ai',
  docsUrl: 'https://platform.openai.com/docs',
  apiVersion: 'v1',
  authMode: 'api_key',
  capabilities: ['chat', 'embeddings'],
  isFixture: false,
  weekendAutomation: false,
  notes: 'AI Runtime provider — routed via Capability Registry, not vendor REST from UI.',
});

registerLiveFeed({
  providerKey: 'anthropic',
  displayName: 'Anthropic',
  family: 'ai',
  docsUrl: 'https://docs.anthropic.com/',
  apiVersion: 'v1',
  authMode: 'api_key',
  capabilities: ['chat'],
  isFixture: false,
  weekendAutomation: false,
  notes: 'AI Runtime provider.',
});

registerLiveFeed({
  providerKey: 'google-gemini',
  displayName: 'Google Gemini',
  family: 'ai',
  docsUrl: 'https://ai.google.dev/docs',
  apiVersion: 'v1',
  authMode: 'api_key',
  capabilities: ['chat'],
  isFixture: false,
  weekendAutomation: false,
  notes: 'AI Runtime provider.',
});

registerLiveFeed({
  providerKey: 'xai',
  displayName: 'xAI Grok',
  family: 'ai',
  docsUrl: 'https://docs.x.ai/',
  apiVersion: 'v1',
  authMode: 'api_key',
  capabilities: ['chat'],
  isFixture: false,
  weekendAutomation: false,
  notes: 'AI Runtime provider (preferred for SpaceXAI / Grok paths).',
});

registerLiveFeed({
  providerKey: 'mistral',
  displayName: 'Mistral AI',
  family: 'ai',
  docsUrl: 'https://docs.mistral.ai/',
  apiVersion: 'v1',
  authMode: 'api_key',
  capabilities: ['chat'],
  isFixture: false,
  weekendAutomation: false,
  notes: 'AI Runtime provider.',
});

