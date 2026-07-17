/**
 * Production connector catalog — capability-oriented descriptors.
 * Live HTTP only runs when credentials resolve; never claim connected without auth.
 */

import type { BusinessCapability } from './business-capabilities';
import type { ConnectorFamily, ConnectorStatus } from './types';
import type { OperationalDomain } from './ops-center';
import { domainForFamily } from './ops-center';

export type AuthMethod =
  | 'oauth2'
  | 'api_key'
  | 'basic'
  | 'none'
  | 'approval_required'
  | 'client_credentials';

export type ProductionConnectorCategory =
  | ConnectorFamily
  | 'accounting'
  | 'observability'
  | 'ai'
  | 'tax'
  | 'search'
  | 'currency';

export type ProductionConnectorDescriptor = {
  id: string;
  provider: string;
  displayName: string;
  category: ProductionConnectorCategory;
  domain: OperationalDomain;
  authMethod: AuthMethod;
  apiVersion: string;
  docsUrl: string;
  /** Env vars that must be non-empty for live status */
  credentialEnvKeys: string[];
  scopes: string[];
  businessCapabilities: BusinessCapability[];
  technicalCapabilities: string[];
  webhookTopics: string[];
  pollingStrategy: 'none' | 'interval' | 'adaptive' | 'webhook_primary';
  syncIntervalSeconds: number;
  rateLimitRpm?: number;
  isFixture: false;
};

const C = (partial: Omit<ProductionConnectorDescriptor, 'isFixture' | 'domain'> & {
  domain?: ProductionConnectorDescriptor['domain'];
  family?: ConnectorFamily;
}): ProductionConnectorDescriptor => ({
  isFixture: false,
  domain:
    partial.domain ??
    domainForFamily(
      partial.category === 'accounting'
        ? 'accounting'
        : partial.category === 'observability'
          ? 'observability'
          : partial.category === 'ai'
            ? 'ai'
            : (partial.category as string),
    ),
  ...partial,
});

/**
 * Full production connector ecosystem (registry). Implementations are credential-gated.
 */
export const PRODUCTION_CONNECTORS: ProductionConnectorDescriptor[] = [
  // Commerce
  C({
    id: 'shopify-graphql-admin',
    provider: 'Shopify',
    displayName: 'Shopify Admin GraphQL',
    category: 'storefront',
    authMethod: 'oauth2',
    apiVersion: '2025-01',
    docsUrl: 'https://shopify.dev/docs/api/admin-graphql',
    credentialEnvKeys: ['SHOPIFY_SHOP_DOMAIN', 'SHOPIFY_ACCESS_TOKEN'],
    scopes: ['read_products', 'write_products', 'read_orders', 'read_inventory'],
    businessCapabilities: [
      'discover_products',
      'prepare_listing',
      'publish_listing',
      'synchronize_inventory',
      'read_orders',
      'receive_webhooks',
    ],
    technicalCapabilities: ['products', 'orders', 'inventory', 'fulfillment', 'webhooks', 'customers'],
    webhookTopics: ['orders/create', 'orders/updated', 'products/update', 'inventory_levels/update'],
    pollingStrategy: 'webhook_primary',
    syncIntervalSeconds: 300,
    rateLimitRpm: 40,
  }),
  C({
    id: 'amazon-sp-api',
    provider: 'Amazon',
    displayName: 'Amazon Selling Partner API',
    category: 'marketplace',
    authMethod: 'oauth2',
    apiVersion: '2024-01',
    docsUrl: 'https://developer-docs.amazon.com/sp-api/',
    credentialEnvKeys: ['AMAZON_SP_CLIENT_ID', 'AMAZON_SP_CLIENT_SECRET', 'AMAZON_SP_REFRESH_TOKEN'],
    scopes: ['sellingpartnerapi'],
    businessCapabilities: [
      'discover_products',
      'publish_listing',
      'read_orders',
      'synchronize_inventory',
      'reconcile_payments',
      'receive_webhooks',
    ],
    technicalCapabilities: ['listings', 'orders', 'reports', 'payments', 'shipments', 'notifications'],
    webhookTopics: ['ORDER_CHANGE', 'LISTINGS_ITEM_STATUS_CHANGE'],
    pollingStrategy: 'adaptive',
    syncIntervalSeconds: 600,
  }),
  C({
    id: 'ebay-sell',
    provider: 'eBay',
    displayName: 'eBay Sell APIs',
    category: 'marketplace',
    authMethod: 'oauth2',
    apiVersion: 'v1',
    docsUrl: 'https://developer.ebay.com/develop',
    credentialEnvKeys: ['EBAY_ACCESS_TOKEN'],
    scopes: ['https://api.ebay.com/oauth/api_scope/sell.inventory'],
    businessCapabilities: [
      'publish_listing',
      'synchronize_inventory',
      'read_orders',
      'monitor_fulfillment',
    ],
    technicalCapabilities: ['inventory', 'orders', 'fulfillment', 'analytics'],
    webhookTopics: [],
    pollingStrategy: 'interval',
    syncIntervalSeconds: 900,
  }),
  C({
    id: 'woocommerce-rest',
    provider: 'WooCommerce',
    displayName: 'WooCommerce REST',
    category: 'storefront',
    authMethod: 'api_key',
    apiVersion: 'v3',
    docsUrl: 'https://woocommerce.github.io/woocommerce-rest-api-docs/',
    credentialEnvKeys: ['WOOCOMMERCE_URL', 'WOOCOMMERCE_CONSUMER_KEY', 'WOOCOMMERCE_CONSUMER_SECRET'],
    scopes: ['read', 'write'],
    businessCapabilities: [
      'discover_products',
      'read_orders',
      'synchronize_inventory',
      'receive_webhooks',
    ],
    technicalCapabilities: ['products', 'orders', 'inventory', 'customers', 'webhooks'],
    webhookTopics: ['order.created', 'product.updated'],
    pollingStrategy: 'webhook_primary',
    syncIntervalSeconds: 600,
  }),
  C({
    id: 'bigcommerce-rest',
    provider: 'BigCommerce',
    displayName: 'BigCommerce REST',
    category: 'storefront',
    authMethod: 'oauth2',
    apiVersion: 'v3',
    docsUrl: 'https://developer.bigcommerce.com/docs/rest-management',
    credentialEnvKeys: ['BIGCOMMERCE_STORE_HASH', 'BIGCOMMERCE_ACCESS_TOKEN'],
    scopes: ['store_v2_products', 'store_v2_orders'],
    businessCapabilities: [
      'discover_products',
      'read_orders',
      'synchronize_inventory',
      'receive_webhooks',
    ],
    technicalCapabilities: ['products', 'orders', 'inventory', 'fulfillment', 'webhooks'],
    webhookTopics: ['store/order/created'],
    pollingStrategy: 'webhook_primary',
    syncIntervalSeconds: 600,
  }),
  // Suppliers
  C({
    id: 'alibaba-open',
    provider: 'Alibaba',
    displayName: 'Alibaba.com Open Platform',
    category: 'supplier',
    domain: 'supplier_intelligence',
    authMethod: 'oauth2',
    apiVersion: 'v1',
    docsUrl: 'https://open.alibaba.com/',
    credentialEnvKeys: ['ALIBABA_APP_KEY', 'ALIBABA_APP_SECRET'],
    scopes: ['product', 'order'],
    businessCapabilities: ['compare_suppliers', 'discover_products', 'calculate_landed_cost'],
    technicalCapabilities: ['products', 'quotes', 'orders', 'logistics'],
    webhookTopics: [],
    pollingStrategy: 'interval',
    syncIntervalSeconds: 3600,
  }),
  C({
    id: 'aliexpress-dropshipping',
    provider: 'AliExpress',
    displayName: 'AliExpress Dropshipping',
    category: 'supplier',
    domain: 'supplier_intelligence',
    authMethod: 'oauth2',
    apiVersion: 'v1',
    docsUrl: 'https://openservice.aliexpress.com/',
    credentialEnvKeys: ['ALIEXPRESS_APP_KEY', 'ALIEXPRESS_APP_SECRET'],
    scopes: ['dropshipping'],
    businessCapabilities: [
      'discover_products',
      'compare_suppliers',
      'submit_supplier_purchase',
      'monitor_fulfillment',
    ],
    technicalCapabilities: ['products', 'orders', 'logistics', 'tracking'],
    webhookTopics: [],
    pollingStrategy: 'interval',
    syncIntervalSeconds: 1800,
  }),
  C({
    id: 'inventory-source',
    provider: 'Inventory Source',
    displayName: 'Inventory Source',
    category: 'supplier',
    domain: 'supplier_intelligence',
    authMethod: 'api_key',
    apiVersion: 'v1',
    docsUrl: 'https://www.inventorysource.com/',
    credentialEnvKeys: ['INVENTORY_SOURCE_API_KEY'],
    scopes: ['catalog'],
    businessCapabilities: ['discover_products', 'synchronize_inventory', 'compare_suppliers'],
    technicalCapabilities: ['products', 'inventory', 'pricing'],
    webhookTopics: [],
    pollingStrategy: 'interval',
    syncIntervalSeconds: 3600,
  }),
  // Payments
  C({
    id: 'stripe-api',
    provider: 'Stripe',
    displayName: 'Stripe',
    category: 'payment',
    domain: 'payments',
    authMethod: 'api_key',
    apiVersion: '2024-11-20',
    docsUrl: 'https://docs.stripe.com/api',
    credentialEnvKeys: ['STRIPE_SECRET_KEY'],
    scopes: ['read_write'],
    businessCapabilities: [
      'read_payments',
      'reconcile_payments',
      'receive_webhooks',
    ],
    technicalCapabilities: [
      'payments',
      'subscriptions',
      'invoices',
      'refunds',
      'payouts',
      'disputes',
      'webhooks',
    ],
    webhookTopics: [
      'payment_intent.succeeded',
      'charge.refunded',
      'payout.paid',
      'charge.dispute.created',
    ],
    pollingStrategy: 'webhook_primary',
    syncIntervalSeconds: 900,
    rateLimitRpm: 100,
  }),
  C({
    id: 'paypal-rest',
    provider: 'PayPal',
    displayName: 'PayPal REST',
    category: 'payment',
    domain: 'payments',
    authMethod: 'oauth2',
    apiVersion: 'v2',
    docsUrl: 'https://developer.paypal.com/docs/api/overview/',
    credentialEnvKeys: ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET'],
    scopes: ['openid'],
    businessCapabilities: ['read_payments', 'reconcile_payments', 'receive_webhooks'],
    technicalCapabilities: ['payments', 'orders', 'payouts', 'subscriptions', 'webhooks'],
    webhookTopics: ['PAYMENT.CAPTURE.COMPLETED', 'PAYMENT.CAPTURE.REFUNDED'],
    pollingStrategy: 'webhook_primary',
    syncIntervalSeconds: 900,
  }),
  C({
    id: 'square-api',
    provider: 'Square',
    displayName: 'Square',
    category: 'payment',
    domain: 'payments',
    authMethod: 'oauth2',
    apiVersion: '2024-01',
    docsUrl: 'https://developer.squareup.com/docs',
    credentialEnvKeys: ['SQUARE_ACCESS_TOKEN'],
    scopes: ['PAYMENTS_READ', 'ORDERS_READ'],
    businessCapabilities: ['read_payments', 'reconcile_payments', 'read_orders'],
    technicalCapabilities: ['payments', 'orders', 'refunds', 'webhooks'],
    webhookTopics: ['payment.created', 'refund.created'],
    pollingStrategy: 'webhook_primary',
    syncIntervalSeconds: 900,
  }),
  // Logistics
  C({
    id: 'easypost-api',
    provider: 'EasyPost',
    displayName: 'EasyPost',
    category: 'shipping',
    domain: 'logistics',
    authMethod: 'api_key',
    apiVersion: 'v2',
    docsUrl: 'https://docs.easypost.com/',
    credentialEnvKeys: ['EASYPOST_API_KEY'],
    scopes: ['shipments'],
    businessCapabilities: ['monitor_fulfillment', 'calculate_landed_cost', 'receive_webhooks'],
    technicalCapabilities: ['shipments', 'labels', 'tracking', 'rates', 'webhooks'],
    webhookTopics: ['tracker.updated'],
    pollingStrategy: 'webhook_primary',
    syncIntervalSeconds: 600,
  }),
  C({
    id: 'shipstation-api',
    provider: 'ShipStation',
    displayName: 'ShipStation',
    category: 'shipping',
    domain: 'logistics',
    authMethod: 'api_key',
    apiVersion: 'v1',
    docsUrl: 'https://www.shipstation.com/docs/api/',
    credentialEnvKeys: ['SHIPSTATION_API_KEY', 'SHIPSTATION_API_SECRET'],
    scopes: ['shipments'],
    businessCapabilities: ['monitor_fulfillment', 'receive_webhooks'],
    technicalCapabilities: ['shipments', 'labels', 'tracking', 'orders', 'webhooks'],
    webhookTopics: ['SHIP_NOTIFY'],
    pollingStrategy: 'webhook_primary',
    syncIntervalSeconds: 600,
  }),
  C({
    id: 'ups-api',
    provider: 'UPS',
    displayName: 'UPS',
    category: 'shipping',
    domain: 'logistics',
    authMethod: 'oauth2',
    apiVersion: 'v1',
    docsUrl: 'https://developer.ups.com/',
    credentialEnvKeys: ['UPS_CLIENT_ID', 'UPS_CLIENT_SECRET'],
    scopes: ['tracking'],
    businessCapabilities: ['monitor_fulfillment'],
    technicalCapabilities: ['shipments', 'tracking', 'rates'],
    webhookTopics: [],
    pollingStrategy: 'interval',
    syncIntervalSeconds: 1800,
  }),
  C({
    id: 'fedex-api',
    provider: 'FedEx',
    displayName: 'FedEx',
    category: 'shipping',
    domain: 'logistics',
    authMethod: 'oauth2',
    apiVersion: 'v1',
    docsUrl: 'https://developer.fedex.com/',
    credentialEnvKeys: ['FEDEX_CLIENT_ID', 'FEDEX_CLIENT_SECRET'],
    scopes: ['tracking'],
    businessCapabilities: ['monitor_fulfillment'],
    technicalCapabilities: ['shipments', 'tracking', 'rates'],
    webhookTopics: [],
    pollingStrategy: 'interval',
    syncIntervalSeconds: 1800,
  }),
  C({
    id: 'dhl-api',
    provider: 'DHL',
    displayName: 'DHL',
    category: 'shipping',
    domain: 'logistics',
    authMethod: 'api_key',
    apiVersion: 'v1',
    docsUrl: 'https://developer.dhl.com/',
    credentialEnvKeys: ['DHL_API_KEY'],
    scopes: ['tracking'],
    businessCapabilities: ['monitor_fulfillment'],
    technicalCapabilities: ['shipments', 'tracking', 'rates'],
    webhookTopics: [],
    pollingStrategy: 'interval',
    syncIntervalSeconds: 1800,
  }),
  C({
    id: 'usps-api',
    provider: 'USPS',
    displayName: 'USPS',
    category: 'shipping',
    domain: 'logistics',
    authMethod: 'oauth2',
    apiVersion: 'v3',
    docsUrl: 'https://developers.usps.com/',
    credentialEnvKeys: ['USPS_CLIENT_ID', 'USPS_CLIENT_SECRET'],
    scopes: ['tracking'],
    businessCapabilities: ['monitor_fulfillment'],
    technicalCapabilities: ['tracking', 'rates'],
    webhookTopics: [],
    pollingStrategy: 'interval',
    syncIntervalSeconds: 1800,
  }),
  C({
    id: 'canada-post-api',
    provider: 'Canada Post',
    displayName: 'Canada Post',
    category: 'shipping',
    domain: 'logistics',
    authMethod: 'basic',
    apiVersion: 'v8',
    docsUrl: 'https://www.canadapost-postescanada.ca/ac/support/api/',
    credentialEnvKeys: ['CANADA_POST_USERNAME', 'CANADA_POST_PASSWORD'],
    scopes: ['shipping'],
    businessCapabilities: ['monitor_fulfillment', 'calculate_landed_cost'],
    technicalCapabilities: ['shipments', 'tracking', 'rates'],
    webhookTopics: [],
    pollingStrategy: 'interval',
    syncIntervalSeconds: 1800,
  }),
  // Marketing
  C({
    id: 'google-ads',
    provider: 'Google',
    displayName: 'Google Ads',
    category: 'advertising',
    domain: 'marketing',
    authMethod: 'oauth2',
    apiVersion: 'v18',
    docsUrl: 'https://developers.google.com/google-ads/api/docs/start',
    credentialEnvKeys: ['GOOGLE_ADS_DEVELOPER_TOKEN', 'GOOGLE_ADS_REFRESH_TOKEN'],
    scopes: ['https://www.googleapis.com/auth/adwords'],
    businessCapabilities: ['generate_executive_insights'],
    technicalCapabilities: ['campaigns', 'reports', 'conversions', 'spend'],
    webhookTopics: [],
    pollingStrategy: 'interval',
    syncIntervalSeconds: 3600,
  }),
  C({
    id: 'meta-marketing',
    provider: 'Meta',
    displayName: 'Meta Marketing API',
    category: 'advertising',
    domain: 'marketing',
    authMethod: 'oauth2',
    apiVersion: 'v21.0',
    docsUrl: 'https://developers.facebook.com/docs/marketing-apis/',
    credentialEnvKeys: ['META_ACCESS_TOKEN', 'META_AD_ACCOUNT_ID'],
    scopes: ['ads_read'],
    businessCapabilities: ['generate_executive_insights'],
    technicalCapabilities: ['campaigns', 'ads', 'insights', 'spend'],
    webhookTopics: [],
    pollingStrategy: 'interval',
    syncIntervalSeconds: 3600,
  }),
  C({
    id: 'tiktok-ads',
    provider: 'TikTok',
    displayName: 'TikTok Marketing API',
    category: 'advertising',
    domain: 'marketing',
    authMethod: 'oauth2',
    apiVersion: 'v1.3',
    docsUrl: 'https://business-api.tiktok.com/portal/docs',
    credentialEnvKeys: ['TIKTOK_ACCESS_TOKEN', 'TIKTOK_ADVERTISER_ID'],
    scopes: ['ads.read'],
    businessCapabilities: ['generate_executive_insights'],
    technicalCapabilities: ['campaigns', 'ads', 'reports', 'spend'],
    webhookTopics: [],
    pollingStrategy: 'interval',
    syncIntervalSeconds: 3600,
  }),
  // Analytics
  C({
    id: 'google-analytics-4',
    provider: 'Google',
    displayName: 'Google Analytics 4',
    category: 'trend',
    domain: 'analytics',
    authMethod: 'oauth2',
    apiVersion: 'v1beta',
    docsUrl: 'https://developers.google.com/analytics/devguides/reporting/data/v1',
    credentialEnvKeys: ['GA4_PROPERTY_ID', 'GOOGLE_APPLICATION_CREDENTIALS'],
    scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
    businessCapabilities: ['generate_executive_insights', 'estimate_demand'],
    technicalCapabilities: ['sessions', 'funnels', 'events', 'conversions'],
    webhookTopics: [],
    pollingStrategy: 'interval',
    syncIntervalSeconds: 3600,
  }),
  C({
    id: 'posthog-api',
    provider: 'PostHog',
    displayName: 'PostHog',
    category: 'trend',
    domain: 'analytics',
    authMethod: 'api_key',
    apiVersion: 'v1',
    docsUrl: 'https://posthog.com/docs/api',
    credentialEnvKeys: ['POSTHOG_API_KEY', 'POSTHOG_HOST'],
    scopes: ['project'],
    businessCapabilities: ['generate_executive_insights', 'detect_exceptions'],
    technicalCapabilities: ['events', 'funnels', 'session_replay'],
    webhookTopics: [],
    pollingStrategy: 'interval',
    syncIntervalSeconds: 1800,
  }),
  C({
    id: 'mixpanel-api',
    provider: 'Mixpanel',
    displayName: 'Mixpanel',
    category: 'trend',
    domain: 'analytics',
    authMethod: 'api_key',
    apiVersion: '2.0',
    docsUrl: 'https://developer.mixpanel.com/reference/overview',
    credentialEnvKeys: ['MIXPANEL_PROJECT_TOKEN', 'MIXPANEL_API_SECRET'],
    scopes: ['export'],
    businessCapabilities: ['generate_executive_insights'],
    technicalCapabilities: ['events', 'funnels', 'cohorts'],
    webhookTopics: [],
    pollingStrategy: 'interval',
    syncIntervalSeconds: 3600,
  }),
  // Accounting
  C({
    id: 'quickbooks-online',
    provider: 'Intuit',
    displayName: 'QuickBooks Online',
    category: 'accounting',
    domain: 'accounting',
    authMethod: 'oauth2',
    apiVersion: 'v3',
    docsUrl: 'https://developer.intuit.com/app/developer/qbo/docs/get-started',
    credentialEnvKeys: ['QUICKBOOKS_ACCESS_TOKEN', 'QUICKBOOKS_REALM_ID'],
    scopes: ['com.intuit.quickbooks.accounting'],
    businessCapabilities: ['generate_executive_insights', 'reconcile_payments'],
    technicalCapabilities: ['invoices', 'expenses', 'payments', 'accounts'],
    webhookTopics: [],
    pollingStrategy: 'interval',
    syncIntervalSeconds: 3600,
  }),
  C({
    id: 'xero-api',
    provider: 'Xero',
    displayName: 'Xero',
    category: 'accounting',
    domain: 'accounting',
    authMethod: 'oauth2',
    apiVersion: 'v2',
    docsUrl: 'https://developer.xero.com/documentation/',
    credentialEnvKeys: ['XERO_ACCESS_TOKEN', 'XERO_TENANT_ID'],
    scopes: ['accounting.transactions'],
    businessCapabilities: ['generate_executive_insights', 'reconcile_payments'],
    technicalCapabilities: ['invoices', 'payments', 'accounts', 'webhooks'],
    webhookTopics: ['INVOICE.UPDATE'],
    pollingStrategy: 'webhook_primary',
    syncIntervalSeconds: 3600,
  }),
  // Search / product intelligence
  C({
    id: 'google-merchant',
    provider: 'Google',
    displayName: 'Google Merchant Center',
    category: 'marketplace',
    domain: 'commerce_platforms',
    authMethod: 'oauth2',
    apiVersion: 'v1',
    docsUrl: 'https://developers.google.com/merchant/api',
    credentialEnvKeys: ['GOOGLE_MERCHANT_ACCESS_TOKEN', 'GOOGLE_MERCHANT_ID'],
    scopes: ['https://www.googleapis.com/auth/content'],
    businessCapabilities: ['publish_listing', 'improve_seo', 'optimize_product_content'],
    technicalCapabilities: ['product_inputs', 'product_issues', 'data_sources', 'reports'],
    webhookTopics: [],
    pollingStrategy: 'interval',
    syncIntervalSeconds: 3600,
  }),
  C({
    id: 'keepa-api',
    provider: 'Keepa',
    displayName: 'Keepa',
    category: 'trend',
    domain: 'search_intelligence',
    authMethod: 'api_key',
    apiVersion: 'v1',
    docsUrl: 'https://keepa.com/#!discuss/t/api',
    credentialEnvKeys: ['KEEPA_API_KEY'],
    scopes: ['product'],
    businessCapabilities: ['estimate_demand', 'discover_products', 'generate_executive_insights'],
    technicalCapabilities: ['pricing', 'history', 'products'],
    webhookTopics: [],
    pollingStrategy: 'interval',
    syncIntervalSeconds: 7200,
  }),
  C({
    id: 'serpapi',
    provider: 'SerpAPI',
    displayName: 'SerpAPI',
    category: 'trend',
    domain: 'search_intelligence',
    authMethod: 'api_key',
    apiVersion: 'v1',
    docsUrl: 'https://serpapi.com/',
    credentialEnvKeys: ['SERPAPI_API_KEY'],
    scopes: ['search'],
    businessCapabilities: ['discover_products', 'estimate_demand', 'improve_seo'],
    technicalCapabilities: ['search', 'shopping', 'trends'],
    webhookTopics: [],
    pollingStrategy: 'none',
    syncIntervalSeconds: 0,
  }),
  // Tax / FX
  C({
    id: 'open-exchange-rates',
    provider: 'Open Exchange Rates',
    displayName: 'Open Exchange Rates',
    category: 'payment',
    domain: 'tax_currency',
    authMethod: 'api_key',
    apiVersion: 'v1',
    docsUrl: 'https://docs.openexchangerates.org/',
    credentialEnvKeys: ['OPENEXCHANGERATES_APP_ID'],
    scopes: ['latest'],
    businessCapabilities: ['calculate_landed_cost'],
    technicalCapabilities: ['fx', 'rates'],
    webhookTopics: [],
    pollingStrategy: 'interval',
    syncIntervalSeconds: 3600,
  }),
  C({
    id: 'avalara',
    provider: 'Avalara',
    displayName: 'Avalara AvaTax',
    category: 'tax',
    domain: 'tax_currency',
    authMethod: 'basic',
    apiVersion: 'v2',
    docsUrl: 'https://developer.avalara.com/',
    credentialEnvKeys: ['AVALARA_ACCOUNT_ID', 'AVALARA_LICENSE_KEY'],
    scopes: ['avatax'],
    businessCapabilities: ['calculate_landed_cost'],
    technicalCapabilities: ['tax', 'estimate'],
    webhookTopics: [],
    pollingStrategy: 'none',
    syncIntervalSeconds: 0,
  }),
  C({
    id: 'taxjar',
    provider: 'TaxJar',
    displayName: 'TaxJar',
    category: 'tax',
    domain: 'tax_currency',
    authMethod: 'api_key',
    apiVersion: 'v2',
    docsUrl: 'https://developers.taxjar.com/api/reference/',
    credentialEnvKeys: ['TAXJAR_API_KEY'],
    scopes: ['tax'],
    businessCapabilities: ['calculate_landed_cost'],
    technicalCapabilities: ['tax', 'rates'],
    webhookTopics: [],
    pollingStrategy: 'none',
    syncIntervalSeconds: 0,
  }),
  // AI providers (orchestration only — routing layer)
  C({
    id: 'openai',
    provider: 'OpenAI',
    displayName: 'OpenAI',
    category: 'ai',
    domain: 'ai_runtime',
    authMethod: 'api_key',
    apiVersion: 'v1',
    docsUrl: 'https://platform.openai.com/docs',
    credentialEnvKeys: ['OPENAI_API_KEY'],
    scopes: ['chat'],
    businessCapabilities: ['generate_executive_insights', 'optimize_product_content'],
    technicalCapabilities: ['chat', 'embeddings'],
    webhookTopics: [],
    pollingStrategy: 'none',
    syncIntervalSeconds: 0,
  }),
  C({
    id: 'anthropic',
    provider: 'Anthropic',
    displayName: 'Anthropic',
    category: 'ai',
    domain: 'ai_runtime',
    authMethod: 'api_key',
    apiVersion: 'v1',
    docsUrl: 'https://docs.anthropic.com/',
    credentialEnvKeys: ['ANTHROPIC_API_KEY'],
    scopes: ['messages'],
    businessCapabilities: ['generate_executive_insights', 'optimize_product_content'],
    technicalCapabilities: ['chat'],
    webhookTopics: [],
    pollingStrategy: 'none',
    syncIntervalSeconds: 0,
  }),
  C({
    id: 'google-gemini',
    provider: 'Google',
    displayName: 'Google Gemini',
    category: 'ai',
    domain: 'ai_runtime',
    authMethod: 'api_key',
    apiVersion: 'v1',
    docsUrl: 'https://ai.google.dev/docs',
    credentialEnvKeys: ['GOOGLE_AI_API_KEY'],
    scopes: ['generate'],
    businessCapabilities: ['generate_executive_insights'],
    technicalCapabilities: ['chat'],
    webhookTopics: [],
    pollingStrategy: 'none',
    syncIntervalSeconds: 0,
  }),
  C({
    id: 'xai',
    provider: 'xAI',
    displayName: 'xAI Grok',
    category: 'ai',
    domain: 'ai_runtime',
    authMethod: 'api_key',
    apiVersion: 'v1',
    docsUrl: 'https://docs.x.ai/',
    credentialEnvKeys: ['XAI_API_KEY'],
    scopes: ['chat'],
    businessCapabilities: ['generate_executive_insights'],
    technicalCapabilities: ['chat'],
    webhookTopics: [],
    pollingStrategy: 'none',
    syncIntervalSeconds: 0,
  }),
  C({
    id: 'mistral',
    provider: 'Mistral',
    displayName: 'Mistral AI',
    category: 'ai',
    domain: 'ai_runtime',
    authMethod: 'api_key',
    apiVersion: 'v1',
    docsUrl: 'https://docs.mistral.ai/',
    credentialEnvKeys: ['MISTRAL_API_KEY'],
    scopes: ['chat'],
    businessCapabilities: ['generate_executive_insights'],
    technicalCapabilities: ['chat'],
    webhookTopics: [],
    pollingStrategy: 'none',
    syncIntervalSeconds: 0,
  }),

  // Industrial / enterprise systems (registry-ready; HTTP adapters credential-gated later)
  C({
    id: 'sap-s4hana',
    provider: 'SAP',
    displayName: 'SAP S/4HANA',
    category: 'accounting',
    domain: 'accounting',
    authMethod: 'oauth2',
    apiVersion: 'v1',
    docsUrl: 'https://api.sap.com/',
    credentialEnvKeys: ['SAP_CLIENT_ID', 'SAP_CLIENT_SECRET', 'SAP_BASE_URL'],
    scopes: ['api'],
    businessCapabilities: [
      'synchronize_inventory',
      'read_orders',
      'reconcile_payments',
    ],
    technicalCapabilities: ['erp', 'materials', 'purchase_orders', 'inventory'],
    webhookTopics: [],
    pollingStrategy: 'interval',
    syncIntervalSeconds: 900,
  }),
  C({
    id: 'oracle-netsuite',
    provider: 'Oracle',
    displayName: 'Oracle NetSuite',
    category: 'accounting',
    domain: 'accounting',
    authMethod: 'oauth2',
    apiVersion: '2024.1',
    docsUrl: 'https://docs.oracle.com/en/cloud/saas/netsuite/',
    credentialEnvKeys: [
      'NETSUITE_ACCOUNT_ID',
      'NETSUITE_CONSUMER_KEY',
      'NETSUITE_TOKEN_ID',
    ],
    scopes: ['rest'],
    businessCapabilities: ['synchronize_inventory', 'read_orders', 'read_payments'],
    technicalCapabilities: ['erp', 'items', 'vendors', 'purchase_orders'],
    webhookTopics: [],
    pollingStrategy: 'interval',
    syncIntervalSeconds: 900,
  }),
  C({
    id: 'infor-csi',
    provider: 'Infor',
    displayName: 'Infor CloudSuite Industrial',
    category: 'accounting',
    domain: 'accounting',
    authMethod: 'oauth2',
    apiVersion: 'v1',
    docsUrl: 'https://docs.infor.com/',
    credentialEnvKeys: ['INFOR_CLIENT_ID', 'INFOR_CLIENT_SECRET', 'INFOR_TENANT'],
    scopes: ['api'],
    businessCapabilities: ['synchronize_inventory', 'read_orders'],
    technicalCapabilities: ['erp', 'bom', 'mro'],
    webhookTopics: [],
    pollingStrategy: 'interval',
    syncIntervalSeconds: 1200,
  }),
  C({
    id: 'salsify-pim',
    provider: 'Salsify',
    displayName: 'Salsify PIM',
    category: 'storefront',
    domain: 'commerce_platforms',
    authMethod: 'api_key',
    apiVersion: 'v1',
    docsUrl: 'https://developers.salsify.com/',
    credentialEnvKeys: ['SALSIFY_API_KEY', 'SALSIFY_ORG_ID'],
    scopes: ['products'],
    businessCapabilities: ['discover_products', 'optimize_product_content'],
    technicalCapabilities: ['pim', 'product_attributes', 'digital_assets'],
    webhookTopics: [],
    pollingStrategy: 'interval',
    syncIntervalSeconds: 600,
  }),
  C({
    id: 'akeneo-pim',
    provider: 'Akeneo',
    displayName: 'Akeneo PIM',
    category: 'storefront',
    domain: 'commerce_platforms',
    authMethod: 'oauth2',
    apiVersion: 'v1',
    docsUrl: 'https://api.akeneo.com/',
    credentialEnvKeys: ['AKENEO_CLIENT_ID', 'AKENEO_CLIENT_SECRET', 'AKENEO_BASE_URL'],
    scopes: ['products'],
    businessCapabilities: ['discover_products'],
    technicalCapabilities: ['pim', 'families', 'attributes'],
    webhookTopics: [],
    pollingStrategy: 'interval',
    syncIntervalSeconds: 600,
  }),
  C({
    id: 'ptc-windchill',
    provider: 'PTC',
    displayName: 'PTC Windchill PLM',
    category: 'storefront',
    domain: 'supplier_intelligence',
    authMethod: 'oauth2',
    apiVersion: 'v1',
    docsUrl: 'https://www.ptc.com/en/products/windchill',
    credentialEnvKeys: ['WINDCHILL_BASE_URL', 'WINDCHILL_USER', 'WINDCHILL_PASSWORD'],
    scopes: ['plm'],
    businessCapabilities: ['discover_products'],
    technicalCapabilities: ['plm', 'bom', 'cad_metadata'],
    webhookTopics: [],
    pollingStrategy: 'interval',
    syncIntervalSeconds: 1800,
  }),
  C({
    id: 'autodesk-forge',
    provider: 'Autodesk',
    displayName: 'Autodesk Platform Services (CAD)',
    category: 'storefront',
    domain: 'supplier_intelligence',
    authMethod: 'oauth2',
    apiVersion: 'v2',
    docsUrl: 'https://aps.autodesk.com/',
    credentialEnvKeys: ['AUTODESK_CLIENT_ID', 'AUTODESK_CLIENT_SECRET'],
    scopes: ['data:read'],
    businessCapabilities: ['discover_products'],
    technicalCapabilities: ['cad', 'drawings', 'viewer'],
    webhookTopics: [],
    pollingStrategy: 'none',
    syncIntervalSeconds: 0,
  }),
  C({
    id: 'manhattan-wms',
    provider: 'Manhattan Associates',
    displayName: 'Manhattan WMS',
    category: 'shipping',
    domain: 'logistics',
    authMethod: 'oauth2',
    apiVersion: 'v1',
    docsUrl: 'https://www.manh.com/',
    credentialEnvKeys: ['MANHATTAN_CLIENT_ID', 'MANHATTAN_CLIENT_SECRET'],
    scopes: ['wms'],
    businessCapabilities: ['synchronize_inventory', 'monitor_fulfillment'],
    technicalCapabilities: ['wms', 'inventory', 'shipments'],
    webhookTopics: [],
    pollingStrategy: 'interval',
    syncIntervalSeconds: 600,
  }),
];

export function listProductionConnectors(): ProductionConnectorDescriptor[] {
  return PRODUCTION_CONNECTORS;
}

export function getProductionConnector(
  id: string,
): ProductionConnectorDescriptor | undefined {
  return PRODUCTION_CONNECTORS.find((c) => c.id === id);
}

/**
 * Resolve live credential status from process env (server-side only).
 */
export function resolveCredentialStatus(
  connector: ProductionConnectorDescriptor,
  env: NodeJS.ProcessEnv = process.env,
): {
  ready: boolean;
  missingKeys: string[];
  status: ConnectorStatus;
  oauthStatus: 'not_started' | 'valid' | 'n_a' | 'unknown';
} {
  const missingKeys = connector.credentialEnvKeys.filter((k) => !env[k]?.trim());
  const ready = missingKeys.length === 0;
  return {
    ready,
    missingKeys,
    status: ready ? 'connected' : 'credentials_required',
    oauthStatus:
      connector.authMethod === 'none'
        ? 'n_a'
        : ready
          ? 'valid'
          : 'not_started',
  };
}

export type LiveConnectorRuntimeRecord = ProductionConnectorDescriptor & {
  status: ConnectorStatus;
  oauthStatus: string;
  missingKeys: string[];
  liveReady: boolean;
  lastSyncHint: string;
};

/**
 * Build runtime records for every production connector using process env credentials.
 * Never marks liveReady without all credential env keys present.
 */
export function listProductionRuntime(
  env: NodeJS.ProcessEnv = process.env,
): LiveConnectorRuntimeRecord[] {
  return PRODUCTION_CONNECTORS.map((c) => {
    const cred = resolveCredentialStatus(c, env);
    return {
      ...c,
      status: cred.status,
      oauthStatus: cred.oauthStatus,
      missingKeys: cred.missingKeys,
      liveReady: cred.ready,
      lastSyncHint: cred.ready
        ? 'Credentials present — run live sync / probe to refresh'
        : `Missing env: ${cred.missingKeys.join(', ') || 'unknown'}`,
    };
  });
}

/**
 * Install-status overlay from env for health center (no fabricated online).
 */
export function productionInstallOverlays(
  env: NodeJS.ProcessEnv = process.env,
): Array<{
  providerKey: string;
  status: string;
  isFixture: false;
  lastError: string | null;
  capabilitiesJson: string[];
}> {
  return listProductionRuntime(env).map((r) => ({
    providerKey: r.id,
    status: r.status,
    isFixture: false as const,
    lastError: r.liveReady
      ? null
      : r.missingKeys.length
        ? `credentials_required: ${r.missingKeys.join(',')}`
        : null,
    capabilitiesJson: r.technicalCapabilities,
  }));
}

/** Providers that have a live HTTP adapter implementation in @tradeops/connector-live-http */
export const LIVE_HTTP_IMPLEMENTED = new Set([
  'shopify-graphql-admin',
  'stripe-api',
  'open-exchange-rates',
  'woocommerce-rest',
  'easypost-api',
  'serpapi',
  'bigcommerce-rest',
  'ebay-sell',
  'paypal-rest',
  'shipstation-api',
  'keepa-api',
  'square-api',
]);

/**
 * Capability → preferred provider keys (AI Capability Registry).
 * Runtime resolves which connected provider fulfills a business capability.
 */
export const CAPABILITY_PROVIDER_MAP: Record<string, string[]> = {
  discover_products: [
    'shopify-graphql-admin',
    'woocommerce-rest',
    'amazon-sp-api',
    'serpapi',
    'keepa-api',
  ],
  publish_listing: [
    'shopify-graphql-admin',
    'amazon-sp-api',
    'ebay-sell',
    'google-merchant',
  ],
  synchronize_inventory: [
    'shopify-graphql-admin',
    'woocommerce-rest',
    'amazon-sp-api',
    'ebay-sell',
  ],
  read_orders: [
    'shopify-graphql-admin',
    'woocommerce-rest',
    'amazon-sp-api',
    'ebay-sell',
    'bigcommerce-rest',
  ],
  read_payments: ['stripe-api', 'paypal-rest', 'square-api'],
  reconcile_payments: ['stripe-api', 'paypal-rest', 'quickbooks-online', 'xero-api'],
  monitor_fulfillment: [
    'easypost-api',
    'shipstation-api',
    'ups-api',
    'fedex-api',
    'dhl-api',
    'usps-api',
  ],
  calculate_landed_cost: [
    'open-exchange-rates',
    'avalara',
    'taxjar',
    'easypost-api',
  ],
  generate_executive_insights: [
    'google-analytics-4',
    'posthog-api',
    'google-ads',
    'meta-marketing',
  ],
  receive_webhooks: [
    'shopify-graphql-admin',
    'stripe-api',
    'woocommerce-rest',
    'easypost-api',
  ],
};
