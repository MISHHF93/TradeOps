import Link from 'next/link';
import { ConfidenceMeter, Money } from '../../../components/commerce/money';
import { terminalGet } from '../../../lib/terminal-api';

type RunPayload = {
  id: string;
  /** User-facing goal only (API strips system/workspace preambles) */
  objective: string;
  /** Outcome summary — never a system prompt */
  description?: string | null;
  status: string;
  decision: string | null;
  decisionNote: string | null;
  planJson: {
    interpretation?: string;
    timeline?: Array<{ at: string; step: string; status: string; detail?: string }>;
    sources?: Array<{ name: string; status: string; detail?: string }>;
    responseSummary?: string;
    navigatorSummary?: string;
    finalAnswer?: string;
    userObjective?: string;
    candidateStats?: { retrieved: number; ranked: number; normalized: number };
    filtersApplied?: Record<string, unknown>;
    objectiveType?: string;
    approvalRequired?: boolean;
  };
  recommendations: Array<{
    id: string;
    rank: number;
    title: string;
    rationale: string;
    confidence: number;
    policyRiskScore: number;
    approvalRequired: boolean;
    productId: string | null;
    evidenceJson: Record<string, unknown>;
    calculationJson: Record<string, unknown>;
    missingDataJson: unknown;
  }>;
};

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams?: Promise<{ runId?: string }>;
}) {
  const sp = searchParams ? await searchParams : {};
  const runId = sp.runId;

  const latestRuns = await terminalGet<
    Array<{
      id: string;
      objective: string;
      description?: string | null;
      status: string;
      decision: string | null;
      startedAt: string;
      recommendations: Array<{ title: string; rank: number }>;
    }>
  >('/api/v1/ai/runs?take=5');

  let run: RunPayload | null = null;
  if (runId) {
    const r = await terminalGet<RunPayload>(`/api/v1/ai/runs/${runId}`);
    if (r.ok) run = r.data;
  } else if (latestRuns.ok && latestRuns.data[0]) {
    const r = await terminalGet<RunPayload>(`/api/v1/ai/runs/${latestRuns.data[0].id}`);
    if (r.ok) run = r.data;
  }

  const plan = run?.planJson ?? {};
  const recs = run?.recommendations ?? [];
  const description =
    run?.description ??
    plan.navigatorSummary ??
    plan.responseSummary ??
    plan.finalAnswer ??
    run?.decisionNote ??
    null;

  return (
    <section>
      <header className="terminal-header">
        <div>
          <p className="pill">Stage view · Evaluate / Qualify</p>
          <h1 className="workspace-title-active">Opportunities</h1>
          <p className="lede">
            Ranked product evaluations from operator runs — not system prompts. Research is
            read-only; approval is only for publish and purchase. Continue on the Process board
            after ranking.
          </p>
        </div>
        <div className="terminal-toolbar">
          <Link className="btn primary" href="/terminal/process">
            Process board
          </Link>
          <Link className="btn secondary" href="/terminal">
            Discover
          </Link>
          <Link className="btn ghost" href="/terminal/ai">
            AI workspace
          </Link>
        </div>
      </header>

      {!run ? (
        <p className="meta">
          No objective run yet. Open the AI panel and run{' '}
          <strong>Find products worth evaluating.</strong>
        </p>
      ) : null}

      {run ? (
        <>
          <div className="detail-grid">
            <article className="panel">
              <h2>Objective</h2>
              <p>
                <strong>{run.objective || '—'}</strong>
              </p>
              <h3 style={{ marginTop: 12, fontSize: '0.95rem' }}>Description</h3>
              <p className="meta">
                {description?.trim()
                  ? description
                  : 'No run summary yet. Description is the evaluation outcome — not AI system instructions.'}
              </p>
              <ul className="kv">
                <li>
                  <span>Status</span>
                  <strong className="text-accent">{run.status}</strong>
                </li>
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
                  <strong>{run.decision ?? '—'}</strong>
                </li>
              </ul>
            </article>
            <article className="panel">
              <h2>Candidates</h2>
              <ul className="kv">
                <li>
                  <span>Retrieved</span>
                  <strong>{plan.candidateStats?.retrieved ?? '—'}</strong>
                </li>
                <li>
                  <span>Normalized</span>
                  <strong>{plan.candidateStats?.normalized ?? '—'}</strong>
                </li>
                <li>
                  <span>Ranked</span>
                  <strong>{plan.candidateStats?.ranked ?? recs.length}</strong>
                </li>
              </ul>
              {plan.filtersApplied ? (
                <p className="meta">
                  Filters used: {JSON.stringify(plan.filtersApplied)}
                </p>
              ) : null}
            </article>
          </div>

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

          <h2 style={{ marginTop: 24 }}>Ranked products</h2>
          <div className="table-wrap">
            <table className="scanner-table" aria-label="Opportunity recommendations">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Product</th>
                  <th>Score</th>
                  <th>Conf</th>
                  <th>Margin</th>
                  <th>Profit</th>
                  <th>Policy</th>
                  <th>Next</th>
                </tr>
              </thead>
              <tbody>
                {recs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="empty">
                      No recommendations for this run.
                    </td>
                  </tr>
                ) : (
                  recs.map((r) => {
                    const card = (r.evidenceJson?.productCard ?? {}) as Record<string, unknown>;
                    const calc = r.calculationJson ?? {};
                    const margin = Number(card.expectedMarginBps ?? calc.netMarginBps ?? 0);
                    const profit = Number(
                      card.contributionProfitMinor ?? calc.contributionProfitMinor ?? 0,
                    );
                    const currency = String(card.currency ?? calc.currency ?? 'USD');
                    const score = Number(card.opportunityScore ?? 0);
                    return (
                      <tr key={r.id} className="is-selected" data-selected="true">
                        <td>{r.rank}</td>
                        <td style={{ whiteSpace: 'normal' }}>
                          {r.productId ? (
                            <Link href={`/terminal/products/${r.productId}`}>{r.title}</Link>
                          ) : (
                            r.title
                          )}
                          <div className="meta">{r.rationale.slice(0, 160)}</div>
                        </td>
                        <td>{score || '—'}</td>
                        <td>
                          <ConfidenceMeter value={r.confidence} />
                        </td>
                        <td className={margin > 0 ? 'money-positive' : undefined}>
                          {(margin / 100).toFixed(1)}%
                        </td>
                        <td>
                          <Money minor={profit} currency={currency} signed />
                        </td>
                        <td
                          className={
                            r.policyRiskScore >= 70
                              ? 'text-blocked'
                              : r.policyRiskScore >= 40
                                ? 'text-warning'
                                : undefined
                          }
                        >
                          {r.policyRiskScore}
                        </td>
                        <td>
                          {r.productId ? (
                            <Link
                              className="btn ghost"
                              href={`/terminal/products/${r.productId}`}
                              style={{ minHeight: 28 }}
                            >
                              Open
                            </Link>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {latestRuns.ok && latestRuns.data.length > 0 ? (
        <>
          <h2 style={{ marginTop: 28 }}>Recent runs</h2>
          <ul className="meta">
            {latestRuns.data.map((r) => (
              <li key={r.id}>
                <Link href={`/terminal/opportunities?runId=${r.id}`}>
                  {(r.objective || 'Operator run').slice(0, 80)}
                </Link>{' '}
                · {r.status} · {r.recommendations?.length ?? 0} recs ·{' '}
                {new Date(r.startedAt).toLocaleString()}
                {r.description ? (
                  <span className="meta"> — {r.description.slice(0, 100)}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}

    </section>
  );
}
