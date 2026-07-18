/**
 * Canonical TradeOps AI response schemas (provider-compatible JSON Schema).
 * Frontend: output.text for chat, output.artifact for UI cards/workflows.
 */

export type ArtifactType =
  | 'answer'
  | 'classification'
  | 'research_report'
  | 'product_comparison'
  | 'supplier_comparison'
  | 'analytics_report'
  | 'operational_brief'
  | 'procurement_plan'
  | 'execution_plan'
  | 'risk_assessment'
  | 'document_extraction';

export type IntentCategory =
  | 'general'
  | 'research'
  | 'product_discovery'
  | 'supplier_discovery'
  | 'commerce'
  | 'payments'
  | 'logistics'
  | 'analytics'
  | 'procurement'
  | 'industrial_product'
  | 'document_analysis'
  | 'mixed';

export type InformationMode =
  | 'no_search'
  | 'public_web'
  | 'official_documentation'
  | 'internal_retrieval'
  | 'authenticated_operational'
  | 'mixed_research';

export type CanonicalEvidence = {
  id: string;
  sourceType: 'web' | 'connector' | 'database' | 'document' | 'calculation' | 'social' | 'x';
  provider: string;
  title: string;
  uri?: string;
  excerpt?: string;
  retrievedAt: string;
  publishedAt?: string;
  freshness: 'live' | 'recent' | 'cached' | 'historical' | 'unknown';
  authority:
    | 'first_party'
    | 'official'
    | 'tenant_owned'
    | 'trusted_industry'
    | 'marketplace'
    | 'general_web'
    | 'social';
};

export type ProposedAction = {
  actionId: string;
  capability: string;
  description: string;
  status:
    | 'recommended'
    | 'awaiting_approval'
    | 'approved'
    | 'executing'
    | 'completed'
    | 'failed'
    | 'blocked';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  requiresApproval: boolean;
  parameters: Array<{ name: string; value: string }>;
};

export type DataMode = 'live' | 'cached' | 'simulation' | 'unavailable';

export type RuntimeProvenance = {
  dataMode: DataMode;
  aiProvider: string | null;
  aiModel: string | null;
  searchProvider: string | null;
  toolNames: string[];
  connectorNames: string[];
  generatedAt: string;
  providerRequestId?: string;
  cacheHit: boolean;
  traceId: string;
  sourceLabel: string;
};

export type TradeOpsCanonicalResponse<TArtifact = unknown> = {
  schemaVersion: string;
  requestId: string;
  tenantId: string;
  workspaceId?: string;
  conversationId: string;
  status: 'completed' | 'partial' | 'blocked' | 'failed';
  /**
   * How this response was produced. Never claim "live" for simulation or
   * missing-provider fallbacks. Never hide blocked behind completed.
   */
  dataMode: DataMode;
  provenance: RuntimeProvenance;
  intent: {
    category: IntentCategory;
    informationMode: InformationMode;
    language: string;
    requiresLiveData: boolean;
  };
  objective: {
    title: string;
    description: string;
    successCriteria: string[];
  };
  output: {
    text: string;
    artifactType: ArtifactType;
    artifact: TArtifact;
  };
  evidence: CanonicalEvidence[];
  actions: ProposedAction[];
  warnings: string[];
  confidence: number;
  generatedAt: string;
  /** When status is blocked/failed — machine-readable, no secrets */
  errorCode?: string;
  requiredAction?: string;
  meta?: {
    provider?: string;
    model?: string;
    promptId?: string;
    promptVersion?: string;
    toolsInvoked?: string[];
    latencyMs?: number;
  };
};

/** Compact schema for Cohere structured synthesis */
/**
 * Cohere-compatible JSON Schema for structured synthesis.
 * Keep relatively flat — dump-into-prompt is no longer used; response_format.schema is.
 * Every object includes required[] per Cohere structured-output constraints.
 */
export const SYNTHESIS_JSON_SCHEMA = {
  type: 'object',
  required: [
    'text',
    'artifactType',
    'artifact',
    'confidence',
    'objectiveTitle',
    'objectiveDescription',
    'successCriteria',
    'intentCategory',
    'informationMode',
    'warnings',
  ],
  properties: {
    text: { type: 'string', description: 'Human-readable answer' },
    artifactType: {
      type: 'string',
      description: 'answer | classification | research_report | operational_brief | execution_plan | …',
    },
    artifact: {
      type: 'object',
      description: 'Structured payload for the UI',
      properties: {
        summary: { type: 'string' },
      },
    },
    confidence: { type: 'number', description: '0..1' },
    objectiveTitle: { type: 'string' },
    objectiveDescription: { type: 'string' },
    successCriteria: {
      type: 'array',
      items: { type: 'string' },
    },
    intentCategory: {
      type: 'string',
      description: 'general | research | commerce | logistics | payments | mixed | …',
    },
    informationMode: {
      type: 'string',
      description: 'no_search | public_web | authenticated_operational | mixed_research | …',
    },
    warnings: {
      type: 'array',
      items: { type: 'string' },
    },
    proposedActions: {
      type: 'array',
      items: {
        type: 'object',
        required: ['capability', 'description', 'requiresApproval', 'riskLevel'],
        properties: {
          capability: { type: 'string' },
          description: { type: 'string' },
          requiresApproval: { type: 'boolean' },
          riskLevel: { type: 'string' },
        },
      },
    },
  },
} as const;

export type SynthesisPayload = {
  text: string;
  artifactType: ArtifactType;
  artifact: Record<string, unknown>;
  confidence: number;
  objectiveTitle: string;
  objectiveDescription: string;
  successCriteria: string[];
  intentCategory: IntentCategory;
  informationMode: InformationMode;
  warnings: string[];
  proposedActions?: Array<{
    capability: string;
    description: string;
    requiresApproval: boolean;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    parameters?: Array<{ name: string; value: string }>;
  }>;
};

export function validateSynthesisPayload(raw: unknown): {
  ok: boolean;
  value?: SynthesisPayload;
  errors: string[];
} {
  const errors: string[] = [];
  if (!raw || typeof raw !== 'object') return { ok: false, errors: ['not an object'] };
  const o = { ...(raw as Record<string, unknown>) };

  // Coerce common model drift so prompt execution is not brittle
  if (typeof o.text !== 'string' && o.text != null) o.text = String(o.text);
  if (typeof o.confidence === 'string' && o.confidence.trim() !== '') {
    const n = Number(o.confidence);
    if (Number.isFinite(n)) o.confidence = n;
  }
  // Artifact must be a plain object (models often emit string/array/null)
  if (
    o.artifact == null ||
    typeof o.artifact !== 'object' ||
    Array.isArray(o.artifact)
  ) {
    o.artifact =
      typeof o.artifact === 'string' && o.artifact.trim()
        ? { summary: o.artifact }
        : {};
  }
  if (!Array.isArray(o.successCriteria)) o.successCriteria = [];
  if (!Array.isArray(o.warnings)) o.warnings = [];
  if (typeof o.objectiveTitle !== 'string' || !o.objectiveTitle.trim()) {
    o.objectiveTitle = typeof o.text === 'string' ? o.text.slice(0, 80) : 'Response';
  }
  if (typeof o.objectiveDescription !== 'string') {
    o.objectiveDescription = typeof o.text === 'string' ? o.text.slice(0, 200) : '';
  }
  if (typeof o.artifactType !== 'string' || !o.artifactType.trim()) {
    o.artifactType = 'answer';
  }
  if (typeof o.intentCategory !== 'string' || !o.intentCategory.trim()) {
    o.intentCategory = 'general';
  }
  if (typeof o.informationMode !== 'string' || !o.informationMode.trim()) {
    o.informationMode = 'no_search';
  }
  // Confidence often omitted or null from free-form structured calls
  if (typeof o.confidence !== 'number' || !Number.isFinite(o.confidence as number)) {
    o.confidence = 0.7;
  }

  if (typeof o.text !== 'string' || !o.text.trim()) errors.push('text required');
  if (typeof o.artifactType !== 'string') errors.push('artifactType required');
  if (!o.artifact || typeof o.artifact !== 'object' || Array.isArray(o.artifact)) {
    errors.push('artifact required');
  }
  if (typeof o.confidence !== 'number' || !Number.isFinite(o.confidence as number)) {
    errors.push('confidence required');
  }
  if (typeof o.objectiveTitle !== 'string') errors.push('objectiveTitle required');
  if (typeof o.objectiveDescription !== 'string') errors.push('objectiveDescription required');
  if (!Array.isArray(o.successCriteria)) errors.push('successCriteria array required');
  if (typeof o.intentCategory !== 'string') errors.push('intentCategory required');
  if (typeof o.informationMode !== 'string') errors.push('informationMode required');
  if (!Array.isArray(o.warnings)) errors.push('warnings array required');
  if (errors.length) return { ok: false, errors };

  const conf = Math.min(1, Math.max(0, Number(o.confidence)));
  return {
    ok: true,
    value: {
      ...(o as unknown as SynthesisPayload),
      confidence: conf,
    },
    errors: [],
  };
}
