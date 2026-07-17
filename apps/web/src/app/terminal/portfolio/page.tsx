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

export default async function PortfolioPage() {
  const result = await terminalGet<{
    activeProducts: number;
    totalProducts: number;
    capitalCommittedMinor: number;
    outstandingSupplierPaymentsMinor: number;
    pendingMarketplacePayoutsMinor: number | null;
    revenueMinor: number;
    grossProfitEstimateMinor: number;
    netProfitEstimateMinor: number;
    advertisingSpendMinor: number;
    refundExposureMinor: number;
    categoryConcentration: Record<string, number>;
    marketplaceConcentration?: Record<string, number>;
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

  if (!result.ok) {
    return (
      <section>
        <p className="form-error">{result.error}</p>
        <Link href="/terminal/process">{PROCESS_LABELS.openProcess}</Link>
      </section>
    );
  }

  const p = result.data;
  const c = p.currency;
  const prov = p.provenance ?? {};

  return (
    <section>
      <ProcessPageHeader
        pill="Canonical store · portfolio"
        title="Portfolio"
        lede="Active commerce book from org database. Revenue is not profit. Estimates use opportunity models until orders settle. Never invents payouts."
        breadcrumbs={[
          { href: '/terminal/process', label: PROCESS_LABELS.boardTitle },
          { label: 'Portfolio' },
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
          PRODUCTION ISOLATION — excluded {p.isolation.excludedFixtures} fixture product
          {p.isolation.excludedFixtures === 1 ? '' : 's'} from KPI totals
        </p>
      ) : null}

      {p.dataClass && p.dataClass.fixtureProducts > 0 && !p.isolation?.strict ? (
        <p className="pill" style={{ marginBottom: 12 }}>
          TEST FIXTURE — {p.dataClass.fixtureProducts} product(s) from fixture sources (included
          in totals until TRADEOPS_PRODUCTION_WORKSPACE=1)
        </p>
      ) : null}

      <div className="detail-grid">
        <article className="panel">
          <h2>Exposure</h2>
          <ul className="kv">
            <li>
              <span>Active listed products</span>
              <strong>{p.activeProducts}</strong>
            </li>
            <li>
              <span>Total products</span>
              <strong>{p.totalProducts}</strong>
            </li>
            <li>
              <span>Capital committed (POs)</span>
              <strong>{formatMoney(p.capitalCommittedMinor, c)}</strong>
            </li>
            <li>
              <span>Outstanding supplier payments</span>
              <strong>{formatMoney(p.outstandingSupplierPaymentsMinor, c)}</strong>
            </li>
          </ul>
        </article>

        <article className="panel">
          <h2>P&amp;L (labeled)</h2>
          <ul className="kv">
            <li>
              <span>Revenue (orders)</span>
              <strong>{formatMoney(p.revenueMinor, c)}</strong>
            </li>
            <li>
              <span>Gross profit estimate</span>
              <strong>{formatMoney(p.grossProfitEstimateMinor, c)}</strong>
            </li>
            <li>
              <span>Net profit estimate</span>
              <strong>{formatMoney(p.netProfitEstimateMinor, c)}</strong>
            </li>
            <li>
              <span>Advertising allocation (planning)</span>
              <strong>{formatMoney(p.advertisingSpendMinor, c)}</strong>
            </li>
            <li>
              <span>Refund exposure reserve</span>
              <strong>{formatMoney(p.refundExposureMinor, c)}</strong>
            </li>
          </ul>
          <ProvenanceMeta provenance={prov.revenue} compact />
          <ProvenanceMeta provenance={prov.expectedContribution} compact />
          <ProvenanceMeta provenance={prov.advertisingAllocation} compact />
        </article>

        <article className="panel">
          <h2>Pending marketplace payouts</h2>
          {p.pendingMarketplacePayoutsMinor == null ? (
            <LiveEmptyState
              title="No payout data"
              reason="Payouts are only shown when CommercePayout rows exist from a payment connector. We never invent payouts as a percentage of revenue."
              actionHref="/terminal/connectors"
              actionLabel="Open Connector Health Center"
            />
          ) : (
            <>
              <strong className="text-accent" style={{ fontSize: '1.4rem' }}>
                {formatMoney(p.pendingMarketplacePayoutsMinor, c)}
              </strong>
              <ProvenanceMeta provenance={prov.pendingPayouts} />
            </>
          )}
        </article>
      </div>

      {Object.keys(p.categoryConcentration ?? {}).length > 0 ? (
        <article className="panel" style={{ marginTop: 16 }}>
          <h2>Category concentration</h2>
          <ul className="kv">
            {Object.entries(p.categoryConcentration).map(([k, v]) => (
              <li key={k}>
                <span>{k}</span>
                <strong>{v}</strong>
              </li>
            ))}
          </ul>
        </article>
      ) : null}
    </section>
  );
}