import Link from 'next/link';
import { AskAiButton } from '../../../../components/ai/ask-ai-button';
import { AutoBootstrapMedia } from '../../../../components/commerce/auto-bootstrap-media';
import { ProductHero } from '../../../../components/commerce/product-hero';
import { ProductMediaWorkspace } from '../../../../components/commerce/product-media-workspace';
import { TerminalPageFrame } from '../../../../components/commerce/process-chrome';
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
      <section className="terminal-page">
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

  const [atp, channel, agentic, caseRes] = await Promise.all([
    terminalGet<{
      atp?: {
        availableToSell: number;
        availableToPromise: number;
        projectedAvailability: number;
        oversellRisk: string;
        replenishmentNeed: number;
        expectedFulfillmentDays: number;
        note: string;
      };
    }>(`/api/v1/saas/atp/${productId}`),
    terminalGet<{
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
    }>(`/api/v1/saas/channel-profitability/${productId}`),
    terminalGet<{
      result?: {
        score: number;
        factors: Array<{ key: string; ok: boolean; weight: number; note: string }>;
      };
    }>(`/api/v1/saas/agentic-readiness/${productId}`),
    terminalGet<{ case?: { id: string } }>(
      `/api/v1/commerce/cases/by-product/${productId}`,
    ),
  ]);

  const commerceCaseId = caseRes.ok ? caseRes.data.case?.id : undefined;
  const aiObjective = `Evaluate product "${p.title}" (id ${productId}) for margin, policy risk, media readiness, and next launch step.`;

  return (
    <TerminalPageFrame
      pill="Product twin · media & economics"
      title={p.title}
      lede={`${p.brand ? `${p.brand} · ` : ''}${p.category} · ★ ${p.rating.toFixed(1)} (${p.reviewCount}) · conf ${(p.dataConfidence * 100).toFixed(0)}% · ${p.mediaCount ?? 0} media assets`}
      breadcrumbs={[
        { href: '/terminal', label: 'Discover' },
        { href: '/terminal/process', label: 'Cases' },
        { label: p.title },
      ]}
      toolbar={
        <>
          <AskAiButton
            objective={aiObjective}
            commerceCaseId={commerceCaseId}
            label="Ask AI"
          />
          <ProductActions productId={p.id} />
        </>
      }
    >
      <div className="product-twin-layout">
        <ProductHero
          title={p.title}
          primaryImageUrl={p.primaryImageUrl}
          galleryImageUrls={p.galleryImageUrlsJson}
          mediaJson={p.mediaJson}
        />

        <p className="product-twin-desc">{p.description}</p>

        <CaseHandoff productId={p.id} />
        <AutoBootstrapMedia productId={p.id} />
        <ProductMediaWorkspace productId={p.id} />

        {p.attributesJson && Object.keys(p.attributesJson).length > 0 ? (
          <article className="panel" style={{ marginBottom: 16 }}>
            <h2>Source attributes</h2>
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
              <ul className="product-twin-bullets">
                {(p.attributesJson.bulletPoints as string[]).map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            ) : null}
          </article>
        ) : null}

        <div className="detail-grid product-twin-grid">
          <article className="panel">
            <h2>Economics</h2>
            <ul className="kv">
              <li>
                <span>Target price</span>
                <strong>{formatMoney(p.targetPriceMinor, p.currency)}</strong>
              </li>
              <li>
                <span>Supplier cost</span>
                <strong>{formatMoney(p.supplierCostMinor, p.currency)}</strong>
              </li>
              <li>
                <span>Shipping</span>
                <strong>{formatMoney(p.shippingCostMinor, p.currency)}</strong>
              </li>
              {profit ? (
                <>
                  <li>
                    <span>Contribution profit</span>
                    <strong className="text-positive">
                      {formatMoney(profit.contributionProfitMinor, p.currency)}
                    </strong>
                  </li>
                  <li>
                    <span>Net margin</span>
                    <strong>{formatBps(profit.netMarginBps)}</strong>
                  </li>
                </>
              ) : null}
            </ul>
          </article>

          <article className="panel">
            <h2>Opportunity</h2>
            {opp ? (
              <ul className="kv">
                <li>
                  <span>Score</span>
                  <strong className="text-accent">{opp.score}</strong>
                </li>
                <li>
                  <span>Signal</span>
                  <strong>{opp.currentSignal}</strong>
                </li>
                <li>
                  <span>Expected profit</span>
                  <strong>{formatMoney(opp.expectedProfitMinor, p.currency)}</strong>
                </li>
                <li>
                  <span>Expected margin</span>
                  <strong>{formatBps(opp.expectedMarginBps)}</strong>
                </li>
              </ul>
            ) : (
              <p className="meta">No opportunity scored yet — run evaluation from the AI rail.</p>
            )}
            {opp?.explanation ? <p className="meta">{opp.explanation}</p> : null}
          </article>

          <article className="panel">
            <h2>Policy</h2>
            {policy ? (
              <>
                <p>
                  Outcome <strong>{policy.outcome}</strong>
                </p>
                <ul className="meta">
                  {(policy.reasonsJson ?? []).slice(0, 6).map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="meta">No policy assessment yet.</p>
            )}
          </article>

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
            <h2>Best channel</h2>
            {channel.ok && channel.data.recommended ? (
              <>
                <p>
                  <strong>{channel.data.recommended.displayName}</strong> · profit{' '}
                  {formatMoney(channel.data.recommended.contributionProfitMinor, p.currency)} ·
                  score {channel.data.recommended.score}
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
                    <li key={f.key} className="meta">
                      {f.ok ? '✓' : '·'} {f.note}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="meta">{agentic.ok ? 'No score' : agentic.error}</p>
            )}
          </article>

          <article className="panel">
            <h2>Suppliers / offers</h2>
            {p.offers?.length ? (
              <ul className="object-panel__list">
                {p.offers.map((o, i) => (
                  <li key={`${o.supplier.name}-${i}`} className="object-panel__item">
                    <strong>{o.supplier.name}</strong>
                    <span className="meta">
                      cost {formatMoney(o.costMinor, p.currency)} · ship{' '}
                      {formatMoney(o.shippingCostMinor, p.currency)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="meta">No supplier offers on record.</p>
            )}
          </article>

          <article className="panel">
            <h2>Listings</h2>
            {p.listings?.length ? (
              <ul className="object-panel__list">
                {p.listings.map((l, i) => (
                  <li key={i} className="object-panel__item">
                    <strong>{l.status}</strong>
                    <span className="meta">
                      {formatMoney(l.priceMinor, p.currency)}
                      {l.externalId ? ` · ${l.externalId}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="meta">No listings yet.</p>
            )}
          </article>

          {p.forecasts?.length ? (
            <article className="panel">
              <h2>Forecasts</h2>
              <ul className="object-panel__list">
                {p.forecasts.map((f, i) => (
                  <li key={i} className="object-panel__item">
                    <strong>
                      {f.horizonDays}d · {f.expectedUnits} units
                    </strong>
                    <span className="meta">
                      range {f.lowUnits}–{f.highUnits} · conf {(f.confidence * 100).toFixed(0)}% ·{' '}
                      {f.modelVersion}
                    </span>
                  </li>
                ))}
              </ul>
            </article>
          ) : null}

          {p.signals?.length ? (
            <article className="panel">
              <h2>Signals</h2>
              <ul className="object-panel__list">
                {p.signals.slice(0, 8).map((s, i) => (
                  <li key={i} className="object-panel__item">
                    <strong>{s.signal}</strong>
                    <span className="meta">
                      {(s.confidence * 100).toFixed(0)}% · {s.rationale}
                    </span>
                  </li>
                ))}
              </ul>
            </article>
          ) : null}
        </div>
      </div>
    </TerminalPageFrame>
  );
}
