/**
 * Commerce Runtime — deterministic execution heart of TradeOps.
 *
 * Every user, AI, connector, and automation action should flow through this model.
 * Not a page router: a process orchestrator with state machines, transformations,
 * capability requirements, friction, and event types.
 *
 * Builds on: commerce-lifecycle, commerce-state-engine, commerce-friction, workspace.
 */

import {
  COMMERCE_STAGES,
  STAGE_TRANSITIONS,
  type CommerceStage,
  type CommerceStageStatus,
} from './commerce-lifecycle';
import {
  COMMERCE_TRANSFORMATIONS,
  TRANSFORMATION_CATALOG,
  buildStateEngineAiPreamble,
  resolveCommerceState,
  type CommerceStateVector,
  type CommerceTransformation,
  type StateEngineInput,
} from './commerce-state-engine';
import type { OperatingPersona } from './workspace';
import { PERSONA_DEFINITIONS, resolveOperatingPersona } from './workspace';

// ─── Runtime process identity ───────────────────────────────────────────────

/** What is currently executing? Every surface must answer this. */
export type RuntimeProcessKind =
  | 'commerce_case'
  | 'workspace_procedure'
  | 'ai_objective'
  | 'connector_sync'
  | 'approval_gate'
  | 'workflow_run'
  | 'idle';

export type RuntimeProcess = {
  processId: string;
  kind: RuntimeProcessKind;
  /** Human label for "what process is executing" */
  label: string;
  organizationId: string;
  /** Primary object under execution */
  subjectKind: RuntimeObjectKind;
  subjectId: string;
  commerceCaseId?: string;
  productId?: string;
  currentState: string;
  targetState?: string;
  status: 'running' | 'blocked' | 'waiting' | 'completed' | 'failed';
  nextTransformation?: string | null;
  friction?: number;
  startedAt: string;
  updatedAt: string;
  source: 'user' | 'ai' | 'automation' | 'connector' | 'system';
  persona?: OperatingPersona | null;
};

// ─── Object FSMs ────────────────────────────────────────────────────────────

export type RuntimeObjectKind =
  | 'commerce_case'
  | 'product'
  | 'supplier'
  | 'listing'
  | 'inventory'
  | 'order'
  | 'shipment'
  | 'payment'
  | 'task'
  | 'approval'
  | 'connector'
  | 'workflow';

export type ObjectFsmDefinition = {
  kind: RuntimeObjectKind;
  label: string;
  states: string[];
  /** from → allowed next */
  transitions: Record<string, string[]>;
  completionStates: string[];
  failureStates: string[];
  defaultState: string;
  requiredPermissions: string[];
  requiredCapabilities: string[];
  recoveryStrategy: string;
};

export const OBJECT_FSMS: Record<RuntimeObjectKind, ObjectFsmDefinition> = {
  commerce_case: {
    kind: 'commerce_case',
    label: 'Commerce Case',
    states: [...COMMERCE_STAGES],
    transitions: Object.fromEntries(
      COMMERCE_STAGES.map((s) => [s, [...(STAGE_TRANSITIONS[s] ?? [])]]),
    ),
    completionStates: ['closed'],
    failureStates: [],
    defaultState: 'discover',
    requiredPermissions: ['products:read'],
    requiredCapabilities: ['discover_products'],
    recoveryStrategy: 'resolve_blocker then re-enter last valid stage',
  },
  product: {
    kind: 'product',
    label: 'Product',
    states: ['imported', 'enriched', 'scored', 'blocked', 'archived'],
    transitions: {
      imported: ['enriched', 'scored', 'blocked', 'archived'],
      enriched: ['scored', 'blocked', 'archived'],
      scored: ['enriched', 'blocked', 'archived'],
      blocked: ['enriched', 'archived'],
      archived: ['imported'],
    },
    completionStates: ['scored'],
    failureStates: ['blocked'],
    defaultState: 'imported',
    requiredPermissions: ['products:write'],
    requiredCapabilities: ['discover_products', 'optimize_product_content'],
    recoveryStrategy: 'clear policy block, re-enrich media/attributes',
  },
  supplier: {
    kind: 'supplier',
    label: 'Supplier',
    states: ['discovered', 'quoted', 'selected', 'rejected'],
    transitions: {
      discovered: ['quoted', 'rejected'],
      quoted: ['selected', 'rejected', 'discovered'],
      selected: ['quoted'],
      rejected: ['discovered'],
    },
    completionStates: ['selected'],
    failureStates: ['rejected'],
    defaultState: 'discovered',
    requiredPermissions: ['products:read'],
    requiredCapabilities: ['compare_suppliers'],
    recoveryStrategy: 're-quote alternative suppliers',
  },
  listing: {
    kind: 'listing',
    label: 'Listing',
    states: ['none', 'draft', 'pending_approval', 'active', 'paused', 'failed'],
    transitions: {
      none: ['draft'],
      draft: ['pending_approval', 'none'],
      pending_approval: ['active', 'draft', 'failed'],
      active: ['paused', 'failed'],
      paused: ['active', 'draft'],
      failed: ['draft'],
    },
    completionStates: ['active'],
    failureStates: ['failed'],
    defaultState: 'none',
    requiredPermissions: ['products:write'],
    requiredCapabilities: ['prepare_listing', 'publish_listing'],
    recoveryStrategy: 'revise draft, re-submit approval, re-publish via connector',
  },
  inventory: {
    kind: 'inventory',
    label: 'Inventory',
    states: ['unknown', 'in_stock', 'low', 'out_of_stock', 'reserved'],
    transitions: {
      unknown: ['in_stock', 'out_of_stock'],
      in_stock: ['low', 'out_of_stock', 'reserved'],
      low: ['in_stock', 'out_of_stock', 'reserved'],
      out_of_stock: ['in_stock', 'low'],
      reserved: ['in_stock', 'low', 'out_of_stock'],
    },
    completionStates: ['in_stock'],
    failureStates: ['out_of_stock'],
    defaultState: 'unknown',
    requiredPermissions: ['products:read'],
    requiredCapabilities: ['synchronize_inventory'],
    recoveryStrategy: 'refresh connector inventory, source PO if depleted',
  },
  order: {
    kind: 'order',
    label: 'Customer Order',
    states: ['pending', 'paid', 'processing', 'fulfilled', 'cancelled', 'refunded'],
    transitions: {
      pending: ['paid', 'cancelled'],
      paid: ['processing', 'refunded', 'cancelled'],
      processing: ['fulfilled', 'cancelled'],
      fulfilled: ['refunded'],
      cancelled: [],
      refunded: [],
    },
    completionStates: ['fulfilled'],
    failureStates: ['cancelled'],
    defaultState: 'pending',
    requiredPermissions: ['orders:read'],
    requiredCapabilities: ['read_orders'],
    recoveryStrategy: 'exception workflow; refund path if payment settled',
  },
  shipment: {
    kind: 'shipment',
    label: 'Shipment',
    states: ['not_started', 'label_created', 'in_transit', 'delivered', 'exception'],
    transitions: {
      not_started: ['label_created'],
      label_created: ['in_transit', 'exception'],
      in_transit: ['delivered', 'exception'],
      delivered: [],
      exception: ['in_transit', 'label_created'],
    },
    completionStates: ['delivered'],
    failureStates: ['exception'],
    defaultState: 'not_started',
    requiredPermissions: ['orders:write'],
    requiredCapabilities: ['monitor_fulfillment'],
    recoveryStrategy: 'carrier exception handling, re-label, notify customer',
  },
  payment: {
    kind: 'payment',
    label: 'Payment',
    states: ['pending', 'authorized', 'captured', 'settled', 'disputed', 'failed'],
    transitions: {
      pending: ['authorized', 'failed'],
      authorized: ['captured', 'failed'],
      captured: ['settled', 'disputed'],
      settled: ['disputed'],
      disputed: ['settled', 'failed'],
      failed: ['pending'],
    },
    completionStates: ['settled'],
    failureStates: ['failed'],
    defaultState: 'pending',
    requiredPermissions: ['analytics:read'],
    requiredCapabilities: ['reconcile_payments', 'read_payments'],
    recoveryStrategy: 'reconcile variance, open dispute workflow',
  },
  task: {
    kind: 'task',
    label: 'Process Task',
    states: ['open', 'in_progress', 'blocked', 'done', 'cancelled'],
    transitions: {
      open: ['in_progress', 'blocked', 'cancelled'],
      in_progress: ['done', 'blocked', 'cancelled'],
      blocked: ['open', 'in_progress', 'cancelled'],
      done: [],
      cancelled: [],
    },
    completionStates: ['done'],
    failureStates: ['cancelled'],
    defaultState: 'open',
    requiredPermissions: ['products:read'],
    requiredCapabilities: [],
    recoveryStrategy: 'clear blocker code on parent Commerce Case',
  },
  approval: {
    kind: 'approval',
    label: 'Approval',
    states: ['pending', 'approved', 'rejected', 'cancelled'],
    transitions: {
      pending: ['approved', 'rejected', 'cancelled'],
      approved: [],
      rejected: ['pending'],
      cancelled: [],
    },
    completionStates: ['approved'],
    failureStates: ['rejected', 'cancelled'],
    defaultState: 'pending',
    requiredPermissions: ['approvals:write'],
    requiredCapabilities: [],
    recoveryStrategy: 'revise underlying draft and re-request approval',
  },
  connector: {
    kind: 'connector',
    label: 'Connector',
    states: [
      'not_configured',
      'credentials_required',
      'connected',
      'degraded',
      'unhealthy',
      'disabled',
    ],
    transitions: {
      not_configured: ['credentials_required', 'connected', 'disabled'],
      credentials_required: ['connected', 'disabled'],
      connected: ['degraded', 'unhealthy', 'disabled'],
      degraded: ['connected', 'unhealthy', 'disabled'],
      unhealthy: ['connected', 'credentials_required', 'disabled'],
      disabled: ['not_configured'],
    },
    completionStates: ['connected'],
    failureStates: ['unhealthy', 'disabled'],
    defaultState: 'not_configured',
    requiredPermissions: ['connectors:read'],
    requiredCapabilities: [],
    recoveryStrategy: 'repair credentials, health check, re-enable',
  },
  workflow: {
    kind: 'workflow',
    label: 'Workflow',
    states: ['idle', 'running', 'waiting_approval', 'completed', 'failed'],
    transitions: {
      idle: ['running'],
      running: ['waiting_approval', 'completed', 'failed'],
      waiting_approval: ['running', 'failed', 'completed'],
      completed: ['idle'],
      failed: ['idle', 'running'],
    },
    completionStates: ['completed'],
    failureStates: ['failed'],
    defaultState: 'idle',
    requiredPermissions: ['ai:write'],
    requiredCapabilities: [],
    recoveryStrategy: 'retry from last checkpoint; shadow mode if live blocked',
  },
};

export function canObjectTransition(
  kind: RuntimeObjectKind,
  from: string,
  to: string,
): boolean {
  const fsm = OBJECT_FSMS[kind];
  return (fsm.transitions[from] ?? []).includes(to);
}

// ─── Immutable business event catalog ───────────────────────────────────────

export const RUNTIME_EVENT_TYPES = [
  'CommerceCaseCreated',
  'CommerceCaseAdvanced',
  'CommerceCaseBlocked',
  'TransformationApplied',
  'TransformationRejected',
  'SupplierMatched',
  'MarginCalculated',
  'DemandEstimated',
  'RiskAssessed',
  'ListingPrepared',
  'ApprovalRequested',
  'ApprovalDecided',
  'ListingPublished',
  'OrderReceived',
  'ShipmentDelivered',
  'PaymentSettled',
  'WorkflowCompleted',
  'ConnectorCapabilityUsed',
  'AiRecommendationIssued',
  'FrictionReduced',
  'ProcessStarted',
  'ProcessCompleted',
] as const;

export type RuntimeEventType = (typeof RUNTIME_EVENT_TYPES)[number];

export function eventTypeForTransformation(code: CommerceTransformation): RuntimeEventType {
  const map: Partial<Record<CommerceTransformation, RuntimeEventType>> = {
    discover_product: 'CommerceCaseCreated',
    validate_opportunity: 'MarginCalculated',
    compare_suppliers: 'SupplierMatched',
    estimate_demand: 'DemandEstimated',
    calculate_landed_cost: 'MarginCalculated',
    evaluate_risk: 'RiskAssessed',
    improve_product_content: 'ListingPrepared',
    prepare_listing: 'ListingPrepared',
    request_approval: 'ApprovalRequested',
    decide_approval: 'ApprovalDecided',
    publish: 'ListingPublished',
    fulfill_order: 'ShipmentDelivered',
    reconcile_payment: 'PaymentSettled',
    learn: 'WorkflowCompleted',
    close_case: 'ProcessCompleted',
    resolve_blocker: 'CommerceCaseAdvanced',
  };
  return map[code] ?? 'TransformationApplied';
}

// ─── Capability map (AI reasons over capabilities, not raw APIs) ───────────

export type CapabilityProvider = {
  providerKey: string;
  displayName: string;
  isFixture: boolean;
  status: string;
  capabilities: string[];
};

/** Transformation → business capabilities required */
export const TRANSFORMATION_CAPABILITIES: Record<CommerceTransformation, string[]> = {
  discover_product: ['discover_products'],
  validate_opportunity: ['estimate_demand', 'calculate_landed_cost'],
  compare_suppliers: ['compare_suppliers'],
  estimate_demand: ['estimate_demand'],
  calculate_landed_cost: ['calculate_landed_cost'],
  evaluate_risk: ['detect_exceptions'],
  improve_product_content: ['optimize_product_content', 'attach_media'],
  prepare_listing: ['prepare_listing'],
  request_approval: [],
  decide_approval: [],
  publish: ['publish_listing'],
  monitor_performance: ['generate_executive_insights', 'read_orders'],
  source_inventory: ['submit_supplier_purchase'],
  fulfill_order: ['monitor_fulfillment'],
  reconcile_payment: ['reconcile_payments'],
  optimize: ['optimize_product_content', 'estimate_demand'],
  learn: ['generate_executive_insights'],
  resolve_blocker: ['detect_exceptions'],
  close_case: [],
};

// ─── Runtime snapshot (answer: what process is executing?) ─────────────────

export type RuntimeRecommendation = {
  transformation: CommerceTransformation;
  label: string;
  score: number;
  expectedFrictionDrop: number;
  expectedRoiHint: string;
  expectedRisk: number;
  expectedTimeHint: string;
  aiCanPerform: boolean;
  approvalRequired: boolean;
  requiredCapabilities: string[];
  requiredPermissions: string[];
  href: string;
  reason: string;
};

export type CommerceRuntimeSnapshot = {
  /** Primary answer for the OS: what is executing */
  activeProcess: RuntimeProcess | null;
  /** Other concurrent processes (approvals, AI runs, syncs) */
  concurrentProcesses: RuntimeProcess[];
  organizationId: string;
  persona: OperatingPersona | null;
  personaLabel: string | null;
  caseState: CommerceStateVector | null;
  recommendation: RuntimeRecommendation | null;
  availableCapabilities: CapabilityProvider[];
  missingCapabilities: string[];
  friction: number;
  executionReadiness: number;
  distanceToTarget: number;
  aiPreamble: string;
  objectFsms: ObjectFsmDefinition[];
  transformationCatalog: Array<{
    code: string;
    label: string;
    capabilities: string[];
    approvalRequired: boolean;
  }>;
  /** Static dependency inventory for audits */
  dependencyNotes: string[];
  computedAt: string;
};

export type BuildRuntimeSnapshotInput = {
  organizationId: string;
  persona?: string | null;
  systemRole?: string | null;
  founderDirect?: boolean;
  caseState?: CommerceStateVector | null;
  connectors?: CapabilityProvider[];
  pendingApprovals?: number;
  openAiRuns?: number;
  activeWorkflows?: number;
  concurrent?: RuntimeProcess[];
};

/**
 * Pure snapshot builder — API loads data, runtime assembles OS view.
 */
export function buildRuntimeSnapshot(input: BuildRuntimeSnapshotInput): CommerceRuntimeSnapshot {
  const persona = resolveOperatingPersona(input.persona, {
    founderDirect: input.founderDirect,
    systemRole: input.systemRole ?? undefined,
  });
  const personaDef = PERSONA_DEFINITIONS[persona];
  const caseState = input.caseState ?? null;

  let activeProcess: RuntimeProcess | null = null;
  if (caseState) {
    const status: RuntimeProcess['status'] =
      caseState.blockers.length > 0
        ? 'blocked'
        : caseState.stageStatus === 'waiting'
          ? 'waiting'
          : caseState.currentState === 'closed'
            ? 'completed'
            : 'running';
    activeProcess = {
      processId: `case:${caseState.caseId}`,
      kind: 'commerce_case',
      label: `Commerce Case · ${caseState.productTitle ?? caseState.productId} · ${caseState.currentState}`,
      organizationId: input.organizationId,
      subjectKind: 'commerce_case',
      subjectId: caseState.caseId,
      commerceCaseId: caseState.caseId,
      productId: caseState.productId,
      currentState: caseState.currentState,
      targetState: caseState.targetState,
      status,
      nextTransformation: caseState.recommendedTransformation?.code ?? null,
      friction: caseState.operationalFriction,
      startedAt: caseState.computedAt,
      updatedAt: caseState.computedAt,
      source: 'system',
      persona,
    };
  }

  const rec = caseState?.recommendedTransformation;
  const recommendation: RuntimeRecommendation | null = rec
    ? {
        transformation: rec.code,
        label: rec.label,
        score: rec.score,
        expectedFrictionDrop: rec.estimatedFrictionDrop,
        expectedRoiHint:
          caseState?.estimatedBusinessValueMinor != null
            ? `Est. contribution ${caseState.estimatedBusinessValueMinor} minor units`
            : 'Improve readiness toward target stage',
        expectedRisk: caseState?.businessRisk ?? 50,
        expectedTimeHint: rec.approvalRequired ? '1 approval cycle' : 'immediate / same session',
        aiCanPerform: rec.aiCanPerform,
        approvalRequired: rec.approvalRequired,
        requiredCapabilities: TRANSFORMATION_CAPABILITIES[rec.code] ?? [],
        requiredPermissions: rec.requiredPermissions,
        href: rec.href,
        reason: rec.reason,
      }
    : null;

  const caps = input.connectors ?? [];
  const offered = new Set(caps.flatMap((c) => c.capabilities));
  const needed = recommendation?.requiredCapabilities ?? [];
  const missingCapabilities = needed.filter((c) => !offered.has(c) && offered.size > 0);

  const concurrent: RuntimeProcess[] = [...(input.concurrent ?? [])];
  if ((input.pendingApprovals ?? 0) > 0) {
    concurrent.push({
      processId: 'approvals:queue',
      kind: 'approval_gate',
      label: `${input.pendingApprovals} approval(s) pending`,
      organizationId: input.organizationId,
      subjectKind: 'approval',
      subjectId: 'queue',
      currentState: 'pending',
      status: 'waiting',
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source: 'system',
      persona,
    });
  }
  if ((input.openAiRuns ?? 0) > 0) {
    concurrent.push({
      processId: 'ai:runs',
      kind: 'ai_objective',
      label: `${input.openAiRuns} AI run(s) active`,
      organizationId: input.organizationId,
      subjectKind: 'workflow',
      subjectId: 'ai',
      currentState: 'running',
      status: 'running',
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source: 'ai',
      persona,
    });
  }

  return {
    activeProcess,
    concurrentProcesses: concurrent,
    organizationId: input.organizationId,
    persona,
    personaLabel: personaDef.label,
    caseState,
    recommendation,
    availableCapabilities: caps,
    missingCapabilities,
    friction: caseState?.operationalFriction ?? 0,
    executionReadiness: caseState?.executionReadiness ?? 0,
    distanceToTarget: caseState?.distanceToTarget ?? 0,
    aiPreamble: caseState
      ? buildStateEngineAiPreamble(caseState)
      : [
          `You are the TradeOps Commerce Runtime optimizer in the ${personaDef.label} workspace.`,
          `Mission: ${personaDef.mission}`,
          'No active Commerce Case. Recommend discovering or selecting a case on the Process board.',
          'Never bypass the Commerce Runtime. Optimize for valid transformations only.',
        ].join('\n'),
    objectFsms: Object.values(OBJECT_FSMS),
    transformationCatalog: COMMERCE_TRANSFORMATIONS.map((code) => ({
      code,
      label: TRANSFORMATION_CATALOG[code].label,
      capabilities: TRANSFORMATION_CAPABILITIES[code],
      approvalRequired: TRANSFORMATION_CATALOG[code].approvalRequired,
    })),
    dependencyNotes: RUNTIME_DEPENDENCY_GRAPH,
    computedAt: new Date().toISOString(),
  };
}

/**
 * Dependency graph notes (pages/services collapse into runtime).
 * Used for audits and professor-mode completion checks.
 */
export const RUNTIME_DEPENDENCY_GRAPH: string[] = [
  'UI Process board → GET /commerce/runtime + /commerce/process → CommerceRuntimeService',
  'UI Case → GET /commerce/runtime/cases/:id → resolveState → resolveCommerceState',
  'UI/AI transform → POST /commerce/runtime/execute → applyTransformation + EventFabric',
  'AI Operator → Workspace + Runtime snapshot preamble → runOperatorCycle (tools only)',
  'Connectors → business capabilities → TRANSFORMATION_CAPABILITIES matching',
  'CommerceCase FSM → commerce-lifecycle STAGE_TRANSITIONS',
  'Friction → commerce-friction → ranking in commerce-state-engine',
  'Persona nav → workspace resolveOperatingPersona → same cases',
  'Audit → CommerceEvent event stream + AuditService',
  'Knowledge graph projection → EcosystemService (org/product/supplier/listing/order)',
];

export function resolveCaseStateFromInput(input: StateEngineInput): CommerceStateVector {
  return resolveCommerceState(input);
}

export type RuntimeExecutePlan = {
  ok: boolean;
  reason?: string;
  transformation: CommerceTransformation;
  eventType: RuntimeEventType;
  toStage?: CommerceStage;
  requiresApproval: boolean;
  requiredCapabilities: string[];
};

/**
 * Plan an execution before side effects (deterministic gate).
 */
export function planRuntimeExecution(input: {
  transformation: string;
  caseState: CommerceStateVector;
}): RuntimeExecutePlan {
  const code = input.transformation as CommerceTransformation;
  if (!COMMERCE_TRANSFORMATIONS.includes(code)) {
    return {
      ok: false,
      reason: `Unknown transformation: ${input.transformation}`,
      transformation: 'validate_opportunity',
      eventType: 'TransformationRejected',
      requiresApproval: false,
      requiredCapabilities: [],
    };
  }
  const def = TRANSFORMATION_CATALOG[code];
  const ranked = input.caseState.rankedTransformations.find((t) => t.code === code);
  if (input.caseState.stageStatus === 'blocked' && code !== 'resolve_blocker') {
    return {
      ok: false,
      reason: 'Case blocked — only resolve_blocker is allowed',
      transformation: code,
      eventType: 'TransformationRejected',
      requiresApproval: def.approvalRequired,
      requiredCapabilities: TRANSFORMATION_CAPABILITIES[code],
    };
  }
  return {
    ok: true,
    transformation: code,
    eventType: eventTypeForTransformation(code),
    toStage: def.targetStage,
    requiresApproval: def.approvalRequired,
    requiredCapabilities: TRANSFORMATION_CAPABILITIES[code],
    reason: ranked?.reason ?? def.description,
  };
}

/** Org-level "what is executing" summary without a single case focus */
export function summarizeOrgExecution(input: {
  organizationId: string;
  openCases: number;
  blockedCases: number;
  pendingApprovals: number;
  avgFriction: number;
  topCase?: { caseId: string; title?: string; stage: string; next?: string | null } | null;
  persona?: string | null;
}): {
  answer: string;
  activeProcess: RuntimeProcess | null;
  metrics: Record<string, number>;
} {
  const persona = resolveOperatingPersona(input.persona);
  if (input.openCases === 0) {
    return {
      answer: 'No Commerce Case is executing. Start Discover to open the process spine.',
      activeProcess: null,
      metrics: {
        openCases: 0,
        blockedCases: 0,
        pendingApprovals: input.pendingApprovals,
        avgFriction: 0,
      },
    };
  }
  const top = input.topCase;
  const activeProcess: RuntimeProcess | null = top
    ? {
        processId: `case:${top.caseId}`,
        kind: 'commerce_case',
        label: `${top.title ?? top.caseId} · ${top.stage}`,
        organizationId: input.organizationId,
        subjectKind: 'commerce_case',
        subjectId: top.caseId,
        commerceCaseId: top.caseId,
        currentState: top.stage,
        status: input.blockedCases > 0 ? 'blocked' : 'running',
        nextTransformation: top.next ?? null,
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        source: 'system',
        persona,
      }
    : null;

  return {
    answer: activeProcess
      ? `Executing: ${activeProcess.label}. ${input.openCases} open case(s), ${input.blockedCases} blocked, friction≈${input.avgFriction}.`
      : `${input.openCases} Commerce Case process(es) open.`,
    activeProcess,
    metrics: {
      openCases: input.openCases,
      blockedCases: input.blockedCases,
      pendingApprovals: input.pendingApprovals,
      avgFriction: input.avgFriction,
    },
  };
}
