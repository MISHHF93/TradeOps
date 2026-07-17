import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  businessCapabilitiesFromTechnical,
  selectProvidersForCapabilities,
  type CapabilityAdvertisement,
} from './business-capabilities';

describe('business capabilities', () => {
  it('maps technical search to discover + compare', () => {
    const b = businessCapabilitiesFromTechnical(['searchProducts', 'readOrders']);
    assert.ok(b.includes('discover_products'));
    assert.ok(b.includes('compare_suppliers'));
    assert.ok(b.includes('read_orders'));
  });

  it('selects providers by required business capabilities', () => {
    const ads: CapabilityAdvertisement[] = [
      {
        providerKey: 'fixture-supplier',
        displayName: 'Fixture',
        family: 'supplier',
        isFixture: true,
        status: 'connected',
        health: 'ok',
        businessCapabilities: ['discover_products', 'compare_suppliers'],
        technicalCapabilities: ['searchProducts'],
        supportedOperations: ['searchProducts'],
      },
      {
        providerKey: 'shopify-graphql-admin',
        displayName: 'Shopify',
        family: 'storefront',
        isFixture: false,
        status: 'credentials_required',
        health: 'not_configured',
        businessCapabilities: ['publish_listing', 'read_orders'],
        technicalCapabilities: ['listings', 'orders'],
        supportedOperations: ['createListing', 'readOrders'],
      },
    ];
    const ranked = selectProvidersForCapabilities(ads, ['discover_products']);
    assert.equal(ranked[0]?.providerKey, 'fixture-supplier');
    const publish = selectProvidersForCapabilities(ads, ['publish_listing'], {
      excludeUnhealthy: false,
    });
    assert.ok(publish.some((p) => p.providerKey === 'shopify-graphql-admin'));
  });
});
