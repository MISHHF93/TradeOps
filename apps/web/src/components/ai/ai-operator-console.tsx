'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { getApiBaseUrl } from '../../lib/api';
import { ConfidenceMeter, Money } from '../commerce/money';

type TimelineStep = {
  at: string;
  step: string;
  status: string;
  detail?: string;
};

type Rec = {
  productId?: string;
  rank: number;
  title: string;
  rationale: string;
  confidence: number;
  approvalRequired: boolean;
  actionClass?: string;
  policyRiskScore?: number;
  calculation?: Record<string, unknown>;
  productCard?: Record<string, unknown>;
  nextActions?: string[];
  missingData?: string[];
};

type OperatorResponse = {
  runId?: string;
  status?: string;
  loopMode?: string;
  decision?: string;
  decisionNote?: string;
  responseSummary?: string;
  objectiveType?: string;
  riskClass?: string;
  approvalRequired?: boolean;
  plan?: { interpretation?: string; steps?: string[]; toolsToCall?: string[] };
  timeline?: TimelineStep[];
  sources?: Array<{ name: string; status: string; detail?: string }>;
  candidateStats?: { retrieved: number; normalized: number; ranked: number };
  filtersApplied?: Record<string, unknown>;
  critic?: { severity?: string; notes?: string; issues?: string[] };
  auditor?: { notes?: string; issues?: string[]; calculationOk?: boolean; policyOk?: boolean };
  recommendations?: Rec[];
  resultsPath?: string;
  honesty?: { note?: string; fixtureProductsPresent?: boolean; shadowByDefault?: boolean };
  message?: string;
  toolTrace?: Array<{ tool?: string; ok?: boolean }>;
};

type AiUiState =
  | 'idle'
  | 'understanding'
  | 'checking_connectors'
  | 'collecting_products'
  | 'evaluating'
  | 'ranking'
  | 'completed'
  | 'approval_required'
  | 'failed'
  | 'blocked';

const DEFAULT_OBJECTIVE =
  'Find three products under $20 supplier cost that could sell in Canada with at least a 25% expected margin.';

const STATUS_LABEL: Record<AiUiState, string> = {
  idle: 'Idle',
  understanding: 'Understanding',
  checking_connectors: 'Checking connectors',
  collecting_products: 'Collecting products',
  evaluating: 'Evaluating',
  ranking: 'Ranking',
  completed: 'Completed',
  approval_required: 'Awaiting approval',
  failed: 'Failed',
  blocked: 'Blocked',
};

/**
 * Full AI Operator workspace — uses server classification.
 * READ_ONLY_ANALYSIS → completed with ranked products (never escalate).
 */
export function AiOperatorConsole({
  commerceCaseId,
  caseContextHint,
}: {
  commerceCaseId?: string;
  caseContextHint?: string;
} = {}) {
  const router = useRouter();
  const [objective, setObjective] = useState(DEFAULT_OBJECTIVE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OperatorResponse | null>(null);
  const [harm, setHarm] = useState<unknown>(null);
  const [aiState, setAiState] = useState<AiUiState>('idle');
  const [progressLabel, setProgressLabel] = useState('Run AI operator (shadow)');
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  async function runOperator(e: FormEvent) {
    e.preventDefault();
    if (busy || !objective.trim()) return;
    setBusy(true);
    setError(null);
    setActionMsg(null);
    setResult(null);
    setAiState('understanding');
    setProgressLabel('Understanding…');
    try {
      await new Promise((r) => setTimeout(r, 160));
      setAiState('checking_connectors');
      setProgressLabel('Searching products…');
      await new Promise((r) => setTimeout(r, 100));
      setAiState('collecting_products');
      setProgressLabel('Evaluating…');

      const res = await fetch(`${getApiBaseUrl()}/api/v1/ai/operator/run`, {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          objective,
          forceShadow: true,
          ...(commerceCaseId ? { commerceCaseId } : {}),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as OperatorResponse;
      if (!res.ok) {
        setError(body.message ?? `HTTP ${res.status}`);
        setAiState('failed');
        setProgressLabel('Retry');
        return;
      }

      setAiState('ranking');
      setProgressLabel('Ranking…');
      await new Promise((r) => setTimeout(r, 60));

      setResult(body);

      // Trust server classification — never force awaiting_approval for research
      let next: AiUiState = 'completed';
      if (body.objectiveType === 'READ_ONLY_ANALYSIS' || body.approvalRequired === false) {
        next = 'completed';
      } else if (body.decision === 'block') {
        next = 'blocked';
      } else if (body.approvalRequired || body.status === 'awaiting_approval') {
        next = 'approval_required';
      }
      setAiState(next);
      setProgressLabel('Completed');

      if (body.resultsPath && body.objectiveType === 'READ_ONLY_ANALYSIS') {
        router.push(body.resultsPath);
      } else {
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operator run failed');
      setAiState('failed');
      setProgressLabel('Retry');
    } finally {
      setBusy(false);
    }
  }

  async function runHarmonize() {
    setBusy(true);
    setError(null);
    setAiState('evaluating');
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/v1/ai/harmonize`, {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((body as { message?: string }).message ?? `HTTP ${res.status}`);
        setAiState('failed');
        return;
      }
      setHarm(body);
      setAiState('completed');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Harmonization failed');
      setAiState('failed');
    } finally {
      setBusy(false);
    }
  }

  async function nextAction(action: string, productId?: string) {
    if (!productId) return;
    setActionMsg(null);
    try {
      if (action === 'watchlist') {
        await fetch(`${getApiBaseUrl()}/api/v1/watchlist/${productId}`, {
          method: 'POST',
          credentials: 'include',
          headers: { Accept: 'application/json' },
        });
        setActionMsg('Added to watchlist');
      } else if (action === 'draft') {
        const res = await fetch(`${getApiBaseUrl()}/api/v1/products/${productId}/listing-draft`, {
          method: 'POST',
          credentials: 'include',
          headers: { Accept: 'application/json' },
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error((body as { message?: string }).message ?? 'Draft failed');
        setActionMsg('Listing draft created (not published)');
      } else if (action === 'rescore') {
        await fetch(`${getApiBaseUrl()}/api/v1/products/${productId}/rescore`, {
          method: 'POST',
          credentials: 'include',
          headers: { Accept: 'application/json' },
        });
        setActionMsg('Profit recalculated');
      } else if (action === 'view') {
        router.push(`/terminal/products/${productId}`);
        return;
      }
      router.refresh();
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : 'Action failed');
    }
  }

  const tools = result?.plan?.toolsToCall ?? [];
  const recs = result?.recommendations ?? [];
  const timeline = result?.timeline ?? [];

  return (
    <div
      className="ai-console"
      data-ai-state={
        aiState === 'approval_required'
          ? 'awaiting_approval'
          : busy
            ? 'executing'
            : aiState === 'completed'
              ? 'completed'
              : aiState === 'failed'
                ? 'failed'
                : aiState === 'blocked'
                  ? 'blocked'
                  : 'idle'
      }
    >
      <div className="ai-console-header">
        <span className={`ai-avatar ${busy ? 'ai-pulse' : ''}`} aria-hidden title="AI Operator" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <strong>AI Operator</strong>
          <p className="meta" style={{ margin: 0 }}>
            Research is read-only · publish still requires approval
          </p>
        </div>
        <span
          className={`ai-status-badge ${
            aiState === 'approval_required'
              ? 'awaiting_approval'
              : aiState === 'completed'
                ? 'completed'
                : aiState === 'failed'
                  ? 'failed'
                  : aiState === 'blocked'
                    ? 'blocked'
                    : busy
                      ? 'thinking'
                      : ''
          }`}
        >
          {STATUS_LABEL[aiState]}
        </span>
        {result?.objectiveType ? (
          <span className="truth-label">{result.objectiveType}</span>
        ) : null}
      </div>

      {busy ? (
        <div className="ai-progress" role="progressbar" aria-label="AI execution progress" />
      ) : null}

      {commerceCaseId ? (
        <p className="meta text-accent" style={{ marginBottom: 8 }}>
          Bound to commerce case <code>{commerceCaseId.slice(0, 8)}…</code>
          {caseContextHint ? ` · ${caseContextHint}` : ''} — recommendations stay stage-aware.
          {' '}
          <Link href={`/terminal/process/${commerceCaseId}`}>Open journey</Link>
        </p>
      ) : (
        <p className="meta" style={{ marginBottom: 8 }}>
          No case selected — global discover/health objectives are allowed. Open a journey and use
          “AI on this case” for stage-bound work.
        </p>
      )}

      <form
        className="card tool-form"
        style={{ maxWidth: '100%' }}
        onSubmit={(e) => void runOperator(e)}
      >
        <label>
          Objective (natural language)
          <textarea
            name="objective"
            className="ai-objective-input"
            rows={3}
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            required
            disabled={busy}
          />
        </label>
        <div className="terminal-toolbar">
          <button className="btn ai" type="submit" disabled={busy || !objective.trim()}>
            {busy ? progressLabel : aiState === 'failed' ? 'Retry' : 'Run AI operator (shadow)'}
          </button>
          <button
            className="btn secondary"
            type="button"
            disabled={busy}
            onClick={() => void runHarmonize()}
          >
            Resolve product identities
          </button>
        </div>
        <p className="meta">
          “Find products worth evaluating” is READ_ONLY_ANALYSIS — no approval. Listing draft does
          not publish. Publish is a separate approved action.
        </p>
      </form>

      {error ? <p className="form-error">{error}</p> : null}
      {actionMsg ? <p className="meta">{actionMsg}</p> : null}

      {result ? (
        <div className="detail-grid" style={{ marginTop: 8 }}>
          <article className="panel">
            <h2>Response</h2>
            <p>
              <strong className="text-accent">
                {result.responseSummary ?? result.decisionNote}
              </strong>
            </p>
            <ul className="kv">
              <li>
                <span>Run</span>
                <strong>{result.runId?.slice(0, 8)}</strong>
              </li>
              <li>
                <span>Type</span>
                <strong>{result.objectiveType ?? '—'}</strong>
              </li>
              <li>
                <span>Approval required</span>
                <strong>{String(result.approvalRequired ?? false)}</strong>
              </li>
              <li>
                <span>Decision</span>
                <strong className="text-accent">{result.decision}</strong>
              </li>
              <li>
                <span>Candidates</span>
                <strong>
                  {result.candidateStats
                    ? `${result.candidateStats.ranked} / ${result.candidateStats.retrieved}`
                    : recs.length}
                </strong>
              </li>
            </ul>
            {result.honesty?.note ? <p className="meta">{result.honesty.note}</p> : null}
            {result.resultsPath ? (
              <Link className="btn primary" href={result.resultsPath} style={{ marginTop: 8 }}>
                Open full results
              </Link>
            ) : null}
          </article>

          <article className="panel">
            <h2>Sources</h2>
            {(result.sources ?? []).length === 0 ? (
              <p className="meta">No source metadata</p>
            ) : (
              <ul className="kv">
                {(result.sources ?? []).map((s) => (
                  <li key={s.name}>
                    <span>{s.name}</span>
                    <strong>
                      {s.status}
                      {s.detail ? ` · ${s.detail}` : ''}
                    </strong>
                  </li>
                ))}
              </ul>
            )}
            {result.filtersApplied ? (
              <p className="meta" style={{ marginTop: 8 }}>
                Filters: {JSON.stringify(result.filtersApplied)}
              </p>
            ) : null}
          </article>

          {timeline.length > 0 ? (
            <article className="panel wide">
              <h2>Execution timeline</h2>
              <ol className="ai-timeline" aria-label="Execution timeline">
                {timeline.map((step, i) => (
                  <li
                    key={`${step.at}-${i}`}
                    className={`ai-timeline-step ${
                      step.status === 'failed'
                        ? 'failed'
                        : step.status === 'active'
                          ? 'active'
                          : 'done'
                    }`}
                  >
                    <span className="meta">{new Date(step.at).toLocaleTimeString()}</span> —{' '}
                    {step.step}
                    {step.detail ? (
                      <span className="meta" style={{ display: 'block' }}>
                        {step.detail}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ol>
            </article>
          ) : null}

          <article className="panel wide">
            <h2>Ranked recommendations</h2>
            {recs.length === 0 ? (
              <p className="meta">
                No recommendations. Import fixtures or relax filters if the store is empty.
              </p>
            ) : (
              <table className="scanner-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Product</th>
                    <th>Score</th>
                    <th>Conf</th>
                    <th>Margin</th>
                    <th>Profit</th>
                    <th>Policy</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {recs.map((r) => {
                    const card = r.productCard ?? {};
                    const margin = Number(
                      card.expectedMarginBps ?? r.calculation?.netMarginBps ?? 0,
                    );
                    const profit = Number(
                      card.contributionProfitMinor ?? r.calculation?.contributionProfitMinor ?? 0,
                    );
                    const currency = String(card.currency ?? r.calculation?.currency ?? 'USD');
                    const score = Number(card.opportunityScore ?? 0);
                    return (
                      <tr key={`${r.rank}-${r.productId ?? r.title}`}>
                        <td>{r.rank}</td>
                        <td style={{ whiteSpace: 'normal' }}>
                          <strong>{r.title}</strong>
                          <div className="meta">{r.rationale}</div>
                          {(r.missingData?.length ?? 0) > 0 ? (
                            <div className="meta">
                              Missing: {(r.missingData ?? []).slice(0, 3).join(', ')}
                            </div>
                          ) : null}
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
                        <td>{r.policyRiskScore ?? '—'}</td>
                        <td>
                          {r.productId ? (
                            <span className="approval-actions" style={{ flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                className="btn ghost"
                                style={{ minHeight: 26, fontSize: '0.65rem' }}
                                onClick={() => void nextAction('view', r.productId)}
                              >
                                View
                              </button>
                              <button
                                type="button"
                                className="btn ghost"
                                style={{ minHeight: 26, fontSize: '0.65rem' }}
                                onClick={() => void nextAction('watchlist', r.productId)}
                              >
                                Watchlist
                              </button>
                              <button
                                type="button"
                                className="btn ghost"
                                style={{ minHeight: 26, fontSize: '0.65rem' }}
                                onClick={() => void nextAction('rescore', r.productId)}
                              >
                                Recalc
                              </button>
                              <button
                                type="button"
                                className="btn secondary"
                                style={{ minHeight: 26, fontSize: '0.65rem' }}
                                onClick={() => void nextAction('draft', r.productId)}
                              >
                                Draft
                              </button>
                            </span>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </article>

          <article className="panel">
            <h2>Critic / Auditor</h2>
            <p className="meta">
              Critic: {result.critic?.severity ?? '—'} — {result.critic?.notes}
            </p>
            <p className="meta">Auditor: {result.auditor?.notes}</p>
            <ul className="kv">
              <li>
                <span>Calculation OK</span>
                <strong
                  className={
                    result.auditor?.calculationOk === true
                      ? 'text-positive'
                      : result.auditor?.calculationOk === false
                        ? 'text-negative'
                        : undefined
                  }
                >
                  {String(result.auditor?.calculationOk)}
                </strong>
              </li>
              <li>
                <span>Policy OK</span>
                <strong
                  className={
                    result.auditor?.policyOk === true
                      ? 'text-positive'
                      : result.auditor?.policyOk === false
                        ? 'text-blocked'
                        : undefined
                  }
                >
                  {String(result.auditor?.policyOk)}
                </strong>
              </li>
            </ul>
          </article>

          {tools.length > 0 ? (
            <article className="panel">
              <h2>Tools</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {tools.map((t) => (
                  <span key={t} className="ai-tool-chip">
                    {t}
                  </span>
                ))}
              </div>
            </article>
          ) : null}
        </div>
      ) : null}

      {harm ? (
        <article className="panel" style={{ marginTop: 8 }}>
          <h2>Identity resolution</h2>
          <pre className="tool-result">{JSON.stringify(harm, null, 2)}</pre>
        </article>
      ) : null}
    </div>
  );
}
