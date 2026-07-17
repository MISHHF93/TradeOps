'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { getApiBaseUrl } from '../../lib/api';
import type { ResolvedWorkspace } from '../../lib/workspace';

const DEFAULT_QUICK = [
  'Find products worth evaluating.',
  'Find three products under $20 supplier cost that could sell in Canada with at least a 25% expected margin.',
  'Inspect connector health.',
  'Show active orders and cash exposure.',
  'Prepare strongest products for approval.',
];

const PERSONA_QUICK: Record<string, string[]> = {
  researcher: [
    'Discover and rank product candidates with media and ratings.',
    'Score the top opportunities by contribution margin and policy risk.',
    'Recommend three candidates ready for operator prepare.',
  ],
  operator: [
    'List open cases ready to prepare or publish.',
    'Prepare strongest products for approval.',
    'Show orders needing fulfillment action.',
  ],
  executive: [
    'Summarize portfolio KPIs, risks, and pending approvals.',
    'Review cash exposure and financial health.',
    'What should I approve today?',
  ],
  analyst: [
    'Explain current commerce signals and score movement.',
    'Summarize portfolio composition and customer patterns.',
    'Review prediction outcomes for learning.',
  ],
  developer: [
    'Inspect connector health and capability readiness.',
    'List workflow failures and how to repair them.',
    'Run a shadow diagnostic on live examples readiness.',
  ],
  administrator: [
    'Review SaaS billing status and usage quotas.',
    'Summarize org onboarding and seat usage.',
    'What admin tasks are incomplete?',
  ],
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
  evidence?: Record<string, unknown> & {
    isFixtureSource?: boolean;
    evidenceLinks?: Array<{ kind: string; id: string; href: string; label: string }>;
  };
  actionHrefs?: Record<string, string>;
};

type OperatorResponse = {
  runId?: string;
  status?: string;
  decision?: string;
  decisionNote?: string;
  responseSummary?: string;
  objectiveType?: string;
  riskClass?: string;
  approvalRequired?: boolean;
  timeline?: TimelineStep[];
  sources?: Array<{ name: string; status: string; detail?: string }>;
  candidateStats?: {
    retrieved: number;
    normalized: number;
    ranked: number;
  };
  filtersApplied?: Record<string, unknown>;
  recommendations?: Rec[];
  resultsPath?: string;
  honesty?: { note?: string };
  message?: string;
};

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

/** v2 invalidates pre-repair caches that stuck on awaiting_approval */
const STORAGE_KEY = 'tradeops.ai.panel.lastRun.v2';

function deriveUiState(body: OperatorResponse): AiUiState {
  // Research never lands in approval_required — even if an old client mis-set it
  if (body.objectiveType === 'READ_ONLY_ANALYSIS' || body.approvalRequired === false) {
    return body.decision === 'block' && (body.recommendations?.length ?? 0) === 0
      ? 'completed'
      : 'completed';
  }
  if (body.decision === 'block') return 'blocked';
  if (body.approvalRequired || body.status === 'awaiting_approval') return 'approval_required';
  return 'completed';
}

/**
 * Docked AI Operator — full objective → timeline → results loop.
 * Inherits persona workspace context automatically (server also injects preamble).
 */
export function AiContextPanel({
  open,
  onToggle,
  workspace,
}: {
  open: boolean;
  onToggle: () => void;
  workspace?: ResolvedWorkspace | null;
}) {
  const router = useRouter();
  const quick =
    (workspace?.persona && PERSONA_QUICK[workspace.persona]) || DEFAULT_QUICK;
  const [objective, setObjective] = useState(
    workspace?.surface?.focusObjective?.slice(0, 400) ||
      workspace?.currentObjective?.slice(0, 280) ||
      quick[0]!,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiState, setAiState] = useState<AiUiState>('idle');
  const [progressLabel, setProgressLabel] = useState('Run objective');
  const [result, setResult] = useState<OperatorResponse | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  // Keep objective aligned with intelligent workspace focus when it arrives
  useEffect(() => {
    const focus = workspace?.surface?.focusObjective?.trim();
    if (focus && !busy && aiState === 'idle') {
      setObjective(focus.slice(0, 400));
    }
  }, [workspace?.surface?.focusObjective, busy, aiState]);

  // Restore last run after refresh — re-derive state from server fields (never trust stale labels)
  useEffect(() => {
    try {
      // Drop pre-repair cache that showed "Awaiting Approval" for research
      sessionStorage.removeItem('tradeops.ai.panel.lastRun');
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        objective?: string;
        result?: OperatorResponse;
        aiState?: AiUiState;
      };
      if (parsed.objective) setObjective(parsed.objective);
      if (parsed.result) {
        setResult(parsed.result);
        setAiState(deriveUiState(parsed.result));
        if (parsed.result.responseSummary || (parsed.result.recommendations?.length ?? 0) > 0) {
          setProgressLabel('Completed');
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  const persist = useCallback((obj: string, res: OperatorResponse, state: AiUiState) => {
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ objective: obj, result: res, aiState: state }),
      );
    } catch {
      /* ignore */
    }
  }, []);

  async function run(e?: FormEvent) {
    e?.preventDefault();
    if (busy || !objective.trim()) return;
    setBusy(true);
    setError(null);
    setActionMsg(null);
    setResult(null);
    setAiState('understanding');
    setProgressLabel('Understanding…');
    try {
      await new Promise((r) => setTimeout(r, 180));
      setAiState('checking_connectors');
      setProgressLabel('Searching products…');
      await new Promise((r) => setTimeout(r, 120));
      setAiState('collecting_products');
      setProgressLabel('Evaluating…');

      const res = await fetch(`${getApiBaseUrl()}/api/v1/ai/operator/run`, {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ objective, forceShadow: true }),
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
      await new Promise((r) => setTimeout(r, 80));

      setResult(body);

      const nextState = deriveUiState(body);
      setAiState(nextState);
      setProgressLabel('Completed');
      persist(objective, body, nextState);

      // Navigate main workspace to results for research
      if (body.resultsPath && body.objectiveType === 'READ_ONLY_ANALYSIS') {
        router.push(body.resultsPath);
      } else {
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Run failed');
      setAiState('failed');
      setProgressLabel('Retry');
    } finally {
      setBusy(false);
    }
  }

  async function nextAction(action: string, productId?: string) {
    if (!productId) return;
    setActionMsg(null);
    try {
      if (action === 'add_to_watchlist') {
        await fetch(`${getApiBaseUrl()}/api/v1/watchlist/${productId}`, {
          method: 'POST',
          credentials: 'include',
          headers: { Accept: 'application/json' },
        });
        setActionMsg(`Added ${productId.slice(0, 8)}… to watchlist`);
      } else if (action === 'create_listing_draft') {
        const res = await fetch(
          `${getApiBaseUrl()}/api/v1/products/${productId}/listing-draft`,
          {
            method: 'POST',
            credentials: 'include',
            headers: { Accept: 'application/json' },
          },
        );
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error((body as { message?: string }).message ?? 'Draft failed');
        setActionMsg('Listing draft created (not published — no approval required for draft)');
      } else if (action === 'recalculate_profit') {
        await fetch(`${getApiBaseUrl()}/api/v1/products/${productId}/rescore`, {
          method: 'POST',
          credentials: 'include',
          headers: { Accept: 'application/json' },
        });
        setActionMsg('Rescored product economics');
      } else if (action === 'view_product') {
        router.push(`/terminal/products/${productId}`);
        return;
      }
      router.refresh();
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : 'Action failed');
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        className="ai-panel-expand"
        onClick={onToggle}
        aria-label="Open AI context panel"
      >
        AI
      </button>
    );
  }

  const recs = result?.recommendations ?? [];

  return (
    <aside
      className="ai-context-panel"
      data-ai-state={
        aiState === 'approval_required'
          ? 'awaiting_approval'
          : aiState === 'understanding' ||
              aiState === 'checking_connectors' ||
              aiState === 'collecting_products'
            ? 'thinking'
            : aiState === 'evaluating' || aiState === 'ranking'
              ? 'executing'
              : aiState === 'completed'
                ? 'completed'
                : aiState === 'failed'
                  ? 'failed'
                  : aiState === 'blocked'
                    ? 'blocked'
                    : 'idle'
      }
      aria-label="AI context panel"
      aria-busy={busy}
    >
      <div className="ai-context-header">
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span
            className={`ai-avatar ${busy ? 'ai-pulse' : ''}`}
            aria-hidden
            title="AI Operator"
          />
          <div>
            <strong>AI Operator</strong>
            <p className="meta" style={{ margin: 0 }}>
              Intelligence · tools · evidence
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <Link href="/terminal/ai" className="meta">
            Workspace
          </Link>
          <button
            type="button"
            className="btn ghost"
            style={{ minHeight: 28, padding: '2px 8px' }}
            onClick={onToggle}
          >
            Hide
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        <span className={`ai-status-badge ${aiState === 'approval_required' ? 'awaiting_approval' : aiState === 'completed' ? 'completed' : aiState === 'failed' ? 'failed' : aiState === 'blocked' ? 'blocked' : busy ? 'thinking' : ''}`}>
          {STATUS_LABEL[aiState] ?? 'Idle'}
        </span>
        {result?.objectiveType ? (
          <span className="truth-label" title="Action class">
            {result.objectiveType}
          </span>
        ) : null}
        {result?.approvalRequired === false ? (
          <span className="meta">Approval: not required</span>
        ) : null}
        {busy ? (
          <span className="ai-typing" aria-label="Working">
            <span />
            <span />
            <span />
          </span>
        ) : null}
      </div>

      {busy ? (
        <div className="ai-progress" role="progressbar" aria-label="AI execution progress" />
      ) : null}

      <form onSubmit={(e) => void run(e)} className="ai-context-form">
        <label className="sr-only" htmlFor="ai-objective">
          Objective
        </label>
        <textarea
          id="ai-objective"
          className="ai-objective-input"
          value={objective}
          onChange={(e) => setObjective(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void run();
            }
          }}
          rows={3}
          disabled={busy}
        />
        <div className="ai-quick-row" role="group" aria-label="AI workflow suggestions">
          {quick.map((q) => (
            <button
              key={q}
              type="button"
              className={`ai-suggestion ${objective === q ? 'active' : ''}`}
              aria-pressed={objective === q}
              disabled={busy}
              onClick={() => setObjective(q)}
              title={q}
            >
              {q.slice(0, 28)}…
            </button>
          ))}
        </div>
        <button className="btn ai" type="submit" disabled={busy || !objective.trim()}>
          {busy ? progressLabel : aiState === 'failed' ? 'Retry' : 'Run objective'}
        </button>
      </form>

      {error ? <p className="form-error">{error}</p> : null}
      {actionMsg ? <p className="meta">{actionMsg}</p> : null}

      {result ? (
        <div className="ai-context-result">
          <h3>Objective</h3>
          <p className="meta">{objective}</p>

          <h3>Response</h3>
          <p>
            <strong className="text-accent">{result.responseSummary ?? result.decisionNote}</strong>
          </p>
          {result.honesty?.note ? <p className="meta">{result.honesty.note}</p> : null}

          {result.sources?.length ? (
            <>
              <h3>Sources</h3>
              <ul className="kv">
                {result.sources.map((s) => (
                  <li key={s.name}>
                    <span>{s.name}</span>
                    <strong>
                      {s.status}
                      {s.detail ? ` · ${s.detail}` : ''}
                    </strong>
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          {result.timeline?.length ? (
            <>
              <h3>Execution timeline</h3>
              <ol className="ai-timeline" aria-label="Execution timeline">
                {result.timeline.map((step, i) => (
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
                    <span className="meta" style={{ display: 'block' }}>
                      {new Date(step.at).toLocaleTimeString()}
                    </span>
                    {step.step}
                    {step.detail ? (
                      <span className="meta" style={{ display: 'block' }}>
                        {step.detail}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ol>
            </>
          ) : null}

          {result.filtersApplied ? (
            <p className="meta">
              Filters: min margin{' '}
              {Number(result.filtersApplied.minMarginBps ?? 0) / 100}% · max policy risk{' '}
              {String(result.filtersApplied.maxPolicyRisk ?? '—')} · top{' '}
              {String(result.filtersApplied.topN ?? 3)}
            </p>
          ) : null}

          {recs.length > 0 ? (
            <>
              <h3>
                Recommendations
                {result.candidateStats
                  ? ` (${result.candidateStats.ranked} of ${result.candidateStats.retrieved})`
                  : ''}
              </h3>
              <div style={{ display: 'grid', gap: 10 }}>
                {recs.map((r) => {
                  const card = r.productCard ?? {};
                  const profit = Number(
                    card.contributionProfitMinor ?? r.calculation?.contributionProfitMinor ?? 0,
                  );
                  const margin = Number(
                    card.expectedMarginBps ?? r.calculation?.netMarginBps ?? 0,
                  );
                  const score = Number(card.opportunityScore ?? 0);
                  return (
                    <article
                      key={`${r.rank}-${r.productId ?? r.title}`}
                      className="panel"
                      style={{ padding: 10 }}
                    >
                      <p style={{ margin: '0 0 4px' }}>
                        <strong>
                          {r.rank}. {r.title}
                        </strong>
                      </p>
                      <p className="meta" style={{ margin: '0 0 6px' }}>
                        Score {score}/100 · Conf {(r.confidence * 100).toFixed(0)}% · Margin{' '}
                        {(margin / 100).toFixed(1)}% · Profit{' '}
                        {(profit / 100).toFixed(2)} {String(card.currency ?? 'USD')}
                      </p>
                      <p className="meta" style={{ margin: '0 0 6px' }}>
                        {r.rationale}
                      </p>
                      {r.evidence?.isFixtureSource ? (
                        <p className="pill" style={{ margin: '0 0 6px' }}>
                          TEST FIXTURE evidence — not live marketplace data
                        </p>
                      ) : null}
                      {Array.isArray(r.evidence?.evidenceLinks) &&
                      r.evidence.evidenceLinks.length > 0 ? (
                        <p className="meta" style={{ margin: '0 0 6px' }}>
                          Evidence:{' '}
                          {r.evidence.evidenceLinks.map((l, i) => (
                            <span key={l.href}>
                              {i > 0 ? ' · ' : null}
                              <Link href={l.href}>{l.label}</Link>
                            </span>
                          ))}
                        </p>
                      ) : r.productId ? (
                        <p className="meta" style={{ margin: '0 0 6px' }}>
                          Evidence:{' '}
                          <Link href={`/terminal/products/${r.productId}`}>Product twin</Link>
                        </p>
                      ) : (
                        <p className="meta">No product evidence — recommendation not actionable.</p>
                      )}
                      {(r.missingData?.length ?? 0) > 0 ? (
                        <p className="meta">Missing: {(r.missingData ?? []).slice(0, 3).join(', ')}</p>
                      ) : null}
                      <div className="ai-quick-row" style={{ marginTop: 6 }}>
                        {r.productId ? (
                          <>
                            <button
                              type="button"
                              className="btn ghost"
                              style={{ minHeight: 26, fontSize: '0.65rem' }}
                              onClick={() => void nextAction('view_product', r.productId)}
                            >
                              View
                            </button>
                            <button
                              type="button"
                              className="btn ghost"
                              style={{ minHeight: 26, fontSize: '0.65rem' }}
                              onClick={() => void nextAction('add_to_watchlist', r.productId)}
                            >
                              Watchlist
                            </button>
                            <button
                              type="button"
                              className="btn ghost"
                              style={{ minHeight: 26, fontSize: '0.65rem' }}
                              onClick={() => void nextAction('recalculate_profit', r.productId)}
                            >
                              Recalculate
                            </button>
                            <button
                              type="button"
                              className="btn secondary"
                              style={{ minHeight: 26, fontSize: '0.65rem' }}
                              onClick={() => void nextAction('create_listing_draft', r.productId)}
                            >
                              Draft listing
                            </button>
                          </>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
              {result.resultsPath ? (
                <Link className="btn primary" href={result.resultsPath} style={{ marginTop: 8 }}>
                  Open full results
                </Link>
              ) : null}
            </>
          ) : (
            <p className="meta">
              No product recommendations in this response. Import fixtures or connect a supplier if
              the store is empty.
            </p>
          )}

          {result.runId ? (
            <p className="meta" style={{ marginTop: 8 }}>
              Run <code>{result.runId.slice(0, 8)}</code> · decision{' '}
              <strong className="text-accent">{result.decision}</strong>
            </p>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}
