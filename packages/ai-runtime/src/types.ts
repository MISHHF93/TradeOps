/**
 * TradeOps AI operator types — tools, risk classes, loop modes.
 * The model never calls arbitrary functions; only registered tools.
 */

export type OperationLoopMode =
  | 'fixture'
  | 'development'
  | 'shadow'
  | 'controlled_live'
  | 'automated_live';

export type AiActionClass =
  | 'read_only'
  | 'draft'
  | 'reversible_operational'
  | 'financial_contractual'
  | 'prohibited';

/** Objective intent — drives approval gates */
export type ObjectiveType =
  | 'READ_ONLY_ANALYSIS'
  | 'DRAFT_LISTING'
  | 'PUBLISH_LISTING'
  | 'SUPPLIER_PO'
  | 'MIXED';

export type OperatorDecision = 'accept' | 'revise' | 'downgrade' | 'block' | 'escalate';

export type ToolRiskPolicy = {
  actionClass: AiActionClass;
  approvalRequired: boolean;
  allowedInLoopModes: OperationLoopMode[];
};

export type ToolDefinition<TInput = Record<string, unknown>, TOutput = unknown> = {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, { type: string; description?: string }>;
    required?: string[];
  };
  requiredPermissions: string[];
  requiredConnectorCapability?: string;
  risk: ToolRiskPolicy;
  timeoutMs: number;
  idempotent: boolean;
  /** Pure handler — API layer injects deps via closure */
  execute: (input: TInput, ctx: ToolExecutionContext) => Promise<TOutput>;
};

export type ToolExecutionContext = {
  organizationId: string;
  userId?: string | null;
  loopMode: OperationLoopMode;
  permissions: string[];
  /** Deps bag filled by API host */
  deps: Record<string, unknown>;
};

export type ToolTraceEntry = {
  tool: string;
  input: unknown;
  output?: unknown;
  error?: string;
  actionClass: AiActionClass;
  durationMs: number;
  at: string;
};

export type TimelineStep = {
  at: string;
  step: string;
  status: 'done' | 'active' | 'failed' | 'skipped';
  detail?: string;
};

export type RecommendationDraft = {
  productId?: string;
  rank: number;
  actionClass: AiActionClass;
  title: string;
  rationale: string;
  evidence: Record<string, unknown>;
  assumptions: string[];
  missingData: string[];
  calculation: Record<string, unknown>;
  forecast: Record<string, unknown>;
  confidence: number;
  policyRiskScore: number;
  approvalRequired: boolean;
  expectedOutcome: Record<string, unknown>;
  proposedAction: string;
  /** Product evaluation card fields (read-only analysis) */
  productCard?: Record<string, unknown>;
  nextActions?: string[];
  /** Deep links for UI evidence navigation */
  actionHrefs?: Record<string, string>;
};

export type CriticResult = {
  issues: string[];
  severity: 'none' | 'low' | 'medium' | 'high';
  notes: string;
};

export type AuditorResult = {
  calculationOk: boolean;
  policyOk: boolean;
  permissionsOk: boolean;
  identityOk: boolean;
  issues: string[];
  notes: string;
};

export type OperatorPlan = {
  steps: string[];
  toolsToCall: string[];
  interpretation: string;
  objectiveType?: ObjectiveType;
  riskClass?: AiActionClass;
  approvalRequired?: boolean;
  filters?: Record<string, unknown>;
};

export type OperatorCycleResult = {
  plan: OperatorPlan;
  toolTrace: ToolTraceEntry[];
  recommendations: RecommendationDraft[];
  critic: CriticResult;
  auditor: AuditorResult;
  decision: OperatorDecision;
  decisionNote: string;
  loopMode: OperationLoopMode;
  /** Explicit objective classification */
  objectiveType: ObjectiveType;
  riskClass: AiActionClass;
  approvalRequired: boolean;
  timeline: TimelineStep[];
  sources: Array<{ name: string; status: string; detail?: string }>;
  responseSummary: string;
  /**
   * How the user-facing briefing was produced.
   * cohere = Phase B model text only; blocked = honest failure (no fixed essay).
   */
  briefingSource?:
    | 'cohere'
    | 'blocked'
    | 'empty_store'
    | 'no_qualifiers'
    | 'tools_structured';
  candidateStats: {
    retrieved: number;
    normalized: number;
    rejectedMissingCost: number;
    passedPolicy: number;
    ranked: number;
  };
  filtersApplied: Record<string, unknown>;
};
