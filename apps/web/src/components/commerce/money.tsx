import { formatMoney } from '../../lib/money';

/**
 * Money display — semantic colors for P&L only when `signed` is set.
 * Accent is never used for profit/loss.
 */
export function Money({
  minor,
  currency = 'USD',
  className = 'num',
  signed = false,
}: {
  minor: number;
  currency?: string;
  className?: string;
  /** When true, positive → green, negative → red (never accent). */
  signed?: boolean;
}) {
  const semantic =
    signed && minor > 0
      ? 'money-positive'
      : signed && minor < 0
        ? 'money-negative'
        : signed
          ? 'money-neutral'
          : '';
  const cls = [className, semantic].filter(Boolean).join(' ');
  return (
    <span className={cls} title={`${minor} minor units`}>
      {formatMoney(minor, currency)}
    </span>
  );
}

/** Confidence as intelligence language (accent), not profit. */
export function ConfidenceMeter({
  value,
  label,
}: {
  /** 0–1 */
  value: number;
  label?: string;
}) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <span className="confidence-meter" title={label ?? `Confidence ${pct}%`}>
      <span className="confidence-meter-track" aria-hidden>
        <span className="confidence-meter-fill" style={{ width: `${pct}%` }} />
      </span>
      <span className="metric-confidence">{pct}%</span>
    </span>
  );
}
