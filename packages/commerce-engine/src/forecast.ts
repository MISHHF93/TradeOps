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
 * Transparent baseline-ma-v2:
 * - 14-day SMA of recent daily units, scaled by horizon
 * - day-of-week factor
 * - linear trend from first half vs second half of the window (no neural net)
 *
 * Still a transparent baseline — not a neural demand model. Confidence shrinks
 * with short history and high residual variance.
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
      modelVersion: 'baseline-ma-v2',
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

  // Linear trend: compare second half mean to first half mean of the window.
  let trendFactor = 1;
  if (window.length >= 4) {
    const mid = Math.floor(window.length / 2);
    const first = window.slice(0, mid);
    const second = window.slice(mid);
    const firstAvg = first.reduce((s, o) => s + o.units, 0) / first.length;
    const secondAvg = second.reduce((s, o) => s + o.units, 0) / second.length;
    if (firstAvg > 0.01) {
      // Cap trend so a single spike cannot 3x the forecast.
      trendFactor = Math.min(1.35, Math.max(0.65, secondAvg / firstAvg));
    } else if (secondAvg > firstAvg) {
      trendFactor = 1.1;
    }
    factors.push(`trend_factor=${trendFactor.toFixed(3)}`);
    factors.push(`half_means=${firstAvg.toFixed(2)}→${secondAvg.toFixed(2)}`);
  } else {
    factors.push('trend_factor=1.000 (insufficient_history)');
    missing.push('trend_history');
  }

  const dow = now.getUTCDay();
  const dowFactor = [0.85, 0.95, 1.0, 1.05, 1.1, 1.15, 1.05][dow] ?? 1;
  factors.push(`dow_factor=${dowFactor}`);

  const expectedUnits = Math.max(
    0,
    Math.round(avg * horizonDays * dowFactor * trendFactor),
  );
  const variance =
    window.reduce((s, o) => s + (o.units - avg) ** 2, 0) / Math.max(1, window.length);
  const std = Math.sqrt(variance);
  // Wider band when trend is strong or residual noise is high
  const trendBoost = Math.abs(trendFactor - 1) * 0.5;
  const band = Math.round(std * horizonDays * (1.28 + trendBoost));

  const sampleFactor = Math.min(1, window.length / 14);
  const noisePenalty = avg > 0 ? Math.min(0.25, (std / avg) * 0.15) : 0.1;
  const trendConfidenceAdj = Math.abs(trendFactor - 1) > 0.2 ? -0.05 : 0.02;
  const confidence =
    Math.round(
      Math.max(
        0.1,
        Math.min(0.92, 0.35 + 0.55 * sampleFactor - noisePenalty + trendConfidenceAdj),
      ) * 100,
    ) / 100;

  if (window.length < 7) {
    missing.push('short_history');
  }

  return {
    horizonDays,
    expectedUnits,
    lowUnits: Math.max(0, expectedUnits - band),
    highUnits: expectedUnits + band,
    confidence,
    modelVersion: 'baseline-ma-v2',
    factors,
    missingSignals: missing,
    explanation: `Expected ~${expectedUnits} units over ${horizonDays}d using ${window.length}-day SMA x DOW x trend (baseline-ma-v2). Confidence ${confidence}. Interval ~ [${Math.max(0, expectedUnits - band)}, ${expectedUnits + band}]. Not a neural demand model.`,
    generatedAt: now.toISOString(),
  };
}
