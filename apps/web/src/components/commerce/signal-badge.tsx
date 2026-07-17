import Link from 'next/link';

const SIGNALS = ['BUY', 'SELL', 'HOLD', 'SCALE', 'REDUCE', 'EXIT', 'BLOCKED'] as const;
export type CommerceSignal = (typeof SIGNALS)[number] | string;

/** Role labels — never color-only (§10 / §14). SELL is action, not loss. */
const SIGNAL_ROLE: Record<string, string> = {
  BUY: 'opportunity',
  SELL: 'action',
  HOLD: 'wait',
  SCALE: 'expand',
  REDUCE: 'trim',
  EXIT: 'exit',
  BLOCKED: 'policy',
};

/**
 * theme.md §10 — explainable signals; never color-only.
 * Optional href for product detail explanation.
 */
export function SignalBadge({
  signal,
  href,
  title,
  showRole = true,
}: {
  signal: CommerceSignal;
  href?: string;
  title?: string;
  showRole?: boolean;
}) {
  const key = String(signal).toUpperCase();
  const role = SIGNAL_ROLE[key];
  const cls = `signal signal-${signal}`;
  const tip =
    title ??
    (key === 'SELL'
      ? 'SELL is a commerce action recommendation — not a financial loss'
      : `Signal ${signal} — open for score, confidence, and reasons`);
  const aria =
    key === 'SELL'
      ? 'SELL action — commerce recommendation, not a loss'
      : role
        ? `${signal} ${role}`
        : String(signal);

  const inner = (
    <>
      <span>{signal}</span>
      {showRole && role ? <span className="signal-role">{role}</span> : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={cls} title={tip} aria-label={aria}>
        {inner}
      </Link>
    );
  }
  return (
    <span className={cls} title={tip} aria-label={aria}>
      {inner}
    </span>
  );
}
