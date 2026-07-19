'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  FormEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { getApiBaseUrl } from '../../lib/api';
import {
  briefingSourceLabel,
  briefingSourceTone,
  isGenerativeBriefing,
  phaseBDetail,
  resolveBriefingText,
} from '../../lib/ai-briefing-provenance';
import {
  humanOperatorError,
  runOperator,
  type OperatorRunResult,
} from '../../lib/ai-operator-client';
import {
  useAiOperator,
  type AiRailMode,
} from '../../lib/ai-operator-context';
import type { ResolvedWorkspace } from '../../lib/workspace';

/**
 * Persistent right-rail AI Operator (canonical contextual entry).
 *
 * Owns: objective composer, progress, concise summary, top rec, handoff to full workspace.
 * Does not own: long-form reports, full execution packages (those live on /terminal/objectives/[id]).
 */

type Rec = {
  productId?: string;
  rank: number;
  title: string;
  rationale: string;
  confidence: number;
  nextActions?: string[];
  evidence?: { isFixtureSource?: boolean };
};

type OperatorResponse = OperatorRunResult & {
  recommendations?: Rec[];
  timeline?: Array<{ at?: string; step: string; status: string; detail?: string }>;
};

function seedObjective(workspace?: ResolvedWorkspace | null): string {
  const focus =
    workspace?.intelligence?.focusObjective?.trim() ||
    workspace?.surface?.focusObjective?.trim();
  if (focus) return focus.slice(0, 400);
  const current = workspace?.currentObjective?.trim();
  if (current) return current.slice(0, 400);
  const def = workspace?.defaultObjective?.trim();
  if (def) return def.slice(0, 400);
  const firstActive = workspace?.surface?.activeObjectives?.[0]?.title?.trim();
  if (firstActive) return firstActive.slice(0, 400);
  return 'Find products worth evaluating.';
}

function workspaceQuickChips(workspace?: ResolvedWorkspace | null): string[] {
  const chips: string[] = [];
  for (const i of workspace?.surface?.insights ?? []) {
    if (i.suggestedObjective?.trim()) chips.push(i.suggestedObjective.trim().slice(0, 200));
    else if (i.suggestedAiQuery?.trim()) chips.push(i.suggestedAiQuery.trim().slice(0, 200));
  }
  for (const o of workspace?.surface?.activeObjectives ?? []) {
    if (o.title?.trim()) chips.push(o.title.trim().slice(0, 200));
  }
  for (const a of workspace?.surface?.recommendedActions ?? []) {
    if (a.label?.trim() && a.reason?.trim()) {
      chips.push(`${a.label}: ${a.reason}`.slice(0, 200));
    } else if (a.label?.trim()) {
      chips.push(a.label.trim().slice(0, 200));
    }
  }
  if (workspace?.recommendedNextAction?.label) {
    const r = workspace.recommendedNextAction;
    chips.push((r.reason ? `${r.label} — ${r.reason}` : r.label).slice(0, 200));
  }
  return [...new Set(chips)].slice(0, 5);
}

function formatAction(a: string): string {
  return a.replace(/_/g, ' ');
}

export function AiContextPanel({
  open,
  onToggle,
  railMode = 'standard',
  onRailModeChange,
  workspace,
}: {
  open: boolean;
  onToggle: () => void;
  railMode?: AiRailMode;
  onRailModeChange?: (m: AiRailMode) => void;
  workspace?: ResolvedWorkspace | null;
}) {
  const router = useRouter();
  const {
    draftObjective,
    setDraftObjective,
    setLastRunId,
    lastRunId,
  } = useAiOperator();
  const threadRef = useRef<HTMLDivElement>(null);
  const quick = useMemo(() => workspaceQuickChips(workspace), [workspace]);
  const [objective, setObjectiveLocal] = useState(() => seedObjective(workspace));
  const [lastUserMsg, setLastUserMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progressLabel, setProgressLabel] = useState<string | null>(null);
  const [progressDetail, setProgressDetail] = useState<string | null>(null);
  const [result, setResult] = useState<OperatorResponse | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  function setObjective(v: string) {
    setObjectiveLocal(v);
    setDraftObjective(v);
  }

  useEffect(() => {
    try {
      sessionStorage.removeItem('tradeops.ai.panel.lastRun');
      sessionStorage.removeItem('tradeops.ai.panel.lastRun.v2');
      sessionStorage.removeItem('tradeops.ai.panel.lastRun.v3');
    } catch {
      /* ignore */
    }
  }, []);

  // Shared draft from contextual openWithObjective
  useEffect(() => {
    if (draftObjective.trim() && draftObjective !== objective) {
      setObjectiveLocal(draftObjective);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to external draft inject
  }, [draftObjective]);

  useEffect(() => {
    if (busy || result) return;
    if (draftObjective.trim()) return;
    const next = seedObjective(workspace);
    if (next) setObjective(next);
  }, [workspace?.surface?.focusObjective, workspace?.currentObjective, busy, result]);

  useEffect(() => {
    const el = threadRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [busy, progressLabel, result, error, lastUserMsg]);

  async function importFixtures() {
    setBusy(true);
    setError(null);
    setActionMsg(null);
    setProgressLabel('Importing fixtures…');
    try {
      const res = await fetch(
        `${getApiBaseUrl()}/api/v1/commerce/import/fixture-supplier`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { Accept: 'application/json' },
        },
      );
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) throw new Error(body.message ?? `HTTP ${res.status}`);
      setActionMsg(body.message ?? 'Fixtures imported. Run objective again.');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setBusy(false);
      setProgressLabel(null);
    }
  }

  async function run(e?: FormEvent) {
    e?.preventDefault();
    if (busy || !objective.trim()) return;
    const prompt = objective.trim();
    setBusy(true);
    setError(null);
    setActionMsg(null);
    setResult(null);
    setLastUserMsg(prompt);
    setProgressLabel('Queued…');
    setProgressDetail(null);
    try {
      const { result: bodyRaw } = await runOperator({
        objective: prompt,
        preferStream: true,
        onProgress: (ev) => {
          setProgressLabel(ev.step || ev.state || 'Working…');
          setProgressDetail(ev.detail ?? null);
        },
      });
      const body = bodyRaw as OperatorResponse;
      setResult(body);
      setProgressLabel(null);
      setProgressDetail(null);
      if (body.runId) setLastRunId(body.runId);

      if (
        (body.candidateStats?.retrieved ?? 0) === 0 &&
        (body.recommendations?.length ?? 0) === 0
      ) {
        setActionMsg('No products in the organization store yet.');
      }

      router.refresh();
    } catch (err) {
      const status =
        typeof err === 'object' && err && 'status' in err
          ? Number((err as { status?: number }).status)
          : 500;
      const body =
        typeof err === 'object' && err && 'body' in err
          ? ((err as { body?: OperatorResponse }).body ?? {})
          : {};
      setError(
        err instanceof Error
          ? humanOperatorError(status, body as OperatorRunResult) || err.message
          : 'Run failed',
      );
      setProgressLabel(null);
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
        setActionMsg('Added to watchlist');
      } else if (action === 'create_listing_draft') {
        const res = await fetch(
          `${getApiBaseUrl()}/api/v1/products/${productId}/listing-draft`,
          {
            method: 'POST',
            credentials: 'include',
            headers: { Accept: 'application/json' },
          },
        );
        if (!res.ok) throw new Error('Draft failed');
        setActionMsg('Listing draft created');
      } else if (action === 'recalculate_profit') {
        await fetch(`${getApiBaseUrl()}/api/v1/products/${productId}/rescore`, {
          method: 'POST',
          credentials: 'include',
          headers: { Accept: 'application/json' },
        });
        setActionMsg('Rescored');
      } else if (action === 'view_product') {
        router.push(`/terminal/products/${productId}`);
        return;
      }
      router.refresh();
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : 'Action failed');
    }
  }

  function onComposerKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void run();
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        className="ai-panel-expand"
        onClick={onToggle}
        aria-label="Open AI Operator"
      >
        AI
      </button>
    );
  }

  const briefing = result ? resolveBriefingText(result) : null;
  const source = result?.briefingSource ?? null;
  const phaseB = phaseBDetail(result?.timeline);
  const generative = isGenerativeBriefing(source);
  const recs: Rec[] = Array.isArray(result?.recommendations)
    ? (result!.recommendations as Rec[])
    : [];
  const topRec = recs[0] ?? null;
  const isFixture =
    result?.honesty?.dataMode === 'fixture' ||
    result?.envelope?.meta?.dataMode === 'fixture';
  const hasThread = Boolean(lastUserMsg || busy || result || error);
  const toolNames = Array.isArray(result?.toolTrace)
    ? [
        ...new Set(
          (result!.toolTrace as Array<{ tool?: string }>)
            .map((t) => t.tool)
            .filter((t): t is string => Boolean(t)),
        ),
      ]
    : [];
  const fullResultHref =
    result?.resultsPath ||
    (result?.runId ? `/terminal/objectives/${result.runId}` : null) ||
    (lastRunId ? `/terminal/objectives/${lastRunId}` : '/terminal/objectives');
  const briefingPreview =
    briefing && briefing.length > 420 ? `${briefing.slice(0, 420).trim()}…` : briefing;

  return (
    <aside
      className={`ai-context-panel ai-context-panel--${railMode}`}
      aria-label="AI Operator"
      data-ai-state={
        busy ? 'thinking' : error ? 'failed' : result ? 'completed' : 'idle'
      }
      data-briefing-source={source ?? undefined}
    >
      <header className="ai-panel-header">
        <div className="ai-panel-header__identity">
          <span className={`ai-panel-avatar ${busy ? 'ai-pulse' : ''}`} aria-hidden />
          <div className="ai-panel-header__meta">
            <strong>AI Operator</strong>
            <span className="meta">
              {workspace?.personaLabel ?? 'Workspace'}
              {busy ? ' · running' : result ? ' · ready' : ' · online'}
              {isFixture ? ' · fixture' : ''}
            </span>
          </div>
        </div>
        <div className="ai-panel-header__actions">
          {result?.briefingSource ? (
            <span
              className={`ai-prov-chip ai-prov-chip--${briefingSourceTone(source)}`}
              title="Server briefingSource"
            >
              {briefingSourceLabel(source)}
            </span>
          ) : null}
          {onRailModeChange ? (
            <button
              type="button"
              className="btn ghost"
              aria-label="Toggle rail width"
              title="Compact / standard / expanded"
              onClick={() => {
                const order: AiRailMode[] = ['compact', 'standard', 'expanded'];
                const i = order.indexOf(railMode === 'closed' ? 'standard' : railMode);
                onRailModeChange(order[(i + 1) % order.length]!);
              }}
            >
              {railMode === 'expanded' ? '⟷' : railMode === 'compact' ? '⟵' : '⟶'}
            </button>
          ) : null}
          <button type="button" className="btn ghost" onClick={onToggle} aria-label="Hide AI panel">
            Hide
          </button>
        </div>
      </header>

      <div className="ai-thread" ref={threadRef}>
        {!hasThread ? (
          <div className="ai-thread-empty">
            <h3>Ask the operator</h3>
            <p>
              State a commerce objective. Tools rank products; Cohere writes the briefing when
              configured.
            </p>
          </div>
        ) : null}

        {lastUserMsg ? (
          <div className="ai-msg ai-msg--user">
            <span className="ai-msg-label">You</span>
            <div className="ai-msg-bubble">{lastUserMsg}</div>
          </div>
        ) : null}

        {busy && progressLabel ? (
          <div className="ai-msg ai-msg--assistant">
            <span className="ai-msg-label">Operator</span>
            <div className="ai-progress-card">
              <strong>{progressLabel}</strong>
              {progressDetail ? <span className="meta">{progressDetail}</span> : null}
              <div className="ai-progress" role="progressbar" aria-label="Working" />
            </div>
          </div>
        ) : null}

        {error ? <p className="form-error">{error}</p> : null}
        {actionMsg ? <p className="meta">{actionMsg}</p> : null}

        {result ? (
          <>
            <div className="ai-prov-bar" aria-label="Briefing provenance">
              <span className={`ai-prov-chip ai-prov-chip--${briefingSourceTone(source)}`}>
                {briefingSourceLabel(source)}
              </span>
              {phaseB.latencyMs != null ? (
                <span className="ai-prov-chip ai-prov-chip--muted">
                  Phase B {phaseB.latencyMs}ms
                </span>
              ) : null}
              {phaseB.fixedTemplate === false ? (
                <span className="ai-prov-chip ai-prov-chip--ok">No fixed template</span>
              ) : null}
              {isFixture ? (
                <span className="ai-prov-chip ai-prov-chip--warn">Fixture data</span>
              ) : null}
            </div>

            {briefingPreview ? (
              <div className="ai-msg ai-msg--assistant">
                <span className="ai-msg-label">
                  {generative ? 'Summary · Cohere' : 'Status'}
                </span>
                <div
                  className={`ai-msg-bubble ${generative ? 'ai-msg-bubble--briefing' : 'ai-msg-bubble--status'}`}
                >
                  <pre className="ai-briefing-body">{briefingPreview}</pre>
                </div>
              </div>
            ) : null}

            {topRec ? (
              <article className="ai-rec-card ai-rec-card--top">
                <div className="ai-rec-card__title">
                  <strong>
                    #{topRec.rank} {topRec.title}
                  </strong>
                  <span className="ai-rec-card__conf">
                    {(topRec.confidence * 100).toFixed(0)}%
                  </span>
                </div>
                <p>
                  {topRec.rationale.slice(0, 220)}
                  {topRec.rationale.length > 220 ? '…' : ''}
                </p>
                <div className="ai-rec-actions">
                  {(topRec.nextActions ?? ['view_product']).slice(0, 2).map((a) => (
                    <button
                      key={a}
                      type="button"
                      className="btn ghost"
                      disabled={!topRec.productId}
                      onClick={() => void nextAction(a, topRec.productId)}
                    >
                      {formatAction(a)}
                    </button>
                  ))}
                </div>
              </article>
            ) : (
              <div className="ai-msg ai-msg--assistant">
                <div className="ai-msg-bubble">
                  <p style={{ margin: '0 0 8px' }}>No products ranked for this objective.</p>
                  <button
                    type="button"
                    className="btn secondary"
                    disabled={busy}
                    onClick={() => void importFixtures()}
                  >
                    Import fixture products
                  </button>
                </div>
              </div>
            )}

            <div className="ai-rail-actions">
              <Link href={fullResultHref} className="btn primary">
                Open full result
              </Link>
              <Link href="/terminal/objectives" className="btn ghost">
                All objectives
              </Link>
              {recs.length > 1 ? (
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => setShowDetails((v) => !v)}
                >
                  {showDetails ? 'Hide details' : `+${recs.length - 1} more`}
                </button>
              ) : null}
            </div>

            {showDetails ? (
              <div className="ai-rail-details">
                {toolNames.length > 0 ? (
                  <p className="meta" title={toolNames.join(', ')}>
                    Tools: {toolNames.slice(0, 6).join(', ')}
                    {toolNames.length > 6 ? '…' : ''}
                  </p>
                ) : null}
                {recs.slice(1).map((r) => (
                  <article
                    key={`${r.rank}-${r.productId ?? r.title}`}
                    className="ai-rec-card"
                  >
                    <div className="ai-rec-card__title">
                      <strong>
                        #{r.rank} {r.title}
                      </strong>
                      <span className="ai-rec-card__conf">
                        {(r.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                    <p>
                      {r.rationale.slice(0, 160)}
                      {r.rationale.length > 160 ? '…' : ''}
                    </p>
                  </article>
                ))}
              </div>
            ) : null}
          </>
        ) : null}
      </div>

      <form className="ai-composer" onSubmit={(e) => void run(e)}>
        {quick.length > 0 ? (
          <div className="ai-chip-row" aria-label="Workspace suggestions">
            {quick.map((q) => (
              <button
                key={q}
                type="button"
                className="ai-chip"
                disabled={busy}
                title={q}
                onClick={() => setObjective(q)}
              >
                {q}
              </button>
            ))}
          </div>
        ) : null}

        <div className="ai-composer-box">
          <label className="sr-only" htmlFor="ai-objective">
            Objective
          </label>
          <textarea
            id="ai-objective"
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            onKeyDown={onComposerKeyDown}
            rows={2}
            disabled={busy}
            placeholder="What should the operator evaluate?"
          />
          <button
            type="submit"
            className="btn primary"
            disabled={busy || !objective.trim()}
            aria-label={busy ? 'Running' : 'Send objective'}
          >
            {busy ? '…' : 'Send'}
          </button>
        </div>
        <p className="ai-composer-hint">Enter to send · Shift+Enter for newline</p>
      </form>
    </aside>
  );
}
