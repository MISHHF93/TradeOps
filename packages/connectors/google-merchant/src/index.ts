/**
 * Google Merchant connector boundary.
 *
 * Live Product Input / Content API posting requires authorized OAuth credentials.
 * Without credentials this connector stays in shadow/dev mode and never claims
 * "connected" or successful live posts.
 *
 * Official direction: Google Merchant API / Content API for Shopping.
 * Docs: https://developers.google.com/merchant/api
 */
import {
  registerConnectorManifest,
  type ConnectorManifest,
  type ConnectorStatus,
} from '@tradeops/connector-core';

export const GOOGLE_MERCHANT_PROVIDER_KEY = 'google-merchant';

export const googleMerchantManifest: ConnectorManifest = {
  id: GOOGLE_MERCHANT_PROVIDER_KEY,
  displayName: 'Google Merchant Center',
  family: 'marketplace',
  isFixture: false,
  version: '0.1.0',
  capabilities: [
    'createListing',
    'updateListing',
    'pauseListing',
    'readInventory',
    'readFees',
    'readProductImages',
    'attachImageToListing',
    'setPrimaryImage',
    'readMediaProcessingStatus',
  ],
  auth: {
    mode: 'oauth2',
    credentialKeys: ['GOOGLE_MERCHANT_ACCESS_TOKEN', 'GOOGLE_MERCHANT_ID'],
    docsUrl: 'https://developers.google.com/merchant/api',
    scopes: ['https://www.googleapis.com/auth/content'],
  },
  rateLimit: { requestsPerMinute: 60, notes: 'Respect Merchant API quotas; never fabricate success.' },
  sync: {
    webhooks: false,
    polling: true,
    defaultPollIntervalSeconds: 3600,
    supportsIncremental: true,
  },
  operations: [
    {
      operation: 'prepareProductFeed',
      capability: 'createListing',
      idempotent: true,
      approvalRequired: false,
      produces: 'product_feed',
    },
    {
      operation: 'postProductInput',
      capability: 'createListing',
      idempotent: false,
      approvalRequired: true,
      produces: 'listing',
    },
  ],
  docsUrl: 'https://developers.google.com/merchant/api',
  healthCheck: 'credentials',
};

registerConnectorManifest(googleMerchantManifest);

export type GoogleMerchantCredentials = {
  /** OAuth2 access token for Merchant/Content API — never fabricate. */
  accessToken?: string;
  /** Merchant Center ID */
  merchantId?: string;
  /** Optional data source id for ProductInput inserts */
  dataSourceId?: string;
};

export type GoogleProductFeedItem = {
  offerId: string;
  title: string;
  description: string;
  link?: string;
  imageLink?: string;
  contentLanguage: string;
  feedLabel: string;
  channel: 'online';
  availability: 'IN_STOCK' | 'OUT_OF_STOCK' | 'PREORDER';
  condition: 'new' | 'refurbished' | 'used';
  price: { value: string; currency: string };
  brand?: string;
  gtin?: string;
  mpn?: string;
  googleProductCategory?: string;
  /** TradeOps provenance */
  sourceProvenance: string;
  dataConfidence: number;
  collectedAt: string;
  isFixtureSource: boolean;
};

export type GoogleWeekendPostMode = 'shadow' | 'live';

export type GoogleWeekendPostResult = {
  mode: GoogleWeekendPostMode;
  providerKey: typeof GOOGLE_MERCHANT_PROVIDER_KEY;
  scheduledFor: string;
  preparedCount: number;
  postedCount: number;
  skippedCount: number;
  status: ConnectorStatus;
  /** Never true unless a real authorized API call succeeded. */
  livePostSucceeded: boolean;
  message: string;
  items: GoogleProductFeedItem[];
  errors: string[];
};

export function hasLiveGoogleCredentials(
  credentials?: GoogleMerchantCredentials | null,
): boolean {
  return Boolean(credentials?.accessToken?.trim() && credentials?.merchantId?.trim());
}

export function googleConnectorStatus(
  credentials?: GoogleMerchantCredentials | null,
): ConnectorStatus {
  if (!hasLiveGoogleCredentials(credentials)) {
    return 'credentials_required';
  }
  return 'connected';
}

/**
 * Build a Google Merchant product feed from canonical TradeOps product records.
 * Does not call Google. Pure mapping with provenance.
 */
export function buildGoogleMerchantFeed(
  products: Array<{
    externalId: string;
    title: string;
    description: string;
    targetPriceMinor: number;
    currency: string;
    inventoryQuantity: number;
    brand?: string | null;
    sourcePlatform: string;
    dataConfidence: number;
    dataFreshnessAt: Date | string;
    isFixtureSource?: boolean;
    imageUrl?: string | null;
    gtin?: string | null;
    mpn?: string | null;
    productUrl?: string | null;
  }>,
  options?: { contentLanguage?: string; feedLabel?: string },
): GoogleProductFeedItem[] {
  const contentLanguage = options?.contentLanguage ?? 'en';
  const feedLabel = options?.feedLabel ?? 'US';

  return products.map((p) => {
    const value = (p.targetPriceMinor / 100).toFixed(2);
    const collectedAt =
      typeof p.dataFreshnessAt === 'string'
        ? p.dataFreshnessAt
        : p.dataFreshnessAt.toISOString();
    return {
      offerId: p.externalId,
      title: p.title.slice(0, 150),
      description: (p.description || p.title).slice(0, 5000),
      link: p.productUrl ?? undefined,
      imageLink: p.imageUrl ?? undefined,
      contentLanguage,
      feedLabel,
      channel: 'online',
      availability: p.inventoryQuantity > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK',
      condition: 'new',
      price: { value, currency: p.currency || 'USD' },
      brand: p.brand ?? undefined,
      gtin: p.gtin ?? undefined,
      mpn: p.mpn ?? undefined,
      sourceProvenance: p.sourcePlatform,
      dataConfidence: p.dataConfidence,
      collectedAt,
      isFixtureSource: Boolean(p.isFixtureSource),
    };
  });
}

/**
 * Weekend post attempt.
 * - shadow: prepare feed, record what would be posted, do not call Google.
 * - live: only when credentials are present; otherwise falls back to shadow and
 *   never claims livePostSucceeded.
 */
export async function runWeekendGooglePost(input: {
  products: Parameters<typeof buildGoogleMerchantFeed>[0];
  credentials?: GoogleMerchantCredentials | null;
  /** Force shadow even if credentials exist */
  forceShadow?: boolean;
  scheduledFor?: Date;
  contentLanguage?: string;
  feedLabel?: string;
}): Promise<GoogleWeekendPostResult> {
  const scheduledFor = (input.scheduledFor ?? nextWeekendMorning()).toISOString();
  const items = buildGoogleMerchantFeed(input.products, {
    contentLanguage: input.contentLanguage,
    feedLabel: input.feedLabel,
  });
  const liveReady = hasLiveGoogleCredentials(input.credentials) && !input.forceShadow;
  const status = googleConnectorStatus(input.credentials);
  const errors: string[] = [];

  // Never post fixture-sourced products to live Google Merchant as if they were real.
  const liveEligible = items.filter((i) => !i.isFixtureSource);
  const skippedFixture = items.length - liveEligible.length;

  if (!liveReady) {
    return {
      mode: 'shadow',
      providerKey: GOOGLE_MERCHANT_PROVIDER_KEY,
      scheduledFor,
      preparedCount: items.length,
      postedCount: 0,
      skippedCount: items.length,
      status,
      livePostSucceeded: false,
      message:
        status === 'credentials_required'
          ? 'Shadow mode: Google Merchant credentials not configured. Feed prepared only — no live post.'
          : 'Shadow mode: weekend feed prepared without live post.',
      items,
      errors,
    };
  }

  // Live path: credentials present. Actual HTTP Content API calls require
  // network + valid OAuth scopes. We attempt only when token/merchantId exist;
  // on failure we record errors and never claim success.
  let postedCount = 0;
  try {
    // Placeholder for authorized Content API product insert batch.
    // Real implementation must use Google Merchant API / Content API with OAuth.
    // We intentionally do not fabricate a successful HTTP response.
    errors.push(
      'Live Google Merchant API client not fully wired for this environment. Feed prepared; live HTTP post requires Content API client + OAuth scopes (content, merchantapi).',
    );
    return {
      mode: 'live',
      providerKey: GOOGLE_MERCHANT_PROVIDER_KEY,
      scheduledFor,
      preparedCount: items.length,
      postedCount,
      skippedCount: skippedFixture + liveEligible.length,
      status: 'credentials_required',
      livePostSucceeded: false,
      message:
        'Credentials present but live Google Merchant HTTP client is not enabled until OAuth scopes and Content API client are configured. Feed prepared in shadow-safe state.',
      items,
      errors,
    };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    return {
      mode: 'live',
      providerKey: GOOGLE_MERCHANT_PROVIDER_KEY,
      scheduledFor,
      preparedCount: items.length,
      postedCount: 0,
      skippedCount: items.length,
      status: 'unhealthy',
      livePostSucceeded: false,
      message: 'Live Google Merchant post failed. Feed retained for retry; no success claimed.',
      items,
      errors,
    };
  }
}

/** Next Saturday 09:00 local, or Sunday 09:00 if already past Saturday window. */
export function nextWeekendMorning(from = new Date(), hour = 9): Date {
  const d = new Date(from);
  d.setSeconds(0, 0);
  d.setMinutes(0);
  d.setHours(hour);
  const day = d.getDay(); // 0 Sun ... 6 Sat
  if (day === 6) {
    // Saturday
    if (from.getHours() < hour) return d;
    // next Sunday
    d.setDate(d.getDate() + 1);
    return d;
  }
  if (day === 0) {
    // Sunday
    if (from.getHours() < hour) return d;
    // next Saturday
    d.setDate(d.getDate() + 6);
    return d;
  }
  // Mon-Fri → upcoming Saturday
  const add = 6 - day;
  d.setDate(d.getDate() + add);
  return d;
}

export function isWeekendLocal(date = new Date()): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export class GoogleMerchantConnector {
  readonly manifest = googleMerchantManifest;

  constructor(private readonly credentials?: GoogleMerchantCredentials | null) {}

  status(): ConnectorStatus {
    return googleConnectorStatus(this.credentials);
  }

  async prepareWeekendFeed(
    products: Parameters<typeof buildGoogleMerchantFeed>[0],
    options?: { forceShadow?: boolean; contentLanguage?: string; feedLabel?: string },
  ): Promise<GoogleWeekendPostResult> {
    return runWeekendGooglePost({
      products,
      credentials: this.credentials,
      forceShadow: options?.forceShadow,
      contentLanguage: options?.contentLanguage,
      feedLabel: options?.feedLabel,
    });
  }
}

export type { ConnectorStatus };
