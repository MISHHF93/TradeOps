import Link from 'next/link';
import { formatMoney } from '../../../lib/money';
import { terminalGet } from '../../../lib/terminal-api';

export default async function NetworkPerformancePage() {
  const result = await terminalGet<{
    hasAccount: boolean;
    capital?: {
      currency: string;
      fundedSettledMinor: number;
      availableMinor: number;
      reservedMinor: number;
      deployedMinor: number;
    };
    labels?: Record<string, string>;
    honesty?: { note: string };
  }>('/api/v1/network/performance');

  const c = result.ok ? result.data.capital : null;
  const cur = c?.currency ?? 'CAD';

  return (
    <section>
      <header className="terminal-header">
        <div>
          <p className="pill">Network · performance</p>
          <h1>Commerce performance</h1>
          <p className="lede">
            Performance of operating capital — not an investment return promise. Realized figures
            only when settlement is matched.
          </p>
        </div>
        <Link className="btn ghost" href="/network">
          Network home
        </Link>
      </header>

      {!result.ok ? <p className="form-error">{result.error}</p> : null}
      {result.ok ? <p className="meta">{result.data.honesty?.note}</p> : null}

      <div className="detail-grid">
        <article className="panel">
          <h2>Operating capital snapshot</h2>
          <ul className="kv">
            <li>
              <span>Funded</span>
              <strong>{formatMoney(c?.fundedSettledMinor ?? 0, cur)}</strong>
            </li>
            <li>
              <span>Available</span>
              <strong>{formatMoney(c?.availableMinor ?? 0, cur)}</strong>
            </li>
            <li>
              <span>Reserved</span>
              <strong>{formatMoney(c?.reservedMinor ?? 0, cur)}</strong>
            </li>
            <li>
              <span>Deployed</span>
              <strong>{formatMoney(c?.deployedMinor ?? 0, cur)}</strong>
            </li>
          </ul>
        </article>
        <article className="panel">
          <h2>Do not confuse</h2>
          <ul>
            {result.ok && result.data.labels
              ? Object.entries(result.data.labels).map(([k, v]) => (
                  <li key={k}>
                    <strong>{k}</strong> — {v}
                  </li>
                ))
              : null}
          </ul>
        </article>
      </div>
    </section>
  );
}
