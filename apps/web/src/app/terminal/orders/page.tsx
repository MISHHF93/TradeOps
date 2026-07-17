import Link from 'next/link';
import { ProcessEmptyState } from '../../../components/feedback/process-empty-state';
import { CompleteFulfillmentButton } from '../../../components/order-actions';
import { formatMoney } from '../../../lib/money';
import { terminalGet } from '../../../lib/terminal-api';

export default async function OrdersPage() {
  const result = await terminalGet<
    Array<{
      id: string;
      externalId: string;
      sourcePlatform: string;
      status: string;
      totalMinor: number;
      currency: string;
      placedAt: string;
      lines: Array<{ title: string; quantity: number; unitPriceMinor: number }>;
      purchaseOrders: Array<{ id: string; isDraft: boolean; costMinor: number; status: string }>;
      fulfillments: Array<{ status: string; trackingNumber: string | null }>;
    }>
  >('/api/v1/orders');

  const rows = result.ok ? result.data : [];

  return (
    <section>
      <header className="terminal-header">
        <div>
          <p className="pill">Stage view · Sell → Source</p>
          <h1>Orders</h1>
          <p className="lede">
            Customer sales orders (not supplier POs). Draft POs need approval. After delivery, advance
            the Commerce Case to Reconcile on the Process board.
          </p>
        </div>
        <div className="terminal-toolbar">
          <Link className="btn secondary" href="/terminal/fulfillment">
            Fulfillment
          </Link>
          <Link className="btn primary" href="/terminal/process">
            Process board
          </Link>
        </div>
      </header>
      {!result.ok ? <p className="form-error">{result.error}</p> : null}
      {rows.length === 0 ? (
        <ProcessEmptyState
          title="No customer orders yet"
          body="Sell stage needs a published listing and a paid channel order. Approve a listing, then ingest fixture orders or wait for verified channel webhooks. Every order attaches to a Commerce Case before sourcing."
          stage="sell → source"
          primaryHref="/terminal/approvals"
          primaryLabel="Review approvals"
          secondaryHref="/terminal/process"
          secondaryLabel="Process board"
        />
      ) : null}
      <table className="scanner-table">
        <thead>
          <tr>
            <th>External ID</th>
            <th>Channel</th>
            <th>Status</th>
            <th>Total</th>
            <th>Lines</th>
            <th>Supplier PO</th>
            <th>Fulfillment</th>
            <th>Placed</th>
            <th>Close loop</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((o) => (
            <tr key={o.id}>
              <td>{o.externalId}</td>
              <td>{o.sourcePlatform}</td>
              <td>{o.status}</td>
              <td>{formatMoney(o.totalMinor, o.currency)}</td>
              <td>
                {o.lines.map((l, i) => (
                  <div key={i}>
                    {l.quantity}× {l.title}
                  </div>
                ))}
              </td>
              <td>
                {o.purchaseOrders.map((po) => (
                  <div key={po.id}>
                    {po.isDraft ? 'DRAFT' : po.status} {formatMoney(po.costMinor, o.currency)}
                  </div>
                ))}
              </td>
              <td>
                {o.fulfillments.map((f, i) => (
                  <div key={i}>
                    {f.status} {f.trackingNumber ?? ''}
                  </div>
                ))}
              </td>
              <td>{new Date(o.placedAt).toLocaleString()}</td>
              <td>
                {o.status !== 'fulfilled' ? (
                  <CompleteFulfillmentButton orderId={o.id} />
                ) : (
                  'realized'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
