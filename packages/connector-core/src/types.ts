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
  | 'receiveWebhooks'
  /** Product Media & Artifact Engine — declare per-connector; never assume parity */
  | 'readProductImages'
  | 'readProductVideos'
  | 'readDocuments'
  | 'readThreeDimensionalModels'
  | 'uploadImage'
  | 'uploadVideo'
  | 'attachImageToListing'
  | 'attachVideoToListing'
  | 'attachRegulatoryDocument'
  | 'deleteMedia'
  | 'reorderMedia'
  | 'setPrimaryImage'
  | 'readMediaProcessingStatus';

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

/**
 * Media asset discovered from a supplier / marketplace feed.
 * Prefer absolute HTTPS URLs; local fixture seeds may use stable CDN placeholders.
 */
export type CanonicalProductMedia = {
  url: string;
  kind: 'image' | 'video' | 'document';
  purpose?:
    | 'primary'
    | 'gallery'
    | 'packaging'
    | 'manual'
    | 'specification'
    | 'warranty'
    | 'compliance'
    | 'demonstration'
    | 'other';
  altText?: string;
  title?: string;
  width?: number;
  height?: number;
  mimeHint?: string;
};

/** Structured attributes for naming, merchandising, and channel listing prep */
export type CanonicalProductAttributes = {
  brand?: string;
  manufacturer?: string;
  model?: string;
  color?: string;
  material?: string;
  size?: string;
  weightGrams?: number;
  dimensionsCm?: { l?: number; w?: number; h?: number };
  bulletPoints?: string[];
  tags?: string[];
  gtin?: string;
  mpn?: string;
  condition?: string;
  countryOfOrigin?: string;
  [key: string]: unknown;
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
  /** Primary hero image (also first of media[]) */
  imageUrl?: string;
  /** Full media set from the online/supplier source */
  media?: CanonicalProductMedia[];
  /** Gallery convenience (URLs only) */
  imageUrls?: string[];
  brand?: string;
  manufacturer?: string;
  attributes?: CanonicalProductAttributes;
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
