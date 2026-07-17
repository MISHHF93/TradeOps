import Link from 'next/link';
import { terminalGet } from '../../../lib/terminal-api';

export default async function NetworkPayoutsPage() {
  const result = await terminalGet<{
    withdrawableMinor: number;
    note: string;
    blocked: string[];
  }>('/api/v1/network/payouts');

  return (
    <section>
      <header className="terminal-header">
        <div>
          <p className="pill">Network · payouts</p>
          <h1>Client payouts</h1>
          <p className="lede">
            Proceeds leave only through approved payout providers after settlement, reserves, and
            risk checks. Not an internal transfer from a fake wallet.
          </p>
        </div>
        <Link className="btn ghost" href="/network/portfolio">
          Portfolio
        </Link>
      </header>

      {!result.ok ? (
        <p className="form-error">{result.error}</p>
      ) : (
        <article className="panel">
          <p>
            Withdrawable (minor units): <strong>{result.data.withdrawableMinor}</strong>
          </p>
          <p className="meta">{result.data.note}</p>
          <h2>Cannot withdraw</h2>
          <ul>
            {result.data.blocked.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </article>
      )}
    </section>
  );
}
