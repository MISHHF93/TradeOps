/**
 * Business capabilities — what the AI Operator reasons over.
 * Vendor APIs map into these; the model never plans against "Shopify Products REST".
 */

export type BusinessCapability =
  | 'discover_products'
  | 'compare_suppliers'
  | 'calculate_landed_cost'
  | 'estimate_demand'
  | 'publish_listing'
  | 'prepare_listing'
  | 'synchronize_inventory'
  | 'optimize_product_content'
  | 'read_orders'
  | 'monitor_fulfillment'
  | 'reconcile_payments'
  | 'improve_seo'
  | 'detect_exceptions'
  | 'generate_executive_insights'
  | 'read_payments'
  | 'submit_supplier_purchase'
  | 'attach_media'
  | 'receive_webhooks';

/** Map low-level connector capabilities → business capabilities */
export const CONNECTOR_TO_BUSINESS: Record<string, BusinessCapability[]> = {
  searchProducts: ['discover_products', 'compare_suppliers'],
  readProduct: ['discover_products', 'optimize_product_content'],
  readSupplier: ['compare_suppliers', 'calculate_landed_cost'],
  quoteShipping: ['calculate_landed_cost', 'monitor_fulfillment'],
  readInventory: ['synchronize_inventory'],
  createListing: ['prepare_listing', 'publish_listing'],
  updateListing: ['prepare_listing', 'optimize_product_content'],
  pauseListing: ['publish_listing'],
  readOrders: ['read_orders', 'detect_exceptions'],
  createSupplierOrder: ['submit_supplier_purchase'],
  submitFulfillment: ['monitor_fulfillment'],
  readTracking: ['monitor_fulfillment'],
  readPayments: ['reconcile_payments', 'read_payments'],
  readFees: ['reconcile_payments', 'calculate_landed_cost'],
  receiveWebhooks: ['receive_webhooks', 'detect_exceptions'],
  readProductImages: ['optimize_product_content', 'attach_media'],
  readProductVideos: ['optimize_product_content', 'attach_media'],
  uploadImage: ['attach_media'],
  uploadVideo: ['attach_media'],
  attachImageToListing: ['attach_media', 'prepare_listing'],
  attachVideoToListing: ['attach_media', 'prepare_listing'],
  readReviews: ['estimate_demand', 'detect_exceptions'],
};

/** Live-feed registry string caps → business capabilities */
export const LIVE_FEED_STRING_TO_BUSINESS: Record<string, BusinessCapability[]> = {
  products: ['discover_products', 'synchronize_inventory'],
  inventory: ['synchronize_inventory'],
  orders: ['read_orders'],
  fulfillment: ['monitor_fulfillment'],
  webhooks: ['receive_webhooks'],
  customers: ['generate_executive_insights'],
  listings: ['prepare_listing', 'publish_listing'],
  reports: ['generate_executive_insights'],
  payments: ['reconcile_payments', 'read_payments'],
  shipments: ['monitor_fulfillment'],
  notifications: ['receive_webhooks', 'detect_exceptions'],
  logistics: ['monitor_fulfillment', 'calculate_landed_cost'],
  tracking: ['monitor_fulfillment'],
  sales_sync: ['read_orders', 'generate_executive_insights'],
  analytics: ['generate_executive_insights', 'estimate_demand'],
  feeds: ['improve_seo', 'publish_listing'],
  content: ['optimize_product_content', 'improve_seo'],
};

export type CapabilityAdvertisement = {
  providerKey: string;
  displayName: string;
  family: string;
  isFixture: boolean;
  authMode?: string;
  apiVersion?: string;
  status: string;
  health: string;
  businessCapabilities: BusinessCapability[];
  technicalCapabilities: string[];
  docsUrl?: string;
  notes?: string;
  rateLimitHint?: string;
  supportedOperations: string[];
};

export function businessCapabilitiesFromTechnical(
  technical: string[],
): BusinessCapability[] {
  const set = new Set<BusinessCapability>();
  for (const t of technical) {
    for (const b of CONNECTOR_TO_BUSINESS[t] ?? []) set.add(b);
    for (const b of LIVE_FEED_STRING_TO_BUSINESS[t] ?? []) set.add(b);
  }
  return [...set].sort();
}

/**
 * Given required business capabilities, rank providers that advertise them.
 * AI uses this instead of hardcoding vendor APIs.
 */
export function selectProvidersForCapabilities(
  ads: CapabilityAdvertisement[],
  required: BusinessCapability[],
  options?: { preferLive?: boolean; excludeUnhealthy?: boolean },
): Array<{ providerKey: string; score: number; missing: BusinessCapability[] }> {
  const preferLive = options?.preferLive ?? true;
  const excludeUnhealthy = options?.excludeUnhealthy ?? true;

  return ads
    .filter((a) => {
      if (excludeUnhealthy && /unhealthy|disabled|expired/i.test(a.status + a.health)) {
        return false;
      }
      return true;
    })
    .map((a) => {
      const have = new Set(a.businessCapabilities);
      const missing = required.filter((r) => !have.has(r));
      const covered = required.length - missing.length;
      let score = covered * 10;
      if (preferLive && !a.isFixture) score += 5;
      if (a.isFixture) score += 1; // still usable in fixture mode
      if (a.status === 'connected') score += 3;
      if (a.authMode === 'none' || a.status === 'connected') score += 1;
      return { providerKey: a.providerKey, score, missing };
    })
    .filter((r) => r.missing.length < required.length) // at least one match
    .sort((a, b) => b.score - a.score);
}

export const BUSINESS_CAPABILITY_CATALOG: Array<{
  id: BusinessCapability;
  label: string;
  lifecycleStages: string[];
}> = [
  { id: 'discover_products', label: 'Discover Products', lifecycleStages: ['discover'] },
  { id: 'compare_suppliers', label: 'Compare Suppliers', lifecycleStages: ['evaluate', 'qualify'] },
  { id: 'calculate_landed_cost', label: 'Calculate Landed Cost', lifecycleStages: ['evaluate', 'qualify'] },
  { id: 'estimate_demand', label: 'Estimate Demand', lifecycleStages: ['evaluate'] },
  { id: 'prepare_listing', label: 'Prepare Listing', lifecycleStages: ['prepare'] },
  { id: 'publish_listing', label: 'Publish Listing', lifecycleStages: ['approve', 'publish'] },
  { id: 'synchronize_inventory', label: 'Synchronize Inventory', lifecycleStages: ['monitor', 'fulfill'] },
  { id: 'optimize_product_content', label: 'Optimize Product Content', lifecycleStages: ['prepare', 'optimize'] },
  { id: 'read_orders', label: 'Read Orders', lifecycleStages: ['sell', 'source'] },
  { id: 'monitor_fulfillment', label: 'Monitor Fulfillment', lifecycleStages: ['fulfill'] },
  { id: 'reconcile_payments', label: 'Reconcile Payments', lifecycleStages: ['reconcile'] },
  { id: 'improve_seo', label: 'Improve SEO / Merchandising', lifecycleStages: ['optimize', 'publish'] },
  { id: 'detect_exceptions', label: 'Detect Exceptions', lifecycleStages: ['monitor', 'fulfill'] },
  { id: 'generate_executive_insights', label: 'Generate Executive Insights', lifecycleStages: ['learn', 'reconcile'] },
  { id: 'read_payments', label: 'Read Payments', lifecycleStages: ['reconcile', 'sell'] },
  { id: 'submit_supplier_purchase', label: 'Submit Supplier Purchase', lifecycleStages: ['source'] },
  { id: 'attach_media', label: 'Attach Media', lifecycleStages: ['prepare'] },
  { id: 'receive_webhooks', label: 'Receive Webhooks', lifecycleStages: ['monitor', 'sell'] },
];
