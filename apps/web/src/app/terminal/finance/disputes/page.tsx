import Link from 'next/link';
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
    <section>
      <header className="terminal-header">
        <div>
          <p className="pill">Finance · disputes / chargebacks</p>
          <h1>Disputes</h1>
          <p className="lede">
            Channel chargebacks and payment disputes. Evidence deadlines and status are preserved
            from the provider. Not SaaS billing dunning — see{' '}
            <Link href="/app/billing">Billing</Link>.
          </p>
        </div>
        <div className="terminal-toolbar">
          <Link className="btn ghost" href="/terminal/finance/payments">
            Payments
          </Link>
          <Link className="btn ghost" href="/terminal/orders">
            Orders
          </Link>
        </div>
      </header>

      {!result.ok ? <p className="form-error">{result.error}</p> : null}
      {result.ok ? <p className="meta">{result.data.honesty.note}</p> : null}

      {rows.length === 0 ? (
        <article className="panel">
          <p>No open disputes. When a channel reports a chargeback, it normalizes here.</p>
        </article>
      ) : null}

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
    </section>
  );
}
