import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildSearchPolicy, classifyInformationNeed } from './search-manager';

describe('Search Manager intent', () => {
  it('skips search for pure operational questions', () => {
    assert.equal(
      classifyInformationNeed('What is our Shopify inventory for SKU-1?'),
      'authenticated_operational_data',
    );
    const p = buildSearchPolicy('authenticated_operational_data');
    assert.equal(p.allowed, false);
  });

  it('routes product discovery to public research', () => {
    const need = classifyInformationNeed(
      'Find high-demand BMW M240i performance parts for resale',
    );
    assert.ok(
      need === 'product_discovery' || need === 'public_web' || need === 'mixed_research',
    );
    const p = buildSearchPolicy(need);
    assert.equal(p.allowed, true);
    assert.ok(p.providers.includes('tavily') || p.providers.includes('xai_web'));
  });

  it('detects social signal intent', () => {
    assert.equal(
      classifyInformationNeed('What is the social sentiment and trending talk on X about EV tires?'),
      'social_signal',
    );
  });
});
