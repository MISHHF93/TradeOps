import Link from 'next/link';
import { ConfidenceMeter, Money } from '../../../../components/commerce/money';
import { terminalGet } from '../../../../lib/terminal-api';

type ExecutionPackage = {
  objective?: { goal?: string; desiredOutcome?: string };
  currentState?: {
    productCount?: number;
    liveProductCount?: number;
    gaps?: string[];
    connectorSummary?: { connected?: number; credentialsRequired?: number };
  };
  liveEvidence?: Array<{
    id: string;
    claim: string;
    sourceType: string;
    confidence: number;
    isLiveOperational: boolean;
  }>;
  recommendations?: Array<{
    id: string;
    title: string;
    score: number;
    recommended: boolean;
    impact: number;
    effort: number;
  }>;
  executionPlan?: {
    summary?: string;
    tasks?: Array<{ id: string; title: string; horizon: string; status: string }>;
  };
  timeline?: { summary?: string };
  dependencies?: Array<{ label: string; present: boolean; required: boolean }>;
  risks?: Array<{ severity: string; description: string; mitigation: string }>;
  executionStatus?: { overall?: string };
  verification?: {
    overall?: string;
    notes?: string;
    criteria?: Array<{ description: string; status: string }>;
  };
  honesty?: { note?: string };
};

type RunDetail = {
  id: string;
  objective: string;
  description?: string | null;
  status: string;
  decision: string | null;
  decisionNote: string | null;
  startedAt: string;
  completedAt: string | null;
  planJson: {
    interpretation?: string;
    timeline?: Array<{ at: string; step: string; status: string; detail?: string }>;
    sources?: Array<{ name: string; status: string; detail?: string }>;
    responseSummary?: string;
    finalAnswer?: string;
    navigatorSummary?: string;
    userObjective?: string;
    candidateStats?: { retrieved: number; ranked: number; normalized: number };
    filtersApplied?: Record<string, unknown>;
    objectiveType?: string;
    approvalRequired?: boolean;
    liveExampleId?: string | null;
    executionPackage?: ExecutionPackage;
  };
  toolTraceJson?: unknown;
  recommendations: Array<{
    id: string;
    rank: number;
    title: string;
    rationale: string;
    confidence: number;
    policyRiskScore: number;
    productId: string | null;
    evidenceJson: Record<string, unknown>;
    calculationJson: Record<string, unknown>;
    missingDataJson: unknown;
  }>;
};

export default async function ObjectiveDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await terminalGet<RunDetail>(`/api/v1/ai/runs/${id}`);

  if (!result.ok) {
    return (
      <section>
        <h1 className="workspace-title-active">Objective</h1>
        <p className="form-error">{result.error}</p>
        <Link href="/terminal/objectives">Back to history</Link>
      </section>
    );
  }

  const run = result.data;
  const plan = run.planJson ?? {};
  const pkg = plan.executionPackage;

  return (
    <section>
      <header className="terminal-header">
        <div>
          <h1 className="workspace-title-active">Objective execution</h1>
          <p className="lede">
            Execution Navigator record <code>{run.id.slice(0, 8)}</code> · status{' '}
            <strong className="text-accent">{run.status}</strong>
            {pkg?.executionStatus?.overall
              ? ` · package ${pkg.executionStatus.overall}`
              : ''}
          </p>
        </div>
        <div className="terminal-toolbar">
          <Link className="btn secondary" href={`/terminal/opportunities?runId=${run.id}`}>
            Opportunities view
          </Link>
          <Link className="btn ghost" href="/terminal/objectives">
            History
          </Link>
          <Link className="btn ghost" href="/terminal/live-examples">
            Live examples
          </Link>
        </div>
      </header>

      <div className="detail-grid">
        <article className="panel">
          <h2>Objective</h2>
          <p>
            <strong>{run.objective || '—'}</strong>
          </p>
          <h3 style={{ marginTop: 12, fontSize: '0.95rem' }}>Description</h3>
          <p className="meta">
            {(
              run.description ??
              plan.navigatorSummary ??
              plan.responseSummary ??
              plan.finalAnswer ??
              run.decisionNote ??
              ''
            ).trim() ||
              'No outcome summary for this run yet. System prompts are never shown here.'}
          </p>
          <ul className="kv">
            <li>
              <span>Type</span>
              <strong>{plan.objectiveType ?? '—'}</strong>
            </li>
            <li>
              <span>Approval required</span>
              <strong>{String(plan.approvalRequired ?? false)}</strong>
            </li>
            <li>
              <span>Decision</span>
              <strong className="text-accent">{run.decision ?? '—'}</strong>
            </li>
            <li>
              <span>Live example</span>
              <strong>{plan.liveExampleId ?? 'ad-hoc'}</strong>
            </li>
            <li>
              <span>Started</span>
              <strong>{new Date(run.startedAt).toLocaleString()}</strong>
            </li>
            <li>
              <span>Completed</span>
              <strong>
                {run.completedAt ? new Date(run.completedAt).toLocaleString() : '—'}
              </strong>
            </li>
          </ul>
        </article>
        <article className="panel">
          <h2>Navigator summary</h2>
          <p>
            <strong className="text-accent">
              {plan.navigatorSummary ??
                plan.finalAnswer ??
                plan.responseSummary ??
                run.decisionNote ??
                '—'}
            </strong>
          </p>
          {pkg?.objective?.goal ? (
            <p className="meta">
              Goal: {pkg.objective.goal}
              {pkg.objective.desiredOutcome
                ? ` → ${pkg.objective.desiredOutcome}`
                : ''}
            </p>
          ) : null}
          {plan.candidateStats ? (
            <ul className="kv">
              <li>
                <span>Retrieved</span>
                <strong>{plan.candidateStats.retrieved}</strong>
              </li>
              <li>
                <span>Normalized</span>
                <strong>{plan.candidateStats.normalized}</strong>
              </li>
              <li>
                <span>Ranked</span>
                <strong>{plan.candidateStats.ranked}</strong>
              </li>
            </ul>
          ) : null}
          {plan.filtersApplied ? (
            <p className="meta">Filters: {JSON.stringify(plan.filtersApplied)}</p>
          ) : null}
        </article>
      </div>

      {pkg ? (
        <article className="panel" style={{ marginTop: 16 }}>
          <h2>Execution Package</h2>
          <ul className="kv">
            <li>
              <span>State</span>
              <strong>
                {pkg.currentState?.productCount ?? 0} products (
                {pkg.currentState?.liveProductCount ?? 0} live) ·{' '}
                {pkg.currentState?.connectorSummary?.connected ?? 0} live connectors
              </strong>
            </li>
            <li>
              <span>Verification</span>
              <strong>
                {pkg.verification?.overall ?? '—'} — {pkg.verification?.notes ?? ''}
              </strong>
            </li>
            <li>
              <span>Plan</span>
              <strong style={{ whiteSpace: 'normal' }}>
                {pkg.executionPlan?.summary ?? pkg.timeline?.summary ?? '—'}
              </strong>
            </li>
          </ul>
          {(pkg.recommendations?.length ?? 0) > 0 ? (
            <>
              <h3 style={{ marginTop: 12 }}>Ranked options</h3>
              <ul className="kv">
                {pkg.recommendations!.map((o) => (
                  <li key={o.id}>
                    <span>
                      score {o.score}
                      {o.recommended ? ' · TOP' : ''}
                    </span>
                    <strong>{o.title}</strong>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {(pkg.liveEvidence?.length ?? 0) > 0 ? (
            <>
              <h3 style={{ marginTop: 12 }}>Evidence</h3>
              <ul className="kv">
                {pkg.liveEvidence!.slice(0, 8).map((e) => (
                  <li key={e.id}>
                    <span>
                      {e.sourceType}
                      {e.isLiveOperational ? ' · LIVE' : ''} ·{' '}
                      {(e.confidence * 100).toFixed(0)}%
                    </span>
                    <strong style={{ whiteSpace: 'normal', fontWeight: 500 }}>
                      {e.claim.slice(0, 180)}
                    </strong>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {(pkg.risks?.length ?? 0) > 0 ? (
            <>
              <h3 style={{ marginTop: 12 }}>Risks</h3>
              <ul className="kv">
                {pkg.risks!.map((r, i) => (
                  <li key={`${r.severity}-${i}`}>
                    <span>{r.severity}</span>
                    <strong style={{ whiteSpace: 'normal', fontWeight: 500 }}>
                      {r.description} — {r.mitigation}
                    </strong>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {pkg.honesty?.note ? <p className="meta">{pkg.honesty.note}</p> : null}
        </article>
      ) : null}

      {plan.sources?.length ? (
        <article className="panel" style={{ marginTop: 16 }}>
          <h2>Sources</h2>
          <ul className="kv">
            {plan.sources.map((s) => (
              <li key={s.name}>
                <span>{s.name}</span>
                <strong>
                  {s.status}
                  {s.detail ? ` · ${s.detail}` : ''}
                </strong>
              </li>
            ))}
          </ul>
        </article>
      ) : null}

      {plan.timeline?.length ? (
        <article className="panel" style={{ marginTop: 16 }}>
          <h2>Execution timeline</h2>
          <ol className="ai-timeline">
            {plan.timeline.map((step, i) => (
              <li
                key={`${step.at}-${i}`}
                className={`ai-timeline-step ${step.status === 'failed' ? 'failed' : 'done'}`}
              >
                <span className="meta">{new Date(step.at).toLocaleString()}</span> — {step.step}
                {step.detail ? <span className="meta"> · {step.detail}</span> : null}
              </li>
            ))}
          </ol>
        </article>
      ) : null}

      <h2 style={{ marginTop: 24 }}>Recommendations</h2>
      <div className="table-wrap">
        <table className="scanner-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Product</th>
              <th>Conf</th>
              <th>Margin</th>
              <th>Profit</th>
              <th>Policy</th>
              <th>Open</th>
            </tr>
          </thead>
          <tbody>
            {run.recommendations.length === 0 ? (
              <tr>
                <td colSpan={7} className="empty">
                  No recommendations stored for this run.
                </td>
              </tr>
            ) : (
              run.recommendations.map((r) => {
                const card = (r.evidenceJson?.productCard ?? {}) as Record<string, unknown>;
                const calc = r.calculationJson ?? {};
                const margin = Number(card.expectedMarginBps ?? calc.netMarginBps ?? 0);
                const profit = Number(
                  card.contributionProfitMinor ?? calc.contributionProfitMinor ?? 0,
                );
                const currency = String(card.currency ?? calc.currency ?? 'USD');
                return (
                  <tr key={r.id}>
                    <td>{r.rank}</td>
                    <td style={{ whiteSpace: 'normal' }}>
                      <strong>{r.title}</strong>
                      <div className="meta">{r.rationale.slice(0, 200)}</div>
                    </td>
                    <td>
                      <ConfidenceMeter value={r.confidence} />
                    </td>
                    <td className={margin > 0 ? 'money-positive' : undefined}>
                      {(margin / 100).toFixed(1)}%
                    </td>
                    <td>
                      <Money minor={profit} currency={currency} signed />
                    </td>
                    <td>{r.policyRiskScore}</td>
                    <td>
                      {r.productId ? (
                        <Link
                          className="btn ghost"
                          href={`/terminal/products/${r.productId}`}
                          style={{ minHeight: 28 }}
                        >
                          Twin
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
