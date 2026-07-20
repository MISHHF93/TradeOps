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
    // Local COS active stack
    'tavily-search': ['TAVILY_API_KEY'],
    'cohere-ai': ['COHERE_API_KEY'],
    sentry: ['SENTRY_DSN'],
    // Production catalog (credential probe map)
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
    'google-analytics-4': ['GA4_PROPERTY_ID'],
    'posthog-api': ['POSTHOG_API_KEY'],
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
    'open-exchange-rates': ['OPENEXCHANGERATES_APP_ID'],
    'woocommerce-rest': [
      'WOOCOMMERCE_URL',
      'WOOCOMMERCE_CONSUMER_KEY',
      'WOOCOMMERCE_CONSUMER_SECRET',
    ],
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
 * Shopify Admin GraphQL — productCreate (draft product).
 * Never call without founder approval + explicit confirm in the app layer.
 * Returns product GID on success; never fabricates an id.
 */
export async function shopifyCreateProduct(input: {
  title: string;
  descriptionHtml?: string;
  status?: 'ACTIVE' | 'DRAFT' | 'ARCHIVED';
  vendor?: string;
  productType?: string;
  tags?: string[];
}): Promise<
  LiveFetchResult<{
    externalId: string;
    title: string;
    status: string;
    handle: string | null;
  }>
> {
  const providerKey = 'shopify-graphql-admin';
  const shop = env('SHOPIFY_SHOP_DOMAIN');
  const token = env('SHOPIFY_ACCESS_TOKEN');
  if (!shop || !token) {
    return missing(providerKey, ['SHOPIFY_SHOP_DOMAIN', 'SHOPIFY_ACCESS_TOKEN']);
  }
  const title = String(input.title ?? '').trim().slice(0, 200);
  if (title.length < 2) {
    return {
      ok: false,
      error: 'title_required',
      providerKey,
      isLive: true,
      fetchedAt: new Date().toISOString(),
    };
  }
  const domain = shop.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const mutation = `
    mutation productCreate($input: ProductInput!) {
      productCreate(input: $input) {
        product {
          id
          title
          status
          handle
        }
        userErrors {
          field
          message
        }
      }
    }
  `;
  const variables = {
    input: {
      title,
      descriptionHtml: (input.descriptionHtml ?? title).slice(0, 50_000),
      status: input.status ?? 'DRAFT',
      vendor: (input.vendor ?? 'TradeOps').slice(0, 100),
      productType: (input.productType ?? 'ai-research').slice(0, 100),
      tags: Array.isArray(input.tags) ? input.tags.slice(0, 10) : ['tradeops', 'ai-research'],
    },
  };
  const t0 = Date.now();
  try {
    const res = await fetch(`https://${domain}/admin/api/2025-01/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token,
      },
      body: JSON.stringify({ query: mutation, variables }),
    });
    const latencyMs = Date.now() - t0;
    if (!res.ok) return httpError(providerKey, res.status, latencyMs);
    const json = (await res.json()) as {
      data?: {
        productCreate?: {
          product?: {
            id: string;
            title: string;
            status: string;
            handle?: string | null;
          } | null;
          userErrors?: Array<{ field?: string[] | null; message: string }>;
        };
      };
      errors?: Array<{ message?: string }>;
    };
    if (json.errors?.length) {
      return {
        ok: false,
        error: json.errors.map((e) => e.message ?? 'graphql_error').join('; ').slice(0, 400),
        providerKey,
        isLive: true,
        fetchedAt: new Date().toISOString(),
        latencyMs,
      };
    }
    const userErrors = json.data?.productCreate?.userErrors ?? [];
    if (userErrors.length > 0) {
      return {
        ok: false,
        error: userErrors.map((e) => e.message).join('; ').slice(0, 400),
        providerKey,
        isLive: true,
        fetchedAt: new Date().toISOString(),
        latencyMs,
      };
    }
    const product = json.data?.productCreate?.product;
    if (!product?.id) {
      return {
        ok: false,
        error: 'productCreate returned no product id',
        providerKey,
        isLive: true,
        fetchedAt: new Date().toISOString(),
        latencyMs,
      };
    }
    return {
      ok: true,
      data: {
        externalId: product.id,
        title: product.title,
        status: product.status,
        handle: product.handle ?? null,
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

/** Build Shopify Admin product URL from shop domain + product GID or numeric id. */
export function shopifyAdminProductUrl(productGidOrId: string): string | null {
  const shop = env('SHOPIFY_SHOP_DOMAIN');
  if (!shop || !productGidOrId) return null;
  const domain = shop.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const numeric =
    productGidOrId.match(/Product\/(\d+)/)?.[1] ||
    (/^\d+$/.test(productGidOrId) ? productGidOrId : null);
  if (!numeric) return `https://${domain}/admin/products`;
  return `https://${domain}/admin/products/${numeric}`;
}

/**
 * Cycle 10 — set default variant price + SKU after productCreate.
 * Fetches first variant, then productVariantUpdate. Never fabricates ids.
 */
export async function shopifyUpdateDefaultVariant(input: {
  productId: string;
  price: string;
  sku?: string;
}): Promise<
  LiveFetchResult<{
    variantId: string;
    price: string;
    sku: string | null;
  }>
> {
  const providerKey = 'shopify-graphql-admin';
  const shop = env('SHOPIFY_SHOP_DOMAIN');
  const token = env('SHOPIFY_ACCESS_TOKEN');
  if (!shop || !token) {
    return missing(providerKey, ['SHOPIFY_SHOP_DOMAIN', 'SHOPIFY_ACCESS_TOKEN']);
  }
  const productId = String(input.productId ?? '').trim();
  if (!productId.startsWith('gid://shopify/Product/')) {
    return {
      ok: false,
      error: 'invalid_product_id',
      providerKey,
      isLive: true,
      fetchedAt: new Date().toISOString(),
    };
  }
  // Shopify price is decimal string e.g. "26.25"
  const price = String(input.price ?? '')
    .replace(/[^0-9.]/g, '')
    .replace(/^(\d+\.\d{0,2}).*$/, '$1');
  if (!price || Number(price) <= 0) {
    return {
      ok: false,
      error: 'invalid_price',
      providerKey,
      isLive: true,
      fetchedAt: new Date().toISOString(),
    };
  }
  const sku = input.sku ? String(input.sku).trim().slice(0, 100) : undefined;
  const domain = shop.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const t0 = Date.now();
  try {
    const qRes = await fetch(`https://${domain}/admin/api/2025-01/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token,
      },
      body: JSON.stringify({
        query: `
          query defaultVariant($id: ID!) {
            product(id: $id) {
              variants(first: 1) {
                edges { node { id } }
              }
            }
          }
        `,
        variables: { id: productId },
      }),
    });
    if (!qRes.ok) return httpError(providerKey, qRes.status, Date.now() - t0);
    const qJson = (await qRes.json()) as {
      data?: {
        product?: {
          variants?: { edges?: Array<{ node: { id: string } }> };
        } | null;
      };
      errors?: Array<{ message?: string }>;
    };
    if (qJson.errors?.length) {
      return {
        ok: false,
        error: qJson.errors.map((e) => e.message ?? 'graphql_error').join('; ').slice(0, 400),
        providerKey,
        isLive: true,
        fetchedAt: new Date().toISOString(),
        latencyMs: Date.now() - t0,
      };
    }
    const variantId = qJson.data?.product?.variants?.edges?.[0]?.node?.id;
    if (!variantId) {
      return {
        ok: false,
        error: 'no_default_variant',
        providerKey,
        isLive: true,
        fetchedAt: new Date().toISOString(),
        latencyMs: Date.now() - t0,
      };
    }

    const mRes = await fetch(`https://${domain}/admin/api/2025-01/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token,
      },
      body: JSON.stringify({
        query: `
          mutation productVariantUpdate($input: ProductVariantInput!) {
            productVariantUpdate(input: $input) {
              productVariant { id price sku }
              userErrors { field message }
            }
          }
        `,
        variables: {
          input: {
            id: variantId,
            price,
            ...(sku ? { sku } : {}),
          },
        },
      }),
    });
    const latencyMs = Date.now() - t0;
    if (!mRes.ok) return httpError(providerKey, mRes.status, latencyMs);
    const mJson = (await mRes.json()) as {
      data?: {
        productVariantUpdate?: {
          productVariant?: {
            id: string;
            price: string;
            sku?: string | null;
          } | null;
          userErrors?: Array<{ message: string }>;
        };
      };
      errors?: Array<{ message?: string }>;
    };
    if (mJson.errors?.length) {
      return {
        ok: false,
        error: mJson.errors.map((e) => e.message ?? 'graphql_error').join('; ').slice(0, 400),
        providerKey,
        isLive: true,
        fetchedAt: new Date().toISOString(),
        latencyMs,
      };
    }
    const userErrors = mJson.data?.productVariantUpdate?.userErrors ?? [];
    if (userErrors.length > 0) {
      return {
        ok: false,
        error: userErrors.map((e) => e.message).join('; ').slice(0, 400),
        providerKey,
        isLive: true,
        fetchedAt: new Date().toISOString(),
        latencyMs,
      };
    }
    const variant = mJson.data?.productVariantUpdate?.productVariant;
    if (!variant?.id) {
      return {
        ok: false,
        error: 'variant_update_empty',
        providerKey,
        isLive: true,
        fetchedAt: new Date().toISOString(),
        latencyMs,
      };
    }
    return {
      ok: true,
      data: {
        variantId: variant.id,
        price: String(variant.price ?? price),
        sku: variant.sku ?? sku ?? null,
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

/** True when URL looks like a public image Shopify can fetch (not an article page). */
export function isLikelyPublicImageUrl(url: string): boolean {
  const u = String(url ?? '').trim();
  if (!/^https:\/\//i.test(u)) return false;
  if (u.length > 2000) return false;
  if (/\.(jpe?g|png|webp|gif|avif)(\?|#|$)/i.test(u)) return true;
  if (
    /cdn\.shopify\.com|images\.unsplash\.com|imgix\.net|cloudinary\.com|googleusercontent\.com|cloudfront\.net/i.test(
      u,
    )
  ) {
    return true;
  }
  return false;
}

/**
 * Cycle 11 — attach a public image URL to a Shopify product via productCreateMedia.
 * Never fabricates media ids. Requires a real https image source Shopify can fetch.
 */
export async function shopifyAttachProductImage(input: {
  productId: string;
  originalSource: string;
  alt?: string;
}): Promise<
  LiveFetchResult<{
    mediaId: string | null;
    status: string | null;
    originalSource: string;
  }>
> {
  const batch = await shopifyAttachProductImages({
    productId: input.productId,
    sources: [{ originalSource: input.originalSource, alt: input.alt }],
  });
  if (!batch.ok || !batch.data) {
    return {
      ok: false,
      error: batch.error,
      providerKey: batch.providerKey,
      isLive: true,
      fetchedAt: batch.fetchedAt,
      latencyMs: batch.latencyMs,
    };
  }
  const first = batch.data.attached[0];
  if (!first) {
    return {
      ok: false,
      error: batch.data.errors[0] || 'media_attach_failed',
      providerKey: batch.providerKey,
      isLive: true,
      fetchedAt: batch.fetchedAt,
      latencyMs: batch.latencyMs,
    };
  }
  return {
    ok: true,
    data: first,
    providerKey: batch.providerKey,
    isLive: true,
    fetchedAt: batch.fetchedAt,
    latencyMs: batch.latencyMs,
  };
}

/**
 * Cycle 12 — attach a gallery of public image URLs (max 5) via productCreateMedia.
 * Single GraphQL call with multiple CreateMediaInput. Never fabricates media ids.
 */
export async function shopifyAttachProductImages(input: {
  productId: string;
  sources: Array<{ originalSource: string; alt?: string }>;
}): Promise<
  LiveFetchResult<{
    attached: Array<{
      mediaId: string | null;
      status: string | null;
      originalSource: string;
    }>;
    planned: string[];
    errors: string[];
  }>
> {
  const providerKey = 'shopify-graphql-admin';
  const shop = env('SHOPIFY_SHOP_DOMAIN');
  const token = env('SHOPIFY_ACCESS_TOKEN');
  if (!shop || !token) {
    return missing(providerKey, ['SHOPIFY_SHOP_DOMAIN', 'SHOPIFY_ACCESS_TOKEN']);
  }
  const productId = String(input.productId ?? '').trim();
  if (!productId.startsWith('gid://shopify/Product/')) {
    return {
      ok: false,
      error: 'invalid_product_id',
      providerKey,
      isLive: true,
      fetchedAt: new Date().toISOString(),
    };
  }
  const planned: string[] = [];
  const mediaInputs: Array<{
    originalSource: string;
    alt: string;
    mediaContentType: 'IMAGE';
  }> = [];
  for (const s of input.sources ?? []) {
    const originalSource = String(s.originalSource ?? '').trim();
    if (!originalSource || planned.includes(originalSource)) continue;
    if (!isLikelyPublicImageUrl(originalSource)) continue;
    planned.push(originalSource);
    mediaInputs.push({
      originalSource,
      alt: (s.alt ?? `Product image ${planned.length}`).slice(0, 200),
      mediaContentType: 'IMAGE',
    });
    if (mediaInputs.length >= 5) break;
  }
  if (mediaInputs.length === 0) {
    return {
      ok: false,
      error: 'no_valid_image_urls',
      providerKey,
      isLive: true,
      fetchedAt: new Date().toISOString(),
    };
  }
  const domain = shop.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const t0 = Date.now();
  try {
    const res = await fetch(`https://${domain}/admin/api/2025-01/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token,
      },
      body: JSON.stringify({
        query: `
          mutation productCreateMedia($productId: ID!, $media: [CreateMediaInput!]!) {
            productCreateMedia(productId: $productId, media: $media) {
              media {
                ... on MediaImage {
                  id
                  status
                }
                ... on Video {
                  id
                  status
                }
                ... on ExternalVideo {
                  id
                  status
                }
                ... on Model3d {
                  id
                  status
                }
              }
              mediaUserErrors {
                field
                message
                code
              }
            }
          }
        `,
        variables: {
          productId,
          media: mediaInputs,
        },
      }),
    });
    const latencyMs = Date.now() - t0;
    if (!res.ok) return httpError(providerKey, res.status, latencyMs);
    const json = (await res.json()) as {
      data?: {
        productCreateMedia?: {
          media?: Array<{ id?: string; status?: string } | null> | null;
          mediaUserErrors?: Array<{ message?: string; code?: string }>;
        };
      };
      errors?: Array<{ message?: string }>;
    };
    if (json.errors?.length) {
      return {
        ok: false,
        error: json.errors.map((e) => e.message ?? 'graphql_error').join('; ').slice(0, 400),
        providerKey,
        isLive: true,
        fetchedAt: new Date().toISOString(),
        latencyMs,
      };
    }
    const userErrors = json.data?.productCreateMedia?.mediaUserErrors ?? [];
    const errors = userErrors.map((e) => e.message || e.code || 'media_error');
    const mediaNodes = (json.data?.productCreateMedia?.media ?? []).filter(Boolean) as Array<{
      id?: string;
      status?: string;
    }>;
    // Map responses in order; Shopify returns one media entry per input when accepted
    const attached = mediaInputs.map((m, i) => {
      const node = mediaNodes[i];
      return {
        mediaId: node?.id ?? null,
        status: node?.status ?? (errors.length ? 'ERROR' : 'ACCEPTED'),
        originalSource: m.originalSource,
      };
    });
    // Partial success: if no media nodes and hard userErrors, fail
    if (mediaNodes.length === 0 && errors.length > 0) {
      return {
        ok: false,
        error: errors.join('; ').slice(0, 400),
        providerKey,
        isLive: true,
        fetchedAt: new Date().toISOString(),
        latencyMs,
      };
    }
    return {
      ok: true,
      data: {
        attached,
        planned,
        errors,
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
 * Cycle 13 — set Shopify product status (DRAFT | ACTIVE | ARCHIVED).
 * Storefront visibility requires ACTIVE. Never call without explicit founder confirm.
 */
export async function shopifySetProductStatus(input: {
  productId: string;
  status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED';
}): Promise<
  LiveFetchResult<{
    externalId: string;
    status: string;
    title: string | null;
    handle: string | null;
  }>
> {
  const providerKey = 'shopify-graphql-admin';
  const shop = env('SHOPIFY_SHOP_DOMAIN');
  const token = env('SHOPIFY_ACCESS_TOKEN');
  if (!shop || !token) {
    return missing(providerKey, ['SHOPIFY_SHOP_DOMAIN', 'SHOPIFY_ACCESS_TOKEN']);
  }
  const productId = String(input.productId ?? '').trim();
  if (!productId.startsWith('gid://shopify/Product/')) {
    return {
      ok: false,
      error: 'invalid_product_id',
      providerKey,
      isLive: true,
      fetchedAt: new Date().toISOString(),
    };
  }
  const status = input.status;
  if (status !== 'ACTIVE' && status !== 'DRAFT' && status !== 'ARCHIVED') {
    return {
      ok: false,
      error: 'invalid_status',
      providerKey,
      isLive: true,
      fetchedAt: new Date().toISOString(),
    };
  }
  const domain = shop.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const t0 = Date.now();
  try {
    const res = await fetch(`https://${domain}/admin/api/2025-01/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token,
      },
      body: JSON.stringify({
        query: `
          mutation productUpdate($input: ProductInput!) {
            productUpdate(input: $input) {
              product {
                id
                title
                status
                handle
              }
              userErrors {
                field
                message
              }
            }
          }
        `,
        variables: {
          input: {
            id: productId,
            status,
          },
        },
      }),
    });
    const latencyMs = Date.now() - t0;
    if (!res.ok) return httpError(providerKey, res.status, latencyMs);
    const json = (await res.json()) as {
      data?: {
        productUpdate?: {
          product?: {
            id: string;
            title?: string;
            status: string;
            handle?: string | null;
          } | null;
          userErrors?: Array<{ message?: string }>;
        };
      };
      errors?: Array<{ message?: string }>;
    };
    if (json.errors?.length) {
      return {
        ok: false,
        error: json.errors.map((e) => e.message ?? 'graphql_error').join('; ').slice(0, 400),
        providerKey,
        isLive: true,
        fetchedAt: new Date().toISOString(),
        latencyMs,
      };
    }
    const userErrors = json.data?.productUpdate?.userErrors ?? [];
    if (userErrors.length > 0) {
      return {
        ok: false,
        error: userErrors.map((e) => e.message || 'update_error').join('; ').slice(0, 400),
        providerKey,
        isLive: true,
        fetchedAt: new Date().toISOString(),
        latencyMs,
      };
    }
    const product = json.data?.productUpdate?.product;
    if (!product?.id) {
      return {
        ok: false,
        error: 'productUpdate_empty',
        providerKey,
        isLive: true,
        fetchedAt: new Date().toISOString(),
        latencyMs,
      };
    }
    return {
      ok: true,
      data: {
        externalId: product.id,
        status: product.status,
        title: product.title ?? null,
        handle: product.handle ?? null,
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
 * Read Shopify product status (for already_active / honesty checks).
 */
export async function shopifyGetProductStatus(
  productId: string,
): Promise<
  LiveFetchResult<{
    externalId: string;
    status: string;
    title: string | null;
    handle: string | null;
  }>
> {
  const providerKey = 'shopify-graphql-admin';
  const shop = env('SHOPIFY_SHOP_DOMAIN');
  const token = env('SHOPIFY_ACCESS_TOKEN');
  if (!shop || !token) {
    return missing(providerKey, ['SHOPIFY_SHOP_DOMAIN', 'SHOPIFY_ACCESS_TOKEN']);
  }
  const id = String(productId ?? '').trim();
  if (!id.startsWith('gid://shopify/Product/')) {
    return {
      ok: false,
      error: 'invalid_product_id',
      providerKey,
      isLive: true,
      fetchedAt: new Date().toISOString(),
    };
  }
  const domain = shop.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const t0 = Date.now();
  try {
    const res = await fetch(`https://${domain}/admin/api/2025-01/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token,
      },
      body: JSON.stringify({
        query: `
          query productStatus($id: ID!) {
            product(id: $id) {
              id
              title
              status
              handle
            }
          }
        `,
        variables: { id },
      }),
    });
    const latencyMs = Date.now() - t0;
    if (!res.ok) return httpError(providerKey, res.status, latencyMs);
    const json = (await res.json()) as {
      data?: {
        product?: {
          id: string;
          title?: string;
          status: string;
          handle?: string | null;
        } | null;
      };
      errors?: Array<{ message?: string }>;
    };
    if (json.errors?.length) {
      return {
        ok: false,
        error: json.errors.map((e) => e.message ?? 'graphql_error').join('; ').slice(0, 400),
        providerKey,
        isLive: true,
        fetchedAt: new Date().toISOString(),
        latencyMs,
      };
    }
    const product = json.data?.product;
    if (!product?.id) {
      return {
        ok: false,
        error: 'product_not_found',
        providerKey,
        isLive: true,
        fetchedAt: new Date().toISOString(),
        latencyMs,
      };
    }
    return {
      ok: true,
      data: {
        externalId: product.id,
        status: product.status,
        title: product.title ?? null,
        handle: product.handle ?? null,
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
 * Cycle 14 — resolve default variant inventory item + first location for inventory ops.
 */
export async function shopifyResolveInventoryContext(productId: string): Promise<
  LiveFetchResult<{
    inventoryItemId: string;
    locationId: string;
    locationName: string | null;
    variantId: string;
  }>
> {
  const providerKey = 'shopify-graphql-admin';
  const shop = env('SHOPIFY_SHOP_DOMAIN');
  const token = env('SHOPIFY_ACCESS_TOKEN');
  if (!shop || !token) {
    return missing(providerKey, ['SHOPIFY_SHOP_DOMAIN', 'SHOPIFY_ACCESS_TOKEN']);
  }
  const id = String(productId ?? '').trim();
  if (!id.startsWith('gid://shopify/Product/')) {
    return {
      ok: false,
      error: 'invalid_product_id',
      providerKey,
      isLive: true,
      fetchedAt: new Date().toISOString(),
    };
  }
  const domain = shop.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const t0 = Date.now();
  try {
    const res = await fetch(`https://${domain}/admin/api/2025-01/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token,
      },
      body: JSON.stringify({
        query: `
          query inventoryContext($id: ID!) {
            product(id: $id) {
              variants(first: 1) {
                edges {
                  node {
                    id
                    inventoryItem { id }
                  }
                }
              }
            }
            locations(first: 5) {
              edges {
                node {
                  id
                  name
                  isActive
                }
              }
            }
          }
        `,
        variables: { id },
      }),
    });
    const latencyMs = Date.now() - t0;
    if (!res.ok) return httpError(providerKey, res.status, latencyMs);
    const json = (await res.json()) as {
      data?: {
        product?: {
          variants?: {
            edges?: Array<{
              node: { id: string; inventoryItem?: { id: string } | null };
            }>;
          };
        } | null;
        locations?: {
          edges?: Array<{
            node: { id: string; name?: string; isActive?: boolean };
          }>;
        };
      };
      errors?: Array<{ message?: string }>;
    };
    if (json.errors?.length) {
      return {
        ok: false,
        error: json.errors.map((e) => e.message ?? 'graphql_error').join('; ').slice(0, 400),
        providerKey,
        isLive: true,
        fetchedAt: new Date().toISOString(),
        latencyMs,
      };
    }
    const variant = json.data?.product?.variants?.edges?.[0]?.node;
    const inventoryItemId = variant?.inventoryItem?.id;
    const locations = (json.data?.locations?.edges ?? []).map((e) => e.node);
    const location =
      locations.find((l) => l.isActive !== false) ?? locations[0] ?? null;
    if (!variant?.id || !inventoryItemId || !location?.id) {
      return {
        ok: false,
        error: 'inventory_context_incomplete',
        providerKey,
        isLive: true,
        fetchedAt: new Date().toISOString(),
        latencyMs,
      };
    }
    return {
      ok: true,
      data: {
        inventoryItemId,
        locationId: location.id,
        locationName: location.name ?? null,
        variantId: variant.id,
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
 * Cycle 14 — set available inventory quantity for a product's default variant.
 */
export async function shopifySetInventoryAvailable(input: {
  productId: string;
  quantity: number;
}): Promise<
  LiveFetchResult<{
    inventoryItemId: string;
    locationId: string;
    locationName: string | null;
    quantity: number;
  }>
> {
  const providerKey = 'shopify-graphql-admin';
  const qty = Math.max(0, Math.floor(Number(input.quantity)));
  if (!Number.isFinite(qty)) {
    return {
      ok: false,
      error: 'invalid_quantity',
      providerKey,
      isLive: true,
      fetchedAt: new Date().toISOString(),
    };
  }
  const ctx = await shopifyResolveInventoryContext(input.productId);
  if (!ctx.ok || !ctx.data) {
    return {
      ok: false,
      error: ctx.error ?? 'inventory_context_failed',
      providerKey,
      isLive: true,
      fetchedAt: new Date().toISOString(),
      latencyMs: ctx.latencyMs,
    };
  }
  const shop = env('SHOPIFY_SHOP_DOMAIN');
  const token = env('SHOPIFY_ACCESS_TOKEN');
  if (!shop || !token) {
    return missing(providerKey, ['SHOPIFY_SHOP_DOMAIN', 'SHOPIFY_ACCESS_TOKEN']);
  }
  const domain = shop.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const t0 = Date.now();
  try {
    const res = await fetch(`https://${domain}/admin/api/2025-01/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token,
      },
      body: JSON.stringify({
        query: `
          mutation inventorySetQuantities($input: InventorySetQuantitiesInput!) {
            inventorySetQuantities(input: $input) {
              userErrors { field message code }
            }
          }
        `,
        variables: {
          input: {
            name: 'available',
            reason: 'correction',
            ignoreCompareQuantity: true,
            quantities: [
              {
                inventoryItemId: ctx.data.inventoryItemId,
                locationId: ctx.data.locationId,
                quantity: qty,
              },
            ],
          },
        },
      }),
    });
    const latencyMs = Date.now() - t0;
    if (!res.ok) return httpError(providerKey, res.status, latencyMs);
    const json = (await res.json()) as {
      data?: {
        inventorySetQuantities?: {
          userErrors?: Array<{ message?: string; code?: string }>;
        };
      };
      errors?: Array<{ message?: string }>;
    };
    if (json.errors?.length) {
      return {
        ok: false,
        error: json.errors.map((e) => e.message ?? 'graphql_error').join('; ').slice(0, 400),
        providerKey,
        isLive: true,
        fetchedAt: new Date().toISOString(),
        latencyMs,
      };
    }
    const userErrors = json.data?.inventorySetQuantities?.userErrors ?? [];
    if (userErrors.length > 0) {
      return {
        ok: false,
        error: userErrors.map((e) => e.message || e.code || 'inventory_error').join('; ').slice(0, 400),
        providerKey,
        isLive: true,
        fetchedAt: new Date().toISOString(),
        latencyMs,
      };
    }
    return {
      ok: true,
      data: {
        inventoryItemId: ctx.data.inventoryItemId,
        locationId: ctx.data.locationId,
        locationName: ctx.data.locationName,
        quantity: qty,
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
 * Cycle 14 — find collection by title (exact, case-insensitive) or create it.
 */
export async function shopifyFindOrCreateCollection(input: {
  title: string;
}): Promise<
  LiveFetchResult<{
    collectionId: string;
    title: string;
    created: boolean;
  }>
> {
  const providerKey = 'shopify-graphql-admin';
  const shop = env('SHOPIFY_SHOP_DOMAIN');
  const token = env('SHOPIFY_ACCESS_TOKEN');
  if (!shop || !token) {
    return missing(providerKey, ['SHOPIFY_SHOP_DOMAIN', 'SHOPIFY_ACCESS_TOKEN']);
  }
  const title = String(input.title ?? '').trim().slice(0, 200);
  if (title.length < 2) {
    return {
      ok: false,
      error: 'title_required',
      providerKey,
      isLive: true,
      fetchedAt: new Date().toISOString(),
    };
  }
  const domain = shop.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const t0 = Date.now();
  try {
    // Search existing
    const qRes = await fetch(`https://${domain}/admin/api/2025-01/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token,
      },
      body: JSON.stringify({
        query: `
          query findCollection($q: String!) {
            collections(first: 10, query: $q) {
              edges { node { id title } }
            }
          }
        `,
        variables: { q: `title:${title}` },
      }),
    });
    if (!qRes.ok) return httpError(providerKey, qRes.status, Date.now() - t0);
    const qJson = (await qRes.json()) as {
      data?: {
        collections?: {
          edges?: Array<{ node: { id: string; title: string } }>;
        };
      };
      errors?: Array<{ message?: string }>;
    };
    if (!qJson.errors?.length) {
      const match = (qJson.data?.collections?.edges ?? []).find(
        (e) => e.node.title.toLowerCase() === title.toLowerCase(),
      );
      if (match) {
        return {
          ok: true,
          data: {
            collectionId: match.node.id,
            title: match.node.title,
            created: false,
          },
          providerKey,
          isLive: true,
          fetchedAt: new Date().toISOString(),
          latencyMs: Date.now() - t0,
        };
      }
    }

    const cRes = await fetch(`https://${domain}/admin/api/2025-01/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token,
      },
      body: JSON.stringify({
        query: `
          mutation collectionCreate($input: CollectionInput!) {
            collectionCreate(input: $input) {
              collection { id title }
              userErrors { field message }
            }
          }
        `,
        variables: {
          input: {
            title,
          },
        },
      }),
    });
    const latencyMs = Date.now() - t0;
    if (!cRes.ok) return httpError(providerKey, cRes.status, latencyMs);
    const cJson = (await cRes.json()) as {
      data?: {
        collectionCreate?: {
          collection?: { id: string; title: string } | null;
          userErrors?: Array<{ message?: string }>;
        };
      };
      errors?: Array<{ message?: string }>;
    };
    if (cJson.errors?.length) {
      return {
        ok: false,
        error: cJson.errors.map((e) => e.message ?? 'graphql_error').join('; ').slice(0, 400),
        providerKey,
        isLive: true,
        fetchedAt: new Date().toISOString(),
        latencyMs,
      };
    }
    const userErrors = cJson.data?.collectionCreate?.userErrors ?? [];
    if (userErrors.length > 0) {
      return {
        ok: false,
        error: userErrors.map((e) => e.message || 'collection_error').join('; ').slice(0, 400),
        providerKey,
        isLive: true,
        fetchedAt: new Date().toISOString(),
        latencyMs,
      };
    }
    const collection = cJson.data?.collectionCreate?.collection;
    if (!collection?.id) {
      return {
        ok: false,
        error: 'collection_create_empty',
        providerKey,
        isLive: true,
        fetchedAt: new Date().toISOString(),
        latencyMs,
      };
    }
    return {
      ok: true,
      data: {
        collectionId: collection.id,
        title: collection.title,
        created: true,
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
 * Cycle 14 — add product to a collection.
 */
export async function shopifyAddProductToCollection(input: {
  collectionId: string;
  productId: string;
}): Promise<
  LiveFetchResult<{
    collectionId: string;
    productId: string;
  }>
> {
  const providerKey = 'shopify-graphql-admin';
  const shop = env('SHOPIFY_SHOP_DOMAIN');
  const token = env('SHOPIFY_ACCESS_TOKEN');
  if (!shop || !token) {
    return missing(providerKey, ['SHOPIFY_SHOP_DOMAIN', 'SHOPIFY_ACCESS_TOKEN']);
  }
  const collectionId = String(input.collectionId ?? '').trim();
  const productId = String(input.productId ?? '').trim();
  if (!collectionId.startsWith('gid://shopify/Collection/')) {
    return {
      ok: false,
      error: 'invalid_collection_id',
      providerKey,
      isLive: true,
      fetchedAt: new Date().toISOString(),
    };
  }
  if (!productId.startsWith('gid://shopify/Product/')) {
    return {
      ok: false,
      error: 'invalid_product_id',
      providerKey,
      isLive: true,
      fetchedAt: new Date().toISOString(),
    };
  }
  const domain = shop.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const t0 = Date.now();
  try {
    const res = await fetch(`https://${domain}/admin/api/2025-01/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token,
      },
      body: JSON.stringify({
        query: `
          mutation collectionAddProducts($id: ID!, $productIds: [ID!]!) {
            collectionAddProducts(id: $id, productIds: $productIds) {
              userErrors { field message }
            }
          }
        `,
        variables: {
          id: collectionId,
          productIds: [productId],
        },
      }),
    });
    const latencyMs = Date.now() - t0;
    if (!res.ok) return httpError(providerKey, res.status, latencyMs);
    const json = (await res.json()) as {
      data?: {
        collectionAddProducts?: {
          userErrors?: Array<{ message?: string }>;
        };
      };
      errors?: Array<{ message?: string }>;
    };
    if (json.errors?.length) {
      return {
        ok: false,
        error: json.errors.map((e) => e.message ?? 'graphql_error').join('; ').slice(0, 400),
        providerKey,
        isLive: true,
        fetchedAt: new Date().toISOString(),
        latencyMs,
      };
    }
    const userErrors = json.data?.collectionAddProducts?.userErrors ?? [];
    if (userErrors.length > 0) {
      // Already in collection is often a soft conflict — treat as ok if message says so
      const msg = userErrors.map((e) => e.message || '').join('; ');
      if (/already|exist/i.test(msg)) {
        return {
          ok: true,
          data: { collectionId, productId },
          providerKey,
          isLive: true,
          fetchedAt: new Date().toISOString(),
          latencyMs,
        };
      }
      return {
        ok: false,
        error: msg.slice(0, 400),
        providerKey,
        isLive: true,
        fetchedAt: new Date().toISOString(),
        latencyMs,
      };
    }
    return {
      ok: true,
      data: { collectionId, productId },
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
    case 'easypost-api':
      return easyPostFetchTrackers();
    case 'tavily-search':
      return tavilyWebSearch(options?.query ?? 'commerce market research');
    case 'open-exchange-rates':
      return fetchFxRates();
    case 'woocommerce-rest':
      return wooCommerceFetchProducts();
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
        error: `provider_not_in_active_stack: ${providerKey} is planned/disabled or not implemented. Active live HTTP: shopify, stripe, easypost, tavily, open-exchange, woocommerce, bigcommerce, ebay, paypal, shipstation, keepa, square.`,
        providerKey,
        isLive: true,
        fetchedAt: new Date().toISOString(),
      };
  }
}
