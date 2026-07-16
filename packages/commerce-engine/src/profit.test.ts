import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { calculateUnitEconomics, estimateMarketplaceFeeMinor } from './profit';
import { scoreOpportunity } from './opportunity-score';
import { forecastDemand } from './forecast';
import { assessProductPolicy } from './policy';
import { decideSignal } from './signals';

describe('calculateUnitEconomics', () => {
  it('never confuses revenue with profit', () => {
    const result = calculateUnitEconomics({
      sellingPriceMinor: 4999,
      marketplaceFeeMinor: 750,
      paymentFeeMinor: 175,
      supplierCostMinor: 1800,
      shippingCostMinor: 450,
      advertisingAllocationMinor: 300,
      returnReserveMinor: 100,
      currency: 'USD',
      units: 2,
    });

    assert.equal(result.revenueMinor, 9998);
    assert.ok(result.contributionProfitMinor < result.revenueMinor);
    assert.equal(result.contributionProfitMinor, 9998 - (1800 + 750 + 175 + 450 + 300 + 100) * 2);
  });

  it('rejects non-integer money', () => {
    assert.throws(() =>
      calculateUnitEconomics({
        sellingPriceMinor: 10.5 as unknown as number,
        marketplaceFeeMinor: 1,
        paymentFeeMinor: 1,
        supplierCostMinor: 1,
        shippingCostMinor: 1,
        currency: 'USD',
      }),
    );
  });
});

describe('scoreOpportunity', () => {
  it('penalizes low confidence and blocks policy ceiling', () => {
    const strong = scoreOpportunity({
      demandPotential: 90,
      trendMomentum: 80,
      netMarginPotential: 85,
      supplierQuality: 80,
      shippingReliability: 80,
      reviewHealth: 75,
      competition: 30,
      returnRisk: 20,
      policyRisk: 10,
      capitalRequirement: 40,
      dataConfidence: 90,
    });
    assert.ok(strong.score >= 70);

    const blocked = scoreOpportunity({
      demandPotential: 99,
      trendMomentum: 99,
      netMarginPotential: 99,
      supplierQuality: 99,
      shippingReliability: 99,
      reviewHealth: 99,
      competition: 0,
      returnRisk: 0,
      policyRisk: 0,
      capitalRequirement: 0,
      dataConfidence: 99,
      policyBlocked: true,
    });
    assert.ok(blocked.score <= 15);
  });

  it('exposes component contributions', () => {
    const r = scoreOpportunity({
      demandPotential: 50,
      trendMomentum: 50,
      netMarginPotential: 50,
      supplierQuality: 50,
      shippingReliability: 50,
      reviewHealth: 50,
      competition: 50,
      returnRisk: 50,
      policyRisk: 50,
      capitalRequirement: 50,
      dataConfidence: 50,
    });
    assert.ok(r.components.length >= 8);
    assert.match(r.explanation, /Score/);
  });
});

describe('forecastDemand', () => {
  it('returns low confidence without history', () => {
    const f = forecastDemand([], 7);
    assert.equal(f.expectedUnits, 0);
    assert.ok(f.confidence <= 0.2);
    assert.ok(f.missingSignals.includes('sales_history'));
  });

  it('scales SMA by horizon', () => {
    const obs = Array.from({ length: 14 }, (_, i) => ({
      date: `2026-06-${String(i + 1).padStart(2, '0')}`,
      units: 10,
    }));
    const f7 = forecastDemand(obs, 7, new Date('2026-07-01T00:00:00Z'));
    const f14 = forecastDemand(obs, 14, new Date('2026-07-01T00:00:00Z'));
    assert.ok(f14.expectedUnits >= f7.expectedUnits);
  });
});

describe('policy + signals', () => {
  it('blocks weapons', () => {
    const p = assessProductPolicy({ title: 'Tactical Firearm Accessory Kit' });
    assert.equal(p.outcome, 'blocked');
  });

  it('emits BLOCKED signal when policy blocked even with great margin', () => {
    const s = decideSignal({
      opportunityScore: 95,
      policyOutcome: 'blocked',
      netMarginBps: 4000,
      hasActiveListing: false,
      forecastConfidence: 0.9,
      dataConfidence: 0.9,
    });
    assert.equal(s.signal, 'BLOCKED');
  });

  it('emits BUY for strong unlisted opportunity', () => {
    const s = decideSignal({
      opportunityScore: 80,
      policyOutcome: 'approved',
      netMarginBps: 2000,
      hasActiveListing: false,
      forecastConfidence: 0.7,
      dataConfidence: 0.8,
    });
    assert.equal(s.signal, 'BUY');
  });
});

describe('fee helpers', () => {
  it('estimates marketplace fee in bps', () => {
    assert.equal(estimateMarketplaceFeeMinor(10_000, 1500), 1500);
  });
});

import { evaluatePredictions, realizedContributionProfitMinor } from './evaluation';
import { PIPELINE_STAGES } from './pipeline';

describe('pipeline contract', () => {
  it('defines the full commerce loop in order', () => {
    const ids = PIPELINE_STAGES.map((s) => s.id);
    assert.deepEqual(ids, [
      'market_data',
      'normalize',
      'forecast',
      'signal',
      'simulation',
      'approval',
      'listing',
      'customer_order',
      'supplier_po',
      'fulfillment',
      'actual_profit',
      'evaluation',
    ]);
  });
});

describe('evaluatePredictions', () => {
  it('computes MAE and bias', () => {
    const report = evaluatePredictions([
      {
        predictedUnits: 10,
        actualUnits: 8,
        predictedProfitMinor: 1000,
        actualProfitMinor: 800,
        signalCorrect: true,
      },
      {
        predictedUnits: 5,
        actualUnits: 7,
        predictedProfitMinor: 500,
        actualProfitMinor: 700,
        signalCorrect: false,
      },
    ]);
    assert.equal(report.sampleSize, 2);
    assert.equal(report.meanAbsoluteUnitError, 2);
    assert.equal(report.meanAbsoluteProfitErrorMinor, 200);
    assert.equal(report.profitBiasMinor, 0);
    assert.equal(report.signalHitRate, 0.5);
  });
});

describe('realizedContributionProfitMinor', () => {
  it('subtracts full unit cost stack from revenue', () => {
    const profit = realizedContributionProfitMinor({
      unitPriceMinor: 5000,
      quantity: 2,
      marketplaceFeeMinorPerUnit: 750,
      paymentFeeMinorPerUnit: 150,
      supplierCostMinorPerUnit: 1800,
      shippingCostMinorPerUnit: 400,
      adAllocationMinorPerUnit: 200,
      returnReserveMinorPerUnit: 100,
    });
    // per unit: 5000 - (750+150+1800+400+200+100) = 1600; *2 = 3200
    assert.equal(profit, 3200);
  });
});
