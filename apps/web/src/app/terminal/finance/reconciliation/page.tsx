import Link from 'next/link';
import { TerminalPageFrame } from '../../../../components/commerce/process-chrome';
import { ProcessEmptyState } from '../../../../components/feedback/process-empty-state';
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
    <TerminalPageFrame
      pill="Finance · reconciliation"
      title="Payout reconciliation"
      lede="Match expected order economics (captures − refunds − fees) to actual payout net. Realized profit uses these figures — never labels revenue as profit."
      relatedPrimary="finance"
      breadcrumbs={[
        { href: '/terminal/workspace', label: 'Workspace' },
        { label: 'Finance' },
      ]}
      toolbar={
        <>
          <FixtureReconcileButton />
          <Link className="btn ghost" href="/terminal/finance/payments">
            Payments
          </Link>
          <Link className="btn ghost" href="/terminal/finance/payouts">
            Payouts
          </Link>
          <Link className="btn ghost" href="/terminal/cashflow">
            Cash flow
          </Link>
        </>
      }
      error={result.ok ? null : result.error}
    >
      {rows.length === 0 && result.ok ? (
        <ProcessEmptyState
          title="No reconciliation runs yet"
          body="Ingest orders/payments, then run fixture reconcile or connect settlement feeds."
          stage="reconcile"
          primaryHref="/terminal/finance/payments"
          primaryLabel="Payments"
          secondaryHref="/terminal/orders"
          secondaryLabel="Orders"
        />
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
    </TerminalPageFrame>
  );
}
