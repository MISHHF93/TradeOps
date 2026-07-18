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

export type TradeOpsCanonicalResponse<TArtifact = unknown> = {
  schemaVersion: string;
  requestId: string;
  tenantId: string;
  workspaceId?: string;
  conversationId: string;
  status: 'completed' | 'partial' | 'blocked' | 'failed';
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
export const SYNTHESIS_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
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
    text: { type: 'string' },
    artifactType: {
      type: 'string',
      enum: [
        'answer',
        'classification',
        'research_report',
        'product_comparison',
        'supplier_comparison',
        'analytics_report',
        'operational_brief',
        'procurement_plan',
        'execution_plan',
        'risk_assessment',
        'document_extraction',
      ],
    },
    artifact: { type: 'object' },
    confidence: { type: 'number' },
    objectiveTitle: { type: 'string' },
    objectiveDescription: { type: 'string' },
    successCriteria: {
      type: 'array',
      items: { type: 'string' },
    },
    intentCategory: {
      type: 'string',
      enum: [
        'general',
        'research',
        'product_discovery',
        'supplier_discovery',
        'commerce',
        'payments',
        'logistics',
        'analytics',
        'procurement',
        'industrial_product',
        'document_analysis',
        'mixed',
      ],
    },
    informationMode: {
      type: 'string',
      enum: [
        'no_search',
        'public_web',
        'official_documentation',
        'internal_retrieval',
        'authenticated_operational',
        'mixed_research',
      ],
    },
    warnings: {
      type: 'array',
      items: { type: 'string' },
    },
    proposedActions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['capability', 'description', 'requiresApproval', 'riskLevel'],
        properties: {
          capability: { type: 'string' },
          description: { type: 'string' },
          requiresApproval: { type: 'boolean' },
          riskLevel: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
          parameters: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['name', 'value'],
              properties: {
                name: { type: 'string' },
                value: { type: 'string' },
              },
            },
          },
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
  const o = raw as Record<string, unknown>;
  if (typeof o.text !== 'string' || !o.text.trim()) errors.push('text required');
  if (typeof o.artifactType !== 'string') errors.push('artifactType required');
  if (!o.artifact || typeof o.artifact !== 'object') errors.push('artifact required');
  if (typeof o.confidence !== 'number') errors.push('confidence required');
  if (typeof o.objectiveTitle !== 'string') errors.push('objectiveTitle required');
  if (typeof o.objectiveDescription !== 'string') errors.push('objectiveDescription required');
  if (!Array.isArray(o.successCriteria)) errors.push('successCriteria array required');
  if (typeof o.intentCategory !== 'string') errors.push('intentCategory required');
  if (typeof o.informationMode !== 'string') errors.push('informationMode required');
  if (!Array.isArray(o.warnings)) errors.push('warnings array required');
  if (errors.length) return { ok: false, errors };
  return { ok: true, value: o as unknown as SynthesisPayload, errors: [] };
}
