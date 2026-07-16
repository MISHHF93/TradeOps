import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { FixtureSupplierConnector } from './index';

describe('FixtureSupplierConnector', () => {
  it('is labeled fixture and returns catalog', async () => {
    const c = new FixtureSupplierConnector();
    assert.equal(c.manifest.isFixture, true);
    const products = await c.searchProducts('');
    assert.ok(products.length >= 4);
    assert.ok(products.some((p) => p.title.toLowerCase().includes('weapon')));
  });
});
