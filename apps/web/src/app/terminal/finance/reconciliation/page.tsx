import Link from 'next/link';
import { FixtureReconcileButton } from '../../../../components/terminal/billing-actions';
import { formatMoney } from '../../../../lib/money';
import { terminalGet } from '../../../../lib/terminal-api';

type ReconciliationsResponse = {
  reconciliations: Array<{
    id: string;
    status: string;
    expectedNetMinor: number;
    actualNetMinor: number;
    varianceMinor: number;
    matchedOrderCount: number;
    unmatchedAmountMinor: number;
    summaryJson: {
      grossSalesMinor?: number;
      refundsMinor?: number;
      processorFeesMinor?: number;
      marketplaceFeesMinor?: number;
      netPayoutMinor?: number;
      unmatchedAmountMinor?: number;
    };
    closedAt: string | null;
    createdAt: string;
    commercePayout: {
      id: string;
      externalPayoutId: string;
      provider: string;
      currency: string;
    } | null;
  }>;
};

export default async function FinanceReconciliationPage() {
  const result = await terminalGet<ReconciliationsResponse>('/api/v1/finance/reconciliations');
  const rows = result.ok ? result.data.reconciliations : [];

  return (
    <section>
      <header className="terminal-header">
        <div>
          <p className="pill">Finance · reconciliation</p>
          <h1>Payout reconciliation</h1>
          <p className="lede">
            Match expected order economics (captures − refunds − fees) to actual payout net. Variance
            and unmatched amounts surface for investigation. Realized profit uses these figures —
            never labels revenue as profit.
          </p>
        </div>
        <div className="terminal-toolbar">
          <FixtureReconcileButton />
          <Link className="btn ghost" href="/terminal/finance/payouts">
            Payouts
          </Link>
          <Link className="btn ghost" href="/terminal/cashflow">
            Cash flow
          </Link>
        </div>
      </header>

      {!result.ok ? <p className="form-error">{result.error}</p> : null}

      {rows.length === 0 ? (
        <article className="panel">
          <p>
            No reconciliation runs yet. Ingest orders/payments, then run fixture reconcile or connect
            settlement feeds.
          </p>
        </article>
      ) : null}

      <div className="detail-grid">
        {rows.map((r) => {
          const c = r.commercePayout?.currency ?? 'USD';
          const s = r.summaryJson ?? {};
          return (
            <article className="panel" key={r.id}>
              <h2>
                {r.status} · {r.matchedOrderCount} orders
              </h2>
              <p className="meta">
                Payout {r.commercePayout?.externalPayoutId ?? '—'} ({r.commercePayout?.provider})
              </p>
              <ul className="kv">
                <li>
                  <span>Gross sales</span>
                  <strong>{formatMoney(s.grossSalesMinor ?? 0, c)}</strong>
                </li>
                <li>
                  <span>Refunds</span>
                  <strong>{formatMoney(s.refundsMinor ?? 0, c)}</strong>
                </li>
                <li>
                  <span>Processor fees</span>
                  <strong>{formatMoney(s.processorFeesMinor ?? 0, c)}</strong>
                </li>
                <li>
                  <span>Marketplace fees</span>
                  <strong>{formatMoney(s.marketplaceFeesMinor ?? 0, c)}</strong>
                </li>
                <li>
                  <span>Expected net</span>
                  <strong>{formatMoney(r.expectedNetMinor, c)}</strong>
                </li>
                <li>
                  <span>Actual net</span>
                  <strong>{formatMoney(r.actualNetMinor, c)}</strong>
                </li>
                <li>
                  <span>Variance</span>
                  <strong>{formatMoney(r.varianceMinor, c)}</strong>
                </li>
                <li>
                  <span>Unmatched</span>
                  <strong>{formatMoney(r.unmatchedAmountMinor, c)}</strong>
                </li>
              </ul>
              {r.closedAt ? (
                <p className="meta">Closed {new Date(r.closedAt).toLocaleString()}</p>
              ) : (
                <p className="meta">Open / needs review</p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
