/**
 * Chart legend using single token source (§11).
 * Accent = analytical / revenue; green/red only for profit/loss meaning.
 */
export type ChartSeriesKey =
  | 'revenue'
  | 'primary'
  | 'profit'
  | 'loss'
  | 'forecast'
  | 'confidence';

const LABELS: Record<ChartSeriesKey, string> = {
  revenue: 'Revenue',
  primary: 'Primary series',
  profit: 'Profit',
  loss: 'Loss',
  forecast: 'Forecast band',
  confidence: 'Confidence',
};

export function ChartLegend({
  series = ['revenue', 'profit', 'loss', 'forecast', 'confidence'],
}: {
  series?: ChartSeriesKey[];
}) {
  return (
    <div className="chart-legend" role="list" aria-label="Chart series">
      {series.map((key) => (
        <span key={key} className="chart-legend-item" role="listitem">
          <span
            className={`chart-swatch chart-swatch-${key === 'primary' ? 'primary' : key}`}
            aria-hidden
          />
          <span>{LABELS[key]}</span>
        </span>
      ))}
    </div>
  );
}

/** Minimal sparkline — stroke uses currentColor (set via chart-sparkline class). */
export function Sparkline({
  values,
  className = 'chart-sparkline',
  label = 'Trend',
}: {
  values: number[];
  className?: string;
  label?: string;
}) {
  if (values.length < 2) {
    return <span className="meta">{label}: insufficient data</span>;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const w = 120;
  const h = 40;
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / span) * (h - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg
      className={className}
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label={label}
      preserveAspectRatio="none"
    >
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        points={pts}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
