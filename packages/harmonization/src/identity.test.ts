import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveIdentities, scoreIdentityPair } from './identity';

describe('identity resolution', () => {
  it('matches high confidence on GTIN and allows auto-link', () => {
    const m = scoreIdentityPair(
      {
        productId: 'a',
        title: 'Bottle A',
        sourcePlatform: 'shopify',
        externalId: '1',
        identifiers: [{ scheme: 'gtin', value: '012345678905' }],
      },
      {
        productId: 'b',
        title: 'Different title entirely',
        sourcePlatform: 'amazon',
        externalId: '2',
        identifiers: [{ scheme: 'gtin', value: '012345678905' }],
      },
    );
    assert.ok(m);
    assert.ok(m!.confidence >= 0.95);
    assert.equal(m!.autoLinkEligible, true);
    assert.equal(m!.matchMethod, 'identifier:gtin');
  });

  it('never auto-links on title similarity alone', () => {
    const m = scoreIdentityPair(
      {
        productId: 'a',
        title: 'Insulated Stainless Water Bottle 32oz Blue',
        sourcePlatform: 'fixture-supplier',
        externalId: 'x',
      },
      {
        productId: 'b',
        title: 'Insulated Stainless Water Bottle 32oz Red',
        sourcePlatform: 'fixture-marketplace',
        externalId: 'y',
      },
    );
    assert.ok(m);
    assert.ok(m!.confidence <= 0.72);
    assert.equal(m!.autoLinkEligible, false);
  });

  it('resolves a catalog without merging weak pairs', () => {
    const matches = resolveIdentities([
      {
        productId: '1',
        title: 'Yoga Mat',
        sourcePlatform: 's1',
        externalId: 'a',
      },
      {
        productId: '2',
        title: 'LED Strip',
        sourcePlatform: 's1',
        externalId: 'b',
      },
    ]);
    assert.equal(matches.length, 0);
  });
});
