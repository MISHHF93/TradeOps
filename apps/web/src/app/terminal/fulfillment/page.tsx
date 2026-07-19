import Link from 'next/link';
import { TerminalPageFrame } from '../../../components/commerce/process-chrome';
import { ProcessEmptyState } from '../../../components/feedback/process-empty-state';
import { formatMoney } from '../../../lib/money';
import { terminalGet } from '../../../lib/terminal-api';

/**
 * Fulfillment stage view — sell / source / fulfill cases + order handoff.
 */
export default async function FulfillmentStagePage() {
  const process = await terminalGet<{
    byStage: Record<
      string,
      Array<{
        id: string;
        productTitle?: string;
        currentStage: string;
        stageStatus: string;
        nextActionLabel?: string | null;
        journeyHref: string;
        blockerMessage?: string | null;
      }>
    >;
  }>('/api/v1/commerce/process');

  const orders = await terminalGet<
    Array<{
      id: string;
      status: string;
      totalMinor: number;
      currency: string;
      externalId: string;
      placedAt: string;
    }>
  >('/api/v1/orders');

  const stages = ['sell', 'source', 'fulfill'] as const;
  const cases = process.ok
    ? stages.flatMap((s) => process.data.byStage[s] ?? [])
    : [];
  const orderRows = orders.ok ? orders.data : [];
  const empty = cases.length === 0 && orderRows.length === 0;

  return (
    <TerminalPageFrame
      pill="Stage view · Sell → Source → Fulfill"
      title="Fulfillment"
      lede="Cases and orders awaiting sourcing or shipment. Same Commerce Cases as Process — not a separate silo."
      showStageStrip
      currentStage="fulfill"
      relatedPrimary="orders"
      breadcrumbs={[
        { href: '/terminal/workspace', label: 'Workspace' },
        { href: '/terminal/process', label: 'Process' },
        { label: 'Fulfillment' },
      ]}
      toolbar={
        <>
          <Link className="btn primary" href="/terminal/orders">
            Orders
          </Link>
          <Link className="btn ghost" href="/terminal/process">
            Process board
          </Link>
        </>
      }
      error={!process.ok ? process.error : !orders.ok ? orders.error : null}
    >
      {empty ? (
        <ProcessEmptyState
          title="Nothing to fulfill yet"
          body="After publish and paid orders, sell/source/fulfill cases show here when Process is synced. Start from listings and orders."
          stage="fulfill"
          primaryHref="/terminal/orders"
          primaryLabel="Orders"
          secondaryHref="/terminal/process"
          secondaryLabel="Sync process"
        />
      ) : null}

      {!empty ? (
        <>
          <article className="panel wide" style={{ marginBottom: 16 }}>
            <h2>Cases in sell / source / fulfill</h2>
            {cases.length === 0 ? (
              <p className="meta">
                No Commerce Cases in these stages. Orders below may still need action.
              </p>
            ) : (
              <table className="compact">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Stage</th>
                    <th>Status</th>
                    <th>Next step</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {cases.map((c) => (
                    <tr key={c.id}>
                      <td>{c.productTitle ?? c.id.slice(0, 8)}</td>
                      <td>{c.currentStage}</td>
                      <td>{c.stageStatus}</td>
                      <td className="meta">{c.blockerMessage ?? c.nextActionLabel ?? '—'}</td>
                      <td>
                        <Link href={c.journeyHref}>Open case</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </article>

          <article className="panel wide">
            <h2>Customer orders</h2>
            {orderRows.length === 0 ? (
              <p className="meta">No customer orders in this view.</p>
            ) : (
              <table className="compact">
                <thead>
                  <tr>
                    <th>External ID</th>
                    <th>Status</th>
                    <th>Total</th>
                    <th>Placed</th>
                    <th>Next</th>
                  </tr>
                </thead>
                <tbody>
                  {orderRows.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <code>{o.externalId}</code>
                      </td>
                      <td>{o.status}</td>
                      <td>{formatMoney(o.totalMinor, o.currency)}</td>
                      <td>{new Date(o.placedAt).toLocaleString()}</td>
                      <td>
                        <Link href="/terminal/orders">Prepare supplier order / fulfill →</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </article>
        </>
      ) : null}
    </TerminalPageFrame>
  );
}
