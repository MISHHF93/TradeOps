import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  SAAS_PLANS,
  getPlan,
  mapStripeSubscriptionStatus,
  planTierForSaasPlan,
} from './billing-plans';

describe('billing plans catalog', () => {
  it('exposes Founder / Professional / Agency / Enterprise', () => {
    const ids = SAAS_PLANS.map((p) => p.id).sort();
    assert.deepEqual(ids, ['agency', 'enterprise', 'founder', 'professional']);
  });

  it('maps plans to entitlement plan tiers', () => {
    assert.equal(planTierForSaasPlan('founder'), 'starter');
    assert.equal(planTierForSaasPlan('professional'), 'growth');
    assert.equal(planTierForSaasPlan('agency'), 'agency');
    assert.equal(planTierForSaasPlan('enterprise'), 'enterprise');
    assert.equal(planTierForSaasPlan('unknown'), 'evaluation');
  });

  it('resolves known plans', () => {
    assert.ok(getPlan('founder'));
    assert.equal(getPlan('missing'), undefined);
  });

  it('maps Stripe subscription statuses', () => {
    assert.equal(mapStripeSubscriptionStatus('active'), 'active');
    assert.equal(mapStripeSubscriptionStatus('trialing'), 'trialing');
    assert.equal(mapStripeSubscriptionStatus('past_due'), 'past_due');
    assert.equal(mapStripeSubscriptionStatus('canceled'), 'cancelled');
    assert.equal(mapStripeSubscriptionStatus('cancelled'), 'cancelled');
    assert.equal(mapStripeSubscriptionStatus('weird'), 'incomplete');
  });
});
