/**
 * Canonical TradeOps AI response: human text + validated JSON + evidence + actions.
 * One envelope — never separate AI systems for JSON vs text.
 */

export type TradeOpsEvidenceSourceType =
  | 'web'
  | 'x'
  | 'connector'
  | 'database'
  | 'document'
  | 'calculation'
  | 'rag';

export type TradeOpsEvidence = {
  sourceType: TradeOpsEvidenceSourceType;
  provider: string;
  title?: string;
  url?: string;
  retrievedAt: string;
  freshness: 'live' | 'recent' | 'cached' | 'unknown';
  snippet?: string;
};

export type TradeOpsActionStatus =
  | 'recommended'
  | 'awaiting_approval'
  | 'executing'
  | 'completed'
  | 'failed';

export type TradeOpsAiAction = {
  actionId: string;
  capability: string;
  status: TradeOpsActionStatus;
  requiresApproval: boolean;
  parameters: Record<string, unknown>;
};

export type TradeOpsAiResponseStatus = 'completed' | 'partial' | 'blocked' | 'failed';

export type TradeOpsAIResponse<T = unknown> = {
  requestId: string;
  tenantId: string;
  conversationId: string;
  output: {
    text: string;
    json: T;
  };
  status: TradeOpsAiResponseStatus;
  confidence: number;
  evidence: TradeOpsEvidence[];
  actions: TradeOpsAiAction[];
  warnings: string[];
  generatedAt: string;
  /** Schema / platform metadata */
  meta?: {
    schemaVersion: string;
    aiProvider: 'xai';
    model?: string;
    informationNeed?: string;
    searchUsed?: boolean;
    toolsInvoked?: string[];
  };
};

export type GatewayObjectiveJson = {
  objective: string;
  recommendations: Array<{
    title: string;
    reason: string;
    score: number;
    product?: string;
    estimatedDemand?: string;
    estimatedMarginPercent?: number;
    risk?: string;
  }>;
  confidence: number;
  sources: Array<{
    provider: string;
    sourceType: string;
    url?: string;
  }>;
};

/** Strict JSON Schema for structured outputs (xAI / server validation). */
export const GATEWAY_OBJECTIVE_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['text', 'objective', 'recommendations', 'confidence', 'sources'],
  properties: {
    text: { type: 'string' },
    objective: { type: 'string' },
    recommendations: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'reason', 'score'],
        properties: {
          title: { type: 'string' },
          reason: { type: 'string' },
          score: { type: 'number' },
          product: { type: 'string' },
          estimatedDemand: { type: 'string' },
          estimatedMarginPercent: { type: 'number' },
          risk: { type: 'string' },
        },
      },
    },
    confidence: { type: 'number' },
    sources: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['provider', 'sourceType'],
        properties: {
          provider: { type: 'string' },
          sourceType: { type: 'string' },
          url: { type: 'string' },
        },
      },
    },
  },
} as const;

export function newRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function buildEnvelope<T>(params: {
  tenantId: string;
  conversationId?: string;
  text: string;
  json: T;
  status?: TradeOpsAiResponseStatus;
  confidence?: number;
  evidence?: TradeOpsEvidence[];
  actions?: TradeOpsAiAction[];
  warnings?: string[];
  meta?: TradeOpsAIResponse['meta'];
}): TradeOpsAIResponse<T> {
  return {
    requestId: newRequestId(),
    tenantId: params.tenantId,
    conversationId: params.conversationId ?? `conv_${Date.now().toString(36)}`,
    output: {
      text: params.text,
      json: params.json,
    },
    status: params.status ?? 'completed',
    confidence: params.confidence ?? 0.5,
    evidence: params.evidence ?? [],
    actions: params.actions ?? [],
    warnings: params.warnings ?? [],
    generatedAt: new Date().toISOString(),
    meta: params.meta,
  };
}

/**
 * Minimal server-side validation — ensure required fields exist.
 * Prefer full AJV in production; this is a lightweight gate.
 */
export function validateObjectivePayload(raw: unknown): {
  ok: boolean;
  value?: GatewayObjectiveJson & { text: string };
  errors: string[];
} {
  const errors: string[] = [];
  if (!raw || typeof raw !== 'object') {
    return { ok: false, errors: ['payload is not an object'] };
  }
  const o = raw as Record<string, unknown>;
  if (typeof o.text !== 'string' || !o.text.trim()) errors.push('text required');
  if (typeof o.objective !== 'string') errors.push('objective required');
  if (!Array.isArray(o.recommendations)) errors.push('recommendations must be array');
  if (typeof o.confidence !== 'number') errors.push('confidence must be number');
  if (!Array.isArray(o.sources)) errors.push('sources must be array');
  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    value: o as unknown as GatewayObjectiveJson & { text: string },
    errors: [],
  };
}
