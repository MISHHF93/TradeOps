import Link from 'next/link';
import {
  CommerceStatePanel,
  type CommerceStateClient,
} from '../../../../components/commerce/commerce-state-panel';
import { ProcessPageHeader } from '../../../../components/commerce/process-chrome';
import {
  ProcessAdvanceButton,
  ProcessSyncButton,
} from '../../../../components/terminal/process-actions';
import { formatMoney } from '../../../../lib/money';
import {
  PROCESS_LABELS,
  relatedStageHref,
  stageStatusLabel,
  stageTitle,
} from '../../../../lib/process-ux';
import { terminalGet } from '../../../../lib/terminal-api';

type Props = { params: Promise<{ caseId: string }> };

const STAGE_ORDER = [
  'discover',
  'evaluate',
  'qualify',
  'prepare',
  'approve',
  'publish',
  'sell',
  'source',
  'fulfill',
  'reconcile',
  'learn',
] as const;

function nextStageOf(current: string): string | null {
  const i = STAGE_ORDER.indexOf(current as (typeof STAGE_ORDER)[number]);
  if (i < 0 || i >= STAGE_ORDER.length - 1) return null;
  return STAGE_ORDER[i + 1]!;
}

export default async function ProductJourneyPage({ params }: Props) {
  const { caseId } = await params;
  const result = await terminalGet<{
    case: {
      id: string;
      productId: string;
      currentStage: string;
      stageStatus: string;
      opportunityScore?: number | null;
      confidence?: number | null;
      expectedProfitMinor?: number | null;
      realizedProfitMinor?: number | null;
      nextActionLabel?: string | null;
      nextHref?: string;
      blockerMessage?: string | null;
      productHref: string;
    };
    product: {
      id: string;
      title: string;
      category: string;
      sourcePlatform: string;
      currency: string;
      dataConfidence: number;
      supplierCostMinor: number;
      shippingCostMinor: number;
      targetPriceMinor: number;
    };
    opportunity?: {
      score: number;
      explanation: string;
      currentSignal: string;
      expectedProfitMinor: number;
      expectedMarginBps: number;
    } | null;
    listings: Array<{ id: string; status: string; priceMinor: number }>;
    offers: Array<{ supplier: { name: string }; costMinor: number; shippingCostMinor: number }>;
    policy?: { outcome: string; reasonsJson?: string[] } | null;
    artifacts: Array<{ id: string; artifactType: string; purpose: string; rightsStatus: string }>;
    lifecycle: Array<{
      id: string;
      title: string;
      description: string;
      handoffLabel: string;
      state: string;
    }>;
    history: Array<{ stage: string; status: string; at: string; note?: string }>;
    handoffLabel: string;
    nextHref: string;
  }>(`/api/v1/commerce/cases/${caseId}`);

  if (!result.ok) {
    return (
      <section>
        <p className="form-error">{result.error}</p>
        <Link href="/terminal/process">← Commerce Process</Link>
      </section>
    );
  }

  const d = result.data;
  const c = d.case;
  const p = d.product;
  const nextStage = nextStageOf(c.currentStage);
  const opp = d.opportunity;

  const stateRes = await terminalGet<CommerceStateClient>(
    `/api/v1/commerce/cases/${caseId}/state`,
  );

  return (
    <section>
      <ProcessPageHeader
        pill={`${PROCESS_LABELS.casePill} · ${stageTitle(c.currentStage)} · ${stageStatusLabel(c.stageStatus)}`}
        title={p.title}
        lede={`${p.category} · ${p.sourcePlatform} · conf ${(p.dataConfidence * 100).toFixed(0)}%${
          p.sourcePlatform.startsWith('fixture') ? ' · TEST FIXTURE' : ''
        }`}
        currentStage={c.currentStage}
        breadcrumbs={[
          { href: '/terminal/process', label: PROCESS_LABELS.boardTitle },
          { href: relatedStageHref(c.currentStage), label: stageTitle(c.currentStage) },
          { label: p.title },
        ]}
        toolbar={
          <>
            <ProcessSyncButton />
            <Link className="btn secondary" href={c.productHref}>
              {PROCESS_LABELS.productTwin}
            </Link>
            <Link
              className="btn ghost"
              href={`/terminal/ai?caseId=${encodeURIComponent(c.id)}`}
            >
              {PROCESS_LABELS.aiOnCase}
            </Link>
            {c.nextHref ? (
              <Link className="btn primary" href={c.nextHref}>
                {c.nextActionLabel ?? PROCESS_LABELS.nextStep}
              </Link>
            ) : null}
          </>
        }
      />

      {c.blockerMessage ? <p className="form-error">{c.blockerMessage}</p> : null}

      {stateRes.ok ? <CommerceStatePanel state={stateRes.data} /> : null}

      <div className="detail-grid">
        <article className="panel">
          <h2>Economics</h2>
          <ul className="kv">
            <li>
              <span>Score</span>
              <strong>{c.opportunityScore ?? '—'}</strong>
            </li>
            <li>
              <span>Expected profit</span>
              <strong>
                {c.expectedProfitMinor != null
                  ? formatMoney(c.expectedProfitMinor, p.currency)
                  : '—'}
              </strong>
            </li>
            <li>
              <span>Realized profit</span>
              <strong>
                {c.realizedProfitMinor != null
                  ? formatMoney(c.realizedProfitMinor, p.currency)
                  : '—'}
              </strong>
            </li>
            <li>
              <span>Target price</span>
              <strong>{formatMoney(p.targetPriceMinor, p.currency)}</strong>
            </li>
            <li>
              <span>Supplier + ship</span>
              <strong>
                {formatMoney(p.supplierCostMinor + p.shippingCostMinor, p.currency)}
              </strong>
            </li>
          </ul>
          {opp ? (
            <p className="meta">
              Signal {opp.currentSignal} · {opp.explanation}
            </p>
          ) : (
            <p className="meta">No opportunity score yet — run evaluation from the product twin.</p>
          )}
        </article>

        <article className="panel">
          <h2>Current work · {c.currentStage}</h2>
          <p>
            Status: <strong>{c.stageStatus}</strong>
          </p>
          <p className="meta">
            {PROCESS_LABELS.nextStep}: {c.nextActionLabel ?? '—'}
          </p>
          {d.policy ? (
            <p className="meta">
              Policy: {d.policy.outcome}
              {(d.policy.reasonsJson ?? []).length
                ? ` — ${(d.policy.reasonsJson ?? []).slice(0, 2).join('; ')}`
                : ''}
            </p>
          ) : null}
          <p className="meta">
            Listings: {d.listings.length ? d.listings.map((l) => l.status).join(', ') : 'none'}
          </p>
          <p className="meta">
            Offers: {d.offers.length ? d.offers.map((o) => o.supplier.name).join(', ') : 'none'}
          </p>
          <p className="meta">
            Artifacts: {d.artifacts.length} (media rights on twin)
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            {c.currentStage === 'discover' || c.currentStage === 'evaluate' ? (
              <Link className="btn secondary" href={c.productHref}>
                {PROCESS_LABELS.productTwin}
              </Link>
            ) : null}
            {c.currentStage === 'prepare' ? (
              <Link className="btn secondary" href={c.productHref}>
                Prepare listing / media
              </Link>
            ) : null}
            {c.currentStage === 'approve' ? (
              <Link className="btn secondary" href="/terminal/approvals">
                {PROCESS_LABELS.viewApprovals}
              </Link>
            ) : null}
            {c.currentStage === 'sell' ||
            c.currentStage === 'source' ||
            c.currentStage === 'fulfill' ? (
              <Link className="btn secondary" href="/terminal/orders">
                {PROCESS_LABELS.viewOrders}
              </Link>
            ) : null}
            {nextStage ? (
              <ProcessAdvanceButton
                caseId={c.id}
                toStage={nextStage}
                label={d.handoffLabel || `Advance to ${stageTitle(nextStage)}`}
              />
            ) : null}
          </div>
        </article>

        <article className="panel wide">
          <h2>Procedure stages</h2>
          <ol
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
              gap: 8,
              listStyle: 'none',
              padding: 0,
              margin: 0,
            }}
          >
            {d.lifecycle.map((s) => (
              <li
                key={s.id}
                className="panel"
                style={{
                  padding: 8,
                  margin: 0,
                  opacity: s.state === 'future' ? 0.55 : 1,
                  borderColor:
                    s.state === 'completed' || s.id === c.currentStage
                      ? 'var(--color-accent, #25c7e8)'
                      : undefined,
                }}
              >
                <strong style={{ fontSize: 12 }}>{s.title}</strong>
                <p className="meta" style={{ margin: '4px 0 0', fontSize: 10 }}>
                  {s.state}
                </p>
              </li>
            ))}
          </ol>
        </article>

        <article className="panel wide">
          <h2>Stage history</h2>
          {d.history.length === 0 ? (
            <p className="meta">No history yet — sync cases from records.</p>
          ) : (
            <table className="compact">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Stage</th>
                  <th>Status</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {[...d.history].reverse().slice(0, 20).map((h, i) => (
                  <tr key={`${h.at}-${i}`}>
                    <td>{new Date(h.at).toLocaleString()}</td>
                    <td>{stageTitle(h.stage)}</td>
                    <td>{stageStatusLabel(h.status)}</td>
                    <td>{h.note ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </article>
      </div>
    </section>
  );
}
