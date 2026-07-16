export type DemandObservation = {
  date: string;
  units: number;
};

export type DemandForecastResult = {
  horizonDays: 7 | 14 | 30;
  expectedUnits: number;
  lowUnits: number;
  highUnits: number;
  confidence: number;
  modelVersion: string;
  factors: string[];
  missingSignals: string[];
  explanation: string;
  generatedAt: string;
};

/**
 * Transparent baseline: simple moving average of recent daily units, scaled by horizon.
 */
export function forecastDemand(
  observations: DemandObservation[],
  horizonDays: 7 | 14 | 30,
  now = new Date(),
): DemandForecastResult {
  const missing: string[] = [];
  const factors: string[] = [];

  if (observations.length === 0) {
    missing.push('sales_history');
    return {
      horizonDays,
      expectedUnits: 0,
      lowUnits: 0,
      highUnits: 0,
      confidence: 0.1,
      modelVersion: 'baseline-ma-v1',
      factors: ['no_observations'],
      missingSignals: missing,
      explanation:
        'No sales observations available. Forecast is zero with very low confidence. Collect channel sales history before acting.',
      generatedAt: now.toISOString(),
    };
  }

  const sorted = [...observations].sort((a, b) => a.date.localeCompare(b.date));
  const window = sorted.slice(-14);
  const avg = window.reduce((s, o) => s + o.units, 0) / window.length;
  factors.push(`sma_${window.length}d=${avg.toFixed(2)}`);

  const dow = now.getUTCDay();
  const dowFactor = [0.85, 0.95, 1.0, 1.05, 1.1, 1.15, 1.05][dow] ?? 1;
  factors.push(`dow_factor=${dowFactor}`);

  const expectedUnits = Math.max(0, Math.round(avg * horizonDays * dowFactor));
  const variance =
    window.reduce((s, o) => s + (o.units - avg) ** 2, 0) / Math.max(1, window.length);
  const std = Math.sqrt(variance);
  const band = Math.round(std * horizonDays * 1.28);

  const sampleFactor = Math.min(1, window.length / 14);
  const confidence = Math.round((0.35 + 0.55 * sampleFactor) * 100) / 100;

  if (window.length < 7) {
    missing.push('short_history');
  }

  return {
    horizonDays,
    expectedUnits,
    lowUnits: Math.max(0, expectedUnits - band),
    highUnits: expectedUnits + band,
    confidence,
    modelVersion: 'baseline-ma-v1',
    factors,
    missingSignals: missing,
    explanation: `Expected ~${expectedUnits} units over ${horizonDays}d using ${window.length}-day SMA scaled by day-of-week. Confidence ${confidence}. Interval ≈ [${Math.max(0, expectedUnits - band)}, ${expectedUnits + band}].`,
    generatedAt: now.toISOString(),
  };
}
