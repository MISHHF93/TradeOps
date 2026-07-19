/**
 * Live HTTP adapters — only call vendor APIs when credentials are present.
 * Never fabricate products/orders/payouts. Frontend must never call these directly.
 */

export type LiveFetchResult<T> = {
  ok: boolean;
  data?: T;
  error?: string;
  providerKey: string;
  isLive: true;
  fetchedAt: string;
  latencyMs?: number;
};

function env(key: string): string | undefined {
  const v = process.env[key]?.trim();
  return v || undefined;
}

function missing(providerKey: string, keys: string[]): LiveFetchResult<never> {
  return {
    ok: false,
    error: `Missing credentials: ${keys.join(', ')}`,
    providerKey,
    isLive: true,
    fetchedAt: new Date().toISOString(),
  };
}

function httpError(
  providerKey: string,
  status: number,
  latencyMs: number,
): LiveFetchResult<never> {
  return {
    ok: false,
    error: `HTTP ${status}`,
    providerKey,
    isLive: true,
    fetchedAt: new Date().toISOString(),
    latencyMs,
  };
}

function catchError(providerKey: string, e: unknown, latencyMs: number): LiveFetchResult<never> {
  return {
    ok: false,
    error: e instanceof Error ? e.message : String(e),
    providerKey,
    isLive: true,
    fetchedAt: new Date().toISOString(),
    latencyMs,
  };
}

/**
 * Credential presence probe — approved active stack only.
 * Planned providers return unknown (not ready) without implying support.
 */
export function probeCredentials(providerKey: string): {
  ready: boolean;
  missingKeys: string[];
  providerKey: string;
} {
  const map: Record<string, string[]> = {
    'shopify-graphql-admin': ['SHOPIFY_SHOP_DOMAIN', 'SHOPIFY_ACCESS_TOKEN'],
    'stripe-api': ['STRIPE_SECRET_KEY'],
    'easypost-api': ['EASYPOST_API_KEY'],
    'tavily-search': ['TAVILY_API_KEY'],
    'cohere-ai': ['COHERE_API_KEY'],
    'google-analytics-4': ['GA4_PROPERTY_ID'],
    'posthog-api': ['POSTHOG_API_KEY'],
    sentry: ['SENTRY_DSN'],
  };
  // Cohere alias
  if (providerKey === 'cohere-ai' && !env('COHERE_API_KEY') && env('CO_API_KEY')) {
    return { ready: true, missingKeys: [], providerKey };
  }
  const keys = map[providerKey] ?? [];
  if (keys.length === 0) {
    return {
      ready: false,
      missingKeys: ['PROVIDER_NOT_IN_ACTIVE_STACK'],
      providerKey,
    };
  }
  const missingKeys = keys.filter((k) => !env(k));
  return {
    ready: missingKeys.length === 0,
    missingKeys,
    providerKey,
  };
}

/**
 * Shopify Admin GraphQL — products (first 25).
 */
export async function shopifyFetchProducts(): Promise<
  LiveFetchResult<
    Array<{
      externalId: string;
      title: string;
      description: string;
      status: string;
    }>
  >
> {
  const providerKey = 'shopify-graphql-admin';
  const shop = env('SHOPIFY_SHOP_DOMAIN');
  const token = env('SHOPIFY_ACCESS_TOKEN');
  if (!shop || !token) {
    return missing(providerKey, ['SHOPIFY_SHOP_DOMAIN', 'SHOPIFY_ACCESS_TOKEN']);
  }
  const domain = shop.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const query = `{
    products(first: 25) {
      edges {
        node {
          id
          title
          description
          status
        }
      }
    }
  }`;
  const t0 = Date.now();
  try {
    const res = await fetch(`https://${domain}/admin/api/2025-01/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token,
      },
      body: JSON.stringify({ query }),
    });
    const latencyMs = Date.now() - t0;
    if (!res.ok) return httpError(providerKey, res.status, latencyMs);
    const json = (await res.json()) as {
      data?: {
        products?: {
          edges?: Array<{
            node: { id: string; title: string; description: string; status: string };
          }>;
        };
      };
      errors?: unknown;
    };
    if (json.errors) {
      return {
        ok: false,
        error: 'Shopify GraphQL errors',
        providerKey,
        isLive: true,
        fetchedAt: new Date().toISOString(),
        latencyMs,
      };
    }
    const data = (json.data?.products?.edges ?? []).map((e) => ({
      externalId: e.node.id,
      title: e.node.title,
      description: e.node.description ?? '',
      status: e.node.status,
    }));
    return {
      ok: true,
      data,
      providerKey,
      isLive: true,
      fetchedAt: new Date().toISOString(),
      latencyMs,
    };
  } catch (e) {
    return catchError(providerKey, e, Date.now() - t0);
  }
}

/**
 * Shopify Admin GraphQL — recent orders (first 10).
 */
export async function shopifyFetchOrders(): Promise<
  LiveFetchResult<
    Array<{
      externalId: string;
      name: string;
      totalMinor: number;
      currency: string;
      financialStatus: string;
    }>
  >
> {
  const providerKey = 'shopify-graphql-admin';
  const shop = env('SHOPIFY_SHOP_DOMAIN');
  const token = env('SHOPIFY_ACCESS_TOKEN');
  if (!shop || !token) {
    return missing(providerKey, ['SHOPIFY_SHOP_DOMAIN', 'SHOPIFY_ACCESS_TOKEN']);
  }
  const domain = shop.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const query = `{
    orders(first: 10, sortKey: CREATED_AT, reverse: true) {
      edges {
        node {
          id
          name
          displayFinancialStatus
          totalPriceSet { shopMoney { amount currencyCode } }
        }
      }
    }
  }`;
  const t0 = Date.now();
  try {
    const res = await fetch(`https://${domain}/admin/api/2025-01/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token,
      },
      body: JSON.stringify({ query }),
    });
    const latencyMs = Date.now() - t0;
    if (!res.ok) return httpError(providerKey, res.status, latencyMs);
    const json = (await res.json()) as {
      data?: {
        orders?: {
          edges?: Array<{
            node: {
              id: string;
              name: string;
              displayFinancialStatus: string;
              totalPriceSet?: {
                shopMoney?: { amount: string; currencyCode: string };
              };
            };
          }>;
        };
      };
      errors?: unknown;
    };
    if (json.errors) {
      return {
        ok: false,
        error: 'Shopify GraphQL errors',
        providerKey,
        isLive: true,
        fetchedAt: new Date().toISOString(),
        latencyMs,
      };
    }
    const data = (json.data?.orders?.edges ?? []).map((e) => {
      const amount = Number(e.node.totalPriceSet?.shopMoney?.amount ?? 0);
      return {
        externalId: e.node.id,
        name: e.node.name,
        totalMinor: Math.round(amount * 100),
        currency: e.node.totalPriceSet?.shopMoney?.currencyCode ?? 'USD',
        financialStatus: e.node.displayFinancialStatus,
      };
    });
    return {
      ok: true,
      data,
      providerKey,
      isLive: true,
      fetchedAt: new Date().toISOString(),
      latencyMs,
    };
  } catch (e) {
    return catchError(providerKey, e, Date.now() - t0);
  }
}

/**
 * Stripe — list recent payouts (live operational cash).
 */
export async function stripeFetchPayouts(): Promise<
  LiveFetchResult<
    Array<{
      externalPayoutId: string;
      amountMinor: number;
      currency: string;
      status: string;
      arrivalDate: number | null;
    }>
  >
> {
  const providerKey = 'stripe-api';
  const key = env('STRIPE_SECRET_KEY');
  if (!key) return missing(providerKey, ['STRIPE_SECRET_KEY']);
  const t0 = Date.now();
  try {
    const res = await fetch('https://api.stripe.com/v1/payouts?limit=25', {
      headers: { Authorization: `Bearer ${key}` },
    });
    const latencyMs = Date.now() - t0;
    if (!res.ok) return httpError(providerKey, res.status, latencyMs);
    const json = (await res.json()) as {
      data?: Array<{
        id: string;
        amount: number;
        currency: string;
        status: string;
        arrival_date?: number;
      }>;
    };
    return {
      ok: true,
      data: (json.data ?? []).map((p) => ({
        externalPayoutId: p.id,
        amountMinor: p.amount,
        currency: (p.currency ?? 'usd').toUpperCase(),
        status: p.status,
        arrivalDate: p.arrival_date ?? null,
      })),
      providerKey,
      isLive: true,
      fetchedAt: new Date().toISOString(),
      latencyMs,
    };
  } catch (e) {
    return catchError(providerKey, e, Date.now() - t0);
  }
}

/**
 * Stripe — list recent balance transactions / payment intents summary.
 */
export async function stripeFetchBalance(): Promise<
  LiveFetchResult<{
    available: Array<{ amount: number; currency: string }>;
    pending: Array<{ amount: number; currency: string }>;
  }>
> {
  const providerKey = 'stripe-api';
  const key = env('STRIPE_SECRET_KEY');
  if (!key) return missing(providerKey, ['STRIPE_SECRET_KEY']);
  const t0 = Date.now();
  try {
    const res = await fetch('https://api.stripe.com/v1/balance', {
      headers: { Authorization: `Bearer ${key}` },
    });
    const latencyMs = Date.now() - t0;
    if (!res.ok) return httpError(providerKey, res.status, latencyMs);
    const json = (await res.json()) as {
      available?: Array<{ amount: number; currency: string }>;
      pending?: Array<{ amount: number; currency: string }>;
    };
    return {
      ok: true,
      data: {
        available: (json.available ?? []).map((a) => ({
          amount: a.amount,
          currency: a.currency.toUpperCase(),
        })),
        pending: (json.pending ?? []).map((a) => ({
          amount: a.amount,
          currency: a.currency.toUpperCase(),
        })),
      },
      providerKey,
      isLive: true,
      fetchedAt: new Date().toISOString(),
      latencyMs,
    };
  } catch (e) {
    return catchError(providerKey, e, Date.now() - t0);
  }
}

/**
 * Open Exchange Rates — latest USD table (currency).
 */
export async function fetchFxRates(): Promise<
  LiveFetchResult<{ base: string; rates: Record<string, number> }>
> {
  const providerKey = 'open-exchange-rates';
  const appId = env('OPENEXCHANGERATES_APP_ID');
  if (!appId) return missing(providerKey, ['OPENEXCHANGERATES_APP_ID']);
  const t0 = Date.now();
  try {
    const res = await fetch(
      `https://openexchangerates.org/api/latest.json?app_id=${encodeURIComponent(appId)}`,
    );
    const latencyMs = Date.now() - t0;
    if (!res.ok) return httpError(providerKey, res.status, latencyMs);
    const json = (await res.json()) as { base?: string; rates?: Record<string, number> };
    return {
      ok: true,
      data: { base: json.base ?? 'USD', rates: json.rates ?? {} },
      providerKey,
      isLive: true,
      fetchedAt: new Date().toISOString(),
      latencyMs,
    };
  } catch (e) {
    return catchError(providerKey, e, Date.now() - t0);
  }
}

/**
 * WooCommerce REST — products.
 */
export async function wooCommerceFetchProducts(): Promise<
  LiveFetchResult<
    Array<{
      externalId: string;
      title: string;
      description: string;
      status: string;
    }>
  >
> {
  const providerKey = 'woocommerce-rest';
  const base = env('WOOCOMMERCE_URL');
  const key = env('WOOCOMMERCE_CONSUMER_KEY');
  const secret = env('WOOCOMMERCE_CONSUMER_SECRET');
  if (!base || !key || !secret) {
    return missing(providerKey, [
      'WOOCOMMERCE_URL',
      'WOOCOMMERCE_CONSUMER_KEY',
      'WOOCOMMERCE_CONSUMER_SECRET',
    ]);
  }
  const url = new URL('/wp-json/wc/v3/products', base.replace(/\/$/, ''));
  url.searchParams.set('per_page', '25');
  url.searchParams.set('consumer_key', key);
  url.searchParams.set('consumer_secret', secret);
  const t0 = Date.now();
  try {
    const res = await fetch(url.toString());
    const latencyMs = Date.now() - t0;
    if (!res.ok) return httpError(providerKey, res.status, latencyMs);
    const json = (await res.json()) as Array<{
      id: number;
      name: string;
      description?: string;
      status: string;
    }>;
    return {
      ok: true,
      data: json.map((p) => ({
        externalId: String(p.id),
        title: p.name,
        description: p.description ?? '',
        status: p.status,
      })),
      providerKey,
      isLive: true,
      fetchedAt: new Date().toISOString(),
      latencyMs,
    };
  } catch (e) {
    return catchError(providerKey, e, Date.now() - t0);
  }
}

/**
 * EasyPost — list trackers (recent).
 */
export async function easyPostFetchTrackers(): Promise<
  LiveFetchResult<
    Array<{
      externalId: string;
      trackingCode: string;
      status: string;
      carrier: string;
    }>
  >
> {
  const providerKey = 'easypost-api';
  const key = env('EASYPOST_API_KEY');
  if (!key) return missing(providerKey, ['EASYPOST_API_KEY']);
  const t0 = Date.now();
  try {
    const res = await fetch('https://api.easypost.com/v2/trackers?page_size=25', {
      headers: {
        Authorization: `Basic ${Buffer.from(`${key}:`).toString('base64')}`,
      },
    });
    const latencyMs = Date.now() - t0;
    if (!res.ok) return httpError(providerKey, res.status, latencyMs);
    const json = (await res.json()) as {
      trackers?: Array<{
        id: string;
        tracking_code: string;
        status: string;
        carrier: string;
      }>;
    };
    return {
      ok: true,
      data: (json.trackers ?? []).map((t) => ({
        externalId: t.id,
        trackingCode: t.tracking_code,
        status: t.status,
        carrier: t.carrier,
      })),
      providerKey,
      isLive: true,
      fetchedAt: new Date().toISOString(),
      latencyMs,
    };
  } catch (e) {
    return catchError(providerKey, e, Date.now() - t0);
  }
}

/**
 * Tavily — sole public web-search provider (canonical research.* capabilities).
 */
export async function tavilyWebSearch(
  query: string,
): Promise<
  LiveFetchResult<
    Array<{
      title: string;
      url: string;
      snippet: string;
    }>
  >
> {
  const providerKey = 'tavily-search';
  const key = env('TAVILY_API_KEY');
  if (!key) return missing(providerKey, ['TAVILY_API_KEY']);
  const t0 = Date.now();
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: key,
        query,
        max_results: 10,
        include_answer: false,
        search_depth: 'basic',
      }),
    });
    const latencyMs = Date.now() - t0;
    if (!res.ok) return httpError(providerKey, res.status, latencyMs);
    const json = (await res.json()) as {
      results?: Array<{ title?: string; url?: string; content?: string }>;
    };
    return {
      ok: true,
      data: (json.results ?? []).map((r) => ({
        title: r.title ?? 'untitled',
        url: r.url ?? '',
        snippet: r.content ?? '',
      })),
      providerKey,
      isLive: true,
      fetchedAt: new Date().toISOString(),
      latencyMs,
    };
  } catch (e) {
    return catchError(providerKey, e, Date.now() - t0);
  }
}

/** @deprecated Removed from active stack — use tavilyWebSearch */
export async function serpApiShoppingSearch(
  _query: string,
): Promise<LiveFetchResult<never>> {
  return {
    ok: false,
    error: 'serpapi_removed: use tavily-search (research.search_public_web)',
    providerKey: 'serpapi',
    isLive: true,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Dispatch live sync by provider key. Only implemented providers hit the network.
 * Others return a structured credentials/not-implemented result — never fake data.
 */
export async function liveSyncProvider(
  providerKey: string,
  options?: { query?: string },
): Promise<LiveFetchResult<unknown>> {
  const cred = probeCredentials(providerKey);
  if (!cred.ready) {
    return {
      ok: false,
      error: `credentials_required: ${cred.missingKeys.join(',')}`,
      providerKey,
      isLive: true,
      fetchedAt: new Date().toISOString(),
    };
  }

  switch (providerKey) {
    case 'shopify-graphql-admin': {
      const products = await shopifyFetchProducts();
      if (!products.ok) return products;
      const orders = await shopifyFetchOrders();
      return {
        ok: true,
        data: {
          products: products.data ?? [],
          orders: orders.ok ? orders.data ?? [] : [],
          ordersError: orders.ok ? null : orders.error,
        },
        providerKey,
        isLive: true,
        fetchedAt: new Date().toISOString(),
        latencyMs: products.latencyMs,
      };
    }
    case 'stripe-api': {
      const payouts = await stripeFetchPayouts();
      if (!payouts.ok) return payouts;
      const balance = await stripeFetchBalance();
      return {
        ok: true,
        data: {
          payouts: payouts.data ?? [],
          balance: balance.ok ? balance.data : null,
          balanceError: balance.ok ? null : balance.error,
        },
        providerKey,
        isLive: true,
        fetchedAt: new Date().toISOString(),
        latencyMs: payouts.latencyMs,
      };
    }
    case 'easypost-api':
      return easyPostFetchTrackers();
    case 'tavily-search':
      return tavilyWebSearch(options?.query ?? 'commerce market research');
    default:
      return {
        ok: false,
        error: `provider_not_in_active_stack: ${providerKey} is planned/disabled or not implemented. Active live HTTP: shopify, stripe, easypost, tavily.`,
        providerKey,
        isLive: true,
        fetchedAt: new Date().toISOString(),
      };
  }
}
