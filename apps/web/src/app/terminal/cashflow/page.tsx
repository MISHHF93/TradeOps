import { formatMoney } from '../../../lib/money';
import { terminalGet } from '../../../lib/terminal-api';

/**
 * Cash view — deliberately separates revenue, contribution, committed cash, and pending payouts.
 * Never labels revenue as profit.
 */
export default async function CashFlowPage() {
  const portfolio = await terminalGet<{
    capitalCommittedMinor: number;
    outstandingSupplierPaymentsMinor: number;
    pendingMarketplacePayoutsMinor: number;
    revenueMinor: number;
    grossProfitEstimateMinor: number;
    netProfitEstimateMinor: number;
    advertisingSpendMinor: number;
    refundExposureMinor: number;
    currency: string;
  }>('/api/v1/terminal/portfolio');

  const orders = await terminalGet<
    Array<{ totalMinor: number; status: string; currency: string }>
  >('/api/v1/orders');

  if (!portfolio.ok) {
    return <p className="form-error">{portfolio.error}</p>;
  }

  const p = portfolio.data;
  const c = p.currency;
  const orderRevenue = orders.ok
    ? orders.data.reduce((s, o) => s + o.totalMinor, 0)
    : p.revenueMinor;

  const committed = p.capitalCommittedMinor;
  const pendingPayouts = p.pendingMarketplacePayoutsMinor;
  const atRisk = p.refundExposureMinor;
  const availableEstimate = Math.max(0, pendingPayouts - committed - atRisk);

  return (
    <section>
      <h1>Cash flow</h1>
      <p className="lede">
        Cash is not profit. Revenue is not profit. Contribution profit is after fees, COGS, shipping,
        ads allocation, and return reserve — before fixed operating costs.
      </p>

      <div className="detail-grid">
        <article className="panel">
          <h2>Inflows</h2>
          <ul className="kv">
            <li>
              <span>Customer order revenue (realized book)</span>
              <strong>{formatMoney(orderRevenue, c)}</strong>
            </li>
            <li>
              <span>Pending marketplace payouts (est.)</span>
              <strong>{formatMoney(pendingPayouts, c)}</strong>
            </li>
          </ul>
        </article>

        <article className="panel">
          <h2>Outflows / commitments</h2>
          <ul className="kv">
            <li>
              <span>Committed / outstanding supplier payments</span>
              <strong>{formatMoney(committed, c)}</strong>
            </li>
            <li>
              <span>Advertising allocation (booked)</span>
              <strong>{formatMoney(p.advertisingSpendMinor, c)}</strong>
            </li>
            <li>
              <span>At-risk cash (return reserve)</span>
              <strong>{formatMoney(atRisk, c)}</strong>
            </li>
          </ul>
        </article>

        <article className="panel">
          <h2>Profitability (not cash)</h2>
          <ul className="kv">
            <li>
              <span>Contribution / net profit estimate</span>
              <strong>{formatMoney(p.netProfitEstimateMinor, c)}</strong>
            </li>
            <li>
              <span>Available cash estimate</span>
              <strong>{formatMoney(availableEstimate, c)}</strong>
            </li>
          </ul>
          <p className="meta">
            Available ≈ pending payouts − committed supplier − return reserve. Improve with live
            payout and bank connectors later.
          </p>
        </article>
      </div>
    </section>
  );
}
