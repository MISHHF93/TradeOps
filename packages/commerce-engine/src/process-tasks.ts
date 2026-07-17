/**
 * Task + blocker derivation from CommerceCase next-action / stage state.
 * First-class work items without duplicating the case spine.
 */

import type { CommerceStage, CommerceStageStatus } from './commerce-lifecycle';
import { STAGE_DEFINITIONS } from './commerce-lifecycle';

export type ProcessTaskPriority = 'critical' | 'high' | 'normal' | 'low';

export type ProcessTask = {
  id: string;
  commerceCaseId: string;
  productId: string;
  productTitle?: string;
  stage: CommerceStage;
  actionCode: string;
  actionLabel: string;
  priority: ProcessTaskPriority;
  blocker?: boolean;
  requiredPermission: string;
  completionCriteria: string;
  href: string;
  aiCanAssist: boolean;
  approvalRequired: boolean;
};

export type ProcessBlocker = {
  id: string;
  commerceCaseId: string;
  productId: string;
  productTitle?: string;
  stage: CommerceStage;
  code: string;
  message: string;
  severity: 'critical' | 'high' | 'medium';
  recommendedResolution: string;
  aiCanAssist: boolean;
  approvalRequired: boolean;
  href: string;
};

export type CaseTaskInput = {
  caseId: string;
  productId: string;
  productTitle?: string;
  currentStage: CommerceStage;
  stageStatus: CommerceStageStatus;
  nextActionCode?: string | null;
  nextActionLabel?: string | null;
  nextHref?: string | null;
  blockerCode?: string | null;
  blockerMessage?: string | null;
  opportunityScore?: number | null;
};

export function deriveTasksFromCases(cases: CaseTaskInput[]): ProcessTask[] {
  const tasks: ProcessTask[] = [];
  for (const c of cases) {
    if (c.currentStage === 'closed') continue;

    if (c.blockerCode || c.stageStatus === 'blocked') {
      tasks.push({
        id: `task-block-${c.caseId}`,
        commerceCaseId: c.caseId,
        productId: c.productId,
        productTitle: c.productTitle,
        stage: c.currentStage,
        actionCode: c.blockerCode ?? 'resolve_blocker',
        actionLabel: c.blockerMessage ?? 'Resolve stage blocker',
        priority: 'critical',
        blocker: true,
        requiredPermission: 'products:write',
        completionCriteria: 'Blocker cleared and stageStatus is no longer blocked',
        href: c.nextHref ?? `/terminal/process/${c.caseId}`,
        aiCanAssist: true,
        approvalRequired: false,
      });
      continue;
    }

    if (!c.nextActionCode || c.nextActionCode === 'closed') continue;

    const priority = priorityFor(c);
    tasks.push({
      id: `task-${c.caseId}-${c.nextActionCode}`,
      commerceCaseId: c.caseId,
      productId: c.productId,
      productTitle: c.productTitle,
      stage: c.currentStage,
      actionCode: c.nextActionCode,
      actionLabel: c.nextActionLabel ?? c.nextActionCode,
      priority,
      blocker: false,
      requiredPermission: permissionFor(c.nextActionCode),
      completionCriteria: criteriaFor(c.nextActionCode),
      href: c.nextHref ?? `/terminal/process/${c.caseId}`,
      aiCanAssist: true,
      approvalRequired:
        c.nextActionCode.includes('approval') ||
        c.nextActionCode === 'decide_approval' ||
        c.nextActionCode === 'submit_approval',
    });
  }

  const order: Record<ProcessTaskPriority, number> = {
    critical: 0,
    high: 1,
    normal: 2,
    low: 3,
  };
  return tasks.sort((a, b) => order[a.priority] - order[b.priority]);
}

export function deriveBlockersFromCases(cases: CaseTaskInput[]): ProcessBlocker[] {
  return cases
    .filter((c) => c.blockerCode || c.stageStatus === 'blocked' || c.blockerMessage)
    .map((c) => ({
      id: `blocker-${c.caseId}`,
      commerceCaseId: c.caseId,
      productId: c.productId,
      productTitle: c.productTitle,
      stage: c.currentStage,
      code: c.blockerCode ?? 'policy_risk',
      message: c.blockerMessage ?? 'Stage blocked',
      severity:
        c.blockerCode === 'policy_blocked' || c.stageStatus === 'blocked'
          ? ('critical' as const)
          : ('high' as const),
      recommendedResolution: resolutionFor(c.blockerCode ?? 'policy_risk'),
      aiCanAssist: true,
      approvalRequired: false,
      href: `/terminal/process/${c.caseId}`,
    }));
}

function priorityFor(c: CaseTaskInput): ProcessTaskPriority {
  if (c.stageStatus === 'waiting' || c.currentStage === 'approve') return 'high';
  if (c.currentStage === 'sell' || c.currentStage === 'fulfill') return 'high';
  if ((c.opportunityScore ?? 0) >= 70) return 'high';
  if (c.currentStage === 'learn') return 'low';
  return 'normal';
}

function permissionFor(code: string): string {
  if (code.includes('approval') || code === 'decide_approval') return 'orders:write';
  if (code.includes('source') || code.includes('order')) return 'orders:write';
  return 'products:write';
}

function criteriaFor(code: string): string {
  switch (code) {
    case 'run_evaluation':
      return 'Opportunity score and policy assessment exist';
    case 'qualify':
      return 'Policy outcome is not blocked; case advanced to prepare';
    case 'prepare_launch':
      return 'Listing draft created with channel and media plan';
    case 'submit_approval':
    case 'decide_approval':
      return 'Approval decided (approved or rejected)';
    case 'source_order':
      return 'Supplier PO created for paid order';
    case 'reconcile':
      return 'Realized profit or prediction outcome recorded';
    case 'review_outcome':
      return 'Learning review completed; case closed or re-queued';
    default:
      return 'Next action completed and stage advanced';
  }
}

function resolutionFor(code: string): string {
  switch (code) {
    case 'policy_blocked':
      return 'Review policy assessment on product twin; remove blocked SKUs or supply compliance evidence';
    case 'missing_data':
      return 'Supply missing cost, shipping, or identity fields then re-evaluate';
    case 'media_rights':
      return 'Verify artifact rights before listing-eligible visibility';
    case 'connector_unavailable':
      return 'Restore connector health or credentials';
    default:
      return 'Open the commerce case journey and complete the recommended next action';
  }
}

/** Executable SOP templates (procedure metadata — wired to stages, not docs-only). */
export type SopStep = {
  id: string;
  title: string;
  stage: CommerceStage;
  required: boolean;
};

export type SopTemplate = {
  id: string;
  name: string;
  description: string;
  steps: SopStep[];
};

export const SOP_TEMPLATES: SopTemplate[] = [
  {
    id: 'product-launch',
    name: 'Product Launch SOP',
    description: 'Discover through verified publication.',
    steps: [
      { id: 'discover', title: 'Discover candidate', stage: 'discover', required: true },
      { id: 'normalize', title: 'Normalize product identity', stage: 'discover', required: true },
      { id: 'evaluate_econ', title: 'Evaluate economics', stage: 'evaluate', required: true },
      { id: 'evaluate_risk', title: 'Evaluate risk / policy', stage: 'evaluate', required: true },
      { id: 'qualify', title: 'Qualify', stage: 'qualify', required: true },
      { id: 'select_supplier', title: 'Select supplier', stage: 'prepare', required: true },
      { id: 'select_channel', title: 'Select channel', stage: 'prepare', required: true },
      { id: 'prepare_listing', title: 'Prepare listing', stage: 'prepare', required: true },
      { id: 'validate_media', title: 'Validate media rights', stage: 'prepare', required: true },
      { id: 'approve', title: 'Approve publication', stage: 'approve', required: true },
      { id: 'publish', title: 'Publish', stage: 'publish', required: true },
      { id: 'verify', title: 'Verify listing', stage: 'publish', required: true },
    ],
  },
  {
    id: 'customer-order',
    name: 'Customer Order SOP',
    description: 'Paid order through delivery monitoring.',
    steps: [
      { id: 'receive', title: 'Receive paid order', stage: 'sell', required: true },
      { id: 'verify', title: 'Verify order', stage: 'sell', required: true },
      { id: 'source', title: 'Select supplier / PO', stage: 'source', required: true },
      { id: 'approve_po', title: 'Approve supplier purchase', stage: 'approve', required: true },
      { id: 'submit_po', title: 'Submit supplier order', stage: 'source', required: true },
      { id: 'tracking', title: 'Retrieve tracking', stage: 'fulfill', required: true },
      { id: 'monitor', title: 'Monitor delivery', stage: 'fulfill', required: true },
    ],
  },
  {
    id: 'margin-protection',
    name: 'Margin Protection SOP',
    description: 'Cost change → reprice or pause with approval.',
    steps: [
      { id: 'detect', title: 'Detect cost change', stage: 'evaluate', required: true },
      { id: 'recalc', title: 'Recalculate profitability', stage: 'evaluate', required: true },
      { id: 'threshold', title: 'Evaluate threshold', stage: 'qualify', required: true },
      { id: 'propose', title: 'Propose price change or pause', stage: 'prepare', required: true },
      { id: 'approve', title: 'Approve if required', stage: 'approve', required: true },
      { id: 'execute', title: 'Execute', stage: 'publish', required: true },
      { id: 'verify', title: 'Verify', stage: 'learn', required: true },
    ],
  },
  {
    id: 'delivery-exception',
    name: 'Delivery Exception SOP',
    description: 'Late shipment classification and remedy.',
    steps: [
      { id: 'detect', title: 'Detect delay', stage: 'fulfill', required: true },
      { id: 'classify', title: 'Classify severity', stage: 'fulfill', required: true },
      { id: 'supplier', title: 'Contact supplier', stage: 'source', required: true },
      { id: 'customer', title: 'Prepare customer response', stage: 'fulfill', required: true },
      { id: 'remedy', title: 'Approve financial remedy if needed', stage: 'approve', required: false },
      { id: 'close', title: 'Close exception', stage: 'reconcile', required: true },
    ],
  },
  {
    id: 'reconciliation',
    name: 'Reconciliation SOP',
    description: 'Payout match through realized profit.',
    steps: [
      { id: 'payout', title: 'Receive payout', stage: 'reconcile', required: true },
      { id: 'match_orders', title: 'Match orders', stage: 'reconcile', required: true },
      { id: 'match_fees', title: 'Match fees', stage: 'reconcile', required: true },
      { id: 'match_costs', title: 'Match supplier costs', stage: 'reconcile', required: true },
      { id: 'profit', title: 'Calculate realized profit', stage: 'reconcile', required: true },
      { id: 'variance', title: 'Identify variance', stage: 'learn', required: true },
      { id: 'close', title: 'Close period', stage: 'closed', required: true },
    ],
  },
];

export function listSopTemplates(): SopTemplate[] {
  return SOP_TEMPLATES;
}

export function stageTitle(stage: CommerceStage): string {
  return STAGE_DEFINITIONS.find((s) => s.id === stage)?.title ?? stage;
}

/** Stage-aware AI system preamble when a commerce case is selected. */
export function buildCaseAiContext(input: {
  caseId: string;
  productTitle: string;
  currentStage: CommerceStage;
  stageStatus: CommerceStageStatus;
  nextActionLabel?: string | null;
  blockerMessage?: string | null;
  opportunityScore?: number | null;
}): string {
  const stage = stageTitle(input.currentStage);
  return [
    `[Commerce case context — stage-bound]`,
    `Case: ${input.caseId}`,
    `Product: ${input.productTitle}`,
    `Current stage: ${stage} (${input.currentStage})`,
    `Stage status: ${input.stageStatus}`,
    input.opportunityScore != null ? `Opportunity score: ${input.opportunityScore}` : null,
    input.nextActionLabel ? `Primary next action: ${input.nextActionLabel}` : null,
    input.blockerMessage ? `Blocker: ${input.blockerMessage}` : null,
    `Only recommend actions relevant to this stage. If another stage is needed, explain the required transition first.`,
    `Do not invent live marketplace publishes or credentials.`,
  ]
    .filter(Boolean)
    .join('\n');
}
