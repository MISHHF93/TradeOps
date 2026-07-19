import Link from 'next/link';
import { TerminalPageFrame } from '../../../../components/commerce/process-chrome';
import { ProcessEmptyState } from '../../../../components/feedback/process-empty-state';
import { formatMoney } from '../../../../lib/money';
import { terminalGet } from '../../../../lib/terminal-api';

type DisputesResponse = {
  domain: 'commerce_disputes';
  disputes: Array<{
    id: string;
    provider: string;
    externalDisputeId: string;
    amountMinor: number;
    currency: string;
    status: string;
    reason: string | null;
    evidenceDueBy: string | null;
    createdAt: string;
    commercePayment: {
      id: string;
      externalPaymentId: string;
      customerOrderId: string;
      status: string;
      capturedAmountMinor: number;
      currency: string;
    };
  }>;
  honesty: { note: string };
};

export default async function FinanceDisputesPage() {
  const result = await terminalGet<DisputesResponse>('/api/v1/finance/disputes');
  const rows = result.ok ? result.data.disputes : [];

  return (
    <TerminalPageFrame
      pill="Finance · disputes / chargebacks"
      title="Disputes"
      lede="Channel chargebacks and payment disputes. Evidence deadlines preserved from the provider. Not SaaS billing dunning."
      relatedPrimary="finance"
      breadcrumbs={[
        { href: '/terminal/workspace', label: 'Workspace' },
        { href: '/terminal/finance/reconciliation', label: 'Finance' },
        { label: 'Disputes' },
      ]}
      toolbar={
        <>
          <Link className="btn ghost" href="/terminal/finance/payments">
            Payments
          </Link>
          <Link className="btn ghost" href="/terminal/finance/reconciliation">
            Reconciliation
          </Link>
          <Link className="btn ghost" href="/app/billing">
            SaaS billing
          </Link>
        </>
      }
      error={result.ok ? null : result.error}
    >
      {result.ok ? <p className="meta">{result.data.honesty.note}</p> : null}

      {rows.length === 0 && result.ok ? (
        <ProcessEmptyState
          title="No open disputes"
          body="When a channel reports a chargeback, it normalizes here with evidence deadlines."
          stage="reconcile"
          primaryHref="/terminal/finance/payments"
          primaryLabel="Payments"
          secondaryHref="/terminal/orders"
          secondaryLabel="Orders"
        />
      ) : null}

      {rows.length > 0 ? (
        <div className="table-wrap">
          <table className="scanner-table">
            <thead>
              <tr>
                <th>Provider</th>
                <th>Status</th>
                <th>Amount</th>
                <th>Reason</th>
                <th>Payment</th>
                <th>Evidence due</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id}>
                  <td>{d.provider}</td>
                  <td>{d.status}</td>
                  <td>{formatMoney(d.amountMinor, d.currency)}</td>
                  <td>{d.reason ?? '—'}</td>
                  <td>
                    <code>{d.commercePayment.externalPaymentId}</code>
                  </td>
                  <td>
                    {d.evidenceDueBy ? new Date(d.evidenceDueBy).toLocaleString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </TerminalPageFrame>
  );
}
