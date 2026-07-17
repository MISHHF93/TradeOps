import Link from 'next/link';
import { ProductMediaWorkspace } from '../../../../components/commerce/product-media-workspace';
import { CaseHandoff } from '../../../../components/terminal/case-handoff';
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
    brand?: string | null;
    manufacturer?: string | null;
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
    primaryImageUrl?: string | null;
    galleryImageUrlsJson?: string[];
    mediaJson?: Array<{ url?: string; purpose?: string; kind?: string }>;
    attributesJson?: Record<string, unknown>;
    mediaCount?: number;
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

  const atp = await terminalGet<{
    atp?: {
      availableToSell: number;
      availableToPromise: number;
      projectedAvailability: number;
      oversellRisk: string;
      replenishmentNeed: number;
      expectedFulfillmentDays: number;
      note: string;
    };
  }>(`/api/v1/saas/atp/${productId}`);

  const channel = await terminalGet<{
    recommended?: {
      channelKey: string;
      displayName: string;
      contributionProfitMinor: number;
      score: number;
      reasons: string[];
    } | null;
    alternatives?: Array<{
      channelKey: string;
      displayName: string;
      contributionProfitMinor: number;
      score: number;
      reasons: string[];
    }>;
    note?: string;
    disclaimer?: string;
  }>(`/api/v1/saas/channel-profitability/${productId}`);

  const agentic = await terminalGet<{
    result?: {
      score: number;
      factors: Array<{ key: string; ok: boolean; weight: number; note: string }>;
    };
  }>(`/api/v1/saas/agentic-readiness/${productId}`);

  return (
    <section>
      <p className="meta">
        <Link href="/terminal">Discover</Link>
        {' · '}
        <Link href="/terminal/process">Process</Link>
      </p>
      <header className="terminal-header">
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          {p.primaryImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={p.primaryImageUrl}
              alt={p.title}
              width={96}
              height={96}
              style={{
                width: 96,
                height: 96,
                objectFit: 'cover',
                borderRadius: 10,
                background: 'var(--surface-2, #111)',
              }}
              referrerPolicy="no-referrer"
            />
          ) : null}
          <div>
            <h1>{p.title}</h1>
            <p className="lede">
              {p.brand ? `${p.brand} · ` : ''}
              {p.category} · ★ {p.rating.toFixed(1)} ({p.reviewCount} reviews) · conf{' '}
              {(p.dataConfidence * 100).toFixed(0)}% · fresh{' '}
              {new Date(p.dataFreshnessAt).toLocaleString()}
              {p.mediaCount != null ? ` · ${p.mediaCount} media assets` : ''}
            </p>
            <p className="meta" style={{ maxWidth: 720 }}>
              {p.description}
            </p>
          </div>
        </div>
        <ProductActions productId={p.id} />
      </header>

      <ProductMediaWorkspace productId={p.id} />
      <CaseHandoff productId={p.id} />

      {p.attributesJson && Object.keys(p.attributesJson).length > 0 ? (
        <article className="panel" style={{ marginBottom: 16 }}>
          <h2>Source attributes (naming &amp; merchandising)</h2>
          <ul className="kv">
            {Object.entries(p.attributesJson)
              .filter(([, v]) => v != null && typeof v !== 'object')
              .slice(0, 16)
              .map(([k, v]) => (
                <li key={k}>
                  <span>{k}</span>
                  <strong>{String(v)}</strong>
                </li>
              ))}
          </ul>
          {Array.isArray(p.attributesJson.bulletPoints) ? (
            <ul>
              {(p.attributesJson.bulletPoints as string[]).map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          ) : null}
        </article>
      ) : null}

      <div className="detail-grid">
        <article className="panel">
          <h2>Available-to-promise</h2>
          {atp.ok && atp.data.atp ? (
            <ul className="kv">
              <li>
                <span>Available to sell</span>
                <strong>{atp.data.atp.availableToSell}</strong>
              </li>
              <li>
                <span>Available to promise</span>
                <strong>{atp.data.atp.availableToPromise}</strong>
              </li>
              <li>
                <span>Projected</span>
                <strong>{atp.data.atp.projectedAvailability}</strong>
              </li>
              <li>
                <span>Oversell risk</span>
                <strong>{atp.data.atp.oversellRisk}</strong>
              </li>
              <li>
                <span>Replenishment need</span>
                <strong>{atp.data.atp.replenishmentNeed}</strong>
              </li>
              <li>
                <span>Est. fulfillment days</span>
                <strong>{atp.data.atp.expectedFulfillmentDays}</strong>
              </li>
            </ul>
          ) : (
            <p className="meta">{atp.ok ? 'No ATP' : atp.error}</p>
          )}
          {atp.ok && atp.data.atp ? <p className="meta">{atp.data.atp.note}</p> : null}
        </article>

        <article className="panel">
          <h2>Best channel (contribution)</h2>
          {channel.ok && channel.data.recommended ? (
            <>
              <p>
                <strong>{channel.data.recommended.displayName}</strong> · profit{' '}
                {formatMoney(channel.data.recommended.contributionProfitMinor, p.currency)} · score{' '}
                {channel.data.recommended.score}
              </p>
              <p className="meta">{(channel.data.recommended.reasons ?? []).join(' · ')}</p>
              <ul>
                {(channel.data.alternatives ?? []).map((a) => (
                  <li key={a.channelKey}>
                    {a.displayName}: {formatMoney(a.contributionProfitMinor, p.currency)} (score{' '}
                    {a.score})
                  </li>
                ))}
              </ul>
              <p className="meta">{channel.data.disclaimer ?? channel.data.note}</p>
            </>
          ) : (
            <p className="meta">{channel.ok ? 'No channel comparison' : channel.error}</p>
          )}
        </article>

        <article className="panel">
          <h2>Agentic readiness</h2>
          {agentic.ok && agentic.data.result ? (
            <>
              <p>
                Score <strong>{agentic.data.result.score}</strong>
              </p>
              <ul>
                {(agentic.data.result.factors ?? []).slice(0, 8).map((f) => (
                  <li key={f.key}>
                    {f.key}: {f.ok ? 'ok' : 'gap'} — {f.note}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="meta">{agentic.ok ? 'No score' : agentic.error}</p>
          )}
        </article>

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
