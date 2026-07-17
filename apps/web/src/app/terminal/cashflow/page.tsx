import Link from 'next/link';
import {
  LiveEmptyState,
  ProvenanceMeta,
  SimulationBanner,
} from '../../../components/commerce/provenance-meta';
import {
  ProcessPageHeader,
  ProcessRelatedLinks,
} from '../../../components/commerce/process-chrome';
import { formatMoney } from '../../../lib/money';
import { PROCESS_LABELS } from '../../../lib/process-ux';
import { terminalGet } from '../../../lib/terminal-api';

type Provenance = {
  origin?: string;
  sourceLabel?: string;
  sourceConnector?: string | null;
  observedAt?: string;
  syncStatus?: string;
  confidence?: number;
  lineage?: string;
  isLiveOperational?: boolean;
  simulationLabel?: string | null;
  refreshHint?: string | null;
};

/**
 * Cash view — revenue ≠ profit. No illustrative/fake sparklines.
 * Pending payouts only when CommercePayout exists.
 */
export default async function CashFlowPage() {
  const portfolio = await terminalGet<{
    capitalCommittedMinor: number;
    outstandingSupplierPaymentsMinor: number;
    pendingMarketplacePayoutsMinor: number | null;
    revenueMinor: number;
    grossProfitEstimateMinor: number;
    netProfitEstimateMinor: number;
    advertisingSpendMinor: number;
    refundExposureMinor: number;
    currency: string;
    dataClass?: {
      fixtureProducts: number;
      liveOrCanonicalProducts: number;
      simulationMode: boolean;
      productionStrict?: boolean;
      excludedFixtures?: number;
    };
    isolation?: {
      excludedFixtures: number;
      simulationMode: boolean;
      strict: boolean;
      note: string;
    };
    provenance?: Record<string, Provenance>;
  }>('/api/v1/terminal/portfolio');

  const orders = await terminalGet<
    Array<{ totalMinor: number; status: string; currency: string; placedAt?: string }>
  >('/api/v1/orders');

  if (!portfolio.ok) {
    return (
      <section>
        <p className="form-error">{portfolio.error}</p>
        <Link href="/terminal/process">{PROCESS_LABELS.openProcess}</Link>
      </section>
    );
  }

  const p = portfolio.data;
  const c = p.currency;
  const prov = p.provenance ?? {};
  const orderRevenue = orders.ok
    ? orders.data.reduce((s, o) => s + o.totalMinor, 0)
    : p.revenueMinor;

  const committed = p.capitalCommittedMinor;
  const pendingPayouts = p.pendingMarketplacePayoutsMinor;
  const atRisk = p.refundExposureMinor;

  return (
    <section>
      <ProcessPageHeader
        pill="Canonical cash · not profit"
        title="Cash flow"
        lede="Cash is not profit. Revenue is not profit. Contribution estimates are after modeled fees/COGS/shipping/return reserve — before fixed opex. No fabricated charts."
        breadcrumbs={[
          { href: '/terminal/process', label: PROCESS_LABELS.boardTitle },
          { label: 'Cash flow' },
        ]}
        toolbar={
          <Link className="btn primary" href="/terminal/process">
            {PROCESS_LABELS.openProcess}
          </Link>
        }
      />
      <ProcessRelatedLinks primary="process" />

      <SimulationBanner active={p.dataClass?.simulationMode} />
      {p.isolation?.strict ? (
        <p className="pill" style={{ marginBottom: 12 }}>
          PRODUCTION ISOLATION — fixture products excluded from book KPIs (
          {p.isolation.excludedFixtures} excluded)
        </p>
      ) : null}
      {p.dataClass && p.dataClass.fixtureProducts > 0 && !p.isolation?.strict ? (
        <p className="pill" style={{ marginBottom: 12 }}>
          TEST FIXTURE — {p.dataClass.fixtureProducts} fixture product(s) in book
        </p>
      ) : null}

      <div className="detail-grid">
        <article className="panel">
          <h2>Inflows</h2>
          <ul className="kv">
            <li>
              <span>Customer order revenue (book)</span>
              <strong>{formatMoney(orderRevenue, c)}</strong>
            </li>
          </ul>
          <ProvenanceMeta provenance={prov.revenue} compact />
          {orders.ok && orders.data.length === 0 ? (
            <LiveEmptyState
              title="No orders yet"
              reason="Revenue is the sum of CustomerOrder.totalMinor. Connect a marketplace and ingest orders, or use labeled fixture order ingest in simulation."
              actionHref="/terminal/orders"
              actionLabel="Open orders"
            />
          ) : null}
        </article>

        <article className="panel">
          <h2>Pending marketplace payouts</h2>
          {pendingPayouts == null ? (
            <LiveEmptyState
              title="No payout data"
              reason="We never invent pending payouts (e.g. % of revenue). Connect a payment connector and sync CommercePayout rows."
              actionHref="/terminal/connectors"
              actionLabel="Connector Health Center"
            />
          ) : (
            <>
              <strong className="text-accent" style={{ fontSize: '1.4rem' }}>
                {formatMoney(pendingPayouts, c)}
              </strong>
              <ProvenanceMeta provenance={prov.pendingPayouts} />
              {pendingPayouts > 0 ? (
                <p className="meta">
                  Estimated free cash after commitments/reserves:{' '}
                  {formatMoney(
                    Math.max(0, pendingPayouts - committed - atRisk),
                    c,
                  )}{' '}
                  (derived from payout − PO commitments − refund reserve)
                </p>
              ) : null}
            </>
          )}
        </article>

        <article className="panel">
          <h2>Outflows / reserves</h2>
          <ul className="kv">
            <li>
              <span>Supplier PO commitments</span>
              <strong>{formatMoney(committed, c)}</strong>
            </li>
            <li>
              <span>Refund exposure reserve</span>
              <strong>{formatMoney(atRisk, c)}</strong>
            </li>
            <li>
              <span>Ad allocation (planning)</span>
              <strong>{formatMoney(p.advertisingSpendMinor, c)}</strong>
            </li>
            <li>
              <span>Contribution estimate (model)</span>
              <strong>{formatMoney(p.grossProfitEstimateMinor, c)}</strong>
            </li>
          </ul>
          <ProvenanceMeta provenance={prov.expectedContribution} compact />
          <ProvenanceMeta provenance={prov.advertisingAllocation} compact />
        </article>
      </div>
    </section>
  );
}
