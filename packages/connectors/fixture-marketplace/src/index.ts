import {
  registerConnectorManifest,
  type CanonicalOrder,
  type ConnectorManifest,
  type MarketplaceConnector,
} from '@tradeops/connector-core';

export const fixtureMarketplaceManifest: ConnectorManifest = {
  id: 'fixture-marketplace',
  displayName: 'Fixture Marketplace (DEV)',
  family: 'marketplace',
  isFixture: true,
  version: '0.1.0',
  capabilities: [
    'createListing',
    'updateListing',
    'pauseListing',
    'readOrders',
    'readFees',
    'readInventory',
    'attachImageToListing',
    'setPrimaryImage',
    'readProductImages',
  ],
  auth: { mode: 'none', credentialKeys: [] },
  rateLimit: { requestsPerMinute: 600, burst: 50, notes: 'Fixture parity with live marketplace contracts.' },
  sync: {
    webhooks: true,
    polling: true,
    defaultPollIntervalSeconds: 0,
    supportsIncremental: true,
  },
  operations: [
    {
      operation: 'createListingDraft',
      capability: 'createListing',
      idempotent: false,
      approvalRequired: false,
      produces: 'listing',
    },
    {
      operation: 'publishListing',
      capability: 'createListing',
      idempotent: false,
      approvalRequired: true,
      produces: 'listing',
    },
    {
      operation: 'listOpenOrders',
      capability: 'readOrders',
      idempotent: true,
      approvalRequired: false,
      produces: 'order',
    },
  ],
  docsUrl: 'https://localhost/tradeops/fixtures/marketplace',
  healthCheck: 'capability_probe',
};

registerConnectorManifest(fixtureMarketplaceManifest);

const drafts = new Map<string, { title: string; priceMinor: number; currency: string; sku: string; status: string }>();

export class FixtureMarketplaceConnector implements MarketplaceConnector {
  readonly manifest = fixtureMarketplaceManifest;

  async createListingDraft(input: {
    title: string;
    priceMinor: number;
    currency: string;
    sku: string;
  }): Promise<{ externalId: string; status: 'draft' }> {
    const externalId = `fm-listing-${input.sku}-${Date.now()}`;
    drafts.set(externalId, { ...input, status: 'draft' });
    return { externalId, status: 'draft' };
  }

  async publishListing(externalId: string): Promise<{ status: 'active' }> {
    const d = drafts.get(externalId);
    if (!d) {
      throw new Error('Listing draft not found in fixture marketplace');
    }
    d.status = 'active';
    return { status: 'active' };
  }

  async listOpenOrders(): Promise<CanonicalOrder[]> {
    return [
      {
        externalId: 'fm-order-1001',
        sourcePlatform: 'fixture-marketplace',
        status: 'paid',
        currency: 'USD',
        totalMinor: 4999,
        lines: [
          {
            externalSku: 'fs-water-bottle-02',
            title: 'Insulated Stainless Water Bottle 32oz',
            quantity: 1,
            unitPriceMinor: 4999,
          },
        ],
        placedAt: new Date().toISOString(),
      },
    ];
  }
}
