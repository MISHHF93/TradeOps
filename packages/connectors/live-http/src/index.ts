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

/** Credential presence probe — no network call. */
export function probeCredentials(providerKey: string): {
  ready: boolean;
  missingKeys: string[];
  providerKey: string;
} {
  const map: Record<string, string[]> = {
    'shopify-graphql-admin': ['SHOPIFY_SHOP_DOMAIN', 'SHOPIFY_ACCESS_TOKEN'],
    'stripe-api': ['STRIPE_SECRET_KEY'],
    'open-exchange-rates': ['OPENEXCHANGERATES_APP_ID'],
    'woocommerce-rest': [
      'WOOCOMMERCE_URL',
      'WOOCOMMERCE_CONSUMER_KEY',
      'WOOCOMMERCE_CONSUMER_SECRET',
    ],
    'easypost-api': ['EASYPOST_API_KEY'],
    serpapi: ['SERPAPI_API_KEY'],
    'paypal-rest': ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET'],
    'square-api': ['SQUARE_ACCESS_TOKEN'],
    'shipstation-api': ['SHIPSTATION_API_KEY', 'SHIPSTATION_API_SECRET'],
    'amazon-sp-api': [
      'AMAZON_SP_CLIENT_ID',
      'AMAZON_SP_CLIENT_SECRET',
      'AMAZON_SP_REFRESH_TOKEN',
    ],
    'ebay-sell': ['EBAY_ACCESS_TOKEN'],
    'bigcommerce-rest': ['BIGCOMMERCE_STORE_HASH', 'BIGCOMMERCE_ACCESS_TOKEN'],
    'google-ads': ['GOOGLE_ADS_DEVELOPER_TOKEN', 'GOOGLE_ADS_REFRESH_TOKEN'],
    'meta-marketing': ['META_ACCESS_TOKEN', 'META_AD_ACCOUNT_ID'],
    'tiktok-ads': ['TIKTOK_ACCESS_TOKEN', 'TIKTOK_ADVERTISER_ID'],
    'google-analytics-4': ['GA4_PROPERTY_ID', 'GOOGLE_APPLICATION_CREDENTIALS'],
    'posthog-api': ['POSTHOG_API_KEY', 'POSTHOG_HOST'],
    'mixpanel-api': ['MIXPANEL_PROJECT_TOKEN', 'MIXPANEL_API_SECRET'],
    'quickbooks-online': ['QUICKBOOKS_ACCESS_TOKEN', 'QUICKBOOKS_REALM_ID'],
    'xero-api': ['XERO_ACCESS_TOKEN', 'XERO_TENANT_ID'],
    'google-merchant': ['GOOGLE_MERCHANT_ACCESS_TOKEN', 'GOOGLE_MERCHANT_ID'],
    'keepa-api': ['KEEPA_API_KEY'],
    avalara: ['AVALARA_ACCOUNT_ID', 'AVALARA_LICENSE_KEY'],
    taxjar: ['TAXJAR_API_KEY'],
    cohere: ['COHERE_API_KEY'],
    openai: ['OPENAI_API_KEY'],
    anthropic: ['ANTHROPIC_API_KEY'],
    'google-gemini': ['GOOGLE_AI_API_KEY'],
    xai: ['XAI_API_KEY'],
    mistral: ['MISTRAL_API_KEY'],
    'ups-api': ['UPS_CLIENT_ID', 'UPS_CLIENT_SECRET'],
    'fedex-api': ['FEDEX_CLIENT_ID', 'FEDEX_CLIENT_SECRET'],
    'dhl-api': ['DHL_API_KEY'],
    'usps-api': ['USPS_CLIENT_ID', 'USPS_CLIENT_SECRET'],
    'canada-post-api': ['CANADA_POST_USERNAME', 'CANADA_POST_PASSWORD'],
    'alibaba-open': ['ALIBABA_APP_KEY', 'ALIBABA_APP_SECRET'],
    'aliexpress-dropshipping': ['ALIEXPRESS_APP_KEY', 'ALIEXPRESS_APP_SECRET'],
    'inventory-source': ['INVENTORY_SOURCE_API_KEY'],
  };
  const keys = map[providerKey] ?? [];
  const missingKeys = keys.filter((k) => !env(k));
  return {
    ready: keys.length > 0 && missingKeys.length === 0,
    missingKeys: keys.length === 0 ? ['UNKNOWN_PROVIDER'] : missingKeys,
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
 * SerpAPI — Google Shopping search (product intelligence).
 */
export async function serpApiShoppingSearch(
  query: string,
): Promise<
  LiveFetchResult<
    Array<{
      title: string;
      price: string | null;
      source: string | null;
      link: string | null;
    }>
  >
> {
  const providerKey = 'serpapi';
  const key = env('SERPAPI_API_KEY');
  if (!key) return missing(providerKey, ['SERPAPI_API_KEY']);
  const t0 = Date.now();
  try {
    const url = new URL('https://serpapi.com/search.json');
    url.searchParams.set('engine', 'google_shopping');
    url.searchParams.set('q', query);
    url.searchParams.set('api_key', key);
    const res = await fetch(url.toString());
    const latencyMs = Date.now() - t0;
    if (!res.ok) return httpError(providerKey, res.status, latencyMs);
    const json = (await res.json()) as {
      shopping_results?: Array<{
        title?: string;
        price?: string;
        source?: string;
        link?: string;
      }>;
    };
    return {
      ok: true,
      data: (json.shopping_results ?? []).slice(0, 25).map((r) => ({
        title: r.title ?? 'unknown',
        price: r.price ?? null,
        source: r.source ?? null,
        link: r.link ?? null,
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
 * BigCommerce REST — catalog products.
 */
export async function bigCommerceFetchProducts(): Promise<
  LiveFetchResult<
    Array<{
      externalId: string;
      title: string;
      description: string;
      status: string;
    }>
  >
> {
  const providerKey = 'bigcommerce-rest';
  const hash = env('BIGCOMMERCE_STORE_HASH');
  const token = env('BIGCOMMERCE_ACCESS_TOKEN');
  if (!hash || !token) {
    return missing(providerKey, ['BIGCOMMERCE_STORE_HASH', 'BIGCOMMERCE_ACCESS_TOKEN']);
  }
  const t0 = Date.now();
  try {
    const res = await fetch(
      `https://api.bigcommerce.com/stores/${encodeURIComponent(hash)}/v3/catalog/products?limit=25`,
      {
        headers: {
          'X-Auth-Token': token,
          Accept: 'application/json',
        },
      },
    );
    const latencyMs = Date.now() - t0;
    if (!res.ok) return httpError(providerKey, res.status, latencyMs);
    const json = (await res.json()) as {
      data?: Array<{
        id: number;
        name: string;
        description?: string;
        is_visible?: boolean;
      }>;
    };
    return {
      ok: true,
      data: (json.data ?? []).map((p) => ({
        externalId: String(p.id),
        title: p.name,
        description: p.description ?? '',
        status: p.is_visible === false ? 'hidden' : 'active',
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
 * eBay Sell Inventory API — inventory items (token-gated).
 */
export async function ebayFetchInventoryItems(): Promise<
  LiveFetchResult<
    Array<{
      externalId: string;
      title: string;
      description: string;
      status: string;
    }>
  >
> {
  const providerKey = 'ebay-sell';
  const token = env('EBAY_ACCESS_TOKEN');
  if (!token) return missing(providerKey, ['EBAY_ACCESS_TOKEN']);
  const t0 = Date.now();
  try {
    const res = await fetch(
      'https://api.ebay.com/sell/inventory/v1/inventory_item?limit=25',
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'Content-Language': 'en-US',
        },
      },
    );
    const latencyMs = Date.now() - t0;
    if (!res.ok) return httpError(providerKey, res.status, latencyMs);
    const json = (await res.json()) as {
      inventoryItems?: Array<{
        sku?: string;
        product?: { title?: string; description?: string };
      }>;
    };
    return {
      ok: true,
      data: (json.inventoryItems ?? []).map((item, i) => ({
        externalId: (item.sku ?? `ebay-item-${i}`).slice(0, 128),
        title: item.product?.title ?? item.sku ?? 'eBay inventory item',
        description: item.product?.description ?? '',
        status: 'inventory',
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
 * PayPal REST — wallet balances (OAuth client credentials).
 */
export async function paypalFetchBalances(): Promise<
  LiveFetchResult<{
    balances: Array<{ currency: string; available: string; total: string }>;
  }>
> {
  const providerKey = 'paypal-rest';
  const clientId = env('PAYPAL_CLIENT_ID');
  const secret = env('PAYPAL_CLIENT_SECRET');
  if (!clientId || !secret) {
    return missing(providerKey, ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET']);
  }
  const base =
    env('PAYPAL_API_BASE')?.replace(/\/$/, '') ?? 'https://api-m.paypal.com';
  const t0 = Date.now();
  try {
    const tokenRes = await fetch(`${base}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    if (!tokenRes.ok) {
      return httpError(providerKey, tokenRes.status, Date.now() - t0);
    }
    const tokenJson = (await tokenRes.json()) as { access_token?: string };
    if (!tokenJson.access_token) {
      return {
        ok: false,
        error: 'PayPal OAuth token missing access_token',
        providerKey,
        isLive: true,
        fetchedAt: new Date().toISOString(),
        latencyMs: Date.now() - t0,
      };
    }
    const balRes = await fetch(`${base}/v1/reporting/balances`, {
      headers: {
        Authorization: `Bearer ${tokenJson.access_token}`,
        Accept: 'application/json',
      },
    });
    const latencyMs = Date.now() - t0;
    if (!balRes.ok) return httpError(providerKey, balRes.status, latencyMs);
    const balJson = (await balRes.json()) as {
      balances?: Array<{
        currency?: string;
        available_balance?: { value?: string };
        total_balance?: { value?: string };
      }>;
    };
    return {
      ok: true,
      data: {
        balances: (balJson.balances ?? []).map((b) => ({
          currency: (b.currency ?? 'USD').toUpperCase(),
          available: b.available_balance?.value ?? '0',
          total: b.total_balance?.value ?? '0',
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
 * ShipStation — recent shipments.
 */
export async function shipStationFetchShipments(): Promise<
  LiveFetchResult<
    Array<{
      externalId: string;
      trackingCode: string;
      status: string;
      carrier: string;
    }>
  >
> {
  const providerKey = 'shipstation-api';
  const key = env('SHIPSTATION_API_KEY');
  const secret = env('SHIPSTATION_API_SECRET');
  if (!key || !secret) {
    return missing(providerKey, ['SHIPSTATION_API_KEY', 'SHIPSTATION_API_SECRET']);
  }
  const t0 = Date.now();
  try {
    const res = await fetch('https://ssapi.shipstation.com/shipments?pageSize=25', {
      headers: {
        Authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}`,
        Accept: 'application/json',
      },
    });
    const latencyMs = Date.now() - t0;
    if (!res.ok) return httpError(providerKey, res.status, latencyMs);
    const json = (await res.json()) as {
      shipments?: Array<{
        shipmentId?: number;
        trackingNumber?: string;
        shipmentStatus?: string;
        carrierCode?: string;
      }>;
    };
    return {
      ok: true,
      data: (json.shipments ?? []).map((s) => ({
        externalId: String(s.shipmentId ?? s.trackingNumber ?? 'unknown'),
        trackingCode: s.trackingNumber ?? '',
        status: s.shipmentStatus ?? 'unknown',
        carrier: s.carrierCode ?? 'unknown',
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
 * Keepa — product lookup by ASIN (query = ASIN).
 */
export async function keepaFetchProduct(
  asin: string,
): Promise<
  LiveFetchResult<
    Array<{
      externalId: string;
      title: string;
      description: string;
      status: string;
    }>
  >
> {
  const providerKey = 'keepa-api';
  const key = env('KEEPA_API_KEY');
  if (!key) return missing(providerKey, ['KEEPA_API_KEY']);
  const cleanAsin = asin.trim().toUpperCase();
  if (!/^[A-Z0-9]{10}$/.test(cleanAsin)) {
    return {
      ok: false,
      error: 'keepa requires a 10-char ASIN in options.query',
      providerKey,
      isLive: true,
      fetchedAt: new Date().toISOString(),
    };
  }
  const t0 = Date.now();
  try {
    const url = new URL('https://api.keepa.com/product');
    url.searchParams.set('key', key);
    url.searchParams.set('domain', '1');
    url.searchParams.set('asin', cleanAsin);
    const res = await fetch(url.toString());
    const latencyMs = Date.now() - t0;
    if (!res.ok) return httpError(providerKey, res.status, latencyMs);
    const json = (await res.json()) as {
      products?: Array<{ asin?: string; title?: string; description?: string }>;
    };
    return {
      ok: true,
      data: (json.products ?? []).map((p) => ({
        externalId: p.asin ?? cleanAsin,
        title: p.title ?? cleanAsin,
        description: p.description ?? '',
        status: 'keepa',
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
 * Square Catalog API — list catalog objects (items).
 */
export async function squareFetchCatalogItems(): Promise<
  LiveFetchResult<
    Array<{
      externalId: string;
      title: string;
      description: string;
      status: string;
    }>
  >
> {
  const providerKey = 'square-api';
  const token = env('SQUARE_ACCESS_TOKEN');
  if (!token) return missing(providerKey, ['SQUARE_ACCESS_TOKEN']);
  const base =
    env('SQUARE_API_BASE')?.replace(/\/$/, '') ?? 'https://connect.squareup.com';
  const t0 = Date.now();
  try {
    const res = await fetch(`${base}/v2/catalog/list?types=ITEM`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Square-Version': '2024-12-18',
      },
    });
    const latencyMs = Date.now() - t0;
    if (!res.ok) return httpError(providerKey, res.status, latencyMs);
    const json = (await res.json()) as {
      objects?: Array<{
        id?: string;
        type?: string;
        item_data?: { name?: string; description?: string };
      }>;
    };
    return {
      ok: true,
      data: (json.objects ?? [])
        .filter((o) => o.type === 'ITEM' || o.item_data)
        .slice(0, 25)
        .map((o) => ({
          externalId: (o.id ?? 'unknown').slice(0, 128),
          title: o.item_data?.name ?? 'Square item',
          description: o.item_data?.description ?? '',
          status: 'active',
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

/** Provider keys with a full live HTTP adapter in this package. */
export const LIVE_HTTP_ADAPTER_KEYS = [
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
] as const;

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
    case 'open-exchange-rates':
      return fetchFxRates();
    case 'woocommerce-rest':
      return wooCommerceFetchProducts();
    case 'easypost-api':
      return easyPostFetchTrackers();
    case 'serpapi':
      return serpApiShoppingSearch(options?.query ?? 'wireless earbuds');
    case 'bigcommerce-rest':
      return bigCommerceFetchProducts();
    case 'ebay-sell':
      return ebayFetchInventoryItems();
    case 'paypal-rest':
      return paypalFetchBalances();
    case 'shipstation-api':
      return shipStationFetchShipments();
    case 'keepa-api':
      return keepaFetchProduct(options?.query ?? '');
    case 'square-api':
      return squareFetchCatalogItems();
    default:
      return {
        ok: false,
        error: `adapter_stub: ${providerKey} credentials present but full HTTP adapter not yet wired — registry-ready only`,
        providerKey,
        isLive: true,
        fetchedAt: new Date().toISOString(),
      };
  }
}
