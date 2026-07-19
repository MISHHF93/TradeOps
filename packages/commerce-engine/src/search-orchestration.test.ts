import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { executeInternalSearch, planSearch } from './search-orchestration';

describe('search orchestration', () => {
  it('plans connector intents', () => {
    const plan = planSearch('show shopify connector health');
    assert.ok(plan.intents.includes('connectors'));
    assert.ok(plan.sources.includes('internal_connector'));
  });

  it('ranks internal products with provenance', () => {
    const plan = planSearch('water bottle');
    const res = executeInternalSearch(plan, {
      products: [
        {
          id: 'p1',
          title: 'Insulated Water Bottle',
          category: 'outdoors',
          sourcePlatform: 'fixture-supplier',
          dataConfidence: 0.9,
        },
      ],
      cases: [
        {
          id: 'c1',
          productId: 'p1',
          productTitle: 'Insulated Water Bottle',
          currentStage: 'evaluate',
          stageStatus: 'ready',
          opportunityScore: 72,
        },
      ],
    });
    assert.ok(res.hits.length >= 1);
    const productHit = res.hits.find((h) => h.objectType === 'product');
    assert.ok(productHit);
    assert.equal(productHit!.provenance.isFixture, true);
    assert.ok(res.hits.some((h) => h.objectType === 'product' || h.objectType === 'commerce_case'));
  });
});
