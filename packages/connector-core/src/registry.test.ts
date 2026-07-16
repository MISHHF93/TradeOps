import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { connectorSupports, getConnectorManifest, registerConnectorManifest } from './registry';

describe('connector registry', () => {
  it('registers manifests and checks capabilities', () => {
    registerConnectorManifest({
      id: 'test-fixture',
      displayName: 'Test',
      family: 'supplier',
      isFixture: true,
      version: '0.0.1',
      capabilities: ['searchProducts', 'readInventory'],
    });
    const m = getConnectorManifest('test-fixture');
    assert.ok(m);
    assert.equal(connectorSupports(m!, 'searchProducts'), true);
    assert.equal(connectorSupports(m!, 'createListing'), false);
  });
});
