import Link from 'next/link';
import { TerminalPageFrame } from '../../../../components/commerce/process-chrome';
import { ProcessEmptyState } from '../../../../components/feedback/process-empty-state';
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
    <TerminalPageFrame
      pill="Finance · marketplace payouts"
      title="Payouts"
      lede="Processor/marketplace transfers to the merchant bank account — not SaaS invoices. Match under Reconciliation."
      relatedPrimary="finance"
      breadcrumbs={[
        { href: '/terminal/workspace', label: 'Workspace' },
        { href: '/terminal/finance/reconciliation', label: 'Finance' },
        { label: 'Payouts' },
      ]}
      toolbar={
        <>
          <FixtureReconcileButton />
          <Link className="btn ghost" href="/terminal/finance/reconciliation">
            Reconciliation
          </Link>
          <Link className="btn ghost" href="/terminal/finance/payments">
            Payments
          </Link>
        </>
      }
      error={result.ok ? null : result.error}
    >
      {result.ok ? <p className="meta">{result.data.honesty.note}</p> : null}

      {rows.length === 0 && result.ok ? (
        <ProcessEmptyState
          title="No payouts yet"
          body="After channel payments exist, run fixture payout reconcile for a demo settlement, or ingest live settlement feeds when authorized."
          stage="reconcile"
          primaryHref="/terminal/finance/payments"
          primaryLabel="Payments"
          secondaryHref="/terminal/finance/reconciliation"
          secondaryLabel="Reconciliation"
        />
      ) : null}

      {rows.length > 0 ? (
        <div className="table-wrap">
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
        </div>
      ) : null}
    </TerminalPageFrame>
  );
}
