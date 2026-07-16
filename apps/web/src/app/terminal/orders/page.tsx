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
      <h1>Customer orders &amp; supplier POs</h1>
      <p className="lede">
        Customer sales orders are separate from supplier purchase orders. Draft POs require approval.
      </p>
      {!result.ok ? <p className="form-error">{result.error}</p> : null}
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
