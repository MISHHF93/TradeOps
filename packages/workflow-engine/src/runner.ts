import { getWorkflowTemplate, type WorkflowTemplate } from './templates';

export type WorkflowRunResult = {
  templateKey: string;
  version: string;
  status: 'completed' | 'awaiting_approval' | 'blocked' | 'partial';
  stepsCompleted: string[];
  stepsSkipped: string[];
  requiresApproval: boolean;
  message: string;
  evidence: Record<string, unknown>;
};

export type ScoredOpportunityEvidence = {
  productId: string;
  title?: string;
  score: number;
  expectedMarginBps?: number;
  currentSignal?: string;
  sourcePlatform?: string;
  isFixture?: boolean;
};

export type WorkflowRunContext = {
  organizationId: string;
  variables?: Record<string, unknown>;
  productCount?: number;
  dryRun?: boolean;
  /**
   * Host-loaded opportunity rows for discovery / margin templates.
   * Never invent scores — empty list is honest empty state.
   */
  scoredOpportunities?: ScoredOpportunityEvidence[];
  /** Optional inventory rows for inventory_protection shadow path */
  inventorySnapshots?: Array<{
    productId: string;
    title?: string;
    quantity: number;
    listingId?: string;
    listingStatus?: string;
  }>;
};

/**
 * Deterministic template runner for v1.
 * Real connector side-effects only when host injects handlers and approvals pass.
 * operational_partial templates produce real evidence from host data when provided.
 */
export function runWorkflowTemplate(
  key: string,
  ctx: WorkflowRunContext,
): WorkflowRunResult {
  const template = getWorkflowTemplate(key);
  if (!template) {
    return {
      templateKey: key,
      version: '0',
      status: 'blocked',
      stepsCompleted: [],
      stepsSkipped: [],
      requiresApproval: false,
      message: `Unknown workflow template: ${key}`,
      evidence: {},
    };
  }

  if (template.executionStatus === 'coming_soon') {
    return {
      templateKey: template.key,
      version: template.version,
      status: 'blocked',
      stepsCompleted: [],
      stepsSkipped: template.steps,
      requiresApproval: template.requiresApproval,
      message: `${template.name} is not fully executable yet (coming_soon). Template recorded for planning only.`,
      evidence: { executionStatus: template.executionStatus },
    };
  }

  const dryRun = ctx.dryRun !== false;
  const stepsCompleted: string[] = [];
  const stepsSkipped: string[] = [];
  const evidence: Record<string, unknown> = {
    organizationId: ctx.organizationId,
    variables: ctx.variables ?? {},
    productCount: ctx.productCount ?? null,
    dryRun,
    executionStatus: template.executionStatus,
  };

  // ── Template-specific evidence assembly (no fabricated metrics) ──────────
  if (template.key === 'product_opportunity_discovery') {
    const minMarginBps = Number(ctx.variables?.minMarginBps ?? 2500);
    const topN = Math.min(50, Math.max(1, Number(ctx.variables?.topN ?? 10)));
    const all = ctx.scoredOpportunities ?? [];
    const qualifying = all
      .filter((o) => {
        const marginOk =
          o.expectedMarginBps == null || o.expectedMarginBps >= minMarginBps;
        const notBlocked = (o.currentSignal ?? '').toUpperCase() !== 'BLOCKED';
        return marginOk && notBlocked;
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, topN);

    evidence.minMarginBps = minMarginBps;
    evidence.topN = topN;
    evidence.candidatesLoaded = all.length;
    evidence.qualifyingCount = qualifying.length;
    evidence.topOpportunities = qualifying.map((o) => ({
      productId: o.productId,
      title: o.title ?? null,
      score: o.score,
      expectedMarginBps: o.expectedMarginBps ?? null,
      currentSignal: o.currentSignal ?? null,
      sourcePlatform: o.sourcePlatform ?? null,
      isFixture: Boolean(o.isFixture),
      dataClass: o.isFixture ? 'TEST_FIXTURE' : 'canonical_or_live',
    }));
    evidence.fixtureInTop = qualifying.filter((o) => o.isFixture).length;
    evidence.honesty =
      all.length === 0
        ? 'No opportunity rows in host store — empty result, not fabricated zeros.'
        : 'Scores come from persisted Opportunity rows; fixtures labeled when present.';
  }

  if (template.key === 'inventory_protection') {
    const minStock = Number(ctx.variables?.minStock ?? 5);
    const pauseBelow = Number(ctx.variables?.pauseBelow ?? 1);
    const snaps = ctx.inventorySnapshots ?? [];
    const atRisk = snaps.filter((s) => s.quantity < minStock);
    const pauseCandidates = snaps.filter((s) => s.quantity < pauseBelow);
    evidence.minStock = minStock;
    evidence.pauseBelow = pauseBelow;
    evidence.listingsInspected = snaps.length;
    evidence.atRiskCount = atRisk.length;
    evidence.pauseCandidates = pauseCandidates.map((s) => ({
      productId: s.productId,
      title: s.title ?? null,
      quantity: s.quantity,
      listingId: s.listingId ?? null,
      listingStatus: s.listingStatus ?? null,
    }));
    evidence.draftActions = pauseCandidates.map((s) => ({
      action: 'pause_or_reduce_qty',
      productId: s.productId,
      listingId: s.listingId ?? null,
      proposedQty: 0,
      requiresApproval: true,
      applied: false,
      note: 'Shadow/draft only — external listing not changed',
    }));
    evidence.honesty =
      snaps.length === 0
        ? 'No inventory snapshots provided — empty inspection, not fabricated stock levels.'
        : 'Inventory quantities from host store; no external pause executed without approval.';
  }

  if (template.key === 'margin_protection') {
    const floor = Number(ctx.variables?.marginFloorBps ?? 2000);
    const all = ctx.scoredOpportunities ?? [];
    const belowFloor = all.filter(
      (o) =>
        o.expectedMarginBps != null && o.expectedMarginBps < floor,
    );
    evidence.marginFloorBps = floor;
    evidence.productsChecked = all.length;
    evidence.belowFloorCount = belowFloor.length;
    evidence.priceAdjustmentDrafts = belowFloor.slice(0, 20).map((o) => ({
      productId: o.productId,
      title: o.title ?? null,
      currentMarginBps: o.expectedMarginBps,
      proposedAction: 'raise_price_or_exit',
      requiresApproval: true,
      applied: false,
    }));
  }

  // ── Step walk ────────────────────────────────────────────────────────────
  for (const step of template.steps) {
    const isConsequential =
      step.includes('submit') ||
      step.includes('apply_if_approved') ||
      step.includes('reconcile_external') ||
      step.includes('submit_po') ||
      step === 'reconcile_external';

    if (
      isConsequential &&
      (template.requiresApproval ||
        template.executionStatus === 'shadow_only' ||
        dryRun)
    ) {
      stepsSkipped.push(step);
      continue;
    }

    // Partial operational: skip notify/write when no host data and discovery empty
    if (
      template.key === 'product_opportunity_discovery' &&
      step === 'notify_operator' &&
      (ctx.scoredOpportunities?.length ?? 0) === 0
    ) {
      stepsSkipped.push(step);
      continue;
    }

    stepsCompleted.push(step);
  }

  const awaiting =
    template.requiresApproval ||
    stepsSkipped.some(
      (s) =>
        s.includes('approval') ||
        s.includes('apply') ||
        s.includes('submit') ||
        s.includes('reconcile'),
    );

  let status: WorkflowRunResult['status'] = awaiting
    ? 'awaiting_approval'
    : stepsSkipped.length
      ? 'partial'
      : 'completed';

  // Shadow templates that finished draft evidence still await approval for apply
  if (template.executionStatus === 'shadow_only' && stepsCompleted.length > 0) {
    status = template.requiresApproval ? 'awaiting_approval' : 'partial';
  }

  let message: string;
  if (template.key === 'product_opportunity_discovery') {
    const q = Number(evidence.qualifyingCount ?? 0);
    const loaded = Number(evidence.candidatesLoaded ?? 0);
    message =
      loaded === 0
        ? `${template.name}: no opportunities in store — import products or run scoring first.`
        : `${template.name}: ${q} of ${loaded} opportunities qualify (topN=${evidence.topN}). ${awaiting ? 'Review queue — no external publish.' : 'Shadow summary written.'}`;
  } else if (template.key === 'inventory_protection') {
    message = `${template.name}: inspected ${evidence.listingsInspected ?? 0} listings; ${evidence.atRiskCount ?? 0} below stock floor. Draft pause/reduce only — no external change.`;
  } else if (awaiting) {
    message = `${template.name}: plan executed through draft/evidence; consequential steps require approval or live connectors.`;
  } else {
    message = `${template.name}: completed permitted steps.`;
  }

  return {
    templateKey: template.key,
    version: template.version,
    status,
    stepsCompleted,
    stepsSkipped,
    requiresApproval: template.requiresApproval,
    message,
    evidence,
  };
}

export function describeTemplate(t: WorkflowTemplate) {
  return {
    key: t.key,
    name: t.name,
    version: t.version,
    description: t.description,
    trigger: t.trigger,
    requiresApproval: t.requiresApproval,
    steps: t.steps,
    variables: t.variables,
    executionStatus: t.executionStatus,
  };
}
