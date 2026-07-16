export type ConnectorFamily =
  | 'marketplace'
  | 'storefront'
  | 'supplier'
  | 'payment'
  | 'shipping'
  | 'advertising'
  | 'trend'
  | 'review';

export type ConnectorCapability =
  | 'searchProducts'
  | 'readProduct'
  | 'readReviews'
  | 'readSupplier'
  | 'quoteShipping'
  | 'readInventory'
  | 'createListing'
  | 'updateListing'
  | 'pauseListing'
  | 'readOrders'
  | 'createSupplierOrder'
  | 'submitFulfillment'
  | 'readTracking'
  | 'readPayments'
  | 'readFees'
  | 'receiveWebhooks';

export type ConnectorStatus =
  | 'not_configured'
  | 'credentials_required'
  | 'connected'
  | 'authorization_expired'
  | 'permission_limited'
  | 'rate_limited'
  | 'unhealthy'
  | 'disabled';

export type ConnectorManifest = {
  id: string;
  displayName: string;
  family: ConnectorFamily;
  /** When true, this is a local development adapter — never claim production API. */
  isFixture: boolean;
  version: string;
  capabilities: ConnectorCapability[];
};

export type CanonicalProductOffer = {
  externalId: string;
  sourcePlatform: string;
  title: string;
  description: string;
  category: string;
  supplierName: string;
  supplierExternalId: string;
  supplierCostMinor: number;
  shippingCostMinor: number;
  currency: string;
  inventoryQuantity: number;
  rating: number;
  reviewCount: number;
  imageUrl?: string;
  collectedAt: string;
  dataConfidence: number;
};

export type CanonicalOrder = {
  externalId: string;
  sourcePlatform: string;
  status: string;
  currency: string;
  totalMinor: number;
  lines: Array<{
    externalSku: string;
    title: string;
    quantity: number;
    unitPriceMinor: number;
  }>;
  placedAt: string;
};

export interface SupplierConnector {
  manifest: ConnectorManifest;
  searchProducts(query: string): Promise<CanonicalProductOffer[]>;
  readInventory(externalId: string): Promise<{ quantity: number }>;
}

export interface MarketplaceConnector {
  manifest: ConnectorManifest;
  listOpenOrders(): Promise<CanonicalOrder[]>;
  createListingDraft(input: {
    title: string;
    priceMinor: number;
    currency: string;
    sku: string;
  }): Promise<{ externalId: string; status: 'draft' }>;
  publishListing?(externalId: string): Promise<{ status: 'active' }>;
}
