import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { evaluateMandate } from './mandate-policy';

const base = {
  status: 'approved',
  maximumCapitalMinor: 100_000,
  maximumProductExposureMinor: 50_000,
  maximumDailySpendMinor: 20_000,
  maximumAdvertisingMinor: 10_000,
  minimumMarginBps: 1500,
  approvalThresholdMinor: 5_000,
  maximumDeliveryDays: 21,
  allowedChannels: ['amazon', 'shopify'],
  allowedCategories: ['home'],
  allowedCountries: ['CA'],
};

describe('commerce mandate policy', () => {
  it('allows in-mandate deployment', () => {
    const r = evaluateMandate(base, {
      amountMinor: 3_000,
      channel: 'amazon',
      category: 'home',
      country: 'CA',
      expectedMarginBps: 2000,
      deliveryDays: 10,
    });
    assert.equal(r.allowed, true);
    assert.equal(r.requiresApproval, false);
  });

  it('requires approval above threshold', () => {
    const r = evaluateMandate(base, {
      amountMinor: 6_000,
      channel: 'amazon',
      category: 'home',
      country: 'CA',
      expectedMarginBps: 2000,
    });
    assert.equal(r.allowed, true);
    assert.equal(r.requiresApproval, true);
  });

  it('blocks draft mandate', () => {
    const r = evaluateMandate({ ...base, status: 'draft' }, { amountMinor: 100 });
    assert.equal(r.allowed, false);
  });

  it('blocks wrong channel', () => {
    const r = evaluateMandate(base, {
      amountMinor: 100,
      channel: 'ebay',
      category: 'home',
      country: 'CA',
      expectedMarginBps: 2000,
    });
    assert.equal(r.allowed, false);
    assert.ok(r.reasons.some((x) => /Channel/.test(x)));
  });

  it('blocks low margin', () => {
    const r = evaluateMandate(base, {
      amountMinor: 100,
      channel: 'amazon',
      category: 'home',
      country: 'CA',
      expectedMarginBps: 500,
    });
    assert.equal(r.allowed, false);
  });

  it('blocks daily spend overrun', () => {
    const r = evaluateMandate(base, {
      amountMinor: 5_000,
      channel: 'amazon',
      category: 'home',
      country: 'CA',
      expectedMarginBps: 2000,
      dailyDeployedSoFarMinor: 18_000,
    });
    assert.equal(r.allowed, false);
  });
});
