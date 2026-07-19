/**
 * Production connector catalog — approved operational stack only.
 * Planned providers live in docs/FUTURE_CONNECTORS.md and listPlannedLiveFeeds().
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
  credentialEnvKeys: string[];
  scopes: string[];
  businessCapabilities: BusinessCapability[];
  technicalCapabilities: string[];
  webhookTopics: string[];
  pollingStrategy: 'none' | 'interval' | 'adaptive' | 'webhook_primary';
  syncIntervalSeconds: number;
  rateLimitRpm?: number;
  isFixture: false;
  maturity: 'operational';
};

const C = (
  partial: Omit<ProductionConnectorDescriptor, 'isFixture' | 'domain' | 'maturity'> & {
    domain?: ProductionConnectorDescriptor['domain'];
  },
): ProductionConnectorDescriptor => ({
  isFixture: false,
  maturity: 'operational',
  domain:
    partial.domain ??
    domainForFamily(
      partial.category === 'observability'
        ? 'observability'
        : partial.category === 'ai'
          ? 'ai'
          : (partial.category as string),
    ),
  ...partial,
});

/** Approved operational production connectors (credentials still required for live). */
export const PRODUCTION_CONNECTORS: ProductionConnectorDescriptor[] = [
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
    id: 'stripe-api',
    provider: 'Stripe',
    displayName: 'Stripe Billing',
    category: 'payment',
    domain: 'payments',
    authMethod: 'api_key',
    apiVersion: '2024-11-20',
    docsUrl: 'https://docs.stripe.com/api',
    credentialEnvKeys: ['STRIPE_SECRET_KEY'],
    scopes: ['read_write'],
    businessCapabilities: ['read_payments', 'receive_webhooks'],
    technicalCapabilities: ['subscriptions', 'checkout', 'invoices', 'customers', 'webhooks'],
    webhookTopics: [
      'customer.subscription.updated',
      'invoice.paid',
      'checkout.session.completed',
    ],
    pollingStrategy: 'webhook_primary',
    syncIntervalSeconds: 900,
    rateLimitRpm: 100,
  }),
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
    id: 'tavily-search',
    provider: 'Tavily',
    displayName: 'Tavily Web Search',
    category: 'search',
    domain: 'search_intelligence',
    authMethod: 'api_key',
    apiVersion: 'v1',
    docsUrl: 'https://docs.tavily.com/',
    credentialEnvKeys: ['TAVILY_API_KEY'],
    scopes: ['search'],
    businessCapabilities: ['discover_products', 'generate_executive_insights'],
    technicalCapabilities: ['web_search', 'url_extract', 'documentation'],
    webhookTopics: [],
    pollingStrategy: 'none',
    syncIntervalSeconds: 0,
  }),
  C({
    id: 'cohere-ai',
    provider: 'Cohere',
    displayName: 'Cohere AI',
    category: 'ai',
    domain: 'ai_runtime',
    authMethod: 'api_key',
    apiVersion: 'v2',
    docsUrl: 'https://docs.cohere.com/',
    credentialEnvKeys: ['COHERE_API_KEY'],
    scopes: ['chat', 'embed', 'rerank'],
    businessCapabilities: ['generate_executive_insights', 'optimize_product_content'],
    technicalCapabilities: ['chat', 'embed', 'rerank'],
    webhookTopics: [],
    pollingStrategy: 'none',
    syncIntervalSeconds: 0,
  }),
  C({
    id: 'google-analytics-4',
    provider: 'Google',
    displayName: 'Google Analytics 4',
    category: 'trend',
    domain: 'analytics',
    authMethod: 'oauth2',
    apiVersion: 'v1beta',
    docsUrl: 'https://developers.google.com/analytics/devguides/reporting/data/v1',
    credentialEnvKeys: ['GA4_PROPERTY_ID'],
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
    credentialEnvKeys: ['POSTHOG_API_KEY'],
    scopes: ['project'],
    businessCapabilities: ['generate_executive_insights'],
    technicalCapabilities: ['events', 'feature_flags'],
    webhookTopics: [],
    pollingStrategy: 'interval',
    syncIntervalSeconds: 1800,
  }),
  C({
    id: 'sentry',
    provider: 'Sentry',
    displayName: 'Sentry',
    category: 'observability',
    domain: 'platform_observability',
    authMethod: 'api_key',
    apiVersion: 'v0',
    docsUrl: 'https://docs.sentry.io/',
    credentialEnvKeys: ['SENTRY_DSN'],
    scopes: ['errors'],
    businessCapabilities: ['detect_exceptions'],
    technicalCapabilities: ['errors', 'performance'],
    webhookTopics: [],
    pollingStrategy: 'none',
    syncIntervalSeconds: 0,
  }),
  C({
    id: 'opentelemetry-collector',
    provider: 'OpenTelemetry',
    displayName: 'OpenTelemetry',
    category: 'observability',
    domain: 'platform_observability',
    authMethod: 'none',
    apiVersion: '1.0',
    docsUrl: 'https://opentelemetry.io/docs/',
    credentialEnvKeys: [],
    scopes: ['otlp'],
    businessCapabilities: ['detect_exceptions'],
    technicalCapabilities: ['traces', 'metrics', 'logs'],
    webhookTopics: [],
    pollingStrategy: 'none',
    syncIntervalSeconds: 0,
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

export function resolveCredentialStatus(
  connector: ProductionConnectorDescriptor,
  env: NodeJS.ProcessEnv = process.env,
): {
  ready: boolean;
  missingKeys: string[];
  status: ConnectorStatus;
  oauthStatus: 'not_started' | 'valid' | 'n_a' | 'unknown';
} {
  // OpenTelemetry has no secrets — always "configured" when present in stack
  if (connector.credentialEnvKeys.length === 0) {
    return {
      ready: true,
      missingKeys: [],
      status: 'connected',
      oauthStatus: 'n_a',
    };
  }
  const missingKeys = connector.credentialEnvKeys.filter((k) => !env[k]?.trim());
  // Cohere accepts CO_API_KEY alias
  if (connector.id === 'cohere-ai' && missingKeys.includes('COHERE_API_KEY') && env.CO_API_KEY?.trim()) {
    return {
      ready: true,
      missingKeys: [],
      status: 'connected',
      oauthStatus: 'valid',
    };
  }
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

/** Providers with a live HTTP adapter in @tradeops/connector-live-http */
export const LIVE_HTTP_IMPLEMENTED = new Set([
  'shopify-graphql-admin',
  'stripe-api',
  'easypost-api',
  'tavily-search',
]);

/**
 * Capability → preferred active provider keys only.
 */
export const CAPABILITY_PROVIDER_MAP: Record<string, string[]> = {
  discover_products: ['shopify-graphql-admin', 'fixture-supplier'],
  publish_listing: ['shopify-graphql-admin', 'fixture-marketplace'],
  prepare_listing: ['shopify-graphql-admin', 'fixture-marketplace'],
  synchronize_inventory: ['shopify-graphql-admin'],
  read_orders: ['shopify-graphql-admin', 'fixture-marketplace'],
  monitor_fulfillment: ['easypost-api', 'shopify-graphql-admin'],
  read_payments: ['stripe-api'],
  reconcile_payments: ['stripe-api'],
  receive_webhooks: ['shopify-graphql-admin', 'stripe-api', 'easypost-api'],
  generate_executive_insights: ['cohere-ai', 'google-analytics-4', 'posthog-api'],
  optimize_product_content: ['cohere-ai'],
  calculate_landed_cost: ['easypost-api', 'fixture-supplier'],
  compare_suppliers: ['fixture-supplier'],
  submit_supplier_purchase: ['fixture-supplier'],
  detect_exceptions: ['sentry', 'opentelemetry-collector'],
  estimate_demand: ['google-analytics-4', 'cohere-ai'],
  improve_seo: ['cohere-ai', 'tavily-search'],
  attach_media: ['shopify-graphql-admin'],
};
