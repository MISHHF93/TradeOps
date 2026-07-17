import Link from 'next/link';
import { terminalGet } from '../../../lib/terminal-api';

type Profile = {
  customerKey: string;
  orderCount: number;
  lifetimeValueMinor: number;
  contributionLifetimeValueMinor: number;
  returnRate: number;
  repeatPurchaseProbability: number;
  churnRisk: number;
  factors: Array<{ key: string; value: number | string; note: string }>;
  note: string;
};

export default async function CustomersIntelligencePage() {
  const data = await terminalGet<{
    profileCount?: number;
    profiles?: Profile[];
    note?: string;
  }>('/api/v1/saas/customers/intelligence');

  const profiles = data.ok ? data.data.profiles ?? [] : [];

  return (
    <section>
      <header className="terminal-header">
        <div>
          <p className="pill">Customer intelligence · explainable factors</p>
          <h1>Customers</h1>
          <p className="lede">
            Lifetime value, contribution LTV, return rate, repeat probability, and churn risk from
            org orders. Factors shown — not a black-box universal score.
          </p>
        </div>
        <div className="terminal-toolbar">
          <Link className="btn ghost" href="/terminal/orders">
            Orders
          </Link>
          <Link className="btn primary" href="/terminal">
            Scanner
          </Link>
        </div>
      </header>

      {!data.ok ? <p className="form-error">{data.error}</p> : null}

      <p className="meta">
        Profiles: {data.ok ? data.data.profileCount : '—'} · {data.ok ? data.data.note : null}
      </p>

      <table className="scanner-table">
        <thead>
          <tr>
            <th>Customer key</th>
            <th>Orders</th>
            <th>LTV</th>
            <th>Contrib LTV</th>
            <th>Return rate</th>
            <th>Repeat p</th>
            <th>Churn risk</th>
          </tr>
        </thead>
        <tbody>
          {profiles.length === 0 ? (
            <tr>
              <td colSpan={7}>
                <span className="meta">No order-derived customers yet. Run demo loop or import orders.</span>
              </td>
            </tr>
          ) : (
            profiles.map((p) => (
              <tr key={p.customerKey}>
                <td>
                  <strong style={{ fontSize: '0.85rem' }}>{p.customerKey}</strong>
                </td>
                <td>{p.orderCount}</td>
                <td>{(p.lifetimeValueMinor / 100).toFixed(2)}</td>
                <td>{(p.contributionLifetimeValueMinor / 100).toFixed(2)}</td>
                <td>{(p.returnRate * 100).toFixed(1)}%</td>
                <td>{(p.repeatPurchaseProbability * 100).toFixed(0)}%</td>
                <td>{p.churnRisk}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}
