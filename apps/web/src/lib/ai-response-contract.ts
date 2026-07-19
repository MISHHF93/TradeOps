/**
 * Frontend response contract for TradeOps Cohere AI chat.
 * Mirrors TradeOpsCanonicalResponse from @tradeops/ai-runtime (server).
 * Source of truth for UI fields remains the API envelope — not Cohere Playground.
 */

export type AiDataMode = 'live' | 'cached' | 'simulation' | 'unavailable';

export type AiResponseStatus = 'completed' | 'partial' | 'blocked' | 'failed';

export type AiArtifactType =
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
  | 'document_extraction'
  | string;

export type AiEvidence = {
  id?: string;
  sourceType: string;
  provider: string;
  title?: string;
  uri?: string;
  url?: string;
  excerpt?: string;
  snippet?: string;
  retrievedAt: string;
  freshness?: string;
  authority?: string;
};

export type AiProposedAction = {
  actionId: string;
  capability: string;
  description?: string;
  status: string;
  riskLevel?: string;
  requiresApproval: boolean;
  parameters?: Array<{ name: string; value: string }> | Record<string, unknown>;
};

/**
 * Canonical chat response the web app must render.
 * Prefer output.text for chat bubbles; output.artifact for structured cards.
 */
export type TradeOpsAiChatResponse = {
  schemaVersion?: string;
  requestId: string;
  tenantId: string;
  conversationId?: string;
  status: AiResponseStatus | string;
  dataMode?: AiDataMode;
  provenance?: {
    dataMode?: string;
    aiProvider?: string | null;
    aiModel?: string | null;
    searchProvider?: string | null;
    toolNames?: string[];
    sourceLabel?: string;
    cacheHit?: boolean;
    traceId?: string;
    generatedAt?: string;
  };
  intent?: {
    category?: string;
    informationMode?: string;
    language?: string;
    requiresLiveData?: boolean;
  };
  objective?: {
    title?: string;
    description?: string;
    successCriteria?: string[];
  };
  output: {
    text: string;
    artifactType?: AiArtifactType;
    artifact?: Record<string, unknown>;
    /** Legacy gateway shape */
    json?: Record<string, unknown>;
  };
  evidence: AiEvidence[];
  actions: AiProposedAction[];
  warnings: string[];
  confidence: number;
  generatedAt: string;
  errorCode?: string;
  requiredAction?: string;
  meta?: {
    provider?: string;
    model?: string;
    /** @deprecated prefer meta.provider */
    aiProvider?: string;
    promptId?: string;
    promptVersion?: string;
    toolsInvoked?: string[];
    latencyMs?: number;
    informationNeed?: string;
  };
};

/** Display helpers — never invent content when blocked/failed. */
export function aiChatDisplayText(r: TradeOpsAiChatResponse | null | undefined): string {
  if (!r?.output?.text?.trim()) {
    if (r?.errorCode) return `Request ${r.status ?? 'failed'}: ${r.errorCode}`;
    return 'No response text.';
  }
  return r.output.text.trim();
}

export function isAiBlocked(r: TradeOpsAiChatResponse | null | undefined): boolean {
  return r?.status === 'blocked' || r?.dataMode === 'unavailable';
}

export function isSimulationResponse(r: TradeOpsAiChatResponse | null | undefined): boolean {
  return r?.dataMode === 'simulation' || r?.provenance?.dataMode === 'simulation';
}

export function artifactTypeLabel(t?: string): string {
  if (!t) return 'answer';
  return t.replace(/_/g, ' ');
}
