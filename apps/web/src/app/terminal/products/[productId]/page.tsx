import Link from 'next/link';
import { ProductActions } from '../../../../components/terminal-actions';
import { formatBps, formatMoney } from '../../../../lib/money';
import { terminalGet } from '../../../../lib/terminal-api';

type Props = { params: Promise<{ productId: string }> };

export default async function ProductDetailPage({ params }: Props) {
  const { productId } = await params;
  const result = await terminalGet<Record<string, unknown>>(
    `/api/v1/products/${productId}`,
  );

  if (!result.ok) {
    return (
      <section>
        <p className="form-error">{result.error}</p>
        <Link href="/terminal">Back to scanner</Link>
      </section>
    );
  }

  const p = result.data as {
    id: string;
    title: string;
    description: string;
    category: string;
    currency: string;
    supplierCostMinor: number;
    shippingCostMinor: number;
    targetPriceMinor: number;
    marketplaceFeeMinor: number;
    paymentFeeMinor: number;
    adAllocationMinor: number;
    returnReserveMinor: number;
    rating: number;
    reviewCount: number;
    dataConfidence: number;
    dataFreshnessAt: string;
    opportunities: Array<{
      score: number;
      explanation: string;
      currentSignal: string;
      expectedProfitMinor: number;
      expectedMarginBps: number;
      componentsJson: Array<{ label: string; raw: number; weight: number; weighted: number }>;
    }>;
    forecasts: Array<{
      horizonDays: number;
      expectedUnits: number;
      lowUnits: number;
      highUnits: number;
      confidence: number;
      explanation: string;
      modelVersion: string;
    }>;
    policyAssessments: Array<{ outcome: string; reasonsJson: string[]; riskFlagsJson: string[] }>;
    profitabilitySnapshots: Array<{
      revenueMinor: number;
      contributionProfitMinor: number;
      netMarginBps: number;
      cashRequiredMinor: number;
    }>;
    signals: Array<{ signal: string; rationale: string; confidence: number; createdAt: string }>;
    simulationRuns: Array<{
      predictedUnits: number;
      actualUnits: number | null;
      predictedProfitMinor: number;
      actualProfitMinor: number | null;
      createdAt: string;
    }>;
    listings: Array<{ status: string; priceMinor: number; externalId: string | null }>;
    offers: Array<{ supplier: { name: string }; costMinor: number; shippingCostMinor: number }>;
  };

  const opp = p.opportunities[0];
  const policy = p.policyAssessments[0];
  const profit = p.profitabilitySnapshots[0];

  return (
    <section>
      <p className="meta">
        <Link href="/terminal">← Scanner</Link>
      </p>
      <header className="terminal-header">
        <div>
          <h1>{p.title}</h1>
          <p className="lede">
            {p.category} · conf {(p.dataConfidence * 100).toFixed(0)}% · fresh{' '}
            {new Date(p.dataFreshnessAt).toLocaleString()}
          </p>
        </div>
        <ProductActions productId={p.id} />
      </header>

      <div className="detail-grid">
        <article className="panel">
          <h2>Signal &amp; score</h2>
          {opp ? (
            <>
              <p>
                <span className={`signal signal-${opp.currentSignal}`}>{opp.currentSignal}</span>{' '}
                score <strong>{opp.score}</strong>
              </p>
              <p>{opp.explanation}</p>
              <table className="compact">
                <thead>
                  <tr>
                    <th>Component</th>
                    <th>Raw</th>
                    <th>Weight</th>
                    <th>Weighted</th>
                  </tr>
                </thead>
                <tbody>
                  {opp.componentsJson?.map((c) => (
                    <tr key={c.label}>
                      <td>{c.label}</td>
                      <td>{Math.round(c.raw)}</td>
                      <td>{(c.weight * 100).toFixed(0)}%</td>
                      <td>{c.weighted.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <p>No opportunity score yet.</p>
          )}
        </article>

        <article className="panel">
          <h2>Unit economics (not revenue-as-profit)</h2>
          <ul className="kv">
            <li>
              <span>Supplier cost</span>
              <strong>{formatMoney(p.supplierCostMinor, p.currency)}</strong>
            </li>
            <li>
              <span>Shipping</span>
              <strong>{formatMoney(p.shippingCostMinor, p.currency)}</strong>
            </li>
            <li>
              <span>Target price</span>
              <strong>{formatMoney(p.targetPriceMinor, p.currency)}</strong>
            </li>
            <li>
              <span>Marketplace fee</span>
              <strong>{formatMoney(p.marketplaceFeeMinor, p.currency)}</strong>
            </li>
            <li>
              <span>Payment fee</span>
              <strong>{formatMoney(p.paymentFeeMinor, p.currency)}</strong>
            </li>
            <li>
              <span>Ad allocation</span>
              <strong>{formatMoney(p.adAllocationMinor, p.currency)}</strong>
            </li>
            <li>
              <span>Return reserve</span>
              <strong>{formatMoney(p.returnReserveMinor, p.currency)}</strong>
            </li>
            {profit ? (
              <>
                <li>
                  <span>Unit revenue</span>
                  <strong>{formatMoney(profit.revenueMinor, p.currency)}</strong>
                </li>
                <li>
                  <span>Contribution profit</span>
                  <strong>{formatMoney(profit.contributionProfitMinor, p.currency)}</strong>
                </li>
                <li>
                  <span>Net margin</span>
                  <strong>{formatBps(profit.netMarginBps)}</strong>
                </li>
                <li>
                  <span>Cash before payout</span>
                  <strong>{formatMoney(profit.cashRequiredMinor, p.currency)}</strong>
                </li>
              </>
            ) : null}
          </ul>
        </article>

        <article className="panel">
          <h2>Policy</h2>
          {policy ? (
            <>
              <p>
                Outcome: <strong>{policy.outcome}</strong>
              </p>
              <ul>
                {(policy.reasonsJson ?? []).map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </>
          ) : (
            <p>No policy assessment.</p>
          )}
        </article>

        <article className="panel">
          <h2>Demand forecast (baseline-ma-v1)</h2>
          <table className="compact">
            <thead>
              <tr>
                <th>Horizon</th>
                <th>Expected</th>
                <th>Low</th>
                <th>High</th>
                <th>Conf</th>
              </tr>
            </thead>
            <tbody>
              {p.forecasts.map((f) => (
                <tr key={`${f.horizonDays}-${f.modelVersion}`}>
                  <td>{f.horizonDays}d</td>
                  <td>{f.expectedUnits}</td>
                  <td>{f.lowUnits}</td>
                  <td>{f.highUnits}</td>
                  <td>{(f.confidence * 100).toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          {p.forecasts[0] ? <p className="meta">{p.forecasts[0].explanation}</p> : null}
        </article>

        <article className="panel">
          <h2>Supplier offers</h2>
          <ul>
            {p.offers.map((o, i) => (
              <li key={i}>
                {o.supplier.name}: {formatMoney(o.costMinor, p.currency)} + ship{' '}
                {formatMoney(o.shippingCostMinor, p.currency)}
              </li>
            ))}
          </ul>
          <h3>Listings</h3>
          <ul>
            {p.listings.length === 0 ? <li>None</li> : null}
            {p.listings.map((l, i) => (
              <li key={i}>
                {l.status} @ {formatMoney(l.priceMinor, p.currency)} {l.externalId}
              </li>
            ))}
          </ul>
        </article>

        <article className="panel">
          <h2>Simulation outcomes</h2>
          <table className="compact">
            <thead>
              <tr>
                <th>When</th>
                <th>Pred units</th>
                <th>Actual units</th>
                <th>Pred profit</th>
                <th>Actual profit</th>
              </tr>
            </thead>
            <tbody>
              {p.simulationRuns.length === 0 ? (
                <tr>
                  <td colSpan={5}>No simulations yet</td>
                </tr>
              ) : (
                p.simulationRuns.map((s, i) => (
                  <tr key={i}>
                    <td>{new Date(s.createdAt).toLocaleString()}</td>
                    <td>{s.predictedUnits}</td>
                    <td>{s.actualUnits ?? '—'}</td>
                    <td>{formatMoney(s.predictedProfitMinor, p.currency)}</td>
                    <td>
                      {s.actualProfitMinor != null
                        ? formatMoney(s.actualProfitMinor, p.currency)
                        : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </article>

        <article className="panel wide">
          <h2>Description</h2>
          <p>{p.description}</p>
          <h3>Recent signals</h3>
          <ul>
            {p.signals.map((s, i) => (
              <li key={i}>
                <span className={`signal signal-${s.signal}`}>{s.signal}</span> {s.rationale}{' '}
                <span className="meta">{new Date(s.createdAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  );
}
