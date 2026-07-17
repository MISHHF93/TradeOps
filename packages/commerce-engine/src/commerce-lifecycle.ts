/**
 * Canonical commerce lifecycle — one process for every product opportunity.
 * TradeOps is an operating procedure, not a feature inventory.
 */

export const COMMERCE_STAGES = [
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
  'closed',
] as const;

export type CommerceStage = (typeof COMMERCE_STAGES)[number];

/** Per-case stage status (distinct from legacy PIPELINE_STAGES StageStatus). */
export type CommerceStageStatus =
  | 'not_started'
  | 'ready'
  | 'in_progress'
  | 'waiting'
  | 'blocked'
  | 'completed'
  | 'failed';

export type StageDefinition = {
  id: CommerceStage;
  title: string;
  description: string;
  handoffLabel: string;
};

export const STAGE_DEFINITIONS: StageDefinition[] = [
  {
    id: 'discover',
    title: 'Discover',
    description: 'Find product candidates from authorized suppliers, feeds, or imports.',
    handoffLabel: 'Run evaluation',
  },
  {
    id: 'evaluate',
    title: 'Evaluate',
    description: 'Economics, demand, risk, media, and confidence.',
    handoffLabel: 'Qualify opportunity',
  },
  {
    id: 'qualify',
    title: 'Qualify',
    description: 'Apply founder/org policy: qualified, watch, reject, or block.',
    handoffLabel: 'Prepare launch',
  },
  {
    id: 'prepare',
    title: 'Prepare',
    description: 'Listing draft, media, supplier plan, channel, cost model.',
    handoffLabel: 'Submit for approval',
  },
  {
    id: 'approve',
    title: 'Approve',
    description: 'Human decision on consequential publication or purchase.',
    handoffLabel: 'Execute publication',
  },
  {
    id: 'publish',
    title: 'Publish',
    description: 'Create/update external listing via authorized connector.',
    handoffLabel: 'Await sales',
  },
  {
    id: 'sell',
    title: 'Sell',
    description: 'Receive and manage customer orders.',
    handoffLabel: 'Prepare supplier order',
  },
  {
    id: 'source',
    title: 'Source',
    description: 'Select supplier and place purchase order.',
    handoffLabel: 'Track fulfillment',
  },
  {
    id: 'fulfill',
    title: 'Fulfill',
    description: 'Shipment, tracking, delivery, exceptions.',
    handoffLabel: 'Reconcile transaction',
  },
  {
    id: 'reconcile',
    title: 'Reconcile',
    description: 'Payouts, fees, costs, realized profit.',
    handoffLabel: 'Review outcomes',
  },
  {
    id: 'learn',
    title: 'Learn',
    description: 'Compare predictions vs actuals; improve recommendations.',
    handoffLabel: 'Close case',
  },
  {
    id: 'closed',
    title: 'Closed',
    description: 'Lifecycle complete or abandoned.',
    handoffLabel: '—',
  },
];

/** Valid forward edges in the process graph */
export const STAGE_TRANSITIONS: Record<CommerceStage, CommerceStage[]> = {
  discover: ['evaluate', 'closed'],
  evaluate: ['qualify', 'discover', 'closed'],
  qualify: ['prepare', 'evaluate', 'closed'],
  prepare: ['approve', 'qualify', 'closed'],
  approve: ['publish', 'prepare', 'closed'],
  publish: ['sell', 'approve', 'closed'],
  sell: ['source', 'closed'],
  source: ['fulfill', 'sell', 'closed'],
  fulfill: ['reconcile', 'source', 'closed'],
  reconcile: ['learn', 'fulfill', 'closed'],
  learn: ['closed', 'discover'],
  closed: ['discover'],
};

export type TransitionRequirement = {
  from: CommerceStage;
  to: CommerceStage;
  checks: string[];
};

export const TRANSITION_REQUIREMENTS: TransitionRequirement[] = [
  {
    from: 'discover',
    to: 'evaluate',
    checks: ['canonical_product', 'source_record'],
  },
  {
    from: 'evaluate',
    to: 'qualify',
    checks: ['opportunity_score', 'cost_model', 'policy_inputs'],
  },
  {
    from: 'qualify',
    to: 'prepare',
    checks: ['qualified_decision', 'no_blocking_policy'],
  },
  {
    from: 'prepare',
    to: 'approve',
    checks: ['listing_draft', 'channel_selected', 'cost_model'],
  },
  {
    from: 'approve',
    to: 'publish',
    checks: ['approval_granted', 'connector_capability'],
  },
  {
    from: 'publish',
    to: 'sell',
    checks: ['external_listing'],
  },
  {
    from: 'sell',
    to: 'source',
    checks: ['paid_order'],
  },
  {
    from: 'source',
    to: 'fulfill',
    checks: ['supplier_po'],
  },
  {
    from: 'fulfill',
    to: 'reconcile',
    checks: ['fulfillment_closed'],
  },
  {
    from: 'reconcile',
    to: 'learn',
    checks: ['actual_costs_or_outcomes'],
  },
];

export type CaseFacts = {
  hasProduct: boolean;
  hasOpportunity: boolean;
  opportunityScore?: number | null;
  expectedProfitMinor?: number | null;
  confidence?: number | null;
  policyOutcome?: string | null;
  hasListingDraft: boolean;
  hasActiveListing: boolean;
  hasPendingApproval: boolean;
  hasPaidOrder: boolean;
  hasSupplierPo: boolean;
  hasFulfillment: boolean;
  hasDelivered: boolean;
  hasOutcome: boolean;
  blockedByPolicy: boolean;
  watchlisted?: boolean;
};

export type InferredStage = {
  currentStage: CommerceStage;
  stageStatus: CommerceStageStatus;
  recommendation?: string;
};

/**
 * Infer lifecycle position from existing commerce records (migration-friendly).
 */
export function inferStageFromFacts(facts: CaseFacts): InferredStage {
  if (facts.blockedByPolicy || facts.policyOutcome === 'blocked') {
    return {
      currentStage: 'qualify',
      stageStatus: 'blocked',
      recommendation: 'blocked',
    };
  }

  if (facts.hasOutcome || (facts.hasDelivered && facts.hasSupplierPo)) {
    if (facts.hasOutcome) {
      return { currentStage: 'learn', stageStatus: 'ready', recommendation: 'review_outcome' };
    }
    return { currentStage: 'reconcile', stageStatus: 'ready', recommendation: 'reconcile' };
  }

  if (facts.hasDelivered || facts.hasFulfillment) {
    return {
      currentStage: facts.hasDelivered ? 'reconcile' : 'fulfill',
      stageStatus: facts.hasDelivered ? 'ready' : 'in_progress',
      recommendation: facts.hasDelivered ? 'reconcile' : 'track_shipment',
    };
  }

  if (facts.hasSupplierPo) {
    return { currentStage: 'source', stageStatus: 'completed', recommendation: 'await_fulfillment' };
  }

  if (facts.hasPaidOrder) {
    return { currentStage: 'sell', stageStatus: 'completed', recommendation: 'source_order' };
  }

  if (facts.hasActiveListing) {
    return { currentStage: 'publish', stageStatus: 'completed', recommendation: 'await_orders' };
  }

  if (facts.hasPendingApproval) {
    return { currentStage: 'approve', stageStatus: 'waiting', recommendation: 'decide_approval' };
  }

  if (facts.hasListingDraft) {
    return { currentStage: 'prepare', stageStatus: 'completed', recommendation: 'submit_approval' };
  }

  if (facts.policyOutcome === 'approved' || facts.policyOutcome === 'approved_with_conditions') {
    return { currentStage: 'qualify', stageStatus: 'completed', recommendation: 'prepare_launch' };
  }

  if (facts.policyOutcome === 'manual_review') {
    return { currentStage: 'qualify', stageStatus: 'waiting', recommendation: 'manual_review' };
  }

  if (facts.hasOpportunity && (facts.opportunityScore ?? 0) > 0) {
    return { currentStage: 'evaluate', stageStatus: 'completed', recommendation: 'qualify' };
  }

  if (facts.hasProduct) {
    return { currentStage: 'discover', stageStatus: 'completed', recommendation: 'evaluate' };
  }

  return { currentStage: 'discover', stageStatus: 'not_started', recommendation: 'import_or_discover' };
}

export type NextAction = {
  code: string;
  label: string;
  stage: CommerceStage;
  href?: string;
  requiresApproval?: boolean;
};

/**
 * Single primary next action for a commerce case.
 */
export function computeNextAction(input: {
  currentStage: CommerceStage;
  stageStatus: CommerceStageStatus;
  productId: string;
  caseId: string;
  facts: CaseFacts;
  blockerMessage?: string | null;
}): NextAction {
  if (input.stageStatus === 'blocked' || input.blockerMessage) {
    return {
      code: 'resolve_blocker',
      label: input.blockerMessage
        ? `Resolve: ${input.blockerMessage}`
        : 'Resolve stage blocker',
      stage: input.currentStage,
      href: `/terminal/process/${input.caseId}`,
    };
  }

  switch (input.currentStage) {
    case 'discover':
      return {
        code: 'run_evaluation',
        label: 'Run evaluation',
        stage: 'evaluate',
        href: `/terminal/products/${input.productId}`,
      };
    case 'evaluate':
      return {
        code: 'qualify',
        label: 'Qualify opportunity',
        stage: 'qualify',
        href: `/terminal/process/${input.caseId}`,
      };
    case 'qualify':
      if (input.facts.blockedByPolicy) {
        return {
          code: 'policy_block',
          label: 'Review policy block',
          stage: 'qualify',
          href: `/terminal/products/${input.productId}`,
        };
      }
      return {
        code: 'prepare_launch',
        label: 'Prepare launch',
        stage: 'prepare',
        href: `/terminal/products/${input.productId}`,
      };
    case 'prepare':
      return {
        code: 'submit_approval',
        label: 'Submit for approval',
        stage: 'approve',
        href: `/terminal/approvals`,
        requiresApproval: true,
      };
    case 'approve':
      return {
        code: 'decide_approval',
        label: 'Review approval queue',
        stage: 'approve',
        href: `/terminal/approvals`,
        requiresApproval: true,
      };
    case 'publish':
      return {
        code: 'await_sales',
        label: 'Monitor live listing / await sales',
        stage: 'sell',
        href: `/terminal/orders`,
      };
    case 'sell':
      return {
        code: 'source_order',
        label: 'Prepare supplier order',
        stage: 'source',
        href: `/terminal/orders`,
      };
    case 'source':
      return {
        code: 'track_fulfillment',
        label: 'Track fulfillment',
        stage: 'fulfill',
        href: `/terminal/orders`,
      };
    case 'fulfill':
      return {
        code: 'reconcile',
        label: 'Reconcile transaction',
        stage: 'reconcile',
        href: `/terminal/process/${input.caseId}`,
      };
    case 'reconcile':
      return {
        code: 'review_outcome',
        label: 'Review prediction outcome',
        stage: 'learn',
        href: `/terminal/process/${input.caseId}`,
      };
    case 'learn':
      return {
        code: 'close_case',
        label: 'Close case',
        stage: 'closed',
        href: `/terminal/process/${input.caseId}`,
      };
    case 'closed':
    default:
      return {
        code: 'closed',
        label: 'Case closed',
        stage: 'closed',
        href: `/terminal/process/${input.caseId}`,
      };
  }
}

export function canTransition(from: CommerceStage, to: CommerceStage): boolean {
  return (STAGE_TRANSITIONS[from] ?? []).includes(to);
}

export type TransitionValidation = {
  ok: boolean;
  reason?: string;
  missing?: string[];
};

/**
 * Validate a stage transition given current facts.
 */
export function validateStageTransition(
  from: CommerceStage,
  to: CommerceStage,
  facts: CaseFacts,
): TransitionValidation {
  if (!canTransition(from, to)) {
    return { ok: false, reason: `Invalid transition ${from} → ${to}` };
  }

  const req = TRANSITION_REQUIREMENTS.find((r) => r.from === from && r.to === to);
  if (!req) return { ok: true };

  const missing: string[] = [];
  for (const check of req.checks) {
    switch (check) {
      case 'canonical_product':
      case 'source_record':
        if (!facts.hasProduct) missing.push(check);
        break;
      case 'opportunity_score':
      case 'cost_model':
      case 'policy_inputs':
        if (!facts.hasOpportunity && !facts.hasProduct) missing.push(check);
        break;
      case 'qualified_decision':
        if (facts.blockedByPolicy) missing.push('not_blocked');
        break;
      case 'no_blocking_policy':
        if (facts.blockedByPolicy || facts.policyOutcome === 'blocked') missing.push(check);
        break;
      case 'listing_draft':
        if (!facts.hasListingDraft && !facts.hasActiveListing) missing.push(check);
        break;
      case 'channel_selected':
        break; // channel implied by draft in current system
      case 'approval_granted':
        if (facts.hasPendingApproval) missing.push(check);
        break;
      case 'connector_capability':
        break;
      case 'external_listing':
        if (!facts.hasActiveListing) missing.push(check);
        break;
      case 'paid_order':
        if (!facts.hasPaidOrder) missing.push(check);
        break;
      case 'supplier_po':
        if (!facts.hasSupplierPo) missing.push(check);
        break;
      case 'fulfillment_closed':
        if (!facts.hasDelivered && !facts.hasFulfillment) missing.push(check);
        break;
      case 'actual_costs_or_outcomes':
        if (!facts.hasOutcome && !facts.hasDelivered) missing.push(check);
        break;
      default:
        break;
    }
  }

  if (missing.length) {
    return { ok: false, reason: 'Missing requirements for transition', missing };
  }
  return { ok: true };
}

export function stageIndex(stage: CommerceStage): number {
  return COMMERCE_STAGES.indexOf(stage);
}

export function stagesUpTo(stage: CommerceStage): CommerceStage[] {
  const i = stageIndex(stage);
  return COMMERCE_STAGES.slice(0, i + 1).filter((s) => s !== 'closed') as CommerceStage[];
}
