/**
 * TradeOps Prediction Engine — transparent demand / profit / signal forecasts.
 *
 * Base: baseline-ma-v2 demand + unit economics.
 * Train: fit unit-bias + profit-bias corrections from PredictionOutcome samples.
 * Never invents sales history. Empty history → low confidence.
 */

import { forecastDemand, type DemandObservation } from './forecast';
import { calculateUnitEconomics } from './profit';
import { decideSignal, type CommerceSignalType } from './signals';
import {
  evaluatePredictions,
  type EvaluationReport,
  type PredictionSample,
} from './evaluation';

export const PREDICTION_ENGINE_FAMILY = 'prediction-engine';
export const PREDICTION_ENGINE_BASE_VERSION = 'prediction-engine-v1';

export type PredictionModelWeights = {
  /** Multiplier on expected units after baseline forecast */
  unitBias: number;
  /** Additive minor-units adjustment per unit contribution (clamped later) */
  profitBiasPerUnitMinor: number;
  /** Blend factor for artifact readiness into confidence (0–1) */
  artifactConfidenceBoost: number;
  sampleSize: number;
  trainedAt: string;
  modelVersion: string;
};

export type ProductPredictionFeatures = {
  productId: string;
  title: string;
  sellingPriceMinor: number;
  marketplaceFeeMinor: number;
  paymentFeeMinor: number;
  supplierCostMinor: number;
  shippingCostMinor: number;
  advertisingAllocationMinor?: number;
  returnReserveMinor?: number;
  currency: string;
  opportunityScore: number;
  policyOutcome: 'approved' | 'approved_with_conditions' | 'manual_review' | 'blocked';
  netMarginBps: number;
  hasActiveListing: boolean;
  dataConfidence: number;
  /** 0–1 media/artifact readiness */
  artifactReadiness?: number;
  observations?: DemandObservation[];
  isFixture?: boolean;
  sourcePlatform?: string;
};

export type ProductPrediction = {
  productId: string;
  title: string;
  horizonDays: 7 | 14 | 30;
  expectedUnits: number;
  lowUnits: number;
  highUnits: number;
  expectedContributionProfitMinor: number;
  signal: CommerceSignalType;
  signalRationale: string;
  confidence: number;
  modelVersion: string;
  factors: string[];
  missingSignals: string[];
  explanation: string;
  isFixture: boolean;
  generatedAt: string;
};

export function defaultPredictionWeights(now = new Date()): PredictionModelWeights {
  return {
    unitBias: 1,
    profitBiasPerUnitMinor: 0,
    artifactConfidenceBoost: 0.08,
    sampleSize: 0,
    trainedAt: now.toISOString(),
    modelVersion: PREDICTION_ENGINE_BASE_VERSION,
  };
}

/**
 * Fit transparent correction weights from outcome samples.
 * unitBias = median(actual/predicted) clamped [0.5, 1.5]
 * profitBiasPerUnit = mean((actualProfit-predictedProfit)/max(predictedUnits,1))
 */
export function trainPredictionModel(
  samples: PredictionSample[],
  now = new Date(),
): {
  weights: PredictionModelWeights;
  evaluation: EvaluationReport;
} {
  const evaluation = evaluatePredictions(
    samples,
    PREDICTION_ENGINE_BASE_VERSION,
    now,
  );

  if (samples.length === 0) {
    return {
      weights: defaultPredictionWeights(now),
      evaluation,
    };
  }

  const ratios: number[] = [];
  let profitBiasSum = 0;
  for (const s of samples) {
    if (s.predictedUnits > 0) {
      ratios.push(s.actualUnits / s.predictedUnits);
    }
    profitBiasSum +=
      (s.actualProfitMinor - s.predictedProfitMinor) /
      Math.max(s.predictedUnits, 1);
  }

  ratios.sort((a, b) => a - b);
  const mid = ratios[Math.floor(ratios.length / 2)] ?? 1;
  const unitBias = Math.min(1.5, Math.max(0.5, mid));
  const profitBiasPerUnitMinor = Math.round(
    Math.min(500, Math.max(-500, profitBiasSum / samples.length)),
  );

  const weights: PredictionModelWeights = {
    unitBias,
    profitBiasPerUnitMinor,
    artifactConfidenceBoost: 0.08,
    sampleSize: samples.length,
    trainedAt: now.toISOString(),
    modelVersion:
      samples.length >= 3
        ? `${PREDICTION_ENGINE_BASE_VERSION}+bias`
        : PREDICTION_ENGINE_BASE_VERSION,
  };

  return {
    weights,
    evaluation: {
      ...evaluation,
      modelVersion: weights.modelVersion,
      recommendation:
        samples.length < 3
          ? evaluation.recommendation
          : `${evaluation.recommendation} Applied unitBias=${unitBias.toFixed(3)}, profitBiasPerUnit=${profitBiasPerUnitMinor}.`,
    },
  };
}

export function predictProduct(
  features: ProductPredictionFeatures,
  horizonDays: 7 | 14 | 30 = 14,
  weights: PredictionModelWeights = defaultPredictionWeights(),
  now = new Date(),
): ProductPrediction {
  const observations = features.observations ?? [];
  const base = forecastDemand(observations, horizonDays, now);

  const expectedUnits = Math.max(
    0,
    Math.round(base.expectedUnits * weights.unitBias),
  );
  const lowUnits = Math.max(0, Math.round(base.lowUnits * weights.unitBias));
  const highUnits = Math.max(
    expectedUnits,
    Math.round(base.highUnits * weights.unitBias),
  );

  const unit = calculateUnitEconomics({
    sellingPriceMinor: features.sellingPriceMinor,
    marketplaceFeeMinor: features.marketplaceFeeMinor,
    paymentFeeMinor: features.paymentFeeMinor,
    supplierCostMinor: features.supplierCostMinor,
    shippingCostMinor: features.shippingCostMinor,
    advertisingAllocationMinor: features.advertisingAllocationMinor ?? 0,
    returnReserveMinor: features.returnReserveMinor ?? 0,
    currency: features.currency,
    units: 1,
  });

  const contributionPerUnit =
    unit.contributionProfitMinor + weights.profitBiasPerUnitMinor;
  const expectedContributionProfitMinor = contributionPerUnit * expectedUnits;

  const artifactBoost =
    (features.artifactReadiness ?? 0) * weights.artifactConfidenceBoost;
  const confidence = Math.min(
    0.95,
    Math.max(0.05, base.confidence + artifactBoost),
  );

  const signal = decideSignal({
    opportunityScore: features.opportunityScore,
    policyOutcome: features.policyOutcome,
    netMarginBps: features.netMarginBps,
    hasActiveListing: features.hasActiveListing,
    forecastConfidence: confidence,
    dataConfidence: features.dataConfidence,
  });

  const factors = [
    ...base.factors,
    `unit_bias=${weights.unitBias.toFixed(3)}`,
    `profit_bias_per_unit=${weights.profitBiasPerUnitMinor}`,
    `artifact_readiness=${(features.artifactReadiness ?? 0).toFixed(2)}`,
    `model=${weights.modelVersion}`,
  ];

  const missing = [...base.missingSignals];
  if ((features.artifactReadiness ?? 0) < 0.3) {
    missing.push('low_artifact_readiness');
  }

  return {
    productId: features.productId,
    title: features.title,
    horizonDays,
    expectedUnits,
    lowUnits,
    highUnits,
    expectedContributionProfitMinor,
    signal: signal.signal,
    signalRationale: signal.rationale,
    confidence: Math.round(confidence * 100) / 100,
    modelVersion: weights.modelVersion,
    factors,
    missingSignals: missing,
    explanation: [
      base.explanation,
      `Prediction engine applied unitBias=${weights.unitBias.toFixed(3)}.`,
      `Expected contribution profit ${expectedContributionProfitMinor} minor over ${horizonDays}d.`,
      signal.rationale,
      features.isFixture ? 'TEST FIXTURE product — not live marketplace truth.' : '',
    ]
      .filter(Boolean)
      .join(' '),
    isFixture: Boolean(features.isFixture),
    generatedAt: now.toISOString(),
  };
}

export function batchPredict(
  products: ProductPredictionFeatures[],
  horizonDays: 7 | 14 | 30 = 14,
  weights?: PredictionModelWeights,
): ProductPrediction[] {
  const w = weights ?? defaultPredictionWeights();
  return products
    .map((p) => predictProduct(p, horizonDays, w))
    .sort((a, b) => b.expectedContributionProfitMinor - a.expectedContributionProfitMinor);
}

export function predictionToCsvRow(p: ProductPrediction): Record<string, string> {
  return {
    productId: p.productId,
    title: p.title,
    horizonDays: String(p.horizonDays),
    expectedUnits: String(p.expectedUnits),
    lowUnits: String(p.lowUnits),
    highUnits: String(p.highUnits),
    expectedContributionProfitMinor: String(p.expectedContributionProfitMinor),
    signal: p.signal,
    confidence: String(p.confidence),
    modelVersion: p.modelVersion,
    isFixture: p.isFixture ? 'true' : 'false',
    generatedAt: p.generatedAt,
  };
}
