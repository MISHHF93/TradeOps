import Link from 'next/link';
import { FixtureReconcileButton } from '../../../../components/terminal/billing-actions';
import { formatMoney } from '../../../../lib/money';
import { terminalGet } from '../../../../lib/terminal-api';

type PayoutsResponse = {
  domain: 'commerce_payouts';
  payouts: Array<{
    id: string;
    provider: string;
    externalPayoutId: string;
    grossAmountMinor: number;
    feeAmountMinor: number;
    netAmountMinor: number;
    currency: string;
    status: string;
    expectedArrival: string | null;
    arrivedAt: string | null;
    createdAt: string;
  }>;
  honesty: { note: string };
};

export default async function FinancePayoutsPage() {
  const result = await terminalGet<PayoutsResponse>('/api/v1/finance/payouts');
  const rows = result.ok ? result.data.payouts : [];

  return (
    <section>
      <header className="terminal-header">
        <div>
          <p className="pill">Finance · marketplace payouts</p>
          <h1>Payouts</h1>
          <p className="lede">
            Processor/marketplace transfers to the merchant bank account — not TradeOps SaaS
            invoices. Match payouts under Reconciliation.
          </p>
        </div>
        <div className="terminal-toolbar">
          <FixtureReconcileButton />
          <Link className="btn ghost" href="/terminal/finance/reconciliation">
            Reconciliation
          </Link>
          <Link className="btn ghost" href="/terminal/finance/payments">
            Payments
          </Link>
        </div>
      </header>

      {!result.ok ? <p className="form-error">{result.error}</p> : null}
      {result.ok ? <p className="meta">{result.data.honesty.note}</p> : null}

      {rows.length === 0 ? (
        <article className="panel">
          <p>
            No payouts yet. After channel payments exist, run{' '}
            <strong>fixture payout reconcile</strong> to create a demo settlement, or ingest live
            channel settlement feeds when connectors are authorized.
          </p>
        </article>
      ) : null}

      <table className="scanner-table">
        <thead>
          <tr>
            <th>Provider</th>
            <th>External ID</th>
            <th>Status</th>
            <th>Gross</th>
            <th>Fees</th>
            <th>Net</th>
            <th>Arrived</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id}>
              <td>{p.provider}</td>
              <td>
                <code>{p.externalPayoutId}</code>
              </td>
              <td>{p.status}</td>
              <td>{formatMoney(p.grossAmountMinor, p.currency)}</td>
              <td>{formatMoney(p.feeAmountMinor, p.currency)}</td>
              <td>{formatMoney(p.netAmountMinor, p.currency)}</td>
              <td>{p.arrivedAt ? new Date(p.arrivedAt).toLocaleString() : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
