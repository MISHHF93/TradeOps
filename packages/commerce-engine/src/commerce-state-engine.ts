/**
 * Commerce State Engine — Smith Chart engineering principles, not RF math.
 *
 * Principles adopted:
 * 1. Complete state — every case is a living state vector, not a page.
 * 2. Valid transformations only — edges are governed by business rules.
 * 3. Measurable consequences — each transform updates friction, value, confidence.
 * 4. Current + target state always known.
 * 5. Optimal next operation always computable.
 *
 * The engine continuously drives cases toward their target operating point
 * by selecting the highest-value valid transformation (reduce friction, raise value).
 */

import {
  COMMERCE_STAGES,
  STAGE_TRANSITIONS,
  canTransition,
  computeNextAction,
  stageIndex,
  validateStageTransition,
  type CaseFacts,
  type CommerceStage,
  type CommerceStageStatus,
  type NextAction,
} from './commerce-lifecycle';
import {
  computeCommerceFriction,
  estimateFrictionReduction,
  type FrictionInputs,
  type FrictionReport,
} from './commerce-friction';
import {
  DEFAULT_MERCHANT_OBJECTIVES,
  matchMerchantToMarket,
  type MarketConditions,
  type MatchingReport,
  type MerchantObjectives,
} from './commerce-matching';

/** Canonical transformation catalog (state-space moves). */
export const COMMERCE_TRANSFORMATIONS = [
  'discover_product',
  'validate_opportunity',
  'compare_suppliers',
  'estimate_demand',
  'calculate_landed_cost',
  'evaluate_risk',
  'improve_product_content',
  'prepare_listing',
  'request_approval',
  'decide_approval',
  'publish',
  'monitor_performance',
  'source_inventory',
  'fulfill_order',
  'reconcile_payment',
  'optimize',
  'learn',
  'resolve_blocker',
  'close_case',
] as const;

export type CommerceTransformation = (typeof COMMERCE_TRANSFORMATIONS)[number];

export type TransformationDefinition = {
  code: CommerceTransformation;
  label: string;
  description: string;
  /** Stage this transform typically advances toward */
  targetStage: CommerceStage;
  /** Stages where this transform is primary */
  fromStages: CommerceStage[];
  aiCanPerform: boolean;
  approvalRequired: boolean;
  requiredPermissions: string[];
  requiredConnectors?: string[];
  aiTools: string[];
  href: (productId: string, caseId: string) => string;
  /** Heuristic business value 0–100 of completing this transform now */
  baseValue: number;
  reversible: boolean;
};

export const TRANSFORMATION_CATALOG: Record<CommerceTransformation, TransformationDefinition> = {
  discover_product: {
    code: 'discover_product',
    label: 'Discover product',
    description: 'Import or search sources into the digital twin.',
    targetStage: 'discover',
    fromStages: ['discover'],
    aiCanPerform: true,
    approvalRequired: false,
    requiredPermissions: ['products:write'],
    aiTools: ['searchConnectedProducts'],
    href: () => '/terminal',
    baseValue: 40,
    reversible: false,
  },
  validate_opportunity: {
    code: 'validate_opportunity',
    label: 'Validate opportunity',
    description: 'Score economics, demand, risk.',
    targetStage: 'evaluate',
    fromStages: ['discover', 'evaluate'],
    aiCanPerform: true,
    approvalRequired: false,
    requiredPermissions: ['products:write', 'analytics:read'],
    aiTools: ['scoreOpportunity', 'calculateContributionProfit'],
    href: (pid) => `/terminal/products/${pid}`,
    baseValue: 70,
    reversible: true,
  },
  compare_suppliers: {
    code: 'compare_suppliers',
    label: 'Compare suppliers',
    description: 'Reduce supplier uncertainty.',
    targetStage: 'evaluate',
    fromStages: ['discover', 'evaluate', 'source'],
    aiCanPerform: true,
    approvalRequired: false,
    requiredPermissions: ['products:read'],
    aiTools: ['searchConnectedProducts'],
    href: (pid) => `/terminal/products/${pid}`,
    baseValue: 55,
    reversible: true,
  },
  estimate_demand: {
    code: 'estimate_demand',
    label: 'Estimate demand',
    description: 'Forecast units and confidence.',
    targetStage: 'evaluate',
    fromStages: ['evaluate', 'qualify'],
    aiCanPerform: true,
    approvalRequired: false,
    requiredPermissions: ['analytics:read'],
    aiTools: ['scoreOpportunity'],
    href: (pid) => `/terminal/products/${pid}`,
    baseValue: 50,
    reversible: true,
  },
  calculate_landed_cost: {
    code: 'calculate_landed_cost',
    label: 'Calculate landed cost',
    description: 'Supplier + ship + fees stack.',
    targetStage: 'evaluate',
    fromStages: ['evaluate', 'prepare'],
    aiCanPerform: true,
    approvalRequired: false,
    requiredPermissions: ['analytics:read'],
    aiTools: ['calculateContributionProfit'],
    href: (pid) => `/terminal/products/${pid}`,
    baseValue: 65,
    reversible: true,
  },
  evaluate_risk: {
    code: 'evaluate_risk',
    label: 'Evaluate risk',
    description: 'Policy and operational risk gates.',
    targetStage: 'qualify',
    fromStages: ['evaluate', 'qualify'],
    aiCanPerform: true,
    approvalRequired: false,
    requiredPermissions: ['products:read'],
    aiTools: ['assessPolicyRisk'],
    href: (pid) => `/terminal/products/${pid}`,
    baseValue: 75,
    reversible: true,
  },
  improve_product_content: {
    code: 'improve_product_content',
    label: 'Improve product content',
    description: 'Media, naming, attributes for channel readiness.',
    targetStage: 'prepare',
    fromStages: ['discover', 'evaluate', 'prepare'],
    aiCanPerform: true,
    approvalRequired: false,
    requiredPermissions: ['products:write'],
    aiTools: ['draftListing'],
    href: (pid) => `/terminal/products/${pid}`,
    baseValue: 60,
    reversible: true,
  },
  prepare_listing: {
    code: 'prepare_listing',
    label: 'Prepare listing',
    description: 'Draft channel listing and media plan.',
    targetStage: 'prepare',
    fromStages: ['qualify', 'prepare'],
    aiCanPerform: true,
    approvalRequired: false,
    requiredPermissions: ['products:write'],
    aiTools: ['draftListing'],
    href: (_p, cid) => `/terminal/listings`,
    baseValue: 80,
    reversible: true,
  },
  request_approval: {
    code: 'request_approval',
    label: 'Request approval',
    description: 'Submit consequential action for human gate.',
    targetStage: 'approve',
    fromStages: ['prepare', 'approve'],
    aiCanPerform: false,
    approvalRequired: true,
    requiredPermissions: ['products:write'],
    aiTools: [],
    href: () => '/terminal/approvals',
    baseValue: 85,
    reversible: true,
  },
  decide_approval: {
    code: 'decide_approval',
    label: 'Decide approval',
    description: 'Human accept/reject of pending gate.',
    targetStage: 'approve',
    fromStages: ['approve'],
    aiCanPerform: false,
    approvalRequired: true,
    requiredPermissions: ['approvals:write'],
    aiTools: [],
    href: () => '/terminal/approvals',
    baseValue: 90,
    reversible: false,
  },
  publish: {
    code: 'publish',
    label: 'Publish',
    description: 'Create/update external listing via connector.',
    targetStage: 'publish',
    fromStages: ['approve', 'publish'],
    aiCanPerform: false,
    approvalRequired: true,
    requiredPermissions: ['products:write'],
    requiredConnectors: ['createListing'],
    aiTools: [],
    href: (_p, cid) => `/terminal/process/${cid}`,
    baseValue: 95,
    reversible: false,
  },
  monitor_performance: {
    code: 'monitor_performance',
    label: 'Monitor performance',
    description: 'Watch live listing and orders.',
    targetStage: 'sell',
    fromStages: ['publish', 'sell'],
    aiCanPerform: true,
    approvalRequired: false,
    requiredPermissions: ['orders:read'],
    aiTools: ['searchConnectedProducts'],
    href: () => '/terminal/orders',
    baseValue: 40,
    reversible: true,
  },
  source_inventory: {
    code: 'source_inventory',
    label: 'Source inventory',
    description: 'Place supplier purchase order.',
    targetStage: 'source',
    fromStages: ['sell', 'source'],
    aiCanPerform: false,
    approvalRequired: true,
    requiredPermissions: ['orders:write'],
    aiTools: [],
    href: () => '/terminal/orders',
    baseValue: 88,
    reversible: false,
  },
  fulfill_order: {
    code: 'fulfill_order',
    label: 'Fulfill order',
    description: 'Shipment and delivery tracking.',
    targetStage: 'fulfill',
    fromStages: ['source', 'fulfill'],
    aiCanPerform: false,
    approvalRequired: false,
    requiredPermissions: ['orders:write'],
    aiTools: [],
    href: () => '/terminal/fulfillment',
    baseValue: 70,
    reversible: false,
  },
  reconcile_payment: {
    code: 'reconcile_payment',
    label: 'Reconcile payment',
    description: 'Payouts, fees, realized profit.',
    targetStage: 'reconcile',
    fromStages: ['fulfill', 'reconcile'],
    aiCanPerform: true,
    approvalRequired: false,
    requiredPermissions: ['analytics:read'],
    aiTools: ['inspectPayout', 'reconcilePayout', 'explainPaymentVariance'],
    href: () => '/terminal/finance/reconciliation',
    baseValue: 60,
    reversible: true,
  },
  optimize: {
    code: 'optimize',
    label: 'Optimize',
    description: 'Improve price, ads, content post-launch.',
    targetStage: 'sell',
    fromStages: ['sell', 'publish', 'learn'],
    aiCanPerform: true,
    approvalRequired: false,
    requiredPermissions: ['analytics:read'],
    aiTools: ['scoreOpportunity'],
    href: (pid) => `/terminal/products/${pid}`,
    baseValue: 45,
    reversible: true,
  },
  learn: {
    code: 'learn',
    label: 'Learn',
    description: 'Compare predictions vs outcomes.',
    targetStage: 'learn',
    fromStages: ['reconcile', 'learn'],
    aiCanPerform: true,
    approvalRequired: false,
    requiredPermissions: ['analytics:read'],
    aiTools: ['evaluatePredictionOutcome'],
    href: (_p, cid) => `/terminal/process/${cid}`,
    baseValue: 50,
    reversible: true,
  },
  resolve_blocker: {
    code: 'resolve_blocker',
    label: 'Resolve blocker',
    description: 'Clear stage blocker before any advance.',
    targetStage: 'discover',
    fromStages: [...COMMERCE_STAGES],
    aiCanPerform: true,
    approvalRequired: false,
    requiredPermissions: ['products:write'],
    aiTools: ['assessPolicyRisk'],
    href: (_p, cid) => `/terminal/process/${cid}`,
    baseValue: 100,
    reversible: false,
  },
  close_case: {
    code: 'close_case',
    label: 'Close case',
    description: 'Lifecycle complete or abandon.',
    targetStage: 'closed',
    fromStages: ['learn', 'qualify', 'evaluate'],
    aiCanPerform: false,
    approvalRequired: false,
    requiredPermissions: ['products:write'],
    aiTools: [],
    href: (_p, cid) => `/terminal/process/${cid}`,
    baseValue: 20,
    reversible: false,
  },
};

export type CommerceStateVector = {
  caseId: string;
  productId: string;
  productTitle?: string;
  organizationId?: string;

  /** Current operational state (lifecycle stage) */
  currentState: CommerceStage;
  stageStatus: CommerceStageStatus;
  /** Optimal target operating point for this case */
  targetState: CommerceStage;
  /** 0–1 distance remaining (0 = at target) */
  distanceToTarget: number;
  /** Stages remaining including current if incomplete */
  stagesRemaining: CommerceStage[];

  blockers: Array<{ code: string; message: string; severity: string }>;
  missingInformation: string[];
  workflowReadiness: number;
  operationalFriction: number;
  businessRisk: number;
  confidenceScore: number;
  opportunityScore: number;
  executionReadiness: number;
  estimatedBusinessValueMinor: number | null;

  friction: FrictionReport;
  matching: MatchingReport;

  validNextStates: CommerceStage[];
  recommendedTransformation: RankedTransformation | null;
  rankedTransformations: RankedTransformation[];

  /** Screen answers */
  screen: {
    whereAmI: string;
    currentStateLabel: string;
    evidence: string[];
    preventingCompletion: string[];
    optimalNext: string;
    aiCanPerform: boolean;
    businessValueHint: string;
  };

  legacyNextAction: NextAction;
  computedAt: string;
};

export type RankedTransformation = {
  code: CommerceTransformation;
  label: string;
  description: string;
  score: number;
  estimatedFrictionDrop: number;
  estimatedValue: number;
  aiCanPerform: boolean;
  approvalRequired: boolean;
  requiredPermissions: string[];
  requiredConnectors?: string[];
  aiTools: string[];
  href: string;
  toStage: CommerceStage;
  reversible: boolean;
  reason: string;
};

export type StateEngineInput = {
  caseId: string;
  productId: string;
  productTitle?: string;
  organizationId?: string;
  currentStage: CommerceStage;
  stageStatus: CommerceStageStatus;
  facts: CaseFacts;
  blockerCode?: string | null;
  blockerMessage?: string | null;
  opportunityScore?: number | null;
  confidence?: number | null;
  expectedProfitMinor?: number | null;
  frictionInputs?: Partial<FrictionInputs>;
  merchantObjectives?: MerchantObjectives;
  marketConditions?: Partial<MarketConditions>;
  /** Ideal target; default is learn (full loop) or publish for early cases */
  targetState?: CommerceStage;
  persona?: string | null;
};

/**
 * Resolve complete Commerce State Vector for one case.
 */
export function resolveCommerceState(input: StateEngineInput): CommerceStateVector {
  const facts = input.facts;
  const target = input.targetState ?? defaultTarget(input.currentStage, facts);
  const distance = computeDistance(input.currentStage, input.stageStatus, target);
  const stagesRemaining = remainingStages(input.currentStage, target);

  const frictionIn: FrictionInputs = {
    dataCompleteness: estimateDataCompleteness(facts, input.frictionInputs),
    mediaCount: input.frictionInputs?.mediaCount,
    hasPrimaryImage: input.frictionInputs?.hasPrimaryImage,
    hasBrand: input.frictionInputs?.hasBrand,
    hasAttributes: input.frictionInputs?.hasAttributes,
    supplierConfidence: input.frictionInputs?.supplierConfidence ?? input.confidence ?? 0.6,
    hasSupplierOffer: input.frictionInputs?.hasSupplierOffer ?? facts.hasProduct,
    shippingCostKnown: input.frictionInputs?.shippingCostKnown ?? true,
    shippingCostMinor: input.frictionInputs?.shippingCostMinor,
    supplierCostMinor: input.frictionInputs?.supplierCostMinor,
    targetPriceMinor: input.frictionInputs?.targetPriceMinor,
    pricingConfidence: input.frictionInputs?.pricingConfidence ?? input.confidence,
    policyOutcome: facts.policyOutcome,
    policyRiskScore: input.frictionInputs?.policyRiskScore,
    inventoryQuantity: input.frictionInputs?.inventoryQuantity,
    inventoryKnown: input.frictionInputs?.inventoryKnown ?? true,
    connectorHealthy: input.frictionInputs?.connectorHealthy ?? true,
    connectorFailures: input.frictionInputs?.connectorFailures ?? 0,
    hasPendingApproval: facts.hasPendingApproval,
    stageStatus: input.stageStatus,
    blockerCode: input.blockerCode,
    dataConfidence: input.confidence ?? facts.confidence ?? 0.7,
    opportunityScore: input.opportunityScore ?? facts.opportunityScore,
  };

  const friction = computeCommerceFriction(frictionIn);

  const objectives = input.merchantObjectives ?? DEFAULT_MERCHANT_OBJECTIVES;
  const market: MarketConditions = {
    supplierAvailable: facts.hasProduct,
    supplierCostMinor: input.frictionInputs?.supplierCostMinor,
    shippingCostMinor: input.frictionInputs?.shippingCostMinor,
    targetPriceMinor: input.frictionInputs?.targetPriceMinor,
    expectedProfitMinor: input.expectedProfitMinor ?? facts.expectedProfitMinor,
    expectedMarginBps: undefined,
    policyOutcome: facts.policyOutcome,
    marketplacePolicyOk: facts.policyOutcome !== 'blocked',
    inventoryQuantity: input.frictionInputs?.inventoryQuantity,
    demandScore: input.opportunityScore ?? facts.opportunityScore ?? undefined,
    competitionScore: input.marketConditions?.competitionScore,
    ...input.marketConditions,
  };
  const matching = matchMerchantToMarket(objectives, market);

  const blockers: CommerceStateVector['blockers'] = [];
  if (input.blockerCode || input.blockerMessage || input.stageStatus === 'blocked') {
    blockers.push({
      code: input.blockerCode ?? 'stage_blocked',
      message: input.blockerMessage ?? 'Stage is blocked',
      severity: 'critical',
    });
  }
  if (facts.blockedByPolicy || facts.policyOutcome === 'blocked') {
    blockers.push({
      code: 'policy_blocked',
      message: 'Policy blocked this product',
      severity: 'critical',
    });
  }

  const missingInformation = collectMissing(facts, friction, matching);
  const validNextStates = (STAGE_TRANSITIONS[input.currentStage] ?? []).filter((to) => {
    if (to === 'closed') return true;
    return validateStageTransition(input.currentStage, to, facts).ok;
  });

  const legacyNext = computeNextAction({
    currentStage: input.currentStage,
    stageStatus: input.stageStatus,
    productId: input.productId,
    caseId: input.caseId,
    facts,
    blockerMessage: input.blockerMessage,
  });

  const ranked = rankTransformations({
    input,
    friction,
    matching,
    blockers,
    legacyNext,
  });

  const recommended = ranked[0] ?? null;
  const conf = input.confidence ?? facts.confidence ?? 0.5;
  const opp = input.opportunityScore ?? facts.opportunityScore ?? 0;
  const businessRisk = Math.round(
    (friction.components.find((c) => c.dimension === 'regulatory_uncertainty')?.score ?? 20) *
      0.5 +
      friction.totalFriction * 0.3 +
      (100 - matching.alignmentScore) * 0.2,
  );
  const workflowReadiness = Math.round(
    Math.max(0, 100 - friction.totalFriction * 0.7 - (blockers.length ? 30 : 0)),
  );
  const executionReadiness = Math.round(
    Math.max(
      0,
      Math.min(
        100,
        matching.alignmentScore * 0.4 +
          (100 - friction.totalFriction) * 0.4 +
          conf * 100 * 0.2 -
          (blockers.length ? 25 : 0),
      ),
    ),
  );

  const evidence: string[] = [
    `stage=${input.currentStage}/${input.stageStatus}`,
    facts.hasOpportunity ? `opportunityScore=${opp}` : 'no opportunity score',
    facts.hasListingDraft ? 'listing draft' : 'no listing draft',
    facts.hasActiveListing ? 'active listing' : 'no active listing',
    `friction=${friction.totalFriction}`,
    `alignment=${matching.alignmentScore}`,
    `confidence=${(conf * 100).toFixed(0)}%`,
  ];

  return {
    caseId: input.caseId,
    productId: input.productId,
    productTitle: input.productTitle,
    organizationId: input.organizationId,
    currentState: input.currentStage,
    stageStatus: input.stageStatus,
    targetState: target,
    distanceToTarget: distance,
    stagesRemaining,
    blockers,
    missingInformation,
    workflowReadiness,
    operationalFriction: friction.totalFriction,
    businessRisk: clamp(businessRisk),
    confidenceScore: Math.round(conf * 1000) / 10,
    opportunityScore: opp,
    executionReadiness,
    estimatedBusinessValueMinor:
      input.expectedProfitMinor ?? facts.expectedProfitMinor ?? matching.contributionProfitMinor,
    friction,
    matching,
    validNextStates,
    recommendedTransformation: recommended,
    rankedTransformations: ranked.slice(0, 6),
    screen: {
      whereAmI: `Commerce Case · ${input.currentStage} (${input.stageStatus})`,
      currentStateLabel: `${input.currentStage} → target ${target}`,
      evidence,
      preventingCompletion: [
        ...blockers.map((b) => b.message),
        ...missingInformation.slice(0, 5),
        ...friction.topDrivers.map((d) => `friction:${d}`),
      ],
      optimalNext: recommended
        ? `${recommended.label} (score ${recommended.score})`
        : legacyNext.label,
      aiCanPerform: recommended?.aiCanPerform ?? false,
      businessValueHint:
        input.expectedProfitMinor != null
          ? `Est. contribution ~${input.expectedProfitMinor} minor units if executed`
          : matching.note,
    },
    legacyNextAction: legacyNext,
    computedAt: new Date().toISOString(),
  };
}

export type RankCtx = {
  input: StateEngineInput;
  friction: FrictionReport;
  matching: MatchingReport;
  blockers: CommerceStateVector['blockers'];
  legacyNext: NextAction;
};

function rankTransformations(ctx: RankCtx): RankedTransformation[] {
  const { input, friction, matching, blockers, legacyNext } = ctx;
  const stage = input.currentStage;
  const out: RankedTransformation[] = [];

  for (const code of COMMERCE_TRANSFORMATIONS) {
    const def = TRANSFORMATION_CATALOG[code];
    // Blocker resolution always ranks when blocked
    if (blockers.length && code !== 'resolve_blocker' && input.stageStatus === 'blocked') {
      continue;
    }
    if (!blockers.length && code === 'resolve_blocker') continue;

    const stageOk =
      def.fromStages.includes(stage) ||
      (code === 'resolve_blocker' && blockers.length > 0) ||
      matching.sequence.includes(code) ||
      legacyMapsTo(legacyNext.code, code);

    if (!stageOk && code !== 'resolve_blocker') continue;

    const frictionDrop = estimateFrictionReduction(friction, code);
    const alignmentBoost = matching.sequence.includes(code) ? 15 : 0;
    const stageBoost = def.fromStages.includes(stage) ? 20 : 0;
    const legacyBoost = legacyMapsTo(legacyNext.code, code) ? 25 : 0;
    const personaBoost = personaBoostFor(input.persona, code);

    const score = Math.round(
      def.baseValue * 0.35 +
        frictionDrop * 1.2 +
        alignmentBoost +
        stageBoost +
        legacyBoost +
        personaBoost +
        (input.expectedProfitMinor != null
          ? Math.min(20, Math.max(0, input.expectedProfitMinor / 500))
          : 0),
    );

    out.push({
      code,
      label: def.label,
      description: def.description,
      score,
      estimatedFrictionDrop: frictionDrop,
      estimatedValue: def.baseValue,
      aiCanPerform: def.aiCanPerform && !def.approvalRequired,
      approvalRequired: def.approvalRequired,
      requiredPermissions: def.requiredPermissions,
      requiredConnectors: def.requiredConnectors,
      aiTools: def.aiTools,
      href: def.href(input.productId, input.caseId),
      toStage: def.targetStage,
      reversible: def.reversible,
      reason: buildReason(code, frictionDrop, alignmentBoost, legacyBoost),
    });
  }

  return out.sort((a, b) => b.score - a.score);
}

function legacyMapsTo(legacyCode: string, transform: CommerceTransformation): boolean {
  const map: Record<string, CommerceTransformation[]> = {
    run_evaluation: ['validate_opportunity', 'calculate_landed_cost', 'estimate_demand'],
    qualify: ['evaluate_risk', 'validate_opportunity'],
    prepare_launch: ['prepare_listing', 'improve_product_content'],
    submit_approval: ['request_approval', 'prepare_listing'],
    decide_approval: ['decide_approval'],
    source_order: ['source_inventory'],
    track_fulfillment: ['fulfill_order'],
    reconcile: ['reconcile_payment'],
    review_outcome: ['learn'],
    resolve_blocker: ['resolve_blocker'],
    close_case: ['close_case'],
    policy_block: ['evaluate_risk', 'resolve_blocker'],
    import_or_discover: ['discover_product'],
    evaluate: ['validate_opportunity'],
  };
  return (map[legacyCode] ?? []).includes(transform);
}

function personaBoostFor(persona: string | null | undefined, code: CommerceTransformation): number {
  if (!persona) return 0;
  const p = persona.toLowerCase();
  const map: Record<string, CommerceTransformation[]> = {
    researcher: [
      'discover_product',
      'validate_opportunity',
      'compare_suppliers',
      'estimate_demand',
      'calculate_landed_cost',
      'evaluate_risk',
    ],
    operator: [
      'prepare_listing',
      'improve_product_content',
      'request_approval',
      'publish',
      'source_inventory',
      'fulfill_order',
      'reconcile_payment',
    ],
    executive: ['decide_approval', 'evaluate_risk', 'monitor_performance', 'learn'],
    analyst: ['estimate_demand', 'validate_opportunity', 'learn', 'optimize', 'monitor_performance'],
    developer: ['resolve_blocker', 'discover_product'],
    administrator: ['decide_approval', 'resolve_blocker'],
  };
  return (map[p] ?? []).includes(code) ? 12 : 0;
}

function buildReason(
  code: string,
  frictionDrop: number,
  alignmentBoost: number,
  legacyBoost: number,
): string {
  const parts = [`transform=${code}`];
  if (frictionDrop > 0) parts.push(`friction↓${frictionDrop}`);
  if (alignmentBoost) parts.push('closes alignment gap');
  if (legacyBoost) parts.push('primary stage action');
  return parts.join(' · ');
}

function defaultTarget(current: CommerceStage, facts: CaseFacts): CommerceStage {
  if (facts.hasActiveListing || stageIndex(current) >= stageIndex('publish')) {
    return 'learn';
  }
  if (facts.hasListingDraft || facts.hasPendingApproval) return 'publish';
  if (facts.hasOpportunity) return 'publish';
  return 'evaluate';
}

function computeDistance(
  current: CommerceStage,
  status: CommerceStageStatus,
  target: CommerceStage,
): number {
  if (current === 'closed') return 0;
  const ci = stageIndex(current);
  const ti = stageIndex(target);
  if (ti <= ci && status === 'completed') return 0;
  const span = Math.max(1, Math.abs(ti - ci) + (status === 'completed' ? 0 : 1));
  const total = COMMERCE_STAGES.length - 1;
  return Math.round((span / total) * 1000) / 1000;
}

function remainingStages(current: CommerceStage, target: CommerceStage): CommerceStage[] {
  const ci = stageIndex(current);
  const ti = stageIndex(target);
  if (ti < ci) return [target];
  return COMMERCE_STAGES.slice(ci, ti + 1).filter((s) => s !== 'closed') as CommerceStage[];
}

function estimateDataCompleteness(
  facts: CaseFacts,
  extra?: Partial<FrictionInputs>,
): number {
  if (extra?.dataCompleteness != null) return extra.dataCompleteness;
  let n = 0;
  let d = 0;
  const bits = [
    facts.hasProduct,
    facts.hasOpportunity,
    extra?.hasPrimaryImage,
    extra?.hasBrand,
    extra?.hasAttributes,
    facts.hasListingDraft || facts.hasActiveListing,
  ];
  for (const b of bits) {
    d += 1;
    if (b) n += 1;
  }
  return d ? n / d : 0.5;
}

function collectMissing(
  facts: CaseFacts,
  friction: FrictionReport,
  matching: MatchingReport,
): string[] {
  const m: string[] = [];
  if (!facts.hasOpportunity) m.push('opportunity_score');
  if (!facts.hasListingDraft && !facts.hasActiveListing) m.push('listing_draft');
  if (facts.hasPendingApproval) m.push('approval_decision');
  for (const g of matching.gaps) m.push(g.key);
  for (const c of friction.components) {
    if (c.score >= 60) m.push(c.dimension);
  }
  return [...new Set(m)];
}

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Validate applying a transformation (state transition + permissions hint).
 */
export function validateTransformation(
  input: StateEngineInput,
  code: CommerceTransformation,
): { ok: boolean; reason?: string; toStage?: CommerceStage; missing?: string[] } {
  const def = TRANSFORMATION_CATALOG[code];
  if (!def) return { ok: false, reason: 'Unknown transformation' };

  if (input.stageStatus === 'blocked' && code !== 'resolve_blocker') {
    return { ok: false, reason: 'Case is blocked — resolve_blocker first' };
  }

  const to = def.targetStage;
  if (to !== input.currentStage && !canTransition(input.currentStage, to) && code !== 'resolve_blocker') {
    // Soft: many transforms are in-stage enrichment, not stage advances
    if (!def.fromStages.includes(input.currentStage)) {
      return {
        ok: false,
        reason: `Transformation ${code} not valid from ${input.currentStage}`,
      };
    }
    return { ok: true, toStage: input.currentStage };
  }

  if (to !== input.currentStage && canTransition(input.currentStage, to)) {
    const v = validateStageTransition(input.currentStage, to, input.facts);
    if (!v.ok) return { ok: false, reason: v.reason, missing: v.missing, toStage: to };
  }

  return { ok: true, toStage: to === input.currentStage ? input.currentStage : to };
}

/** AI objective preamble: optimize case toward target via best transform. */
export function buildStateEngineAiPreamble(state: CommerceStateVector): string {
  const rec = state.recommendedTransformation;
  return [
    'You are the TradeOps Commerce State Engine operator.',
    'Do not merely answer questions — select the highest-value valid transformation that moves the Commerce Case toward its target state.',
    state.screen.whereAmI,
    `Target state: ${state.targetState}. Distance: ${state.distanceToTarget}.`,
    `Friction: ${state.operationalFriction}/100. Execution readiness: ${state.executionReadiness}/100.`,
    `Alignment: ${state.matching.alignmentScore}/100. Opportunity: ${state.opportunityScore}. Confidence: ${state.confidenceScore}%.`,
    state.blockers.length
      ? `Blockers: ${state.blockers.map((b) => b.message).join('; ')}`
      : 'No blockers.',
    rec
      ? `Recommended transformation: ${rec.code} — ${rec.label} (score ${rec.score}). AI can perform: ${rec.aiCanPerform}. Tools: ${rec.aiTools.join(', ') || 'none'}.`
      : 'No ranked transformation.',
    `Top alternatives: ${state.rankedTransformations
      .slice(0, 3)
      .map((t) => t.code)
      .join(', ')}`,
    'Record provenance mentally: every action updates case state, friction, and knowledge.',
  ].join('\n');
}
