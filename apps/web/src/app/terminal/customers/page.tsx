import Link from 'next/link';
import { TerminalPageFrame } from '../../../components/commerce/process-chrome';
import { ProcessEmptyState } from '../../../components/feedback/process-empty-state';
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
    <TerminalPageFrame
      pill="Customer intelligence · explainable factors"
      title="Customers"
      lede="Lifetime value, contribution LTV, return rate, repeat probability, and churn risk from org orders. Factors shown — not a black-box universal score."
      relatedPrimary="orders"
      breadcrumbs={[
        { href: '/terminal/workspace', label: 'Workspace' },
        { label: 'Customers' },
      ]}
      toolbar={
        <>
          <Link className="btn secondary" href="/terminal/orders">
            Orders
          </Link>
          <Link className="btn ghost" href="/terminal">
            Discover
          </Link>
        </>
      }
      error={data.ok ? null : data.error}
    >
      <p className="meta">
        Profiles: {data.ok ? data.data.profileCount ?? profiles.length : '—'}
        {data.ok && data.data.note ? ` · ${data.data.note}` : null}
      </p>

      {profiles.length === 0 && data.ok ? (
        <ProcessEmptyState
          title="No customer profiles yet"
          body="Profiles are derived from customer orders. Ingest fixture orders after a listing is active, or wait for live channel sales."
          stage="sell → learn"
          primaryHref="/terminal/orders"
          primaryLabel="Open orders"
          secondaryHref="/terminal/process"
          secondaryLabel="Process board"
        />
      ) : null}

      {profiles.length > 0 ? (
        <div className="table-wrap">
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
              {profiles.map((p) => (
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
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </TerminalPageFrame>
  );
}
