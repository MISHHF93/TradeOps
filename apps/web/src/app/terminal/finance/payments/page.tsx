import Link from 'next/link';
import { formatMoney } from '../../../../lib/money';
import { terminalGet } from '../../../../lib/terminal-api';

type PaymentsResponse = {
  domain: 'commerce_payments';
  payments: Array<{
    id: string;
    customerOrderId: string;
    orderExternalId: string;
    orderStatus: string;
    channel: string;
    provider: string;
    externalPaymentId: string;
    currency: string;
    authorizedAmountMinor: number;
    capturedAmountMinor: number;
    refundedAmountMinor: number;
    feeAmountMinor: number | null;
    netAmountMinor: number | null;
    status: string;
    createdAt: string;
  }>;
  honesty: { note: string };
};

/**
 * Commerce payment intelligence — shopper money on channels.
 * Not SaaS Stripe subscription billing (/app/billing).
 */
export default async function FinancePaymentsPage() {
  const result = await terminalGet<PaymentsResponse>('/api/v1/finance/payments');
  const rows = result.ok ? result.data.payments : [];

  return (
    <section>
      <header className="terminal-header">
        <div>
          <p className="pill">Finance · commerce payments</p>
          <h1>Channel payments</h1>
          <p className="lede">
            Normalized shopper payments from marketplaces and storefronts. Separate from{' '}
            <Link href="/app/billing">SaaS billing</Link>. Supplier sourcing is blocked until payment
            is captured (or authorized under policy).
          </p>
        </div>
        <div className="terminal-toolbar">
          <Link className="btn secondary" href="/terminal/finance/payouts">
            Payouts
          </Link>
          <Link className="btn ghost" href="/terminal/finance/reconciliation">
            Reconciliation
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
          <p>
            No commerce payments yet. Ingest fixture orders (Orders → process) or wait for channel
            payment events. SaaS invoices are not listed here.
          </p>
        </article>
      ) : null}

      <table className="scanner-table">
        <thead>
          <tr>
            <th>Order</th>
            <th>Channel</th>
            <th>Provider</th>
            <th>Status</th>
            <th>Captured</th>
            <th>Refunded</th>
            <th>Fees</th>
            <th>Net</th>
            <th>External ID</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id}>
              <td>
                <Link href={`/terminal/orders`}>{p.orderExternalId}</Link>
                <div className="meta">{p.orderStatus}</div>
              </td>
              <td>{p.channel}</td>
              <td>{p.provider}</td>
              <td>{p.status}</td>
              <td>{formatMoney(p.capturedAmountMinor, p.currency)}</td>
              <td>{formatMoney(p.refundedAmountMinor, p.currency)}</td>
              <td>
                {p.feeAmountMinor != null ? formatMoney(p.feeAmountMinor, p.currency) : '—'}
              </td>
              <td>
                {p.netAmountMinor != null ? formatMoney(p.netAmountMinor, p.currency) : '—'}
              </td>
              <td>
                <code>{p.externalPaymentId}</code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
