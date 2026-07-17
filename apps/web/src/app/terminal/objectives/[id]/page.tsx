import Link from 'next/link';
import { ConfidenceMeter, Money } from '../../../../components/commerce/money';
import { terminalGet } from '../../../../lib/terminal-api';

type RunDetail = {
  id: string;
  objective: string;
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
    candidateStats?: { retrieved: number; ranked: number; normalized: number };
    filtersApplied?: Record<string, unknown>;
    objectiveType?: string;
    approvalRequired?: boolean;
    liveExampleId?: string | null;
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
  // Keep opportunities as the ranked commerce view; this page is the durable execution record
  if (plan.objectiveType === 'READ_ONLY_ANALYSIS' && run.recommendations?.length) {
    // stay on this page — show full execution (also link to opportunities)
  }

  return (
    <section>
      <header className="terminal-header">
        <div>
          <h1 className="workspace-title-active">Objective execution</h1>
          <p className="lede">
            Durable record <code>{run.id.slice(0, 8)}</code> · status{' '}
            <strong className="text-accent">{run.status}</strong>
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
          <p>{run.objective}</p>
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
          <h2>Final AI answer</h2>
          <p>
            <strong className="text-accent">
              {plan.finalAnswer ?? plan.responseSummary ?? run.decisionNote ?? '—'}
            </strong>
          </p>
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
