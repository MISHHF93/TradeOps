import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { calculateDistributionWaterfall, WATERFALL_VERSION } from './distribution-waterfall';

describe('distribution waterfall', () => {
  it('returns principal then splits residual profit', () => {
    const r = calculateDistributionWaterfall({
      currency: 'CAD',
      grossSalesMinor: 100_000,
      refundsMinor: 5_000,
      taxesMinor: 0,
      processorFeesMinor: 2_000,
      marketplaceFeesMinor: 3_000,
      supplierCostsMinor: 40_000,
      fulfillmentCostsMinor: 5_000,
      advertisingSpendMinor: 10_000,
      reserveRestoreMinor: 0,
      capitalFundedMinor: 25_000,
      platformFeeBps: 1000, // 10%
      capitalProfitShareBps: 5000, // 50% of residual after platform fee
    });
    assert.equal(r.version, WATERFALL_VERSION);
    assert.equal(r.netSalesMinor, 95_000);
    assert.ok(r.principalReturnedMinor <= 25_000);
    assert.ok(r.principalReturnedMinor > 0);
    assert.ok(r.disclaimer.includes('Not a guarantee'));
    // Ledger identity: residual pieces non-negative
    assert.ok(r.platformFeeMinor >= 0);
    assert.ok(r.capitalProfitMinor >= 0);
    assert.ok(r.merchantResidualMinor >= 0);
  });

  it('allocates loss when residual below capital', () => {
    const r = calculateDistributionWaterfall({
      currency: 'CAD',
      grossSalesMinor: 10_000,
      refundsMinor: 0,
      taxesMinor: 0,
      processorFeesMinor: 500,
      marketplaceFeesMinor: 500,
      supplierCostsMinor: 8_000,
      fulfillmentCostsMinor: 1_000,
      advertisingSpendMinor: 500,
      reserveRestoreMinor: 0,
      capitalFundedMinor: 20_000,
      platformFeeBps: 1000,
      capitalProfitShareBps: 5000,
    });
    assert.ok(r.residualLossMinor > 0);
    assert.equal(r.capitalProfitMinor, 0);
    assert.ok(r.principalReturnedMinor < 20_000);
  });

  it('is deterministic for same inputs', () => {
    const input = {
      currency: 'USD',
      grossSalesMinor: 50_000,
      refundsMinor: 0,
      taxesMinor: 0,
      processorFeesMinor: 1000,
      marketplaceFeesMinor: 1000,
      supplierCostsMinor: 20_000,
      fulfillmentCostsMinor: 2000,
      advertisingSpendMinor: 3000,
      reserveRestoreMinor: 500,
      capitalFundedMinor: 15_000,
      platformFeeBps: 500,
      capitalProfitShareBps: 0,
    };
    const a = calculateDistributionWaterfall(input);
    const b = calculateDistributionWaterfall(input);
    assert.deepEqual(a, b);
  });
});
