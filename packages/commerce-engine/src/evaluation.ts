/**
 * Prediction evaluation — learning loop inputs.
 * Keeps metrics transparent for baseline model improvement decisions.
 */

export type PredictionSample = {
  predictedUnits: number;
  actualUnits: number;
  predictedProfitMinor: number;
  actualProfitMinor: number;
  /** True if operational signal direction was later consistent with profitability */
  signalCorrect?: boolean;
};

export type EvaluationReport = {
  modelVersion: string;
  sampleSize: number;
  meanAbsoluteUnitError: number;
  meanAbsoluteProfitErrorMinor: number;
  /** |actual-predicted| / max(|predicted|,1) average */
  meanAbsolutePercentageProfitError: number;
  profitBiasMinor: number;
  signalHitRate: number | null;
  recommendation: string;
  generatedAt: string;
};

export function evaluatePredictions(
  samples: PredictionSample[],
  modelVersion = 'baseline-ma-v2',
  now = new Date(),
): EvaluationReport {
  if (samples.length === 0) {
    return {
      modelVersion,
      sampleSize: 0,
      meanAbsoluteUnitError: 0,
      meanAbsoluteProfitErrorMinor: 0,
      meanAbsolutePercentageProfitError: 0,
      profitBiasMinor: 0,
      signalHitRate: null,
      recommendation:
        'No outcomes yet. Run simulation or complete fulfilled orders to evaluate forecasts.',
      generatedAt: now.toISOString(),
    };
  }

  let unitErr = 0;
  let profitErr = 0;
  let profitPct = 0;
  let bias = 0;
  let signalHits = 0;
  let signalN = 0;

  for (const s of samples) {
    unitErr += Math.abs(s.actualUnits - s.predictedUnits);
    const pe = s.actualProfitMinor - s.predictedProfitMinor;
    profitErr += Math.abs(pe);
    bias += pe;
    profitPct += Math.abs(pe) / Math.max(Math.abs(s.predictedProfitMinor), 1);
    if (typeof s.signalCorrect === 'boolean') {
      signalN += 1;
      if (s.signalCorrect) signalHits += 1;
    }
  }

  const n = samples.length;
  const maeUnits = unitErr / n;
  const maeProfit = Math.round(profitErr / n);
  const mape = profitPct / n;
  const avgBias = Math.round(bias / n);
  const hitRate = signalN > 0 ? signalHits / signalN : null;

  let recommendation =
    'Baseline remains acceptable. Keep collecting outcomes before changing models.';
  if (n >= 5 && maeUnits > 5) {
    recommendation =
      'Unit forecast MAE is elevated. Prefer longer sales history and reduce seasonal bias before adding complex models.';
  }
  if (n >= 5 && mape > 0.35) {
    recommendation =
      'Profit forecast error is high. Revisit fee/COGS assumptions and return reserves before neural models.';
  }
  if (hitRate !== null && hitRate < 0.5 && signalN >= 5) {
    recommendation =
      'Signal hit rate below 50%. Tighten BUY threshold or raise policy/margin gates.';
  }
  if (n >= 20 && maeUnits <= 2 && (hitRate === null || hitRate >= 0.65)) {
    recommendation =
      'Sufficient stable outcomes. Candidate for A/B testing a second model version (e.g. exponential smoothing).';
  }

  return {
    modelVersion,
    sampleSize: n,
    meanAbsoluteUnitError: Math.round(maeUnits * 100) / 100,
    meanAbsoluteProfitErrorMinor: maeProfit,
    meanAbsolutePercentageProfitError: Math.round(mape * 1000) / 1000,
    profitBiasMinor: avgBias,
    signalHitRate: hitRate === null ? null : Math.round(hitRate * 1000) / 1000,
    recommendation,
    generatedAt: now.toISOString(),
  };
}

/** Realized contribution for a completed customer line using known unit costs. */
export function realizedContributionProfitMinor(input: {
  unitPriceMinor: number;
  quantity: number;
  marketplaceFeeMinorPerUnit: number;
  paymentFeeMinorPerUnit: number;
  supplierCostMinorPerUnit: number;
  shippingCostMinorPerUnit: number;
  adAllocationMinorPerUnit?: number;
  returnReserveMinorPerUnit?: number;
  refundMinor?: number;
}): number {
  const q = input.quantity;
  const revenue = input.unitPriceMinor * q;
  const costs =
    (input.marketplaceFeeMinorPerUnit +
      input.paymentFeeMinorPerUnit +
      input.supplierCostMinorPerUnit +
      input.shippingCostMinorPerUnit +
      (input.adAllocationMinorPerUnit ?? 0) +
      (input.returnReserveMinorPerUnit ?? 0)) *
      q +
    (input.refundMinor ?? 0);
  return revenue - costs;
}
