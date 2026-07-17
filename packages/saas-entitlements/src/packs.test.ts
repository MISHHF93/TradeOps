import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  assertWithinQuota,
  entitlementsForPlan,
  hasPack,
  defaultPersonaForSegment,
} from './packs';

describe('saas entitlements', () => {
  it('evaluation includes starter + AI packs only', () => {
    const e = entitlementsForPlan('evaluation');
    assert.equal(hasPack('evaluation', 'commerce_starter'), true);
    assert.equal(hasPack('evaluation', 'ai_intelligence'), true);
    assert.equal(hasPack('evaluation', 'enterprise_governance'), false);
    assert.equal(e.maxClientOrgs, 0);
  });

  it('enforces product quota', () => {
    const e = entitlementsForPlan('starter');
    const r = assertWithinQuota(e, 'maxProducts', e.maxProducts);
    assert.equal(r.ok, false);
    assert.equal(assertWithinQuota(e, 'maxProducts', 0).ok, true);
  });

  it('maps segment to default persona', () => {
    assert.equal(defaultPersonaForSegment('individual'), 'founder');
    assert.equal(defaultPersonaForSegment('agency'), 'agency');
  });
});
