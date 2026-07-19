/**
 * Canonical TradeOps runtime contract — shared by API, AI, connectors, UI.
 * Every executable response should carry dataMode, ids, and state honestly.
 */

import { z } from 'zod';

export const DATA_MODES = ['live', 'fixture', 'simulation', 'shadow', 'blocked'] as const;
export type DataMode = (typeof DATA_MODES)[number];

export const RUNTIME_STATES = [
  'idle',
  'queued',
  'classifying',
  'retrieving',
  'calling_tools',
  'normalizing',
  'validating',
  'awaiting_approval',
  'executing',
  'reconciling',
  'completed',
  'partial',
  'blocked',
  'failed',
] as const;
export type RuntimeExecutionState = (typeof RUNTIME_STATES)[number];

/** Standard domain event names for the event fabric */
export const STANDARD_EVENT_TYPES = [
  'ProductDiscovered',
  'ProductEvaluated',
  'CommerceCaseAdvanced',
  'ApprovalRequested',
  'ApprovalDecided',
  'ListingPrepared',
  'ListingPublished',
  'OrderReceived',
  'PaymentVerified',
  'SupplierOrderPrepared',
  'ShipmentCreated',
  'ShipmentUpdated',
  'ReconciliationCompleted',
  'PredictionEvaluated',
  'ConnectorHealthChanged',
  'AIObjectiveStarted',
  'AIObjectiveCompleted',
  'ToolExecutionFailed',
] as const;
export type StandardEventType = (typeof STANDARD_EVENT_TYPES)[number];

export const EVENT_SCHEMA_VERSION = '1.0.0';

export type ProvenanceRecord = {
  source: string;
  providerKey?: string;
  dataMode: DataMode;
  collectedAt: string;
  confidence?: number;
  evidenceId?: string;
  url?: string;
  title?: string;
};

export type CanonicalEnvelopeMeta = {
  requestId: string;
  traceId: string;
  correlationId?: string;
  tenantId: string;
  state: RuntimeExecutionState;
  dataMode: DataMode;
  warnings: string[];
  confidence?: number;
  schemaVersion: string;
  at: string;
};

export type CanonicalEnvelope<T = unknown> = {
  meta: CanonicalEnvelopeMeta;
  text?: string;
  data: T;
  evidence: ProvenanceRecord[];
  actions: Array<{ id: string; label: string; href?: string; requiresApproval?: boolean }>;
  blocked?: { code: string; message: string; missing?: string[] };
};

export function newRequestIds(): { requestId: string; traceId: string } {
  const requestId = cryptoRandomId();
  return { requestId, traceId: requestId };
}

function cryptoRandomId(): string {
  // Avoid hard Node crypto import for edge-friendly contracts package
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return (crypto as { randomUUID: () => string }).randomUUID();
  }
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function wrapEnvelope<T>(input: {
  tenantId: string;
  data: T;
  state: RuntimeExecutionState;
  dataMode: DataMode;
  text?: string;
  evidence?: ProvenanceRecord[];
  actions?: CanonicalEnvelope<T>['actions'];
  warnings?: string[];
  confidence?: number;
  blocked?: CanonicalEnvelope<T>['blocked'];
  requestId?: string;
  traceId?: string;
  correlationId?: string;
}): CanonicalEnvelope<T> {
  const ids = newRequestIds();
  return {
    meta: {
      requestId: input.requestId ?? ids.requestId,
      traceId: input.traceId ?? ids.traceId,
      correlationId: input.correlationId,
      tenantId: input.tenantId,
      state: input.state,
      dataMode: input.dataMode,
      warnings: input.warnings ?? [],
      confidence: input.confidence,
      schemaVersion: EVENT_SCHEMA_VERSION,
      at: new Date().toISOString(),
    },
    text: input.text,
    data: input.data,
    evidence: input.evidence ?? [],
    actions: input.actions ?? [],
    blocked: input.blocked,
  };
}

export function dataModeFromPlatform(sourcePlatform?: string | null, loopMode?: string): DataMode {
  if (!sourcePlatform) return 'simulation';
  if (sourcePlatform.startsWith('fixture') || loopMode === 'fixture') return 'fixture';
  if (loopMode === 'shadow') return 'shadow';
  return 'live';
}

export type DomainEventEnvelope = {
  eventType: StandardEventType | string;
  schemaVersion: string;
  tenantId: string;
  entityId?: string;
  entityType?: string;
  correlationId: string;
  causationId?: string;
  traceId: string;
  source: string;
  dataMode: DataMode;
  occurredAt: string;
  payload: Record<string, unknown>;
};

export function buildDomainEvent(input: {
  eventType: StandardEventType | string;
  tenantId: string;
  payload?: Record<string, unknown>;
  entityId?: string;
  entityType?: string;
  correlationId?: string;
  causationId?: string;
  traceId?: string;
  source?: string;
  dataMode?: DataMode;
}): DomainEventEnvelope {
  const ids = newRequestIds();
  return {
    eventType: input.eventType,
    schemaVersion: EVENT_SCHEMA_VERSION,
    tenantId: input.tenantId,
    entityId: input.entityId,
    entityType: input.entityType,
    correlationId: input.correlationId ?? ids.requestId,
    causationId: input.causationId,
    traceId: input.traceId ?? ids.traceId,
    source: input.source ?? 'tradeops',
    dataMode: input.dataMode ?? 'simulation',
    occurredAt: new Date().toISOString(),
    payload: input.payload ?? {},
  };
}

/** UI → backend wiring row for system matrix */
export type WiringMatrixRow = {
  uiAction: string;
  route: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  controller: string;
  service: string;
  domainOperation: string;
  toolOrConnector: string;
  model: string;
  event: string;
  responseSchema: string;
  finalUiState: string;
  status: 'wired' | 'partial' | 'blocked' | 'decorative_removed';
};

export const CORE_WIRING_MATRIX: WiringMatrixRow[] = [
  {
    uiAction: 'Import fixtures',
    route: '/api/v1/commerce/import/fixture-supplier',
    method: 'POST',
    controller: 'CommerceController',
    service: 'CommerceService.importFixtureSupplier',
    domainOperation: 'discover_products + create cases',
    toolOrConnector: 'fixture-supplier',
    model: 'Product,CommerceCase',
    event: 'ProductDiscovered',
    responseSchema: 'CanonicalEnvelope',
    finalUiState: 'Scanner rows + process board cases',
    status: 'wired',
  },
  {
    uiAction: 'Open case workspace',
    route: '/api/v1/commerce/cases/:caseId/workspace',
    method: 'GET',
    controller: 'CommerceController',
    service: 'CommerceCaseService.getCaseWorkspace',
    domainOperation: 'load case object graph',
    toolOrConnector: 'none',
    model: 'CommerceCase,Product,…',
    event: 'none',
    responseSchema: 'ObjectWorkspaceView',
    finalUiState: 'Object workspace tabs',
    status: 'wired',
  },
  {
    uiAction: 'Advance commerce stage',
    route: '/api/v1/commerce/cases/:caseId/advance',
    method: 'POST',
    controller: 'CommerceController',
    service: 'CommerceCaseService.advance',
    domainOperation: 'validated lifecycle transition',
    toolOrConnector: 'none',
    model: 'CommerceCase',
    event: 'CommerceCaseAdvanced',
    responseSchema: 'CaseDto',
    finalUiState: 'Updated stage + history',
    status: 'wired',
  },
  {
    uiAction: 'Run AI objective',
    route: '/api/v1/ai/operator/run',
    method: 'POST',
    controller: 'AiController',
    service: 'AiOperatorService.runObjective',
    domainOperation: 'phase A tools + phase B synthesis',
    toolOrConnector: 'typed tools / Cohere',
    model: 'OperatorRun,OperatorRecommendation',
    event: 'AIObjectiveStarted,AIObjectiveCompleted',
    responseSchema: 'CanonicalEnvelope+OperatorResult',
    finalUiState: 'AI panel recommendations',
    status: 'wired',
  },
  {
    uiAction: 'Command bar search',
    route: '/api/v1/search',
    method: 'GET',
    controller: 'CommerceController',
    service: 'SearchService.search',
    domainOperation: 'unified internal search',
    toolOrConnector: 'internal',
    model: 'Product,CommerceCase,…',
    event: 'none',
    responseSchema: 'SearchResponse+provenance',
    finalUiState: 'Navigate to top hit',
    status: 'wired',
  },
  {
    uiAction: 'Public web research (AI tool)',
    route: 'tool:researchSearchPublicWeb',
    method: 'POST',
    controller: 'AiOperatorService tool invoke',
    service: 'invokeResearchCapability',
    domainOperation: 'research.search_public_web',
    toolOrConnector: 'tavily-search',
    model: 'none',
    event: 'none',
    responseSchema: 'WebSearchResult',
    finalUiState: 'Evidence in AI result',
    status: 'wired',
  },
  {
    uiAction: 'Connector probe',
    route: '/api/v1/ops/connectors/:providerKey/probe',
    method: 'POST',
    controller: 'CommerceController',
    service: 'ConnectorOpsService.probe',
    domainOperation: 'health check',
    toolOrConnector: 'providerKey',
    model: 'ConnectorHealthEvent',
    event: 'ConnectorHealthChanged',
    responseSchema: 'ProbeResult',
    finalUiState: 'Connector status row',
    status: 'wired',
  },
  {
    uiAction: 'Shopify/live sync',
    route: '/api/v1/ops/connectors/live-sync',
    method: 'POST',
    controller: 'CommerceController',
    service: 'ConnectorOpsService.syncLive',
    domainOperation: 'import live catalog when credentials present',
    toolOrConnector: 'shopify-graphql-admin',
    model: 'Product,ExternalPayload',
    event: 'ProductDiscovered',
    responseSchema: 'LiveSyncResult+dataMode',
    finalUiState: 'Products + cases or credential blocker',
    status: 'partial',
  },
  {
    uiAction: 'Approve / reject',
    route: '/api/v1/approvals/:id/decide',
    method: 'POST',
    controller: 'CommerceController',
    service: 'CommerceService.decideApproval',
    domainOperation: 'consequential gate',
    toolOrConnector: 'listing/PO',
    model: 'Approval,Listing',
    event: 'ApprovalDecided',
    responseSchema: 'ApprovalDto',
    finalUiState: 'Approval queue updated',
    status: 'wired',
  },
  {
    uiAction: 'Run workflow template',
    route: '/api/v1/automation/workflows/run',
    method: 'POST',
    controller: 'AutomationController',
    service: 'WorkflowService.runTemplate',
    domainOperation: 'durable template execution',
    toolOrConnector: 'workflow-engine',
    model: 'OperatorRun',
    event: 'workflow.template_run',
    responseSchema: 'DurableWorkflowRun',
    finalUiState: 'Objectives history',
    status: 'partial',
  },
  {
    uiAction: 'Stack diagnostics',
    route: '/api/v1/ops/diagnostics',
    method: 'GET',
    controller: 'OpsDiagnosticsController',
    service: 'DiagnosticsService.probeStack',
    domainOperation: 'configuration honesty board',
    toolOrConnector: 'all active',
    model: 'none',
    event: 'none',
    responseSchema: 'DiagnosticsReport',
    finalUiState: 'Diagnostics panel',
    status: 'wired',
  },
  {
    uiAction: 'Demo commerce loop',
    route: 'script:demo:loop / UI DemoLoopButton',
    method: 'POST',
    controller: 'multiple commerce endpoints',
    service: 'fixture lifecycle',
    domainOperation: 'discover→… fixture path',
    toolOrConnector: 'fixture-*',
    model: 'full commerce models',
    event: 'multiple',
    responseSchema: 'mixed',
    finalUiState: 'Process board filled',
    status: 'wired',
  },
];

export const envelopeMetaSchema = z.object({
  requestId: z.string(),
  traceId: z.string(),
  tenantId: z.string(),
  state: z.enum(RUNTIME_STATES),
  dataMode: z.enum(DATA_MODES),
  warnings: z.array(z.string()),
  schemaVersion: z.string(),
  at: z.string(),
});
