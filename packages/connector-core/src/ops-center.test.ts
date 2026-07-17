import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildConnectorHealthCenter,
  buildConnectorRegistryRecords,
  resolveCapability,
} from './ops-center';
import { listLiveFeeds } from './live-feed-registry';
import type { CapabilityAdvertisement } from './business-capabilities';

describe('ops center registry', () => {
  it('registers major operational domains providers', () => {
    const feeds = listLiveFeeds();
    const keys = new Set(feeds.map((f) => f.providerKey));
    for (const k of [
      'shopify-graphql-admin',
      'stripe-api',
      'shipstation-api',
      'google-ads',
      'sentry',
      'fixture-supplier',
    ]) {
      assert.ok(keys.has(k), `missing ${k}`);
    }
    assert.ok(feeds.length >= 20);
  });

  it('builds health center with fixture online and live needs credentials', () => {
    const records = buildConnectorRegistryRecords(listLiveFeeds(), [
      {
        providerKey: 'fixture-supplier',
        status: 'connected',
        isFixture: true,
        lastHealthAt: new Date(),
        installationId: 'i1',
      },
    ]);
    const center = buildConnectorHealthCenter(records);
    assert.ok(center.summary.total >= 20);
    assert.ok(center.summary.fixtures >= 2);
    assert.ok(center.summary.needsCredentials >= 1);
    assert.ok(center.byDomain.length >= 1);
    assert.match(center.honesty.note, /Fixture/);
  });

  it('resolves discover_products to a provider', () => {
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
    ];
    const r = resolveCapability(ads, 'discover_products');
    assert.equal(r.selected?.providerKey, 'fixture-supplier');
  });
});
