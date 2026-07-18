/**
 * TradeOps canonical architecture registry.
 * Source of truth for platform layers — modules register against these seams.
 *
 * Presentation → Workspace → AI → Workflow → Capability → Connector → Data Fabric → Knowledge Graph → Persistence
 */

/** Vertical layers every feature must map to */
export const PLATFORM_LAYERS = [
  'presentation',
  'workspace',
  'ai',
  'workflow',
  'capability',
  'connector',
  'data_fabric',
  'knowledge_graph',
  'event_fabric',
  'live_projection',
  'persistence',
  'ops_command_center',
] as const;

export type PlatformLayer = (typeof PLATFORM_LAYERS)[number];

/** Canonical monorepo modules and their primary layer(s) */
export const PLATFORM_MODULES = {
  'apps/web': {
    layers: ['presentation', 'workspace'] as PlatformLayer[],
    role: 'Next.js terminal + public site',
  },
  'apps/api': {
    layers: [
      'workspace',
      'ai',
      'workflow',
      'capability',
      'connector',
      'event_fabric',
      'live_projection',
      'ops_command_center',
    ] as PlatformLayer[],
    role: 'NestJS modular monolith — sole backend for browser',
  },
  'apps/worker': {
    layers: ['workflow', 'event_fabric'] as PlatformLayer[],
    role: 'BullMQ background jobs (optional when Redis up)',
  },
  '@tradeops/ai-runtime': {
    layers: ['ai', 'live_projection'] as PlatformLayer[],
    role: 'Cohere code-first agent, Search Manager, live projection, retrieval',
  },
  '@tradeops/commerce-engine': {
    layers: ['data_fabric', 'workflow', 'workspace'] as PlatformLayer[],
    role: 'Commerce lifecycle, scoring, workspace nav, state engine',
  },
  '@tradeops/connector-core': {
    layers: ['connector', 'capability', 'ops_command_center'] as PlatformLayer[],
    role: 'Connector registry, capabilities, ops center pure logic, normalize',
  },
  '@tradeops/connectors/*': {
    layers: ['connector'] as PlatformLayer[],
    role: 'Vendor adapters (fixtures, google-merchant, live-http)',
  },
  '@tradeops/database': {
    layers: ['persistence', 'data_fabric'] as PlatformLayer[],
    role: 'Prisma schema + client (canonical entities)',
  },
  '@tradeops/domain': {
    layers: ['data_fabric', 'workspace'] as PlatformLayer[],
    role: 'Tenancy, RBAC, architecture registry',
  },
  '@tradeops/contracts': {
    layers: ['presentation', 'workspace'] as PlatformLayer[],
    role: 'Shared DTOs and permission catalog',
  },
  '@tradeops/config': {
    layers: ['ops_command_center'] as PlatformLayer[],
    role: 'Typed env, security boot, AI platform config, financial gates',
  },
  '@tradeops/workflow-engine': {
    layers: ['workflow'] as PlatformLayer[],
    role: 'Workflow templates + runner',
  },
  '@tradeops/harmonization': {
    layers: ['data_fabric', 'ai'] as PlatformLayer[],
    role: 'Normalization / identity harmonization',
  },
  '@tradeops/saas-entitlements': {
    layers: ['workspace'] as PlatformLayer[],
    role: 'Plan packs and entitlements',
  },
  '@tradeops/auth': {
    layers: ['workspace'] as PlatformLayer[],
    role: 'Auth primitives (session helpers)',
  },
  '@tradeops/logging': {
    layers: ['ops_command_center'] as PlatformLayer[],
    role: 'Structured logging',
  },
} as const;

/**
 * Canonical business entities (Data Fabric).
 * Connectors must normalize into these — never leak raw vendor objects.
 */
export const DATA_FABRIC_ENTITIES = [
  'Organization',
  'User',
  'Membership',
  'Workspace',
  'Product',
  'Supplier',
  'SupplierOffer',
  'Customer', // derived / intelligence profiles
  'SalesChannel',
  'Listing',
  'Inventory', // via product.inventoryQuantity + ATP
  'Quote', // industrial / procurement
  'RFQ',
  'CustomerOrder',
  'SupplierPurchaseOrder',
  'Fulfillment',
  'Shipment', // fulfillment projection
  'CommercePayment',
  'Invoice', // billing invoices (SaaS) vs commerce
  'Return', // refunds / disputes path
  'Document', // ProductArtifact
  'Conversation', // AiConversation
  'AIArtifact', // OperatorRun / recommendations
  'Workflow', // OperatorRun + workflow-engine templates
  'Event', // CommerceEvent
  'ConnectorInstallation',
  'CommerceCase',
  'Opportunity',
  'CommerceSignal',
  'Approval',
] as const;

export type DataFabricEntity = (typeof DATA_FABRIC_ENTITIES)[number];

/**
 * Platform event catalog (Event Fabric).
 * Durable, tenant-scoped via organizationId on CommerceEvent.
 */
export const PLATFORM_EVENT_TYPES = [
  'product.created',
  'product.updated',
  'inventory.changed',
  'price.changed',
  'order.created',
  'order.updated',
  'shipment.updated',
  'payment.received',
  'connector.connected',
  'connector.disconnected',
  'connector.health_changed',
  'workflow.started',
  'workflow.completed',
  'workflow.failed',
  'ai.completed',
  'ai.failed',
  'live_search.started',
  'live_search.completed',
  'live_search.item_projected',
  'case.advanced',
  'approval.requested',
  'approval.resolved',
  'webhook.received',
] as const;

export type PlatformEventType = (typeof PLATFORM_EVENT_TYPES)[number];

/** Specialized AI agents (orchestration layer — capabilities on one runtime) */
export const AI_AGENT_ROLES = [
  'orchestrator',
  'research',
  'commerce',
  'procurement',
  'supplier',
  'analytics',
  'operations',
  'compliance',
  'documentation',
] as const;

export type AiAgentRole = (typeof AI_AGENT_ROLES)[number];

/** Search Manager routing targets */
export const SEARCH_ROUTES = [
  'internal_database',
  'vector_retrieval',
  'documents',
  'commerce_connectors',
  'supplier_apis',
  'public_web',
  'official_documentation',
] as const;

/**
 * Presentation routes that are redirects / aliases (not orphan features).
 */
export const ROUTE_ALIASES: Record<string, string> = {
  '/terminal/cockpit': '/terminal/workspace/executive',
  '/terminal/control-tower': '/terminal/ops',
  '/terminal/pipeline': '/terminal/process',
  '/scanner': '/terminal',
};

/** Single ops command center surfaces (API + UI) */
export const OPS_COMMAND_CENTER = {
  ui: {
    commandCenter: '/terminal/ops',
    connectors: '/terminal/connectors',
    ecosystem: '/terminal/ecosystem',
    system: '/app',
    status: '/status',
    healthApi: '/api/v1/health',
    envHealthApi: '/api/v1/health/environment',
    architectureApi: '/api/v1/health/architecture',
    opsHealthApi: '/api/v1/ops/connectors/health',
    commandCenterApi: '/api/v1/ops/command-center',
    eventsApi: '/api/v1/ops/events',
    eventsStreamApi: '/api/v1/ops/events/stream',
  },
  principles: [
    'Connectors are sensors, not silos',
    'AI uses capabilities, not vendor REST',
    'Events are durable and tenant-scoped',
    'Live projection streams normalized items',
    'One command center composes fabrics — no parallel monitoring stack',
  ],
} as const;

export function architecturePublicStatus() {
  return {
    platform: 'TradeOps Commerce Operating System',
    layers: PLATFORM_LAYERS,
    modules: Object.keys(PLATFORM_MODULES),
    dataFabricEntities: DATA_FABRIC_ENTITIES.length,
    eventTypes: PLATFORM_EVENT_TYPES.length,
    aiAgents: AI_AGENT_ROLES,
    searchRoutes: SEARCH_ROUTES,
    opsCommandCenter: OPS_COMMAND_CENTER,
    routeAliases: ROUTE_ALIASES,
  };
}
