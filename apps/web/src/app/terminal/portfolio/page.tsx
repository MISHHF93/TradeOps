import { formatMoney } from '../../../lib/money';
import { terminalGet } from '../../../lib/terminal-api';

export default async function PortfolioPage() {
  const result = await terminalGet<{
    activeProducts: number;
    totalProducts: number;
    capitalCommittedMinor: number;
    outstandingSupplierPaymentsMinor: number;
    pendingMarketplacePayoutsMinor: number;
    revenueMinor: number;
    grossProfitEstimateMinor: number;
    netProfitEstimateMinor: number;
    advertisingSpendMinor: number;
    refundExposureMinor: number;
    categoryConcentration: Record<string, number>;
    currency: string;
  }>('/api/v1/terminal/portfolio');

  if (!result.ok) {
    return <p className="form-error">{result.error}</p>;
  }

  const p = result.data;
  const c = p.currency;

  return (
    <section>
      <h1 className="workspace-title-active">Portfolio</h1>
      <p className="lede">
        Active commerce book. Revenue is not profit. Estimates use opportunity models until realized
        orders settle.
      </p>
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
              <span>Capital committed</span>
              <strong>{formatMoney(p.capitalCommittedMinor, c)}</strong>
            </li>
            <li>
              <span>Outstanding supplier payments</span>
              <strong>{formatMoney(p.outstandingSupplierPaymentsMinor, c)}</strong>
            </li>
            <li>
              <span>Pending marketplace payouts</span>
              <strong>{formatMoney(p.pendingMarketplacePayoutsMinor, c)}</strong>
            </li>
          </ul>
        </article>
        <article className="panel">
          <h2>P&amp;L (clear labels)</h2>
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
              <span>Advertising allocation</span>
              <strong>{formatMoney(p.advertisingSpendMinor, c)}</strong>
            </li>
            <li>
              <span>Refund exposure reserve</span>
              <strong>{formatMoney(p.refundExposureMinor, c)}</strong>
            </li>
          </ul>
        </article>
        <article className="panel">
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
      </div>
    </section>
  );
}
