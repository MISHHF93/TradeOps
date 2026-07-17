import Link from 'next/link';
import { formatMoney } from '../../../lib/money';
import { terminalGet } from '../../../lib/terminal-api';
import { CapitalSetupActions } from '../../../components/network/capital-setup';

type Portfolio = {
  hasAccount: boolean;
  note?: string;
  account?: {
    id: string;
    status: string;
    currency: string;
    sandbox: boolean;
  };
  capital?: {
    currency: string;
    fundedSettledMinor: number;
    availableMinor: number;
    reservedMinor: number;
    deployedMinor: number;
    returnedMinor: number;
    withdrawableMinor: number;
  };
  labels?: Record<string, string>;
  allocations?: Array<{
    id: string;
    status: string;
    amountReservedMinor: number;
    amountDeployedMinor: number;
  }>;
  honesty?: { note: string; withdrawable: string; sandbox: boolean };
};

export default async function NetworkPortfolioPage() {
  const result = await terminalGet<Portfolio>('/api/v1/network/portfolio');

  if (!result.ok) {
    return (
      <section>
        <p className="form-error">{result.error}</p>
      </section>
    );
  }

  const p = result.data;
  const c = p.capital;
  const cur = c?.currency ?? 'CAD';

  return (
    <section>
      <header className="terminal-header">
        <div>
          <p className="pill">Network · portfolio</p>
          <h1>Commerce portfolio</h1>
          <p className="lede">
            Client-owned operating capital under mandate. Forecast is never labeled as earned
            profit.
          </p>
        </div>
        <div className="terminal-toolbar">
          <Link className="btn ghost" href="/network">
            Network home
          </Link>
          <Link className="btn ghost" href="/network/allocations">
            Allocations
          </Link>
        </div>
      </header>

      {!p.hasAccount ? (
        <article className="panel">
          <p>{p.note}</p>
          <CapitalSetupActions />
        </article>
      ) : (
        <>
          <p className="meta">
            Account <code>{p.account?.status}</code>
            {p.account?.sandbox ? ' · SANDBOX' : ''} · {p.honesty?.note}
          </p>
          <div className="detail-grid">
            <article className="panel">
              <h2>Capital positions</h2>
              <ul className="kv">
                <li>
                  <span>Funded (settled / sandbox confirmed)</span>
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
                <li>
                  <span>Returned</span>
                  <strong>{formatMoney(c?.returnedMinor ?? 0, cur)}</strong>
                </li>
                <li>
                  <span>Withdrawable</span>
                  <strong>{formatMoney(c?.withdrawableMinor ?? 0, cur)}</strong>
                </li>
              </ul>
              <p className="meta">{p.honesty?.withdrawable}</p>
            </article>
            <article className="panel">
              <h2>Label legend</h2>
              <ul>
                {p.labels
                  ? Object.entries(p.labels).map(([k, v]) => (
                      <li key={k}>
                        <strong>{k}</strong>: {v}
                      </li>
                    ))
                  : null}
              </ul>
            </article>
          </div>
          <h2 style={{ marginTop: 24 }}>Recent allocations</h2>
          {(p.allocations ?? []).length === 0 ? (
            <p className="meta">No allocations yet.</p>
          ) : (
            <table className="scanner-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Reserved</th>
                  <th>Deployed</th>
                </tr>
              </thead>
              <tbody>
                {(p.allocations ?? []).map((a) => (
                  <tr key={a.id}>
                    <td>{a.status}</td>
                    <td>{formatMoney(a.amountReservedMinor, cur)}</td>
                    <td>{formatMoney(a.amountDeployedMinor, cur)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div style={{ marginTop: 16 }}>
            <CapitalSetupActions />
          </div>
        </>
      )}
    </section>
  );
}
