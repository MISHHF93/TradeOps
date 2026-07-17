/**
 * AI Execution Navigator — Objective Resolution Engine.
 *
 * Every interaction starts with an objective, not a chat question.
 * Output is a structured Execution Package (10 sections) with evidence-backed
 * recommendations and actionable engineering tasks.
 */

import {
  classifyObjective,
  type ObjectiveClassification,
  type OperatorProduct,
} from './operator-cycle';
import type {
  AiActionClass,
  ObjectiveType,
  OperatorCycleResult,
  OperationLoopMode,
  RecommendationDraft,
} from './types';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ExecutionStatus =
  | 'planned'
  | 'in_progress'
  | 'blocked'
  | 'completed'
  | 'failed';

export type EvidenceSourceType =
  | 'live_connector'
  | 'canonical_store'
  | 'official_docs'
  | 'public_api'
  | 'derived_model'
  | 'simulation'
  | 'fixture'
  | 'repository_state';

export type LiveEvidenceItem = {
  id: string;
  claim: string;
  source: string;
  sourceType: EvidenceSourceType;
  observedAt: string;
  confidence: number;
  connectorKey?: string | null;
  isLiveOperational: boolean;
  /** When true, UI must show simulation/fixture banner */
  simulationLabel?: string | null;
};

export type RankedOption = {
  id: string;
  title: string;
  description: string;
  /** Expected business impact 1–5 */
  impact: number;
  /** Implementation effort 1–5 (higher = more effort) */
  effort: number;
  confidence: number;
  /** Business value 1–5 */
  businessValue: number;
  /** Composite score for ranking */
  score: number;
  evidenceIds: string[];
  tradeoffs: string[];
  recommended: boolean;
};

export type EngineeringTask = {
  id: string;
  title: string;
  description: string;
  horizon: 'immediate' | 'short_term' | 'longer_term';
  estimatedHours: number;
  status: ExecutionStatus;
  affectedFiles: string[];
  services: string[];
  models: string[];
  apis: string[];
  workflows: string[];
  uiComponents: string[];
  dependsOn: string[];
  acceptanceHint: string;
};

export type DependencyItem = {
  id: string;
  kind:
    | 'credential'
    | 'oauth_scope'
    | 'api'
    | 'infrastructure'
    | 'approval'
    | 'third_party'
    | 'data';
  label: string;
  required: boolean;
  present: boolean;
  detail?: string;
};

export type RiskItem = {
  id: string;
  category: 'technical' | 'security' | 'operational' | 'business';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  mitigation: string;
};

export type VerificationCriterion = {
  id: string;
  description: string;
  measurable: string;
  status: 'pending' | 'met' | 'unmet' | 'partial';
  evidenceIds: string[];
};

export type KnowledgeBaseEntry = {
  id: string;
  objectivePattern: string;
  lesson: string;
  evidenceSummary: string;
  confidence: number;
  createdAt: string;
  runId?: string | null;
};

export type ObjectiveSection = {
  raw: string;
  goal: string;
  desiredOutcome: string;
  objectiveType: ObjectiveType;
  riskClass: AiActionClass;
  approvalRequired: boolean;
  filters: Record<string, unknown>;
};

export type CurrentStateSection = {
  inspectedAt: string;
  productCount: number;
  fixtureProductCount: number;
  liveProductCount: number;
  connectorSummary: {
    total: number;
    connected: number;
    credentialsRequired: number;
    fixtures: number;
  };
  openCommerceCases: number;
  recentOperatorRuns: number;
  simulationMode: boolean;
  loopMode: OperationLoopMode;
  repositoryCapabilities: string[];
  alreadyImplemented: string[];
  gaps: string[];
};

export type TimelineSection = {
  immediate: EngineeringTask[];
  shortTerm: EngineeringTask[];
  longerTerm: EngineeringTask[];
  summary: string;
};

export type ExecutionStatusSection = {
  overall: ExecutionStatus;
  history: Array<{ at: string; status: ExecutionStatus; note: string }>;
  blockedReason?: string | null;
};

export type VerificationSection = {
  criteria: VerificationCriterion[];
  overall: 'pending' | 'passed' | 'failed' | 'partial';
  notes: string;
};

/**
 * Structured execution package — the core output of the Objective Resolution Engine.
 */
export type ObjectiveExecutionPackage = {
  packageVersion: '1.0';
  generatedAt: string;
  runId?: string | null;
  /** 1. Objective */
  objective: ObjectiveSection;
  /** 2. Current State */
  currentState: CurrentStateSection;
  /** 3. Live Evidence */
  liveEvidence: LiveEvidenceItem[];
  /** 4. Recommendations (ranked options) */
  recommendations: RankedOption[];
  /** Product-level recs from operator cycle (when applicable) */
  productRecommendations: RecommendationDraft[];
  /** 5. Execution Plan */
  executionPlan: {
    tasks: EngineeringTask[];
    summary: string;
  };
  /** 6. Timeline */
  timeline: TimelineSection;
  /** 7. Dependencies */
  dependencies: DependencyItem[];
  /** 8. Risks */
  risks: RiskItem[];
  /** 9. Execution Status */
  executionStatus: ExecutionStatusSection;
  /** 10. Verification */
  verification: VerificationSection;
  /** Knowledge base updates from this resolution */
  knowledgeBaseDelta: KnowledgeBaseEntry[];
  /** Prior knowledge applied */
  priorKnowledgeApplied: KnowledgeBaseEntry[];
  honesty: {
    note: string;
    liveOperationalEvidenceCount: number;
    fixtureOrSimulationEvidenceCount: number;
  };
};

export type NavigatorPlatformSnapshot = {
  productCount: number;
  fixtureProductCount: number;
  liveProductCount: number;
  connectors: Array<{
    providerKey: string;
    status: string;
    isFixture: boolean;
  }>;
  openCommerceCases?: number;
  recentOperatorRuns?: number;
  simulationMode?: boolean;
  hasLiveHttpReady?: string[];
  liveProductSample?: OperatorProduct[];
};

export type BuildExecutionPackageInput = {
  objective: string;
  loopMode?: OperationLoopMode;
  snapshot: NavigatorPlatformSnapshot;
  cycle?: OperatorCycleResult | null;
  priorKnowledge?: KnowledgeBaseEntry[];
  runId?: string | null;
  now?: Date;
};

// ─── Scoring ─────────────────────────────────────────────────────────────────

export function rankOptionScore(input: {
  impact: number;
  effort: number;
  confidence: number;
  businessValue: number;
}): number {
  // Higher impact/value/confidence better; higher effort worse
  const impact = clamp(input.impact, 1, 5);
  const effort = clamp(input.effort, 1, 5);
  const conf = clamp(input.confidence, 0, 1);
  const value = clamp(input.businessValue, 1, 5);
  return Math.round((impact * 2 + value * 2 + conf * 5 - effort) * 10) / 10;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function nowIso(d = new Date()): string {
  return d.toISOString();
}

// ─── Objective framing ───────────────────────────────────────────────────────

export function frameObjective(
  raw: string,
  classification: ObjectiveClassification,
): ObjectiveSection {
  const text = raw.trim();
  let goal = 'Improve commerce operations with evidence-backed actions';
  let desiredOutcome = 'Measurable progress on the stated business goal';

  if (classification.objectiveType === 'READ_ONLY_ANALYSIS') {
    goal = 'Identify and rank commerce opportunities from connected data';
    desiredOutcome =
      'Ranked product recommendations with economics, policy risk, and next actions — no live publish';
  } else if (classification.objectiveType === 'DRAFT_LISTING') {
    goal = 'Prepare marketplace listing drafts for qualifying products';
    desiredOutcome = 'Draft listings ready for human review (not published)';
  } else if (classification.objectiveType === 'PUBLISH_LISTING') {
    goal = 'Publish approved listings to connected marketplaces';
    desiredOutcome = 'Live listings only after approval + healthy connector credentials';
  } else if (classification.objectiveType === 'SUPPLIER_PO') {
    goal = 'Submit supplier purchase orders for selected SKUs';
    desiredOutcome = 'PO drafts/submissions under financial approval controls';
  }

  // Refine from natural language when clear
  if (/\bconnect(or|ion)?\b|\bintegrat/i.test(text)) {
    goal = 'Connect external commerce systems and establish live data flows';
    desiredOutcome = 'Healthy connectors with credential-gated sync and provenance';
  } else if (/\binventor/i.test(text)) {
    goal = 'Synchronize and monitor inventory across channels';
    desiredOutcome = 'Inventory levels reflected in canonical store with freshness timestamps';
  } else if (/\bpayment|payout|cash\s*flow|stripe\b/i.test(text)) {
    goal = 'Establish live payment and payout operational visibility';
    desiredOutcome = 'Payment/payout events from live connectors with empty states when unavailable';
  } else if (/\bfulfill|ship|logistics|track/i.test(text)) {
    goal = 'Monitor fulfillment and shipping exceptions';
    desiredOutcome = 'Shipment tracking events with delay detection from logistics connectors';
  } else if (/\bai\s+runtime|model\s+provider|orchestrat/i.test(text)) {
    goal = 'Route AI workloads through the Capability Registry';
    desiredOutcome = 'AI never calls vendor REST directly; capabilities resolve to providers';
  }

  return {
    raw: text,
    goal,
    desiredOutcome,
    objectiveType: classification.objectiveType,
    riskClass: classification.riskClass,
    approvalRequired: classification.approvalRequired,
    filters: classification.filters as Record<string, unknown>,
  };
}

// ─── Evidence collection ─────────────────────────────────────────────────────

export function collectLiveEvidence(
  snapshot: NavigatorPlatformSnapshot,
  cycle: OperatorCycleResult | null | undefined,
  now: Date,
): LiveEvidenceItem[] {
  const items: LiveEvidenceItem[] = [];
  const at = nowIso(now);
  let n = 0;
  const push = (partial: Omit<LiveEvidenceItem, 'id'>) => {
    n += 1;
    items.push({ id: `ev-${n}`, ...partial });
  };

  push({
    claim: `Organization product store holds ${snapshot.productCount} products (${snapshot.liveProductCount} non-fixture, ${snapshot.fixtureProductCount} fixture).`,
    source: 'Product table (canonical store)',
    sourceType: 'canonical_store',
    observedAt: at,
    confidence: 1,
    isLiveOperational: snapshot.liveProductCount > 0,
    simulationLabel:
      snapshot.fixtureProductCount > 0 ? 'Includes TEST FIXTURE products' : null,
  });

  const connected = snapshot.connectors.filter(
    (c) => !c.isFixture && /connected|sync/i.test(c.status),
  );
  const needCreds = snapshot.connectors.filter(
    (c) => !c.isFixture && /credential|not_configured|not_started/i.test(c.status),
  );
  push({
    claim: `Connectors: ${connected.length} live-connected, ${needCreds.length} need credentials, ${snapshot.connectors.filter((c) => c.isFixture).length} fixtures.`,
    source: 'ConnectorInstallation + production registry',
    sourceType: connected.length ? 'live_connector' : 'repository_state',
    observedAt: at,
    confidence: 0.95,
    isLiveOperational: connected.length > 0,
  });

  for (const key of snapshot.hasLiveHttpReady ?? []) {
    push({
      claim: `Live HTTP credentials present for ${key} — sync can pull vendor data.`,
      source: `Env credentials · ${key}`,
      sourceType: 'live_connector',
      observedAt: at,
      confidence: 0.9,
      connectorKey: key,
      isLiveOperational: true,
    });
  }

  if (cycle) {
    push({
      claim: `Operator cycle ranked ${cycle.candidateStats.ranked} of ${cycle.candidateStats.retrieved} candidates (normalized ${cycle.candidateStats.normalized}).`,
      source: 'AI Operator cycle (derived over product store)',
      sourceType: 'derived_model',
      observedAt: at,
      confidence: 0.85,
      isLiveOperational: cycle.candidateStats.ranked > 0,
    });
    for (const src of cycle.sources.slice(0, 8)) {
      push({
        claim: `Source ${src.name}: ${src.status}${src.detail ? ` — ${src.detail}` : ''}`,
        source: src.name,
        sourceType: src.name.toLowerCase().includes('fixture')
          ? 'fixture'
          : /connected|ok|healthy/i.test(src.status)
            ? 'live_connector'
            : 'repository_state',
        observedAt: at,
        confidence: 0.8,
        connectorKey: src.name,
        isLiveOperational: !src.name.toLowerCase().includes('fixture'),
        simulationLabel: src.name.toLowerCase().includes('fixture')
          ? 'TEST FIXTURE'
          : null,
      });
    }
    for (const rec of cycle.recommendations.slice(0, 5)) {
      push({
        claim: `Recommendation #${rec.rank}: ${rec.title} (confidence ${(rec.confidence * 100).toFixed(0)}%, policy risk ${rec.policyRiskScore}).`,
        source: rec.productId
          ? `Product ${rec.productId.slice(0, 8)} economics`
          : 'Operator recommendation',
        sourceType: 'derived_model',
        observedAt: at,
        confidence: rec.confidence,
        isLiveOperational: !JSON.stringify(rec.evidence).includes('fixture'),
      });
    }
  }

  if (snapshot.simulationMode) {
    push({
      claim: 'TRADEOPS_SIMULATION_MODE is active — simulation/fixture data may appear and must be labeled.',
      source: 'Platform configuration',
      sourceType: 'simulation',
      observedAt: at,
      confidence: 1,
      isLiveOperational: false,
      simulationLabel: 'SIMULATION MODE',
    });
  }

  // Official docs anchors for major integration paths (not live data)
  push({
    claim:
      'Production connector catalog and Ops pipeline are documented; live calls require authenticated provider APIs.',
    source: 'docs/TRADEOPS_CONNECTOR_ECOSYSTEM.md',
    sourceType: 'official_docs',
    observedAt: at,
    confidence: 0.95,
    isLiveOperational: false,
  });

  return items;
}

// ─── Recommendations (implementation options) ────────────────────────────────

export function buildRankedOptions(
  objective: ObjectiveSection,
  snapshot: NavigatorPlatformSnapshot,
  evidence: LiveEvidenceItem[],
  cycle?: OperatorCycleResult | null,
): RankedOption[] {
  const evidenceIds = evidence.map((e) => e.id);
  const hasProducts = snapshot.productCount > 0;
  const hasLiveConnectors = snapshot.connectors.some(
    (c) => !c.isFixture && /connected/i.test(c.status),
  );
  const needsCreds = snapshot.connectors.some(
    (c) => !c.isFixture && /credential|not_configured/i.test(c.status),
  );

  const options: Array<Omit<RankedOption, 'score' | 'recommended'>> = [];

  if (objective.objectiveType === 'READ_ONLY_ANALYSIS') {
    options.push({
      id: 'opt-eval-store',
      title: 'Evaluate products in the canonical store now',
      description:
        'Run the operator cycle against imported products: unit economics, policy, opportunity scores, ranked cards.',
      impact: hasProducts ? 4 : 2,
      effort: 1,
      confidence: hasProducts ? 0.9 : 0.4,
      businessValue: 4,
      evidenceIds: evidenceIds.slice(0, 4),
      tradeoffs: [
        hasProducts
          ? 'Uses existing store data (may include fixtures — labeled)'
          : 'Empty store — import or connect supplier first',
      ],
    });
    options.push({
      id: 'opt-live-supplier',
      title: 'Connect live supplier / storefront and re-sync',
      description:
        'Set Shopify/WooCommerce credentials, POST /ops/connectors/live-sync, then re-run evaluation on live products.',
      impact: 5,
      effort: 3,
      confidence: needsCreds || !hasLiveConnectors ? 0.7 : 0.85,
      businessValue: 5,
      evidenceIds: evidenceIds.filter((id) =>
        evidence.find((e) => e.id === id && e.sourceType === 'live_connector'),
      ),
      tradeoffs: ['Requires provider credentials and OAuth/scopes'],
    });
    options.push({
      id: 'opt-fixture-demo',
      title: 'Use labeled fixture catalog for process rehearsal',
      description:
        'Import fixture-supplier products for SOP practice. Never label as live market data.',
      impact: 2,
      effort: 1,
      confidence: 0.95,
      businessValue: 2,
      evidenceIds: evidenceIds.filter((id) =>
        evidence.find((e) => e.id === id && e.sourceType === 'fixture'),
      ),
      tradeoffs: ['Simulation only — not production commerce truth'],
    });
  } else if (objective.objectiveType === 'PUBLISH_LISTING') {
    options.push({
      id: 'opt-draft-first',
      title: 'Draft listing first, publish under approval',
      description:
        'Create draft listings, queue Approval, publish only after human approve + live connector.',
      impact: 5,
      effort: 2,
      confidence: 0.85,
      businessValue: 5,
      evidenceIds,
      tradeoffs: ['Slower time-to-live but safer financially'],
    });
    options.push({
      id: 'opt-shadow-publish',
      title: 'Shadow-mode publish simulation',
      description:
        'Record what would be published without calling marketplace APIs (ShadowDecision ledger).',
      impact: 3,
      effort: 1,
      confidence: 0.9,
      businessValue: 3,
      evidenceIds,
      tradeoffs: ['No live listing created'],
    });
  } else {
    options.push({
      id: 'opt-capability-resolve',
      title: 'Resolve business capability via Capability Registry',
      description:
        'AI requests capabilities (e.g. synchronize_inventory); runtime selects credentialed provider.',
      impact: 4,
      effort: 2,
      confidence: 0.8,
      businessValue: 4,
      evidenceIds,
      tradeoffs: ['Needs at least one healthy provider advertising the capability'],
    });
    options.push({
      id: 'opt-ops-health',
      title: 'Hardening Ops Center + live sync first',
      description:
        'Ensure registry installs, webhook queue, and live-sync health before domain automation.',
      impact: 4,
      effort: 2,
      confidence: 0.85,
      businessValue: 4,
      evidenceIds,
      tradeoffs: ['Platform investment before feature work'],
    });
  }

  if (cycle && cycle.recommendations.length > 0) {
    options.push({
      id: 'opt-act-on-top-rec',
      title: `Act on top ranked product: ${cycle.recommendations[0]!.title.slice(0, 60)}`,
      description:
        cycle.recommendations[0]!.rationale.slice(0, 240) ||
        'Proceed with next actions on the highest-scoring recommendation.',
      impact: 4,
      effort: 2,
      confidence: cycle.recommendations[0]!.confidence,
      businessValue: 4,
      evidenceIds: evidenceIds.slice(-3),
      tradeoffs: cycle.recommendations[0]!.missingData.slice(0, 3),
    });
  }

  const ranked = options
    .map((o) => ({
      ...o,
      score: rankOptionScore(o),
      recommended: false,
    }))
    .sort((a, b) => b.score - a.score);

  if (ranked[0]) ranked[0].recommended = true;
  return ranked;
}

// ─── Execution plan + timeline ───────────────────────────────────────────────

export function buildExecutionTasks(
  objective: ObjectiveSection,
  snapshot: NavigatorPlatformSnapshot,
  options: RankedOption[],
): EngineeringTask[] {
  const tasks: EngineeringTask[] = [];
  const top = options.find((o) => o.recommended) ?? options[0];

  tasks.push({
    id: 'task-frame',
    title: 'Confirm objective framing and success metrics',
    description: `Goal: ${objective.goal}. Outcome: ${objective.desiredOutcome}.`,
    horizon: 'immediate',
    estimatedHours: 0.5,
    status: 'completed',
    affectedFiles: [],
    services: ['AiOperatorService', 'ExecutionNavigator'],
    models: ['OperatorRun'],
    apis: ['POST /ai/operator/run', 'POST /ai/navigator/resolve'],
    workflows: [],
    uiComponents: ['AiOperatorConsole', 'Objectives pages'],
    dependsOn: [],
    acceptanceHint: 'Execution package objective section matches user intent',
  });

  tasks.push({
    id: 'task-inspect-state',
    title: 'Inspect connectors, product store, and runtime health',
    description:
      'Load ConnectorInstallation, product counts, open cases, production catalog readiness.',
    horizon: 'immediate',
    estimatedHours: 1,
    status: snapshot.productCount >= 0 ? 'completed' : 'planned',
    affectedFiles: [
      'apps/api/src/ai/ai-operator.service.ts',
      'apps/api/src/commerce/connector-ops.service.ts',
    ],
    services: ['ConnectorOpsService', 'LiveConnectorService', 'PrismaService'],
    models: ['Product', 'ConnectorInstallation', 'CommerceCase'],
    apis: ['GET /ops/connectors/health', 'GET /ops/connectors/production'],
    workflows: ['OpsSyncScheduler'],
    uiComponents: ['/terminal/connectors'],
    dependsOn: ['task-frame'],
    acceptanceHint: 'Current state section populated with non-fabricated counts',
  });

  if (top?.id === 'opt-live-supplier' || snapshot.liveProductCount === 0) {
    tasks.push({
      id: 'task-credentials',
      title: 'Provision connector credentials and run live sync',
      description:
        'Set env keys (e.g. SHOPIFY_*, STRIPE_*), ensure-registry, live-sync, verify Product rows with sourceProvenance live_http:*.',
      horizon: 'short_term',
      estimatedHours: 4,
      status: (snapshot.hasLiveHttpReady?.length ?? 0) > 0 ? 'in_progress' : 'planned',
      affectedFiles: [
        'packages/connectors/live-http/src/index.ts',
        'apps/api/src/commerce/live-connector.service.ts',
      ],
      services: ['LiveConnectorService'],
      models: ['Product', 'CommerceEvent'],
      apis: [
        'POST /ops/connectors/ensure-registry',
        'POST /ops/connectors/live-sync',
      ],
      workflows: ['live-http-sync'],
      uiComponents: ['Ops Center'],
      dependsOn: ['task-inspect-state'],
      acceptanceHint: 'At least one non-fixture product with live_http provenance OR honest empty state',
    });
  }

  if (objective.objectiveType === 'READ_ONLY_ANALYSIS') {
    tasks.push({
      id: 'task-operator-cycle',
      title: 'Run operator cycle and persist ranked recommendations',
      description:
        'classifyObjective → tools → economics → critic/auditor → OperatorRecommendation rows.',
      horizon: 'immediate',
      estimatedHours: 1,
      status: 'in_progress',
      affectedFiles: [
        'packages/ai-runtime/src/operator-cycle.ts',
        'packages/ai-runtime/src/execution-navigator.ts',
      ],
      services: ['AiOperatorService'],
      models: ['OperatorRun', 'OperatorRecommendation'],
      apis: ['POST /ai/operator/run'],
      workflows: [],
      uiComponents: ['/terminal/opportunities', '/terminal/objectives'],
      dependsOn: ['task-inspect-state'],
      acceptanceHint: 'Recommendations have evidence, confidence, and no unlabeled fixtures',
    });
  }

  if (objective.approvalRequired) {
    tasks.push({
      id: 'task-approval-gate',
      title: 'Queue human approval for consequential actions',
      description: 'Publish/PO require Approval records before live side effects.',
      horizon: 'immediate',
      estimatedHours: 1,
      status: 'planned',
      affectedFiles: ['apps/api/src/ai/ai-operator.service.ts'],
      services: ['AiOperatorService'],
      models: ['Approval'],
      apis: ['/approvals'],
      workflows: ['approval_execution'],
      uiComponents: ['/terminal/approvals'],
      dependsOn: ['task-operator-cycle'],
      acceptanceHint: 'No live publish without approved Approval row',
    });
  }

  tasks.push({
    id: 'task-verify',
    title: 'Verify acceptance criteria with tests and live observables',
    description:
      'Unit tests for navigator package; Ops health; product provenance; operator run status.',
    horizon: 'short_term',
    estimatedHours: 2,
    status: 'planned',
    affectedFiles: [
      'packages/ai-runtime/src/execution-navigator.test.ts',
    ],
    services: [],
    models: [],
    apis: ['GET /ai/runs/:id'],
    workflows: [],
    uiComponents: [],
    dependsOn: ['task-operator-cycle', 'task-inspect-state'],
    acceptanceHint: 'All verification criteria met or explicitly partial with reason',
  });

  tasks.push({
    id: 'task-knowledge',
    title: 'Write knowledge base delta for future objectives',
    description:
      'Persist lessons (what worked, missing data, credential gaps) for navigator priorKnowledge.',
    horizon: 'longer_term',
    estimatedHours: 2,
    status: 'planned',
    affectedFiles: ['apps/api/src/ai/ai-operator.service.ts'],
    services: ['EventFabricService'],
    models: ['CommerceEvent', 'OperatorRun.planJson'],
    apis: [],
    workflows: [],
    uiComponents: [],
    dependsOn: ['task-verify'],
    acceptanceHint: 'Subsequent similar objectives cite priorKnowledgeApplied',
  });

  return tasks;
}

export function groupTimeline(tasks: EngineeringTask[]): TimelineSection {
  return {
    immediate: tasks.filter((t) => t.horizon === 'immediate'),
    shortTerm: tasks.filter((t) => t.horizon === 'short_term'),
    longerTerm: tasks.filter((t) => t.horizon === 'longer_term'),
    summary: [
      `Immediate (hours): ${tasks.filter((t) => t.horizon === 'immediate').length} tasks`,
      `Short-term (days): ${tasks.filter((t) => t.horizon === 'short_term').length} tasks`,
      `Longer-term (weeks): ${tasks.filter((t) => t.horizon === 'longer_term').length} tasks`,
      `Total estimate: ~${tasks.reduce((s, t) => s + t.estimatedHours, 0)} hours`,
    ].join(' · '),
  };
}

// ─── Dependencies & risks ────────────────────────────────────────────────────

export function buildDependencies(
  objective: ObjectiveSection,
  snapshot: NavigatorPlatformSnapshot,
): DependencyItem[] {
  const items: DependencyItem[] = [
    {
      id: 'dep-db',
      kind: 'infrastructure',
      label: 'Postgres / Prisma database',
      required: true,
      present: true,
      detail: 'Canonical Product, OperatorRun, ConnectorInstallation',
    },
    {
      id: 'dep-ai-entitlement',
      kind: 'approval',
      label: 'SaaS AI evaluation entitlement',
      required: true,
      present: true,
      detail: 'assertAiEvaluationAllowed on operator run',
    },
  ];

  const shopify = snapshot.connectors.find((c) => c.providerKey.includes('shopify'));
  items.push({
    id: 'dep-shopify',
    kind: 'credential',
    label: 'Shopify Admin API credentials',
    required: /shopify|storefront|listing|publish/i.test(objective.raw + objective.goal),
    present: Boolean(snapshot.hasLiveHttpReady?.includes('shopify-graphql-admin')),
    detail: shopify ? `install status=${shopify.status}` : 'Not installed',
  });

  items.push({
    id: 'dep-stripe',
    kind: 'credential',
    label: 'Stripe secret key',
    required: /payment|payout|stripe|cash/i.test(objective.raw + objective.goal),
    present: Boolean(snapshot.hasLiveHttpReady?.includes('stripe-api')),
  });

  if (objective.approvalRequired) {
    items.push({
      id: 'dep-human-approval',
      kind: 'approval',
      label: 'Human approval for financial/contractual actions',
      required: true,
      present: false,
      detail: 'Queued via Approval workflow when recommendations require it',
    });
  }

  items.push({
    id: 'dep-oauth-scopes',
    kind: 'oauth_scope',
    label: 'Provider OAuth scopes (products/orders/inventory as needed)',
    required: true,
    present: (snapshot.hasLiveHttpReady?.length ?? 0) > 0,
    detail: 'See production-connectors credentialEnvKeys + scopes',
  });

  return items;
}

export function buildRisks(
  objective: ObjectiveSection,
  snapshot: NavigatorPlatformSnapshot,
): RiskItem[] {
  const risks: RiskItem[] = [
    {
      id: 'risk-fixture-pollution',
      category: 'operational',
      severity: snapshot.fixtureProductCount > 0 ? 'medium' : 'low',
      description: 'Fixture products counted as live commerce truth',
      mitigation:
        'Label fixtures, production-isolation filter, provenance badges, simulation banners',
    },
    {
      id: 'risk-unverified-live',
      category: 'business',
      severity: 'high',
      description: 'Acting on recommendations without live connector evidence',
      mitigation:
        'Evidence section with confidence; prefer live_connector over derived when available',
    },
    {
      id: 'risk-credential-leak',
      category: 'security',
      severity: 'critical',
      description: 'Exposing API secrets in AI responses or UI',
      mitigation:
        'Only report credential presence booleans; never return secret values',
    },
  ];

  if (objective.approvalRequired) {
    risks.push({
      id: 'risk-unapproved-publish',
      category: 'business',
      severity: 'critical',
      description: 'Live marketplace publish without approval',
      mitigation: 'ApprovalRequired gate + shadow mode default',
    });
  }

  if (snapshot.productCount === 0) {
    risks.push({
      id: 'risk-empty-store',
      category: 'technical',
      severity: 'medium',
      description: 'Empty product store yields empty recommendations',
      mitigation: 'Honest empty state + connect/import tasks in plan',
    });
  }

  return risks;
}

export function buildVerification(
  objective: ObjectiveSection,
  snapshot: NavigatorPlatformSnapshot,
  cycle: OperatorCycleResult | null | undefined,
  evidence: LiveEvidenceItem[],
): VerificationSection {
  const criteria: VerificationCriterion[] = [
    {
      id: 'vc-objective-framed',
      description: 'Objective goal and desired outcome are explicit',
      measurable: 'objective.goal and desiredOutcome non-empty',
      status: 'met',
      evidenceIds: [],
    },
    {
      id: 'vc-evidence-present',
      description: 'At least one evidence item with source + timestamp + confidence',
      measurable: 'liveEvidence.length >= 1',
      status: evidence.length >= 1 ? 'met' : 'unmet',
      evidenceIds: evidence.slice(0, 3).map((e) => e.id),
    },
    {
      id: 'vc-no-fabricated-kpis',
      description: 'No fabricated production KPIs; fixtures labeled',
      measurable: 'honesty distinguishes live vs fixture evidence',
      status: 'met',
      evidenceIds: evidence
        .filter((e) => e.sourceType === 'fixture' || e.simulationLabel)
        .map((e) => e.id),
    },
  ];

  if (objective.objectiveType === 'READ_ONLY_ANALYSIS') {
    const ranked = cycle?.candidateStats.ranked ?? 0;
    criteria.push({
      id: 'vc-ranked-products',
      description: 'Ranked product recommendations or honest empty result',
      measurable: 'ranked > 0 OR productCount == 0 with empty-state note',
      status:
        ranked > 0
          ? 'met'
          : snapshot.productCount === 0
            ? 'partial'
            : cycle
              ? 'partial'
              : 'pending',
      evidenceIds: evidence
        .filter((e) => e.source.includes('Operator') || e.source.includes('Product'))
        .map((e) => e.id),
    });
  }

  if (objective.approvalRequired) {
    criteria.push({
      id: 'vc-approval-gate',
      description: 'Consequential actions require approval records',
      measurable: 'approvalRequired true and no live publish without Approval',
      status: 'pending',
      evidenceIds: [],
    });
  }

  const unmet = criteria.filter((c) => c.status === 'unmet').length;
  const partial = criteria.filter((c) => c.status === 'partial' || c.status === 'pending')
    .length;
  const overall =
    unmet > 0 ? 'failed' : partial > 0 ? 'partial' : 'passed';

  return {
    criteria,
    overall,
    notes:
      overall === 'passed'
        ? 'Acceptance criteria satisfied for this resolution pass.'
        : overall === 'partial'
          ? 'Some criteria pending live data or human approval — continue execution plan.'
          : 'One or more criteria unmet — address gaps before claiming objective complete.',
  };
}

// ─── Knowledge base ──────────────────────────────────────────────────────────

export function buildKnowledgeDelta(
  objective: ObjectiveSection,
  snapshot: NavigatorPlatformSnapshot,
  cycle: OperatorCycleResult | null | undefined,
  runId: string | null | undefined,
  now: Date,
): KnowledgeBaseEntry[] {
  const entries: KnowledgeBaseEntry[] = [];
  entries.push({
    id: `kb-${now.getTime()}-1`,
    objectivePattern: objective.objectiveType,
    lesson: `Goal "${objective.goal}" with ${snapshot.productCount} products and ${snapshot.connectors.filter((c) => !c.isFixture && /connected/i.test(c.status)).length} live connectors.`,
    evidenceSummary: cycle
      ? `Ranked ${cycle.candidateStats.ranked}/${cycle.candidateStats.retrieved}; decision=${cycle.decision}`
      : 'Navigation pass without full operator cycle',
    confidence: 0.8,
    createdAt: nowIso(now),
    runId: runId ?? null,
  });

  if (snapshot.fixtureProductCount > 0) {
    entries.push({
      id: `kb-${now.getTime()}-2`,
      objectivePattern: 'DATA_CLASS_HYGIENE',
      lesson: 'Always separate fixture vs live product counts in recommendations.',
      evidenceSummary: `${snapshot.fixtureProductCount} fixture products present`,
      confidence: 1,
      createdAt: nowIso(now),
      runId: runId ?? null,
    });
  }

  if ((snapshot.hasLiveHttpReady?.length ?? 0) === 0 && snapshot.productCount > 0) {
    entries.push({
      id: `kb-${now.getTime()}-3`,
      objectivePattern: 'CONNECTOR_CREDENTIALS',
      lesson:
        'Products exist but no live HTTP credentials — prefer connect-live option over claiming market truth.',
      evidenceSummary: 'hasLiveHttpReady empty',
      confidence: 0.9,
      createdAt: nowIso(now),
      runId: runId ?? null,
    });
  }

  return entries;
}

function applyPriorKnowledge(
  prior: KnowledgeBaseEntry[] | undefined,
  objectiveType: ObjectiveType,
): KnowledgeBaseEntry[] {
  if (!prior?.length) return [];
  return prior
    .filter(
      (k) =>
        k.objectivePattern === objectiveType ||
        k.objectivePattern === 'DATA_CLASS_HYGIENE' ||
        k.objectivePattern === 'CONNECTOR_CREDENTIALS',
    )
    .slice(0, 8);
}

// ─── Main builder ────────────────────────────────────────────────────────────

/**
 * Build the full Objective Execution Package.
 * Pure function — host supplies platform snapshot + optional operator cycle.
 */
export function buildExecutionPackage(
  input: BuildExecutionPackageInput,
): ObjectiveExecutionPackage {
  const now = input.now ?? new Date();
  const classification = classifyObjective(input.objective);
  const objective = frameObjective(input.objective, classification);
  const loopMode = input.loopMode ?? input.cycle?.loopMode ?? 'shadow';

  const connected = input.snapshot.connectors.filter(
    (c) => !c.isFixture && /connected|sync/i.test(c.status),
  );
  const needCreds = input.snapshot.connectors.filter(
    (c) => !c.isFixture && /credential|not_configured/i.test(c.status),
  );
  const fixtures = input.snapshot.connectors.filter((c) => c.isFixture);

  const alreadyImplemented: string[] = [
    'AI operator cycle (classify → tools → critic/auditor)',
    'Commerce Runtime FSMs and process tasks',
    'Connector registry + Ops Center health',
    'Live HTTP adapters (Shopify, Stripe, FX, Woo, EasyPost, SerpAPI)',
    'Webhook queue with normalize + DLQ',
    'Data provenance + production isolation helpers',
    'Persona workspaces and capability board',
  ];

  const gaps: string[] = [];
  if (input.snapshot.liveProductCount === 0) {
    gaps.push('No non-fixture products in store — connect live supplier/storefront or import');
  }
  if (connected.length === 0) {
    gaps.push('No live-connected connectors — set credentials and ensure-registry');
  }
  if ((input.snapshot.hasLiveHttpReady?.length ?? 0) === 0) {
    gaps.push('No LIVE_HTTP credentials in env — live sync will skip honestly');
  }
  if (objective.approvalRequired) {
    gaps.push('Consequential objective requires human approval path');
  }

  const currentState: CurrentStateSection = {
    inspectedAt: nowIso(now),
    productCount: input.snapshot.productCount,
    fixtureProductCount: input.snapshot.fixtureProductCount,
    liveProductCount: input.snapshot.liveProductCount,
    connectorSummary: {
      total: input.snapshot.connectors.length,
      connected: connected.length,
      credentialsRequired: needCreds.length,
      fixtures: fixtures.length,
    },
    openCommerceCases: input.snapshot.openCommerceCases ?? 0,
    recentOperatorRuns: input.snapshot.recentOperatorRuns ?? 0,
    simulationMode: Boolean(input.snapshot.simulationMode),
    loopMode,
    repositoryCapabilities: [
      'objective_resolution',
      'operator_cycle',
      'capability_registry',
      'live_http_sync',
      'commerce_runtime',
      'webhook_pipeline',
    ],
    alreadyImplemented,
    gaps,
  };

  const liveEvidence = collectLiveEvidence(input.snapshot, input.cycle, now);
  const recommendations = buildRankedOptions(
    objective,
    input.snapshot,
    liveEvidence,
    input.cycle,
  );
  const tasks = buildExecutionTasks(objective, input.snapshot, recommendations);
  const timeline = groupTimeline(tasks);
  const dependencies = buildDependencies(objective, input.snapshot);
  const risks = buildRisks(objective, input.snapshot);
  const verification = buildVerification(
    objective,
    input.snapshot,
    input.cycle,
    liveEvidence,
  );
  const knowledgeBaseDelta = buildKnowledgeDelta(
    objective,
    input.snapshot,
    input.cycle,
    input.runId,
    now,
  );
  const priorKnowledgeApplied = applyPriorKnowledge(
    input.priorKnowledge,
    objective.objectiveType,
  );

  // Mark task statuses from cycle
  if (input.cycle) {
    for (const t of tasks) {
      if (t.id === 'task-operator-cycle') {
        t.status =
          input.cycle.decision === 'block' ? 'blocked' : 'completed';
      }
      if (t.id === 'task-frame' || t.id === 'task-inspect-state') {
        t.status = 'completed';
      }
    }
  }

  const overall: ExecutionStatus =
    verification.overall === 'failed'
      ? 'failed'
      : input.cycle?.decision === 'block' && objective.approvalRequired
        ? 'blocked'
        : verification.overall === 'passed'
          ? 'completed'
          : verification.overall === 'partial'
            ? 'in_progress'
            : 'planned';

  const liveCount = liveEvidence.filter((e) => e.isLiveOperational).length;
  const simCount = liveEvidence.filter(
    (e) =>
      e.sourceType === 'fixture' ||
      e.sourceType === 'simulation' ||
      Boolean(e.simulationLabel),
  ).length;

  return {
    packageVersion: '1.0',
    generatedAt: nowIso(now),
    runId: input.runId ?? null,
    objective,
    currentState,
    liveEvidence,
    recommendations,
    productRecommendations: input.cycle?.recommendations ?? [],
    executionPlan: {
      tasks,
      summary: `${tasks.length} executable tasks across immediate/short/longer horizons. Top option: ${recommendations.find((r) => r.recommended)?.title ?? 'n/a'}`,
    },
    timeline,
    dependencies,
    risks,
    executionStatus: {
      overall,
      history: [
        {
          at: nowIso(now),
          status: 'planned',
          note: 'Objective received',
        },
        {
          at: nowIso(now),
          status: 'in_progress',
          note: 'Platform state inspected and evidence collected',
        },
        {
          at: nowIso(now),
          status: overall,
          note: verification.notes,
        },
      ],
      blockedReason:
        overall === 'blocked'
          ? input.cycle?.decisionNote ?? 'Blocked by policy/approval'
          : null,
    },
    verification,
    knowledgeBaseDelta,
    priorKnowledgeApplied,
    honesty: {
      note:
        'Evidence distinguishes live_connector, canonical_store, derived_model, fixture, and simulation. Recommendations cite evidenceIds. Secrets never appear in package.',
      liveOperationalEvidenceCount: liveCount,
      fixtureOrSimulationEvidenceCount: simCount,
    },
  };
}

/**
 * Compact text summary for logs / chat-like surfaces that still want a synopsis.
 */
export function summarizeExecutionPackage(pkg: ObjectiveExecutionPackage): string {
  const top = pkg.recommendations.find((r) => r.recommended);
  const lines = [
    `OBJECTIVE: ${pkg.objective.goal}`,
    `OUTCOME: ${pkg.objective.desiredOutcome}`,
    `STATUS: ${pkg.executionStatus.overall}`,
    `STATE: ${pkg.currentState.productCount} products (${pkg.currentState.liveProductCount} live) · ${pkg.currentState.connectorSummary.connected} live connectors`,
    `TOP OPTION: ${top?.title ?? '—'} (score ${top?.score ?? '—'})`,
    `PLAN: ${pkg.executionPlan.summary}`,
    `TIMELINE: ${pkg.timeline.summary}`,
    `VERIFY: ${pkg.verification.overall} — ${pkg.verification.notes}`,
    `EVIDENCE: ${pkg.liveEvidence.length} items (${pkg.honesty.liveOperationalEvidenceCount} live operational)`,
  ];
  return lines.join('\n');
}
