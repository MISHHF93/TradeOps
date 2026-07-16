import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { FixtureMarketplaceConnector } from './index';

describe('FixtureMarketplaceConnector', () => {
  it('creates draft listings and returns fixture orders', async () => {
    const c = new FixtureMarketplaceConnector();
    assert.equal(c.manifest.isFixture, true);
    const draft = await c.createListingDraft({
      title: 'Test',
      priceMinor: 1000,
      currency: 'USD',
      sku: 'sku-1',
    });
    assert.equal(draft.status, 'draft');
    const orders = await c.listOpenOrders();
    assert.ok(orders.length >= 1);
  });
});
