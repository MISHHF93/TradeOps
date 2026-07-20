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
import { isGenerativeBriefing } from '../../lib/ai-briefing-provenance';
import {
  draftListingFromResearch,
  humanOperatorError,
  persistResearchToCases,
  prepareShopifyGoLive,
  applyShopifyPostActiveOps,
  publishShopifyActive,
  pushListingToShopify,
  runOperator,
  type OperatorRunResult,
  type PublishShopifyActiveResult,
  type PushListingToShopifyResult,
  type ShopifyGoLivePack,
  type ShopifyPostActiveOpsResult,
} from '../../lib/ai-operator-client';
import {
  useAiOperator,
  type AiRailMode,
} from '../../lib/ai-operator-context';
import { normalizeOperatorResult } from '../../lib/operator-result';
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
  return '';
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
  const [result, setResult] = useState<OperatorResponse | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [savingCases, setSavingCases] = useState(false);
  const [saveNote, setSaveNote] = useState<string | null>(null);
  const [draftingListing, setDraftingListing] = useState(false);
  const [draftNote, setDraftNote] = useState<string | null>(null);
  const [preparingGoLive, setPreparingGoLive] = useState(false);
  const [goLivePack, setGoLivePack] = useState<ShopifyGoLivePack | null>(null);
  const [goLiveNote, setGoLiveNote] = useState<string | null>(null);
  const [pushingShopify, setPushingShopify] = useState(false);
  const [pushResult, setPushResult] = useState<PushListingToShopifyResult | null>(
    null,
  );
  const [publishingActive, setPublishingActive] = useState(false);
  const [publishResult, setPublishResult] =
    useState<PublishShopifyActiveResult | null>(null);
  const [applyingOps, setApplyingOps] = useState(false);
  const [opsResult, setOpsResult] = useState<ShopifyPostActiveOpsResult | null>(
    null,
  );
  const [autoSaveCases, setAutoSaveCases] = useState(false);
  const [progressSteps, setProgressSteps] = useState<
    Array<{ state?: string; step?: string; detail?: string; at?: string }>
  >([]);

  useEffect(() => {
    try {
      setAutoSaveCases(localStorage.getItem('tradeops.ai.autoSaveCases') === '1');
    } catch {
      /* ignore */
    }
  }, []);

  function setObjective(v: string) {
    setObjectiveLocal(v);
    setDraftObjective(v);
  }

  // Restore last live result if panel remounts (do not wipe results)
  useEffect(() => {
    try {
      sessionStorage.removeItem('tradeops.ai.panel.lastRun');
      sessionStorage.removeItem('tradeops.ai.panel.lastRun.v2');
      sessionStorage.removeItem('tradeops.ai.panel.lastRun.v3');
      const raw = sessionStorage.getItem('tradeops.ai.panel.lastResult');
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        at?: number;
        prompt?: string;
        body?: OperatorResponse;
      };
      // Keep for 30 minutes
      if (parsed.body && parsed.at && Date.now() - parsed.at < 30 * 60_000) {
        setResult(parsed.body);
        if (parsed.prompt) setLastUserMsg(parsed.prompt);
        if (parsed.body.runId) setLastRunId(parsed.body.runId);
      }
    } catch {
      /* ignore */
    }
  }, [setLastRunId]);

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
  }, [busy, result, error, lastUserMsg]);

  async function run(e?: FormEvent) {
    e?.preventDefault();
    if (busy || !objective.trim()) return;
    const prompt = objective.trim();
    setBusy(true);
    setError(null);
    setResult(null);
    setSaveNote(null);
    setDraftNote(null);
    setGoLivePack(null);
    setGoLiveNote(null);
    setPushResult(null);
    setPublishResult(null);
    setOpsResult(null);
    setProgressSteps([]);
    setLastUserMsg(prompt);
    try {
      // Prefer SSE for live milestones; client falls back to JSON if stream fails.
      const { result: bodyRaw } = await runOperator({
        objective: prompt,
        preferStream: true,
        forceShadow: false,
        onProgress: (ev) => {
          setProgressSteps((prev) => {
            const next = [...prev, { ...ev, at: ev.at || new Date().toISOString() }];
            return next.slice(-8);
          });
        },
      });
      const body = bodyRaw as OperatorResponse;
      setResult(body);
      if (body.runId) setLastRunId(body.runId);
      try {
        sessionStorage.setItem(
          'tradeops.ai.panel.lastResult',
          JSON.stringify({
            at: Date.now(),
            prompt,
            body,
          }),
        );
      } catch {
        /* ignore */
      }
      // Cycle 5: optional auto-persist research comparison as Commerce Cases
      if (
        autoSaveCases &&
        Array.isArray(body.productComparison) &&
        body.productComparison.length > 0
      ) {
        try {
          const out = await persistResearchToCases({
            runId: body.runId,
            products: body.productComparison,
          });
          setSaveNote(
            `Auto-saved ${out.created} new · ${out.reused} existing · ${out.cases.length} cases`,
          );
          router.refresh();
        } catch (saveErr) {
          setSaveNote(
            saveErr instanceof Error ? saveErr.message : 'Auto-save failed',
          );
        }
      }
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
    } finally {
      setBusy(false);
    }
  }

  async function nextAction(action: string, productId?: string) {
    if (!productId) return;
    try {
      if (action === 'add_to_watchlist') {
        await fetch(`${getApiBaseUrl()}/api/v1/watchlist/${productId}`, {
          method: 'POST',
          credentials: 'include',
          headers: { Accept: 'application/json' },
        });
      } else if (action === 'create_listing_draft') {
        await fetch(`${getApiBaseUrl()}/api/v1/products/${productId}/listing-draft`, {
          method: 'POST',
          credentials: 'include',
          headers: { Accept: 'application/json' },
        });
      } else if (action === 'recalculate_profit') {
        await fetch(`${getApiBaseUrl()}/api/v1/products/${productId}/rescore`, {
          method: 'POST',
          credentials: 'include',
          headers: { Accept: 'application/json' },
        });
      } else if (action === 'view_product') {
        router.push(`/terminal/products/${productId}`);
        return;
      }
      router.refresh();
    } catch {
      /* silent — no static toast copy */
    }
  }

  function onComposerKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void run();
    }
  }

  function comparisonProducts() {
    if (!result) return [];
    const fromComparison = Array.isArray(result.productComparison)
      ? result.productComparison
      : [];
    if (fromComparison.length > 0) return fromComparison;
    return (
      (result.recommendations as Array<Record<string, unknown>> | undefined)?.map(
        (r, i) => ({
          rank: typeof r.rank === 'number' ? r.rank : i + 1,
          product: String(r.title ?? r.product ?? ''),
          priceBand: r.priceBand ? String(r.priceBand) : null,
          why: r.rationale ? String(r.rationale) : null,
          risk: r.risk ? String(r.risk) : null,
          confidence: typeof r.confidence === 'number' ? r.confidence : 0.6,
        }),
      ) ?? []
    );
  }

  async function draftTopListing() {
    if (!result || draftingListing) return;
    const products = comparisonProducts();
    if (products.length === 0) {
      setDraftNote('No product rows to draft.');
      return;
    }
    setDraftingListing(true);
    setDraftNote(null);
    try {
      const out = await draftListingFromResearch({
        runId: result.runId,
        products,
      });
      setDraftNote(
        `${out.note ?? 'Draft ready'} · ${out.listingBrief?.suggestedRetail ?? ''}`.trim(),
      );
      router.refresh();
    } catch (err) {
      setDraftNote(err instanceof Error ? err.message : 'Draft listing failed');
    } finally {
      setDraftingListing(false);
    }
  }

  async function prepareGoLive() {
    if (!result || preparingGoLive) return;
    const products = comparisonProducts();
    if (products.length === 0) {
      setGoLiveNote('No product rows — run research first.');
      return;
    }
    setPreparingGoLive(true);
    setGoLiveNote(null);
    setPushResult(null);
    try {
      const out = await prepareShopifyGoLive({
        runId: result.runId,
        products,
      });
      setGoLivePack(out.goLivePack ?? null);
      setGoLiveNote(out.goLivePack?.honesty?.note ?? 'Go-live pack ready');
      router.refresh();
    } catch (err) {
      setGoLiveNote(err instanceof Error ? err.message : 'Shopify go-live prep failed');
    } finally {
      setPreparingGoLive(false);
    }
  }

  async function pushToShopify(opts?: { dryRun?: boolean }) {
    if (pushingShopify) return;
    const listingId = goLivePack?.listing?.id || goLivePack?.approval?.listingId;
    const approvalId = goLivePack?.approval?.id;
    if (!listingId && !approvalId) {
      setGoLiveNote('Prepare Shopify go-live first.');
      return;
    }
    setPushingShopify(true);
    setPublishResult(null);
    try {
      const out = await pushListingToShopify({
        listingId: listingId || undefined,
        approvalId: approvalId || undefined,
        confirmPush: true,
        approveIfPending: true,
        dryRun: Boolean(opts?.dryRun),
      });
      setPushResult(out);
      router.refresh();
    } catch (err) {
      setPushResult({
        status: 'shopify_error',
        publishedToShopify: false,
        honesty: {
          note: err instanceof Error ? err.message : 'Push failed',
        },
        error: 'push_failed',
      });
    } finally {
      setPushingShopify(false);
    }
  }

  async function publishActive(opts?: { dryRun?: boolean }) {
    if (publishingActive) return;
    const listingId =
      pushResult?.listing?.id ||
      goLivePack?.listing?.id ||
      goLivePack?.approval?.listingId;
    const shopifyProductId = pushResult?.shopifyProductId || undefined;
    if (!listingId && !shopifyProductId) {
      setGoLiveNote('Push a DRAFT to Shopify first, then publish ACTIVE.');
      return;
    }
    setPublishingActive(true);
    try {
      const out = await publishShopifyActive({
        listingId: listingId || undefined,
        shopifyProductId: shopifyProductId || undefined,
        confirmPublish: true,
        confirmPhrase: opts?.dryRun ? undefined : 'PUBLISH_ACTIVE',
        dryRun: Boolean(opts?.dryRun),
      });
      setPublishResult(out);
      router.refresh();
    } catch (err) {
      setPublishResult({
        status: 'shopify_error',
        storefrontActive: false,
        honesty: {
          note: err instanceof Error ? err.message : 'Publish ACTIVE failed',
        },
        error: 'publish_failed',
      });
    } finally {
      setPublishingActive(false);
    }
  }

  async function applyPostActiveOps(opts?: { dryRun?: boolean }) {
    if (applyingOps) return;
    const listingId =
      pushResult?.listing?.id ||
      goLivePack?.listing?.id ||
      publishResult?.listing?.id ||
      undefined;
    const shopifyProductId =
      pushResult?.shopifyProductId ||
      publishResult?.shopifyProductId ||
      undefined;
    if (!listingId && !shopifyProductId) {
      setGoLiveNote('Link a Shopify product first (push DRAFT), then apply ops.');
      return;
    }
    setApplyingOps(true);
    try {
      const out = await applyShopifyPostActiveOps({
        listingId,
        shopifyProductId: shopifyProductId || undefined,
        confirmOps: true,
        dryRun: Boolean(opts?.dryRun),
        inventoryQuantity: 10,
        collectionTitle: 'TradeOps Research',
      });
      setOpsResult(out);
      router.refresh();
    } catch (err) {
      setOpsResult({
        status: 'shopify_error',
        honesty: {
          note: err instanceof Error ? err.message : 'Ops failed',
        },
        error: 'ops_failed',
      });
    } finally {
      setApplyingOps(false);
    }
  }

  async function saveAsCases() {
    if (!result || savingCases) return;
    const products = comparisonProducts();
    if (products.length === 0) {
      setSaveNote('No product rows to save.');
      return;
    }
    setSavingCases(true);
    setSaveNote(null);
    try {
      const out = await persistResearchToCases({
        runId: result.runId,
        products,
      });
      setSaveNote(
        `Saved ${out.created} new · ${out.reused} existing · ${out.cases.length} cases`,
      );
      router.refresh();
    } catch (err) {
      setSaveNote(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSavingCases(false);
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

  const view = result ? normalizeOperatorResult(result, lastRunId) : null;
  const source = view?.briefingSource ?? result?.briefingSource ?? null;
  const generative = isGenerativeBriefing(source);
  const fullResultHref = view?.fullResultHref ?? '/terminal/objectives';

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
            {workspace?.personaLabel ? (
              <span className="meta">{workspace.personaLabel}</span>
            ) : null}
          </div>
        </div>
        <div className="ai-panel-header__actions">
          {onRailModeChange ? (
            <button
              type="button"
              className="btn ghost"
              aria-label="Toggle rail width"
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
        {lastUserMsg ? (
          <div className="ai-msg ai-msg--user">
            <div className="ai-msg-bubble">{lastUserMsg}</div>
          </div>
        ) : null}

        {busy ? (
          <div
            className="ai-progress-card"
            role="status"
            aria-live="polite"
            aria-busy="true"
          >
            <strong>
              {progressSteps[progressSteps.length - 1]?.step?.trim() || 'Working'}
            </strong>
            <p className="meta" style={{ margin: 0 }}>
              {progressSteps[progressSteps.length - 1]?.detail?.trim() ||
                'Running tools and synthesizing an answer…'}
            </p>
            {progressSteps.length > 1 ? (
              <ol className="ai-progress-steps">
                {progressSteps.map((s, i) => (
                  <li key={`${s.at ?? i}-${s.step ?? i}`}>
                    <span>{s.step || s.state || 'Step'}</span>
                    {s.detail ? <span className="meta"> — {s.detail}</span> : null}
                  </li>
                ))}
              </ol>
            ) : null}
          </div>
        ) : null}

        {error ? <p className="form-error">{error}</p> : null}

        {view ? (
          <>
            <article
              className={`ai-decision-card ${generative ? 'ai-decision-card--generative' : ''}`}
            >
              <p className="meta" style={{ margin: '0 0 4px' }}>
                {view.status}
                {view.dataMode !== 'unknown' ? ` · ${view.dataMode}` : ''}
                {view.approvalRequired ? ' · approval may be required' : ''}
                {view.merchantDecision ? ' · merchant decision' : ''}
              </p>
              <h3 className="ai-decision-card__headline">{view.decision.headline}</h3>
              <p className="ai-decision-card__summary">{view.decision.summary}</p>
              <p className="meta" style={{ margin: '8px 0 0' }}>
                Evidence {view.evidenceCount}
                {view.riskCount > 0 ? ` · Risks ${view.riskCount}` : ''}
                {view.tools.length > 0
                  ? ` · Tools ${view.tools.slice(0, 3).join(', ')}`
                  : ''}
              </p>
            </article>

            {view.merchantDecision?.topPick ? (
              <article className="ai-merchant-decision" aria-label="Merchant decision">
                <p className="meta" style={{ margin: '0 0 4px' }}>
                  Decision brief · Cycle 7
                </p>
                <p className="ai-merchant-decision__pick">
                  <strong>Top pick:</strong> {view.merchantDecision.topPick.product}
                  {view.merchantDecision.topPick.priceBand ? (
                    <span className="meta">
                      {' '}
                      · {view.merchantDecision.topPick.priceBand}
                    </span>
                  ) : null}
                </p>
                {view.merchantDecision.runnersUp.length > 0 ? (
                  <p className="meta" style={{ margin: '4px 0 0' }}>
                    Also watch:{' '}
                    {view.merchantDecision.runnersUp
                      .map((r) => r.product)
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                ) : null}
                {view.listingBrief ? (
                  <div className="ai-listing-brief">
                    <p className="meta" style={{ margin: '8px 0 4px' }}>
                      Listing brief · suggested retail{' '}
                      <strong>{view.listingBrief.suggestedRetail ?? '—'}</strong>
                      {view.listingBrief.status ? (
                        <span> · {view.listingBrief.status}</span>
                      ) : null}
                    </p>
                    <ul className="ai-listing-brief__bullets">
                      {view.listingBrief.bullets.slice(0, 4).map((b) => (
                        <li key={b.slice(0, 40)}>{b}</li>
                      ))}
                    </ul>
                    {view.listingBrief.channelNote ? (
                      <p className="meta" style={{ margin: '6px 0 0' }}>
                        {view.listingBrief.channelNote}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                <div
                  className="ai-rec-actions"
                  style={{ marginTop: 8, gap: 8, display: 'flex', flexWrap: 'wrap' }}
                >
                  <button
                    type="button"
                    className="btn primary"
                    disabled={draftingListing}
                    onClick={() => void draftTopListing()}
                  >
                    {draftingListing ? 'Drafting…' : 'Draft listing for #1'}
                  </button>
                  <button
                    type="button"
                    className="btn secondary"
                    disabled={preparingGoLive}
                    onClick={() => void prepareGoLive()}
                  >
                    {preparingGoLive ? 'Preparing…' : 'Prepare Shopify go-live'}
                  </button>
                </div>
                {draftNote ? (
                  <p className="meta" style={{ margin: '6px 0 0' }}>
                    {draftNote}{' '}
                    <Link href="/terminal/process">Open Cases →</Link>
                  </p>
                ) : null}
                {goLivePack ? (
                  <div className="ai-golive-pack" aria-label="Shopify go-live pack">
                    <p className="meta" style={{ margin: '10px 0 4px' }}>
                      Go-live pack · Cycle 8
                    </p>
                    <strong className="ai-golive-pack__headline">{goLivePack.headline}</strong>
                    <p className="meta" style={{ margin: '4px 0 6px' }}>
                      {goLivePack.summary}
                    </p>
                    <ul className="ai-golive-pack__checks">
                      {goLivePack.checklist.map((c) => (
                        <li key={c.id} className={c.ok ? 'is-ok' : 'is-blocked'}>
                          <span>{c.ok ? '✓' : '○'}</span> {c.label}
                          {c.detail ? (
                            <span className="meta"> — {c.detail}</span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                    {goLivePack.publishPayloadPreview ? (
                      <p className="meta" style={{ margin: '6px 0 0' }}>
                        Preview: {goLivePack.publishPayloadPreview.title} ·{' '}
                        {goLivePack.publishPayloadPreview.price} · SKU{' '}
                        {goLivePack.publishPayloadPreview.sku} ·{' '}
                        <em>preview only</em>
                      </p>
                    ) : null}
                    <div
                      className="ai-rec-actions"
                      style={{ marginTop: 8, gap: 8, display: 'flex', flexWrap: 'wrap' }}
                    >
                      <button
                        type="button"
                        className="btn primary"
                        disabled={pushingShopify}
                        onClick={() => void pushToShopify()}
                      >
                        {pushingShopify
                          ? 'Pushing…'
                          : 'Approve & push to Shopify'}
                      </button>
                      <button
                        type="button"
                        className="btn ghost"
                        disabled={pushingShopify}
                        onClick={() => void pushToShopify({ dryRun: true })}
                      >
                        Dry-run push
                      </button>
                      <Link
                        className="btn secondary"
                        href={goLivePack.approvalsHref || '/terminal/approvals'}
                      >
                        Open Approvals
                      </Link>
                      <Link
                        className="btn ghost"
                        href={goLivePack.connectorsHref || '/terminal/connectors#shopify-path'}
                      >
                        Shopify path
                      </Link>
                    </div>
                    <p className="meta" style={{ margin: '6px 0 0' }}>
                      {goLivePack.honesty?.note ||
                        'Prepare only until you confirm push. productCreate needs credentials.'}
                    </p>
                    {pushResult ? (
                      <div className="ai-shopify-push" aria-label="Shopify push result">
                        <p className="meta" style={{ margin: '8px 0 2px' }}>
                          Push result · Cycle 13 ·{' '}
                          <strong>{pushResult.status ?? 'unknown'}</strong>
                          {pushResult.publishedToShopify
                            ? ' · on Shopify'
                            : ' · not on Shopify'}
                          {pushResult.media
                            ? pushResult.media.attached
                              ? ` · gallery ${pushResult.media.attachedCount ?? 1}/${pushResult.media.plannedCount ?? 1}`
                              : pushResult.media.plannedCount
                                ? ` · gallery planned ${pushResult.media.plannedCount}`
                                : ' · media pending'
                            : ''}
                        </p>
                        {pushResult.launchReport ? (
                          <div className="ai-launch-report">
                            <strong className="ai-launch-report__headline">
                              {pushResult.launchReport.headline}
                            </strong>
                            <ul className="ai-golive-pack__checks">
                              {pushResult.launchReport.checklist.map((c) => (
                                <li
                                  key={c.id}
                                  className={c.ok ? 'is-ok' : 'is-blocked'}
                                >
                                  <span>{c.ok ? '✓' : '○'}</span> {c.label}
                                  {c.detail ? (
                                    <span className="meta"> — {c.detail}</span>
                                  ) : null}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        {pushResult.shopifyProductId ? (
                          <p className="meta" style={{ margin: '4px 0' }}>
                            Product id: {pushResult.shopifyProductId}
                            {pushResult.shopifyHandle
                              ? ` · handle ${pushResult.shopifyHandle}`
                              : ''}
                          </p>
                        ) : null}
                        {pushResult.variant ? (
                          <p className="meta" style={{ margin: '0 0 4px' }}>
                            Variant · ${pushResult.variant.price}
                            {pushResult.variant.sku
                              ? ` · SKU ${pushResult.variant.sku}`
                              : ''}
                          </p>
                        ) : pushResult.payloadPreview ? (
                          <p className="meta" style={{ margin: '0 0 4px' }}>
                            Planned: {pushResult.payloadPreview.title} ·{' '}
                            {pushResult.payloadPreview.price} · SKU{' '}
                            {pushResult.payloadPreview.sku}
                          </p>
                        ) : null}
                        <p className="meta" style={{ margin: 0 }}>
                          {pushResult.honesty?.note ||
                            pushResult.error ||
                            'Push finished.'}
                        </p>
                        <div
                          className="ai-rec-actions"
                          style={{
                            marginTop: 6,
                            gap: 8,
                            display: 'flex',
                            flexWrap: 'wrap',
                          }}
                        >
                          <button
                            type="button"
                            className="btn secondary"
                            disabled={publishingActive}
                            onClick={() => void publishActive({ dryRun: true })}
                          >
                            {publishingActive ? '…' : 'Dry-run ACTIVE'}
                          </button>
                          <button
                            type="button"
                            className="btn primary"
                            disabled={publishingActive}
                            title="Sets Shopify product status ACTIVE (storefront). Requires PUBLISH_ACTIVE phrase on API."
                            onClick={() => {
                              const ok = window.confirm(
                                'Publish this product as ACTIVE on the Shopify storefront?\n\nThis is live storefront visibility, not a draft. Continue only if price/media look correct.',
                              );
                              if (ok) void publishActive();
                            }}
                          >
                            {publishingActive
                              ? 'Publishing…'
                              : 'Publish ACTIVE (storefront)'}
                          </button>
                          {pushResult.shopifyAdminUrl ||
                          pushResult.launchReport?.shopifyAdminUrl ? (
                            <a
                              className="btn ghost"
                              href={
                                pushResult.shopifyAdminUrl ||
                                pushResult.launchReport?.shopifyAdminUrl ||
                                '#'
                              }
                              target="_blank"
                              rel="noreferrer"
                            >
                              Open Shopify Admin
                            </a>
                          ) : null}
                          {pushResult.listing?.href ? (
                            <Link
                              className="btn ghost"
                              href={pushResult.listing.href}
                            >
                              Open case →
                            </Link>
                          ) : null}
                        </div>
                        {publishResult ? (
                          <div
                            className="ai-publish-active"
                            aria-label="Shopify ACTIVE publish result"
                          >
                            <p className="meta" style={{ margin: '8px 0 2px' }}>
                              Storefront · Cycle 13 ·{' '}
                              <strong>{publishResult.status ?? 'unknown'}</strong>
                              {publishResult.storefrontActive
                                ? ' · ACTIVE'
                                : ' · not active'}
                            </p>
                            {publishResult.publishReport ? (
                              <div className="ai-launch-report">
                                <strong className="ai-launch-report__headline">
                                  {publishResult.publishReport.headline}
                                </strong>
                                <ul className="ai-golive-pack__checks">
                                  {publishResult.publishReport.checklist.map(
                                    (c) => (
                                      <li
                                        key={c.id}
                                        className={c.ok ? 'is-ok' : 'is-blocked'}
                                      >
                                        <span>{c.ok ? '✓' : '○'}</span> {c.label}
                                        {c.detail ? (
                                          <span className="meta">
                                            {' '}
                                            — {c.detail}
                                          </span>
                                        ) : null}
                                      </li>
                                    ),
                                  )}
                                </ul>
                              </div>
                            ) : null}
                            <p className="meta" style={{ margin: '4px 0 0' }}>
                              {publishResult.honesty?.note ||
                                publishResult.error ||
                                ''}
                            </p>
                          </div>
                        ) : null}
                        <div
                          className="ai-rec-actions"
                          style={{
                            marginTop: 8,
                            gap: 8,
                            display: 'flex',
                            flexWrap: 'wrap',
                          }}
                        >
                          <button
                            type="button"
                            className="btn ghost"
                            disabled={applyingOps}
                            onClick={() => void applyPostActiveOps({ dryRun: true })}
                          >
                            {applyingOps ? '…' : 'Dry-run inventory + collection'}
                          </button>
                          <button
                            type="button"
                            className="btn secondary"
                            disabled={applyingOps}
                            title="Sets available qty 10 + collection TradeOps Research"
                            onClick={() => void applyPostActiveOps()}
                          >
                            {applyingOps
                              ? 'Applying…'
                              : 'Apply inventory + collection'}
                          </button>
                        </div>
                        {opsResult ? (
                          <div
                            className="ai-shopify-ops"
                            aria-label="Shopify post-ACTIVE ops"
                          >
                            <p className="meta" style={{ margin: '8px 0 2px' }}>
                              Ops · Cycle 14 ·{' '}
                              <strong>{opsResult.status ?? 'unknown'}</strong>
                            </p>
                            {opsResult.opsReport ? (
                              <div className="ai-launch-report">
                                <strong className="ai-launch-report__headline">
                                  {opsResult.opsReport.headline}
                                </strong>
                                <ul className="ai-golive-pack__checks">
                                  {opsResult.opsReport.checklist.map((c) => (
                                    <li
                                      key={c.id}
                                      className={c.ok ? 'is-ok' : 'is-blocked'}
                                    >
                                      <span>{c.ok ? '✓' : '○'}</span> {c.label}
                                      {c.detail ? (
                                        <span className="meta"> — {c.detail}</span>
                                      ) : null}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}
                            <p className="meta" style={{ margin: '4px 0 0' }}>
                              {opsResult.honesty?.note || opsResult.error || ''}
                            </p>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {goLiveNote && !goLivePack ? (
                  <p className="meta" style={{ margin: '6px 0 0' }}>
                    {goLiveNote}
                  </p>
                ) : null}
              </article>
            ) : null}

            {view.recommendations.length > 0 ? (
              <div className="ai-product-recs" aria-label="Product comparison">
                <p className="meta" style={{ margin: '0 0 6px' }}>
                  Product comparison
                </p>
                <div className="ai-compare-table-wrap">
                  <table className="ai-compare-table compact">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Product</th>
                        <th>Price</th>
                        <th>Why</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(showDetails
                        ? view.recommendations
                        : view.recommendations.slice(0, 4)
                      ).map((r) => (
                        <tr key={`${r.rank}-${r.title}`}>
                          <td>{r.rank}</td>
                          <td>
                            <strong>{r.title}</strong>
                            {r.risk ? (
                              <div className="meta">Risk: {r.risk}</div>
                            ) : null}
                          </td>
                          <td className="meta">{r.priceBand ?? '—'}</td>
                          <td className="meta">
                            {(r.rationale || '—').slice(0, 120)}
                            {r.rationale && r.rationale.length > 120 ? '…' : ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="ai-rec-actions" style={{ marginTop: 8, gap: 8, display: 'flex', flexWrap: 'wrap' }}>
                  {view.recommendations.length > 4 ? (
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() => setShowDetails((v) => !v)}
                    >
                      {showDetails
                        ? 'Show fewer'
                        : `+${view.recommendations.length - 4} more`}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="btn secondary"
                    disabled={savingCases || !(result?.productComparison?.length || view.recommendations.length)}
                    onClick={() => void saveAsCases()}
                  >
                    {savingCases ? 'Saving…' : 'Save as Cases'}
                  </button>
                  <label className="meta ai-autosave-toggle">
                    <input
                      type="checkbox"
                      checked={autoSaveCases}
                      onChange={(e) => {
                        const on = e.target.checked;
                        setAutoSaveCases(on);
                        try {
                          localStorage.setItem(
                            'tradeops.ai.autoSaveCases',
                            on ? '1' : '0',
                          );
                        } catch {
                          /* ignore */
                        }
                      }}
                    />{' '}
                    Auto-save next runs
                  </label>
                </div>
                {saveNote ? (
                  <p className="meta" style={{ margin: '6px 0 0' }}>
                    {saveNote}{' '}
                    <Link href="/terminal/process">Open Cases →</Link>
                  </p>
                ) : null}
              </div>
            ) : null}

            {view.sources.length > 0 ? (
              <div className="ai-sources-strip">
                <p className="meta" style={{ margin: '0 0 4px' }}>
                  Sources
                </p>
                <ul className="ai-sources-list">
                  {view.sources.slice(0, 4).map((s, i) => {
                    const detail = s.detail ?? '';
                    const isUrl = /^https?:\/\//i.test(detail);
                    return (
                      <li key={`${s.name}-${i}`}>
                        <span>{s.name}</span>
                        {detail ? (
                          isUrl ? (
                            <>
                              {' '}
                              ·{' '}
                              <a href={detail} target="_blank" rel="noreferrer">
                                {detail.replace(/^https?:\/\//, '').slice(0, 48)}
                              </a>
                            </>
                          ) : (
                            <span className="meta"> · {detail.slice(0, 80)}</span>
                          )
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}

            <div className="ai-rail-actions">
              <Link href={fullResultHref} className="btn primary">
                Full analysis
              </Link>
            </div>
          </>
        ) : null}
      </div>

      <form className="ai-composer" onSubmit={(e) => void run(e)}>
        {quick.length > 0 && !result ? (
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
            rows={result ? 2 : 3}
            disabled={busy}
            placeholder="What do you want to do?"
          />
          <button
            type="submit"
            className="btn primary"
            disabled={busy || !objective.trim()}
            aria-label="Send"
          >
            {busy ? '…' : '→'}
          </button>
        </div>
      </form>
    </aside>
  );
}
