import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  batchPredict,
  defaultPredictionWeights,
  predictProduct,
  trainPredictionModel,
} from './prediction-engine';

const baseFeatures = {
  productId: 'p1',
  title: 'Water Bottle',
  sellingPriceMinor: 3499,
  marketplaceFeeMinor: 500,
  paymentFeeMinor: 100,
  supplierCostMinor: 900,
  shippingCostMinor: 400,
  currency: 'USD',
  opportunityScore: 80,
  policyOutcome: 'approved' as const,
  netMarginBps: 2500,
  hasActiveListing: false,
  dataConfidence: 0.8,
  artifactReadiness: 0.7,
  isFixture: true,
};

describe('prediction engine', () => {
  it('returns low confidence without sales history', () => {
    const p = predictProduct({ ...baseFeatures, observations: [] }, 14);
    assert.equal(p.expectedUnits, 0);
    assert.ok(p.confidence <= 0.3);
    assert.ok(p.missingSignals.includes('sales_history'));
    assert.equal(p.isFixture, true);
  });

  it('scales with history and unit bias after train', () => {
    const obs = Array.from({ length: 14 }, (_, i) => ({
      date: `2026-06-${String(i + 1).padStart(2, '0')}`,
      units: 10,
    }));
    const untrained = predictProduct({ ...baseFeatures, observations: obs }, 14);
    assert.ok(untrained.expectedUnits > 0);

    const { weights } = trainPredictionModel([
      {
        predictedUnits: 10,
        actualUnits: 12,
        predictedProfitMinor: 1000,
        actualProfitMinor: 1100,
        signalCorrect: true,
      },
      {
        predictedUnits: 10,
        actualUnits: 13,
        predictedProfitMinor: 1000,
        actualProfitMinor: 1200,
        signalCorrect: true,
      },
      {
        predictedUnits: 8,
        actualUnits: 10,
        predictedProfitMinor: 800,
        actualProfitMinor: 900,
        signalCorrect: false,
      },
    ]);
    assert.ok(weights.sampleSize === 3);
    assert.ok(weights.unitBias >= 0.5 && weights.unitBias <= 1.5);
    assert.match(weights.modelVersion, /prediction-engine-v1/);

    const trained = predictProduct(
      { ...baseFeatures, observations: obs },
      14,
      weights,
    );
    // With unitBias > 1 from actuals above predicted, trained units should not collapse
    assert.ok(trained.expectedUnits >= Math.floor(untrained.expectedUnits * 0.5));
  });

  it('batchPredict sorts by expected contribution', () => {
    const list = batchPredict(
      [
        { ...baseFeatures, productId: 'a', opportunityScore: 50 },
        {
          ...baseFeatures,
          productId: 'b',
          sellingPriceMinor: 9999,
          opportunityScore: 90,
          observations: Array.from({ length: 14 }, (_, i) => ({
            date: `2026-06-${String(i + 1).padStart(2, '0')}`,
            units: 20,
          })),
        },
      ],
      14,
      defaultPredictionWeights(),
    );
    assert.equal(list.length, 2);
    assert.ok(
      list[0]!.expectedContributionProfitMinor >=
        list[1]!.expectedContributionProfitMinor,
    );
  });

  it('empty train returns base weights', () => {
    const { weights, evaluation } = trainPredictionModel([]);
    assert.equal(weights.unitBias, 1);
    assert.equal(evaluation.sampleSize, 0);
  });
});
