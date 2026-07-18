/**
 * Persona-driven operating workspaces.
 *
 * TradeOps is a Commerce Operating System: every nav item, page, and AI prompt
 * belongs to a persona procedure — not a feature module catalog.
 */

import {
  buildIntelligenceBrief,
  insightsToPriorities,
  type IntelligenceBrief,
} from './intelligence-engine';

/** Primary operating personas (product surface). */
export const OPERATING_PERSONAS = [
  'executive',
  'operator',
  'researcher',
  'analyst',
  'developer',
  'administrator',
] as const;

export type OperatingPersona = (typeof OPERATING_PERSONAS)[number];

/**
 * Stored membership personas (Prisma WorkspacePersona) including legacy values.
 * Legacy maps into primary operating personas for nav/AI.
 */
export type StoredWorkspacePersona =
  | OperatingPersona
  | 'founder'
  | 'procurement'
  | 'finance'
  | 'agency'
  | 'auditor';

export type ProcedureStepStatus = 'not_started' | 'ready' | 'in_progress' | 'blocked' | 'completed';

export type ProcedureStep = {
  id: string;
  label: string;
  description: string;
  href: string;
  /** Commerce lifecycle stage this step advances, if any */
  commerceStage?: string;
  /** AI tools allowed to recommend from this step */
  aiTools?: string[];
  /** Permission keys required to complete */
  requiredPermissions?: string[];
};

export type OperatingProcedure = {
  id: string;
  persona: OperatingPersona;
  label: string;
  summary: string;
  /** Ordered executable steps — beginning → middle → completion */
  steps: ProcedureStep[];
  completionCriteria: string;
};

export type NavKind = 'procedure_hub' | 'procedure_step' | 'resource' | 'admin' | 'dev_utility';

export type WorkspaceNavItem = {
  id: string;
  href: string;
  label: string;
  kind: NavKind;
  procedureId?: string;
  stepId?: string;
  status?: 'operational' | 'approval_controlled' | 'credential_blocked' | 'planned';
  badge?: string;
};

export type WorkspaceNavGroup = {
  id: string;
  label: string;
  items: WorkspaceNavItem[];
};

export type PersonaDefinition = {
  id: OperatingPersona;
  label: string;
  mission: string;
  homeHref: string;
  defaultObjective: string;
  procedures: string[];
};

/** Canonical route ownership — which persona owns a path prefix. */
export type RouteOwnership = {
  path: string;
  primaryPersona: OperatingPersona;
  secondaryPersonas?: OperatingPersona[];
  procedureId?: string;
  kind: NavKind;
  /** If true, not shown in sidebar; deep-link / redirect only */
  orphan?: boolean;
  /** Redirect target when consolidating duplicates */
  redirectTo?: string;
};

// --- Persona catalog ---

export const PERSONA_DEFINITIONS: Record<OperatingPersona, PersonaDefinition> = {
  executive: {
    id: 'executive',
    label: 'Executive',
    mission: 'Review KPIs, risks, approvals, and financial health; approve strategy.',
    homeHref: '/terminal/workspace/executive',
    defaultObjective:
      'Summarize portfolio health, open risks, pending approvals, and cash exposure. Recommend only board-level actions.',
    procedures: ['exec_kpi_review', 'exec_risk_review', 'exec_approvals', 'exec_finance'],
  },
  operator: {
    id: 'operator',
    label: 'Operator',
    mission: 'Run listing → publish → order → fulfill procedures end-to-end.',
    homeHref: '/terminal/workspace/operator',
    defaultObjective:
      'Focus on open Commerce Cases ready to prepare, approve, publish, or fulfill. Propose only operator-permitted next actions.',
    procedures: ['ops_listing_launch', 'ops_order_fulfill', 'ops_reconcile'],
  },
  researcher: {
    id: 'researcher',
    label: 'Researcher',
    mission: 'Discover products, compare suppliers, evaluate demand, score opportunities.',
    homeHref: '/terminal/workspace/researcher',
    defaultObjective:
      'Discover and rank product candidates with media, ratings, and contribution economics. Research only — no publish.',
    procedures: ['research_discover', 'research_evaluate', 'research_recommend'],
  },
  analyst: {
    id: 'analyst',
    label: 'Analyst',
    mission: 'Signals, portfolio intelligence, customers, and outcome learning.',
    homeHref: '/terminal/workspace/analyst',
    defaultObjective:
      'Explain signals, portfolio composition, customer patterns, and prediction outcomes. Analysis only unless asked to draft.',
    procedures: ['analyst_signals', 'analyst_portfolio', 'analyst_learn'],
  },
  developer: {
    id: 'developer',
    label: 'Developer',
    mission: 'Connectors, workflows, diagnostics, live examples, and repair loops.',
    homeHref: '/terminal/workspace/developer',
    defaultObjective:
      'Inspect connector health, workflow failures, and capability readiness. Prefer diagnostics and shadow runs.',
    procedures: ['dev_connectors', 'dev_workflows', 'dev_diagnostics'],
  },
  administrator: {
    id: 'administrator',
    label: 'Administrator',
    mission: 'Organizations, users, permissions, audit, SaaS billing, access modes.',
    homeHref: '/terminal/workspace/administrator',
    defaultObjective:
      'Review org setup, seats, billing, and audit posture. Admin actions only within entitlements.',
    procedures: ['admin_org', 'admin_access', 'admin_billing'],
  },
};

// --- Procedures ---

export const PROCEDURES: Record<string, OperatingProcedure> = {
  research_discover: {
    id: 'research_discover',
    persona: 'researcher',
    label: 'Discover products',
    summary: 'Import or search sources, capture media twin, open Commerce Cases.',
    completionCriteria: 'At least one product imported with media/attributes and case in discover/evaluate.',
    steps: [
      {
        id: 'import_sources',
        label: 'Import / scan sources',
        description: 'Pull fixture or live supplier catalog into the twin.',
        href: '/terminal',
        commerceStage: 'discover',
        aiTools: ['searchConnectedProducts', 'listConnectorCapabilities'],
      },
      {
        id: 'inspect_media',
        label: 'Inspect product media',
        description: 'Confirm images, ratings, naming, attributes on candidates.',
        href: '/terminal',
        commerceStage: 'discover',
        aiTools: ['searchConnectedProducts'],
      },
      {
        id: 'watchlist',
        label: 'Save watchlist',
        description: 'Pin candidates worth deeper evaluation.',
        href: '/terminal/watchlist',
        commerceStage: 'discover',
      },
    ],
  },
  research_evaluate: {
    id: 'research_evaluate',
    persona: 'researcher',
    label: 'Evaluate demand & suppliers',
    summary: 'Score economics, demand, risk; compare supplier offers.',
    completionCriteria: 'Opportunity scored; case advanced to evaluate/qualify.',
    steps: [
      {
        id: 'score',
        label: 'Score opportunities',
        description: 'Contribution, demand, policy, confidence.',
        href: '/terminal/opportunities',
        commerceStage: 'evaluate',
        aiTools: ['scoreOpportunity', 'calculateContributionProfit', 'assessPolicyRisk'],
      },
      {
        id: 'process_board',
        label: 'Advance process cases',
        description: 'Move cases through evaluate → qualify.',
        href: '/terminal/process',
        commerceStage: 'qualify',
      },
    ],
  },
  research_recommend: {
    id: 'research_recommend',
    persona: 'researcher',
    label: 'Recommend candidates',
    summary: 'Hand off qualified candidates to operators with rationale.',
    completionCriteria: 'Recommendations recorded; tasks created for prepare stage.',
    steps: [
      {
        id: 'tasks',
        label: 'Handoff tasks',
        description: 'Tasks & blockers for prepare/publish.',
        href: '/terminal/tasks',
        commerceStage: 'qualify',
      },
      {
        id: 'ai_research',
        label: 'AI research assist',
        description: 'Read-only ranking and rationale.',
        href: '/terminal/ai',
        aiTools: ['scoreOpportunity', 'searchConnectedProducts'],
      },
    ],
  },
  ops_listing_launch: {
    id: 'ops_listing_launch',
    persona: 'operator',
    label: 'Prepare & publish listing',
    summary: 'Media validate → listing draft → approval → publish.',
    completionCriteria: 'Listing published or approval pending with complete draft.',
    steps: [
      {
        id: 'prepare',
        label: 'Prepare listing',
        description: 'Draft title, price, channel, media plan.',
        href: '/terminal/listings',
        commerceStage: 'prepare',
        aiTools: ['draftListing'],
      },
      {
        id: 'media',
        label: 'Validate media',
        description: 'Primary image, gallery, channel readiness.',
        href: '/terminal/listings',
        commerceStage: 'prepare',
      },
      {
        id: 'approval',
        label: 'Submit approval',
        description: 'Human gate for publication.',
        href: '/terminal/approvals',
        commerceStage: 'approve',
      },
      {
        id: 'publish',
        label: 'Publish',
        description: 'Execute authorized channel publish.',
        href: '/terminal/process',
        commerceStage: 'publish',
      },
      {
        id: 'monitor',
        label: 'Monitor cases',
        description: 'Track stage progress after publish.',
        href: '/terminal/process',
        commerceStage: 'sell',
      },
    ],
  },
  ops_order_fulfill: {
    id: 'ops_order_fulfill',
    persona: 'operator',
    label: 'Orders & fulfillment',
    summary: 'Sell → source → fulfill open orders.',
    completionCriteria: 'Open orders fulfilled or blocked with resolution path.',
    steps: [
      {
        id: 'orders',
        label: 'Review orders',
        description: 'Customer orders requiring action.',
        href: '/terminal/orders',
        commerceStage: 'sell',
      },
      {
        id: 'source',
        label: 'Source inventory',
        description: 'Supplier PO path.',
        href: '/terminal/orders',
        commerceStage: 'source',
      },
      {
        id: 'fulfill',
        label: 'Fulfill & track',
        description: 'Shipment and exceptions.',
        href: '/terminal/fulfillment',
        commerceStage: 'fulfill',
      },
    ],
  },
  ops_reconcile: {
    id: 'ops_reconcile',
    persona: 'operator',
    label: 'Reconcile channel money',
    summary: 'Payments, payouts, disputes, reconciliation.',
    completionCriteria: 'Period reconcilable; variances explained.',
    steps: [
      {
        id: 'payments',
        label: 'Channel payments',
        description: 'Marketplace/storefront payment truth.',
        href: '/terminal/finance/payments',
        commerceStage: 'reconcile',
        aiTools: ['inspectOrderPayment'],
      },
      {
        id: 'payouts',
        label: 'Payouts',
        description: 'Payout batches and status.',
        href: '/terminal/finance/payouts',
        commerceStage: 'reconcile',
        aiTools: ['inspectPayout', 'reconcilePayout'],
      },
      {
        id: 'recon',
        label: 'Reconciliation',
        description: 'Match fees, refunds, profit.',
        href: '/terminal/finance/reconciliation',
        commerceStage: 'reconcile',
        aiTools: ['explainPaymentVariance'],
      },
    ],
  },
  exec_kpi_review: {
    id: 'exec_kpi_review',
    persona: 'executive',
    label: 'Review KPIs',
    summary: 'Command center and portfolio performance.',
    completionCriteria: 'KPI snapshot reviewed for the period.',
    steps: [
      {
        id: 'cockpit',
        label: 'Command center',
        description: 'Cross-cutting health.',
        href: '/terminal/cockpit',
      },
      {
        id: 'portfolio',
        label: 'Portfolio',
        description: 'Product portfolio outcomes.',
        href: '/terminal/portfolio',
      },
      {
        id: 'cash',
        label: 'Cash flow',
        description: 'Cash required and exposure.',
        href: '/terminal/cashflow',
      },
    ],
  },
  exec_risk_review: {
    id: 'exec_risk_review',
    persona: 'executive',
    label: 'Review risks',
    summary: 'Policy, blockers, control tower.',
    completionCriteria: 'Critical blockers acknowledged or assigned.',
    steps: [
      {
        id: 'tower',
        label: 'Control tower',
        description: 'Risk and ops exceptions.',
        href: '/terminal/control-tower',
      },
      {
        id: 'tasks',
        label: 'Critical blockers',
        description: 'Process tasks at critical priority.',
        href: '/terminal/tasks',
      },
    ],
  },
  exec_approvals: {
    id: 'exec_approvals',
    persona: 'executive',
    label: 'Review approvals',
    summary: 'Consequential decisions awaiting human gate.',
    completionCriteria: 'Pending approvals decided or delegated.',
    steps: [
      {
        id: 'approvals',
        label: 'Approval queue',
        description: 'List and decide.',
        href: '/terminal/approvals',
      },
    ],
  },
  exec_finance: {
    id: 'exec_finance',
    persona: 'executive',
    label: 'Financial health',
    summary: 'SaaS billing + channel finance posture (not investment custody).',
    completionCriteria: 'Billing and channel finance status known.',
    steps: [
      {
        id: 'billing',
        label: 'SaaS subscription',
        description: 'Plan and invoices.',
        href: '/app/billing',
      },
      {
        id: 'channel',
        label: 'Channel finance',
        description: 'Payments & reconciliation summary.',
        href: '/terminal/finance/reconciliation',
      },
    ],
  },
  analyst_signals: {
    id: 'analyst_signals',
    persona: 'analyst',
    label: 'Signal intelligence',
    summary: 'Commerce signals and opportunity movement.',
    completionCriteria: 'Active signals reviewed.',
    steps: [
      {
        id: 'signals',
        label: 'Signals feed',
        description: 'Latest commerce signals.',
        href: '/terminal/signals',
      },
      {
        id: 'opps',
        label: 'Opportunities',
        description: 'Scored book.',
        href: '/terminal/opportunities',
      },
    ],
  },
  analyst_portfolio: {
    id: 'analyst_portfolio',
    persona: 'analyst',
    label: 'Portfolio & customers',
    summary: 'Composition, demand, customer patterns.',
    completionCriteria: 'Portfolio and customer views reviewed.',
    steps: [
      {
        id: 'portfolio',
        label: 'Portfolio',
        href: '/terminal/portfolio',
        description: 'Holdings and performance.',
      },
      {
        id: 'customers',
        label: 'Customers',
        href: '/terminal/customers',
        description: 'Customer intelligence.',
      },
      {
        id: 'watch',
        label: 'Watchlist',
        href: '/terminal/watchlist',
        description: 'Tracked candidates.',
      },
    ],
  },
  analyst_learn: {
    id: 'analyst_learn',
    persona: 'analyst',
    label: 'Learn from outcomes',
    summary: 'Prediction outcomes and process learning stage.',
    completionCriteria: 'Outcomes reviewed for model feedback.',
    steps: [
      {
        id: 'process',
        label: 'Process learn stage',
        href: '/terminal/process',
        commerceStage: 'learn',
        description: 'Cases in learn/reconcile.',
      },
      {
        id: 'ai',
        label: 'AI analysis',
        href: '/terminal/ai',
        description: 'Read-only outcome analysis.',
        aiTools: ['evaluatePredictionOutcome'],
      },
    ],
  },
  dev_connectors: {
    id: 'dev_connectors',
    persona: 'developer',
    label: 'Inspect connectors',
    summary: 'Hub health, capabilities, partner graph.',
    completionCriteria: 'Connector statuses known; fixtures labeled.',
    steps: [
      {
        id: 'hub',
        label: 'Connector hub',
        href: '/terminal/connectors',
        description: 'Installs and readiness.',
        aiTools: ['listConnectorCapabilities'],
      },
      {
        id: 'ecosystem',
        label: 'Partner & graph',
        href: '/terminal/ecosystem',
        description: 'Capability board and knowledge graph.',
      },
    ],
  },
  dev_workflows: {
    id: 'dev_workflows',
    persona: 'developer',
    label: 'Workflows & automation',
    summary: 'Automation engine and execution history.',
    completionCriteria: 'Failed workflows triaged.',
    steps: [
      {
        id: 'automations',
        label: 'Workflows',
        href: '/terminal/automations',
        description: 'Automation definitions.',
      },
      {
        id: 'objectives',
        label: 'Execution history',
        href: '/terminal/objectives',
        description: 'Operator/workflow runs.',
      },
    ],
  },
  dev_diagnostics: {
    id: 'dev_diagnostics',
    persona: 'developer',
    label: 'Diagnostics & examples',
    summary: 'Live examples, system status, repair loops.',
    completionCriteria: 'Diagnostics green or issues ticketed.',
    steps: [
      {
        id: 'examples',
        label: 'Live examples',
        href: '/terminal/live-examples',
        description: 'Honest fixture vs live demos.',
      },
      {
        id: 'status',
        label: 'Capability status',
        href: '/status',
        description: 'Public capability matrix.',
      },
      {
        id: 'system',
        label: 'System',
        href: '/app',
        description: 'Release readiness and system surface.',
      },
    ],
  },
  admin_org: {
    id: 'admin_org',
    persona: 'administrator',
    label: 'Manage organization',
    summary: 'Org profile, segment, onboarding.',
    completionCriteria: 'Org onboarding complete or step known.',
    steps: [
      {
        id: 'onboarding',
        label: 'Onboarding',
        href: '/onboarding',
        description: 'Segment and setup.',
      },
      {
        id: 'agency',
        label: 'Agency clients',
        href: '/terminal/agency',
        description: 'Multi-client (agency segment).',
      },
    ],
  },
  admin_access: {
    id: 'admin_access',
    persona: 'administrator',
    label: 'Access & audit',
    summary: 'Roles, persona assignment, audit surfaces.',
    completionCriteria: 'Access model understood; persona set per user.',
    steps: [
      {
        id: 'workspace',
        label: 'Workspace switcher',
        href: '/terminal/workspace',
        description: 'Set operating persona.',
      },
      {
        id: 'system',
        label: 'System & audit',
        href: '/app',
        description: 'System controls.',
      },
    ],
  },
  admin_billing: {
    id: 'admin_billing',
    persona: 'administrator',
    label: 'SaaS billing',
    summary: 'Subscription, plans, usage quotas.',
    completionCriteria: 'Billing account status current.',
    steps: [
      {
        id: 'billing',
        label: 'Billing',
        href: '/app/billing',
        description: 'Stripe SaaS billing only.',
        aiTools: ['getBillingStatus', 'createBillingCheckout', 'openBillingPortal'],
      },
      {
        id: 'plans',
        label: 'Platform plans',
        href: '/platform/plans',
        description: 'Plan catalog.',
      },
    ],
  },
};

// --- Route ownership / consolidation inventory ---
// Page categories: workspace | business process | Commerce Case | settings | connector | admin
// Orphans should be merged, redirected, or AI-only.

export const ROUTE_OWNERSHIP: RouteOwnership[] = [
  // Public marketing — not persona workspace
  { path: '/', primaryPersona: 'executive', kind: 'resource', orphan: true },
  { path: '/product', primaryPersona: 'executive', kind: 'resource', orphan: true },
  { path: '/pricing', primaryPersona: 'administrator', kind: 'resource', orphan: true },
  { path: '/login', primaryPersona: 'administrator', kind: 'admin', orphan: true },
  { path: '/register', primaryPersona: 'administrator', kind: 'admin', orphan: true },
  { path: '/signup', primaryPersona: 'administrator', kind: 'admin', orphan: true, redirectTo: '/register' },
  { path: '/scanner', primaryPersona: 'researcher', kind: 'procedure_step', redirectTo: '/terminal' },
  { path: '/terminal/pipeline', primaryPersona: 'operator', kind: 'procedure_step', redirectTo: '/terminal/process' },
  // Capital/network — executive admin only, not default ops chrome
  { path: '/capital', primaryPersona: 'executive', kind: 'admin', orphan: true },
  { path: '/network', primaryPersona: 'executive', kind: 'admin', orphan: true },
  // Workspaces
  { path: '/terminal/workspace', primaryPersona: 'administrator', kind: 'procedure_hub' },
  { path: '/terminal/workspace/executive', primaryPersona: 'executive', kind: 'procedure_hub' },
  { path: '/terminal/workspace/operator', primaryPersona: 'operator', kind: 'procedure_hub' },
  { path: '/terminal/workspace/researcher', primaryPersona: 'researcher', kind: 'procedure_hub' },
  { path: '/terminal/workspace/analyst', primaryPersona: 'analyst', kind: 'procedure_hub' },
  { path: '/terminal/workspace/developer', primaryPersona: 'developer', kind: 'procedure_hub' },
  { path: '/terminal/workspace/administrator', primaryPersona: 'administrator', kind: 'procedure_hub' },
  // Business process / Commerce Cases
  { path: '/terminal/process', primaryPersona: 'operator', secondaryPersonas: ['researcher', 'analyst', 'executive'], kind: 'procedure_hub' },
  { path: '/terminal/tasks', primaryPersona: 'operator', secondaryPersonas: ['executive', 'researcher'], kind: 'procedure_step' },
  { path: '/terminal', primaryPersona: 'researcher', secondaryPersonas: ['operator', 'analyst'], procedureId: 'research_discover', kind: 'procedure_step' },
  { path: '/terminal/opportunities', primaryPersona: 'researcher', secondaryPersonas: ['analyst'], kind: 'procedure_step' },
  { path: '/terminal/listings', primaryPersona: 'operator', kind: 'procedure_step' },
  { path: '/terminal/orders', primaryPersona: 'operator', kind: 'procedure_step' },
  { path: '/terminal/fulfillment', primaryPersona: 'operator', kind: 'procedure_step' },
  { path: '/terminal/approvals', primaryPersona: 'executive', secondaryPersonas: ['operator'], kind: 'procedure_step' },
  { path: '/terminal/watchlist', primaryPersona: 'researcher', secondaryPersonas: ['analyst'], kind: 'procedure_step' },
  { path: '/terminal/signals', primaryPersona: 'analyst', kind: 'procedure_step' },
  { path: '/terminal/portfolio', primaryPersona: 'executive', secondaryPersonas: ['analyst'], kind: 'resource' },
  { path: '/terminal/cashflow', primaryPersona: 'executive', kind: 'resource' },
  { path: '/terminal/customers', primaryPersona: 'analyst', kind: 'resource' },
  { path: '/terminal/control-tower', primaryPersona: 'executive', kind: 'resource' },
  { path: '/terminal/cockpit', primaryPersona: 'executive', kind: 'resource', redirectTo: '/terminal/workspace/executive' },
  { path: '/terminal/finance/payments', primaryPersona: 'operator', kind: 'procedure_step' },
  { path: '/terminal/finance/payouts', primaryPersona: 'operator', kind: 'procedure_step' },
  { path: '/terminal/finance/reconciliation', primaryPersona: 'operator', secondaryPersonas: ['executive'], kind: 'procedure_step' },
  { path: '/terminal/finance/disputes', primaryPersona: 'operator', kind: 'procedure_step' },
  // AI / objectives
  { path: '/terminal/ai', primaryPersona: 'operator', secondaryPersonas: OPERATING_PERSONAS.slice(), kind: 'resource' },
  { path: '/terminal/objectives', primaryPersona: 'executive', secondaryPersonas: OPERATING_PERSONAS.slice(), kind: 'resource' },
  { path: '/terminal/live-examples', primaryPersona: 'developer', kind: 'dev_utility' },
  // Connectors / runtime
  { path: '/terminal/connectors', primaryPersona: 'developer', kind: 'procedure_step' },
  { path: '/terminal/ecosystem', primaryPersona: 'developer', kind: 'resource' },
  { path: '/terminal/automations', primaryPersona: 'developer', kind: 'procedure_step' },
  // Admin / settings
  { path: '/app/billing', primaryPersona: 'administrator', secondaryPersonas: ['executive'], kind: 'admin' },
  { path: '/app', primaryPersona: 'administrator', kind: 'admin' },
  { path: '/onboarding', primaryPersona: 'administrator', kind: 'admin' },
  { path: '/terminal/agency', primaryPersona: 'administrator', kind: 'admin' },
  { path: '/platform/plans', primaryPersona: 'administrator', kind: 'admin' },
  { path: '/status', primaryPersona: 'developer', kind: 'dev_utility' },
  // Product twin (Commerce Case context)
  { path: '/terminal/products', primaryPersona: 'researcher', secondaryPersonas: ['operator'], kind: 'procedure_step' },
];

/** Map stored (incl. legacy) persona → primary operating persona. */
export function resolveOperatingPersona(
  stored: string | null | undefined,
  opts?: { founderDirect?: boolean; systemRole?: string },
): OperatingPersona {
  if (opts?.founderDirect && !stored) return 'researcher';
  const key = (stored ?? 'founder').toLowerCase();
  switch (key) {
    case 'executive':
      return 'executive';
    case 'operator':
      return 'operator';
    case 'researcher':
      return 'researcher';
    case 'analyst':
      return 'analyst';
    case 'developer':
      return 'developer';
    case 'administrator':
      return 'administrator';
    case 'founder':
      return 'researcher'; // founders land in discovery loop by default
    case 'procurement':
      return 'operator';
    case 'finance':
      return 'executive';
    case 'agency':
      return 'administrator';
    case 'auditor':
      return 'executive';
    default:
      if (opts?.systemRole === 'admin' || opts?.systemRole === 'owner') return 'administrator';
      return 'operator';
  }
}

export function proceduresForPersona(persona: OperatingPersona): OperatingProcedure[] {
  const def = PERSONA_DEFINITIONS[persona];
  const out: OperatingProcedure[] = [];
  for (const id of def.procedures) {
    const p = PROCEDURES[id];
    if (p) out.push(p);
  }
  return out;
}

/**
 * Persona-specific primary destinations (lean — max ~6 + home + AI).
 * Everything else is contextual / AI-searchable, not permanent chrome.
 */
const PERSONA_PRIMARY_NAV: Record<
  OperatingPersona,
  Array<{ id: string; href: string; label: string; kind?: NavKind }>
> = {
  executive: [
    { id: 'brief', href: '/terminal/workspace/executive', label: 'Executive Brief', kind: 'procedure_hub' },
    { id: 'objectives', href: '/terminal/objectives', label: 'Objectives', kind: 'resource' },
    { id: 'decisions', href: '/terminal/approvals', label: 'Decisions', kind: 'procedure_step' },
    { id: 'revenue', href: '/terminal/portfolio', label: 'Revenue', kind: 'resource' },
    { id: 'ai', href: '/terminal/ai', label: 'AI Advisor', kind: 'resource' },
  ],
  operator: [
    { id: 'home', href: '/terminal/workspace/operator', label: 'Operator home', kind: 'procedure_hub' },
    { id: 'tasks', href: '/terminal/tasks', label: 'Tasks', kind: 'resource' },
    { id: 'orders', href: '/terminal/orders', label: 'Orders', kind: 'procedure_step' },
    { id: 'process', href: '/terminal/process', label: 'Cases', kind: 'procedure_hub' },
    { id: 'fulfill', href: '/terminal/fulfillment', label: 'Shipments', kind: 'procedure_step' },
    { id: 'ai', href: '/terminal/ai', label: 'AI Operator', kind: 'resource' },
  ],
  researcher: [
    { id: 'home', href: '/terminal/workspace/researcher', label: 'Research home', kind: 'procedure_hub' },
    { id: 'discover', href: '/terminal', label: 'Product Discovery', kind: 'procedure_step' },
    { id: 'opps', href: '/terminal/opportunities', label: 'Opportunities', kind: 'procedure_step' },
    { id: 'process', href: '/terminal/process', label: 'Cases', kind: 'procedure_hub' },
    { id: 'ai', href: '/terminal/ai', label: 'AI Research', kind: 'resource' },
  ],
  analyst: [
    { id: 'home', href: '/terminal/workspace/analyst', label: 'Analyst home', kind: 'procedure_hub' },
    { id: 'signals', href: '/terminal/signals', label: 'Signals', kind: 'procedure_step' },
    { id: 'portfolio', href: '/terminal/portfolio', label: 'Portfolio', kind: 'resource' },
    { id: 'customers', href: '/terminal/customers', label: 'Customers', kind: 'resource' },
    { id: 'ai', href: '/terminal/ai', label: 'AI Analyst', kind: 'resource' },
  ],
  developer: [
    { id: 'home', href: '/terminal/workspace/developer', label: 'Developer home', kind: 'procedure_hub' },
    { id: 'connectors', href: '/terminal/connectors', label: 'Connectors', kind: 'procedure_step' },
    { id: 'runtime', href: '/terminal/ecosystem', label: 'Runtime', kind: 'resource' },
    { id: 'automations', href: '/terminal/automations', label: 'Automations', kind: 'procedure_step' },
    { id: 'ai', href: '/terminal/ai', label: 'AI Tools', kind: 'resource' },
  ],
  administrator: [
    { id: 'home', href: '/terminal/workspace/administrator', label: 'Admin home', kind: 'procedure_hub' },
    { id: 'workspace', href: '/terminal/workspace', label: 'Personas', kind: 'admin' },
    { id: 'billing', href: '/app/billing', label: 'Billing', kind: 'admin' },
    { id: 'system', href: '/app', label: 'System', kind: 'admin' },
    { id: 'ai', href: '/terminal/ai', label: 'AI Admin', kind: 'resource' },
  ],
};

/** Secondary destinations — collapsed under "More", not always competing for attention */
const PERSONA_MORE_NAV: Record<
  OperatingPersona,
  Array<{ id: string; href: string; label: string; kind?: NavKind }>
> = {
  executive: [
    { id: 'industrial', href: '/terminal/industrial', label: 'Industrial OS' },
    { id: 'process', href: '/terminal/process', label: 'Process cases' },
    { id: 'tasks', href: '/terminal/tasks', label: 'All tasks' },
    { id: 'cash', href: '/terminal/cashflow', label: 'Cash flow' },
    { id: 'tower', href: '/terminal/control-tower', label: 'Control tower' },
    { id: 'finance', href: '/terminal/finance/reconciliation', label: 'Channel finance' },
    { id: 'switch', href: '/terminal/workspace?switch=1', label: 'Switch persona', kind: 'admin' },
  ],
  operator: [
    { id: 'industrial', href: '/terminal/industrial', label: 'Industrial OS' },
    { id: 'procure', href: '/terminal/industrial/procurement', label: 'Procurement' },
    { id: 'listings', href: '/terminal/listings', label: 'Listings' },
    { id: 'approvals', href: '/terminal/approvals', label: 'Approvals' },
    { id: 'payments', href: '/terminal/finance/payments', label: 'Payments' },
    { id: 'discover', href: '/terminal', label: 'Discover' },
    { id: 'objectives', href: '/terminal/objectives', label: 'Objectives' },
    { id: 'switch', href: '/terminal/workspace?switch=1', label: 'Switch persona', kind: 'admin' },
  ],
  researcher: [
    { id: 'industrial', href: '/terminal/industrial/products', label: 'Industrial catalog' },
    { id: 'watchlist', href: '/terminal/watchlist', label: 'Watchlist' },
    { id: 'tasks', href: '/terminal/tasks', label: 'Tasks' },
    { id: 'objectives', href: '/terminal/objectives', label: 'Objectives' },
    { id: 'live-examples', href: '/terminal/live-examples', label: 'Live examples' },
    { id: 'switch', href: '/terminal/workspace?switch=1', label: 'Switch persona', kind: 'admin' },
  ],
  analyst: [
    { id: 'twin', href: '/terminal/industrial/twin', label: 'Digital twin' },
    { id: 'opps', href: '/terminal/opportunities', label: 'Opportunities' },
    { id: 'watch', href: '/terminal/watchlist', label: 'Watchlist' },
    { id: 'process', href: '/terminal/process', label: 'Process / learn' },
    { id: 'objectives', href: '/terminal/objectives', label: 'Objectives' },
    { id: 'switch', href: '/terminal/workspace?switch=1', label: 'Switch persona', kind: 'admin' },
  ],
  developer: [
    { id: 'industrial', href: '/terminal/industrial', label: 'Industrial OS' },
    { id: 'integrations', href: '/terminal/integrations', label: 'Integration hub' },
    { id: 'objectives', href: '/terminal/objectives', label: 'Execution history' },
    { id: 'examples', href: '/terminal/live-examples', label: 'Live examples' },
    { id: 'process', href: '/terminal/process', label: 'Process cases' },
    { id: 'status', href: '/status', label: 'Capability status' },
    { id: 'switch', href: '/terminal/workspace?switch=1', label: 'Switch persona', kind: 'admin' },
  ],
  administrator: [
    { id: 'industrial', href: '/terminal/industrial', label: 'Industrial OS' },
    { id: 'agency', href: '/terminal/agency', label: 'Agency clients' },
    { id: 'onboarding', href: '/onboarding', label: 'Onboarding' },
    { id: 'plans', href: '/platform/plans', label: 'Plans' },
    { id: 'connectors', href: '/terminal/connectors', label: 'Connectors' },
    { id: 'integrations', href: '/terminal/integrations', label: 'Integration hub' },
    { id: 'switch', href: '/terminal/workspace?switch=1', label: 'All personas', kind: 'admin' },
  ],
};

/** Shared Operate hubs — always visible (not persona-hidden). */
export const SHARED_OPERATE_NAV: Array<{
  id: string;
  href: string;
  label: string;
  kind?: NavKind;
}> = [
  { id: 'discover', href: '/terminal', label: 'Discover', kind: 'procedure_step' },
  { id: 'cases', href: '/terminal/process', label: 'Cases', kind: 'procedure_hub' },
  { id: 'tasks', href: '/terminal/tasks', label: 'Tasks', kind: 'resource' },
  { id: 'orders', href: '/terminal/orders', label: 'Orders', kind: 'procedure_step' },
  { id: 'approvals', href: '/terminal/approvals', label: 'Approvals', kind: 'procedure_step' },
  { id: 'opportunities', href: '/terminal/opportunities', label: 'Opportunities', kind: 'procedure_step' },
  { id: 'fulfillment', href: '/terminal/fulfillment', label: 'Fulfillment', kind: 'procedure_step' },
];

/** Shared Platform hubs — always visible. */
export const SHARED_PLATFORM_NAV: Array<{
  id: string;
  href: string;
  label: string;
  kind?: NavKind;
}> = [
  { id: 'ops', href: '/terminal/ops', label: 'Ops Center', kind: 'admin' },
  { id: 'connectors', href: '/terminal/connectors', label: 'Connectors', kind: 'procedure_step' },
  { id: 'ecosystem', href: '/terminal/ecosystem', label: 'Ecosystem', kind: 'resource' },
  { id: 'automations', href: '/terminal/automations', label: 'Automations', kind: 'procedure_step' },
  { id: 'system', href: '/app', label: 'System', kind: 'admin' },
  { id: 'billing', href: '/app/billing', label: 'Billing', kind: 'admin' },
  { id: 'status', href: '/status', label: 'Capability status', kind: 'admin' },
];

function hrefKey(href: string): string {
  // Normalize for dedupe (ignore query string)
  const q = href.indexOf('?');
  return q >= 0 ? href.slice(0, q) : href;
}

function applyNavBadges(
  item: WorkspaceNavItem,
  options?: {
    pendingApprovals?: number;
    openTasks?: number;
    openBlockers?: number;
    connectorIssues?: number;
    activeCaseCount?: number;
  },
): WorkspaceNavItem {
  if (item.id === 'tasks' || item.id === 'home') {
    if (options?.openTasks) item.badge = String(options.openTasks);
  }
  if (item.id === 'decisions' || item.id === 'approvals') {
    if (options?.pendingApprovals) item.badge = String(options.pendingApprovals);
  }
  if (item.id === 'process' || item.id === 'cases' || item.href === '/terminal/process') {
    if (options?.openBlockers) item.badge = String(options.openBlockers);
    else if (options?.activeCaseCount) item.badge = String(options.activeCaseCount);
  }
  if ((item.id === 'connectors' || item.href === '/terminal/connectors') && options?.connectorIssues) {
    item.badge = String(options.connectorIssues);
    item.status = 'credential_blocked';
  }
  if (item.id === 'ai' || item.href === '/terminal/ai') {
    item.status = 'approval_controlled';
  }
  return item;
}

/**
 * Build dynamic sidebar — hybrid IA:
 * Focus (persona) · Operate (shared) · Platform (shared) · More (collapsed).
 * Principle: One user · One workspace · One objective · One AI — without hiding the OS.
 */
export function buildPersonaNav(
  persona: OperatingPersona,
  options?: {
    pendingApprovals?: number;
    openTasks?: number;
    openBlockers?: number;
    connectorIssues?: number;
    activeCaseCount?: number;
  },
): WorkspaceNavGroup[] {
  const primary = PERSONA_PRIMARY_NAV[persona].map((item) =>
    applyNavBadges(
      {
        id: item.id,
        href: item.href,
        label: item.label,
        kind: item.kind ?? 'resource',
        status: 'operational',
      },
      options,
    ),
  );

  const focusHrefs = new Set(primary.map((i) => hrefKey(i.href)));

  const operate = SHARED_OPERATE_NAV.filter((item) => !focusHrefs.has(hrefKey(item.href))).map(
    (item) =>
      applyNavBadges(
        {
          id: `op-${item.id}`,
          href: item.href,
          label: item.label,
          kind: item.kind ?? 'resource',
          status: 'operational',
        },
        options,
      ),
  );

  const usedHrefs = new Set([...focusHrefs, ...operate.map((i) => hrefKey(i.href))]);

  const platform = SHARED_PLATFORM_NAV.filter((item) => !usedHrefs.has(hrefKey(item.href))).map(
    (item) =>
      applyNavBadges(
        {
          id: `pl-${item.id}`,
          href: item.href,
          label: item.label,
          kind: item.kind ?? 'admin',
          status: 'operational',
        },
        options,
      ),
  );

  for (const i of platform) usedHrefs.add(hrefKey(i.href));

  const more: WorkspaceNavItem[] = PERSONA_MORE_NAV[persona]
    .filter((item) => !usedHrefs.has(hrefKey(item.href)))
    .map((item) => ({
      id: item.id,
      href: item.href,
      label: item.label,
      kind: item.kind ?? 'resource',
      status: 'operational' as const,
    }));

  // Procedure deep-links only under More
  const def = PERSONA_DEFINITIONS[persona];
  for (const p of proceduresForPersona(persona)) {
    more.push({
      id: `proc-${p.id}`,
      href: `${def.homeHref}?procedure=${p.id}`,
      label: p.label,
      kind: 'procedure_hub',
      procedureId: p.id,
      status: 'operational',
    });
  }

  return [
    { id: 'focus', label: 'Focus', items: primary },
    { id: 'operate', label: 'Operate', items: operate },
    { id: 'platform', label: 'Platform', items: platform },
    { id: 'more', label: 'More', items: more },
  ];
}

/**
 * Offline / API-down catalog — same hybrid shape as buildPersonaNav.
 * Used by web shell when GET /workspace fails so the product never collapses to 4 links.
 */
export function buildFallbackNav(persona: OperatingPersona = 'researcher'): WorkspaceNavGroup[] {
  return buildPersonaNav(persona);
}

/** Flat destination catalog for command palette / search (all personas union, unique hrefs). */
export function listTerminalDestinations(): Array<{
  id: string;
  label: string;
  href: string;
  group: string;
}> {
  const seen = new Set<string>();
  const out: Array<{ id: string; label: string; href: string; group: string }> = [];
  const push = (group: string, id: string, label: string, href: string) => {
    const k = hrefKey(href);
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ id, label, href, group });
  };
  for (const item of SHARED_OPERATE_NAV) {
    push('Operate', item.id, item.label, item.href);
  }
  for (const item of SHARED_PLATFORM_NAV) {
    push('Platform', item.id, item.label, item.href);
  }
  for (const persona of OPERATING_PERSONAS) {
    for (const item of PERSONA_PRIMARY_NAV[persona]) {
      push('Focus', `${persona}-${item.id}`, item.label, item.href);
    }
    for (const item of PERSONA_MORE_NAV[persona]) {
      push('More', `${persona}-${item.id}`, item.label, item.href);
    }
  }
  push('Automate', 'ai', 'AI Operator', '/terminal/ai');
  push('Govern', 'workspace', 'Switch persona', '/terminal/workspace');
  return out;
}

/** AI tools allowed for persona (union of procedure step tools + safe reads). */
export function aiToolsForPersona(persona: OperatingPersona): string[] {
  const set = new Set<string>(['listConnectorCapabilities', 'searchConnectedProducts']);
  for (const p of proceduresForPersona(persona)) {
    for (const s of p.steps) {
      for (const t of s.aiTools ?? []) set.add(t);
    }
  }
  // Persona-specific expansions
  if (persona === 'executive') {
    set.add('getBillingStatus');
    set.add('inspectPayout');
  }
  if (persona === 'administrator') {
    set.add('getBillingStatus');
    set.add('createBillingCheckout');
    set.add('openBillingPortal');
  }
  if (persona === 'operator') {
    set.add('draftListing');
    set.add('reconcilePayout');
    set.add('prepareRefundAction');
  }
  return [...set];
}

export type WorkspaceResolveInput = {
  storedPersona?: string | null;
  systemRole?: string | null;
  founderDirect?: boolean;
  organizationId: string;
  organizationName?: string;
  userId?: string | null;
  userEmail?: string | null;
  pendingApprovals?: number;
  openTasks?: number;
  openBlockers?: number;
  activeCaseCount?: number;
  connectorIssues?: number;
  availableConnectors?: Array<{ providerKey: string; status: string; isFixture?: boolean }>;
  currentObjective?: string | null;
  activeCases?: Array<{
    caseId: string;
    productId: string;
    productTitle?: string;
    currentStage: string;
    stageStatus: string;
    nextActionLabel?: string | null;
  }>;
  /** Live intelligence inputs (optional — richer when host loads full signal set) */
  intelligence?: {
    productCount?: number;
    fixtureProductCount?: number;
    liveProductCount?: number;
    openOrderCount?: number;
    stalledCaseCount?: number;
    highOpportunityCount?: number;
    topOpportunityScore?: number | null;
    liveConnectorCount?: number;
    recentObjectiveCount?: number;
    failedRunCount?: number;
    signalBuyCount?: number;
    signalBlockedCount?: number;
    simulationMode?: boolean;
  };
};

/** Priority row on persona home */
export type WorkspacePriority = {
  id: string;
  label: string;
  href: string;
  urgency: 'critical' | 'high' | 'normal';
  reason: string;
};

/** Active objective card (max 3–5 on home) */
export type WorkspaceActiveObjective = {
  id: string;
  title: string;
  href: string;
  status: string;
  kind: 'procedure' | 'case' | 'approval' | 'system';
};

export type WorkspaceKpi = {
  id: string;
  label: string;
  value: string | number;
  href?: string;
  tone?: 'neutral' | 'positive' | 'warning' | 'critical';
};

export type WorkspaceAlert = {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  href?: string;
};

/** Focused home surface — not a feature dump */
export type WorkspaceSurface = {
  principles: string[];
  todaysPriorities: WorkspacePriority[];
  aiBriefing: string;
  activeObjectives: WorkspaceActiveObjective[];
  recommendedActions: Array<{ label: string; href: string; reason: string }>;
  keyKpis: WorkspaceKpi[];
  alerts: WorkspaceAlert[];
  everythingElseHint: string;
  /** Smart system fields */
  attentionScore?: number;
  healthLabel?: string;
  focusObjective?: string;
  insights?: Array<{
    id: string;
    kind: string;
    title: string;
    detail: string;
    urgencyScore: number;
    confidence: number;
    href: string;
    suggestedObjective: string;
    suggestedAiQuery?: string;
  }>;
};

export type ResolvedWorkspace = {
  persona: OperatingPersona;
  personaLabel: string;
  mission: string;
  homeHref: string;
  defaultObjective: string;
  currentObjective: string;
  nav: WorkspaceNavGroup[];
  procedures: Array<
    OperatingProcedure & {
      progress: { total: number; completedHint: number };
      activeStepId: string | null;
    }
  >;
  allowedAiTools: string[];
  organizationId: string;
  organizationName?: string;
  userId?: string | null;
  userEmail?: string | null;
  pendingApprovals: number;
  openTasks: number;
  openBlockers: number;
  activeCaseCount: number;
  recommendedNextAction: {
    label: string;
    href: string;
    procedureId?: string;
    reason: string;
  } | null;
  availableConnectors: Array<{ providerKey: string; status: string; isFixture?: boolean }>;
  activeCases: WorkspaceResolveInput['activeCases'];
  aiContextPreamble: string;
  allPersonas: Array<{ id: OperatingPersona; label: string; homeHref: string }>;
  /** Focused home content */
  surface: WorkspaceSurface;
  /** Principle slogan for UI chrome */
  operatingPrinciple: string;
  /** Full intelligence brief */
  intelligence?: IntelligenceBrief;
};

/**
 * Pure Workspace Resolver — API loads counts then calls this.
 * Login → persona → objective → cases → connectors → intelligence → nav → AI → surface.
 */
export function resolveWorkspace(input: WorkspaceResolveInput): ResolvedWorkspace {
  const persona = resolveOperatingPersona(input.storedPersona, {
    founderDirect: input.founderDirect,
    systemRole: input.systemRole ?? undefined,
  });
  const def = PERSONA_DEFINITIONS[persona];
  const nav = buildPersonaNav(persona, {
    pendingApprovals: input.pendingApprovals,
    openTasks: input.openTasks,
    openBlockers: input.openBlockers,
    connectorIssues: input.connectorIssues,
    activeCaseCount: input.activeCaseCount,
  });
  const procedures = proceduresForPersona(persona).map((p) => ({
    ...p,
    progress: {
      total: p.steps.length,
      completedHint: 0,
    },
    activeStepId: p.steps[0]?.id ?? null,
  }));

  const liveConnectors =
    input.intelligence?.liveConnectorCount ??
    (input.availableConnectors ?? []).filter(
      (c) => !c.isFixture && /connected|sync/i.test(c.status),
    ).length;

  const intelligence = buildIntelligenceBrief({
    persona,
    organizationName: input.organizationName,
    pendingApprovals: input.pendingApprovals ?? 0,
    openTasks: input.openTasks ?? 0,
    openBlockers: input.openBlockers ?? 0,
    activeCaseCount: input.activeCaseCount ?? 0,
    connectorIssues: input.connectorIssues ?? 0,
    productCount: input.intelligence?.productCount ?? 0,
    fixtureProductCount: input.intelligence?.fixtureProductCount ?? 0,
    liveProductCount: input.intelligence?.liveProductCount ?? 0,
    openOrderCount: input.intelligence?.openOrderCount ?? 0,
    stalledCaseCount: input.intelligence?.stalledCaseCount ?? 0,
    highOpportunityCount: input.intelligence?.highOpportunityCount ?? 0,
    topOpportunityScore: input.intelligence?.topOpportunityScore ?? null,
    liveConnectorCount: liveConnectors,
    recentObjectiveCount: input.intelligence?.recentObjectiveCount ?? 0,
    failedRunCount: input.intelligence?.failedRunCount ?? 0,
    signalBuyCount: input.intelligence?.signalBuyCount ?? 0,
    signalBlockedCount: input.intelligence?.signalBlockedCount ?? 0,
    simulationMode: Boolean(input.intelligence?.simulationMode),
    caseHints: (input.activeCases ?? []).map((c) => ({
      caseId: c.caseId,
      title: c.productTitle ?? c.productId,
      stage: c.currentStage,
      status: c.stageStatus,
      nextAction: c.nextActionLabel,
    })),
  });

  // Smart next action = top insight, fallback to rule-based
  const smartNext = intelligence.topInsight
    ? {
        label: intelligence.topInsight.title,
        href: intelligence.topInsight.href,
        reason: `Intelligence · urgency ${intelligence.topInsight.urgencyScore}`,
      }
    : recommendNext(persona, input);

  const recommendedNextAction = smartNext;
  const currentObjective =
    input.currentObjective?.trim() ||
    intelligence.focusObjective ||
    def.defaultObjective;
  const allowedAiTools = aiToolsForPersona(persona);
  const surface = buildWorkspaceSurface(
    persona,
    input,
    recommendedNextAction,
    currentObjective,
    intelligence,
  );

  const topInsights = intelligence.insights
    .slice(0, 5)
    .map((i) => `• [${i.urgencyScore}] ${i.title}: ${i.detail}`)
    .join('\n');

  const aiContextPreamble = [
    `You are the single intelligent AI for the ${def.label} workspace (One User · One Workspace · One Objective · One AI).`,
    `Mission: ${def.mission}`,
    `Organization: ${input.organizationName ?? input.organizationId}`,
    input.userEmail ? `User: ${input.userEmail}` : null,
    `Health: ${intelligence.healthLabel} · attention score ${intelligence.attentionScore}/100.`,
    `Open tasks: ${input.openTasks ?? 0}; blockers: ${input.openBlockers ?? 0}; pending approvals: ${input.pendingApprovals ?? 0}; active cases: ${input.activeCaseCount ?? 0}; live connectors: ${liveConnectors}.`,
    `Allowed tools for this persona: ${allowedAiTools.join(', ')}.`,
    `Primary navigation is limited to Focus items. Route users via AI search for everything else.`,
    `Recommend only actions relevant to ${def.label}. Cite live evidence. Do not invent investment/custody features or fabricated KPIs.`,
    recommendedNextAction
      ? `Recommended next action: ${recommendedNextAction.label} → ${recommendedNextAction.href} (${recommendedNextAction.reason})`
      : null,
    `Ranked operational insights:\n${topInsights}`,
    `AI briefing:\n${intelligence.narrative}`,
    `Focus objective (start here unless user overrides):\n${currentObjective}`,
    intelligence.learningHints.length
      ? `Learning hints: ${intelligence.learningHints.join(' ')}`
      : null,
  ]
    .filter(Boolean)
    .join('\n');

  return {
    persona,
    personaLabel: def.label,
    mission: def.mission,
    homeHref: def.homeHref,
    defaultObjective: def.defaultObjective,
    currentObjective,
    nav,
    procedures,
    allowedAiTools,
    organizationId: input.organizationId,
    organizationName: input.organizationName,
    userId: input.userId,
    userEmail: input.userEmail,
    pendingApprovals: input.pendingApprovals ?? 0,
    openTasks: input.openTasks ?? 0,
    openBlockers: input.openBlockers ?? 0,
    activeCaseCount: input.activeCaseCount ?? 0,
    recommendedNextAction,
    availableConnectors: input.availableConnectors ?? [],
    activeCases: input.activeCases ?? [],
    aiContextPreamble,
    allPersonas: OPERATING_PERSONAS.map((id) => ({
      id,
      label: PERSONA_DEFINITIONS[id].label,
      homeHref: PERSONA_DEFINITIONS[id].homeHref,
    })),
    surface,
    operatingPrinciple: 'One User · One Workspace · One Objective · One AI',
    intelligence,
  };
}

/**
 * Build focused home surface for a persona — driven by intelligence brief when present.
 */
export function buildWorkspaceSurface(
  persona: OperatingPersona,
  input: WorkspaceResolveInput,
  recommendedNextAction: ResolvedWorkspace['recommendedNextAction'],
  currentObjective: string,
  intelligence?: IntelligenceBrief,
): WorkspaceSurface {
  const def = PERSONA_DEFINITIONS[persona];

  // Prefer ranked intelligence insights as priorities
  const priorities: WorkspacePriority[] = intelligence
    ? insightsToPriorities(intelligence.insights)
    : [];

  if (priorities.length === 0) {
    if ((input.openBlockers ?? 0) > 0) {
      priorities.push({
        id: 'blockers',
        label: 'Resolve critical blockers',
        href: '/terminal/tasks',
        urgency: 'critical',
        reason: `${input.openBlockers} blockers`,
      });
    }
    if ((input.pendingApprovals ?? 0) > 0 && (persona === 'executive' || persona === 'operator')) {
      priorities.push({
        id: 'approvals',
        label: 'Decide pending approvals',
        href: '/terminal/approvals',
        urgency: 'high',
        reason: `${input.pendingApprovals} waiting`,
      });
    }
    if (priorities.length === 0) {
      const first = proceduresForPersona(persona)[0]?.steps[0];
      priorities.push({
        id: 'start',
        label: first?.label ?? 'Start primary procedure',
        href: first?.href ?? def.homeHref,
        urgency: 'normal',
        reason: 'No urgent exceptions — continue mission work',
      });
    }
  }

  const activeObjectives: WorkspaceActiveObjective[] = [
    {
      id: 'focus',
      title: (intelligence?.focusObjective ?? currentObjective).slice(0, 140),
      href: '/terminal/ai',
      status: intelligence?.healthLabel ?? 'active',
      kind: 'system',
    },
  ];
  for (const p of proceduresForPersona(persona).slice(0, 2)) {
    activeObjectives.push({
      id: p.id,
      title: p.label,
      href: `${def.homeHref}?procedure=${p.id}`,
      status: 'procedure',
      kind: 'procedure',
    });
  }
  for (const c of (input.activeCases ?? []).slice(0, 2)) {
    activeObjectives.push({
      id: c.caseId,
      title: c.productTitle ?? c.productId,
      href: `/terminal/process/${c.caseId}`,
      status: `${c.currentStage}/${c.stageStatus}`,
      kind: 'case',
    });
  }

  const keyKpis: WorkspaceKpi[] = intelligence
    ? intelligence.kpis.map((k) => ({
        id: k.id,
        label: k.label,
        value: k.value,
        href: k.href,
        tone: k.tone,
      }))
    : [
        {
          id: 'tasks',
          label: 'Open tasks',
          value: input.openTasks ?? 0,
          href: '/terminal/tasks',
          tone: (input.openTasks ?? 0) > 5 ? 'warning' : 'neutral',
        },
        {
          id: 'blockers',
          label: 'Blockers',
          value: input.openBlockers ?? 0,
          href: '/terminal/tasks',
          tone: (input.openBlockers ?? 0) > 0 ? 'critical' : 'positive',
        },
        {
          id: 'cases',
          label: 'Active cases',
          value: input.activeCaseCount ?? 0,
          href: '/terminal/process',
          tone: 'neutral',
        },
        {
          id: 'approvals',
          label: 'Approvals',
          value: input.pendingApprovals ?? 0,
          href: '/terminal/approvals',
          tone: (input.pendingApprovals ?? 0) > 0 ? 'warning' : 'neutral',
        },
      ];

  const alerts: WorkspaceAlert[] = (intelligence?.insights ?? [])
    .filter((i) => i.urgencyScore >= 40)
    .slice(0, 5)
    .map((i) => ({
      id: i.id,
      severity:
        i.urgencyScore >= 70 ? 'critical' : i.urgencyScore >= 45 ? 'warning' : 'info',
      message: i.title,
      href: i.href,
    }));
  if (alerts.length === 0) {
    alerts.push({
      id: 'a-ok',
      severity: 'info',
      message: intelligence?.narrative?.slice(0, 120) ?? 'No critical alerts',
    });
  }

  const recommendedActions =
    intelligence?.recommendedActions.slice(0, 5).map((a) => ({
      label: a.label,
      href: a.href,
      reason: a.reason,
    })) ?? [];
  if (recommendedNextAction && recommendedActions.length === 0) {
    recommendedActions.push({
      label: recommendedNextAction.label,
      href: recommendedNextAction.href,
      reason: recommendedNextAction.reason,
    });
  }

  return {
    principles: [
      'One User',
      'One Workspace',
      'One Objective',
      'One AI',
      'One Canonical Navigation Model',
    ],
    todaysPriorities: priorities.slice(0, 5),
    aiBriefing: intelligence?.narrative ?? currentObjective,
    activeObjectives: activeObjectives.slice(0, 5),
    recommendedActions: recommendedActions.slice(0, 5),
    keyKpis,
    alerts,
    everythingElseHint:
      'Ask AI or use search for capabilities outside Focus — the intelligence engine ranks what matters now.',
    attentionScore: intelligence?.attentionScore,
    healthLabel: intelligence?.healthLabel,
    focusObjective: intelligence?.focusObjective ?? currentObjective,
    insights: intelligence?.insights.slice(0, 8).map((i) => ({
      id: i.id,
      kind: i.kind,
      title: i.title,
      detail: i.detail,
      urgencyScore: i.urgencyScore,
      confidence: i.confidence,
      href: i.href,
      suggestedObjective: i.suggestedObjective,
      suggestedAiQuery: i.suggestedAiQuery,
    })),
  };
}

// ─── AI-first navigation ─────────────────────────────────────────────────────

export type AiNavigationIntent = {
  patterns: RegExp[];
  href: string;
  label: string;
  personas?: OperatingPersona[];
};

/** Natural-language → route map (AI primary discovery). */
export const AI_NAVIGATION_INTENTS: AiNavigationIntent[] = [
  {
    patterns: [/delay(ed)?\s+ship/i, /shipment/i, /fulfill/i, /tracking/i, /logistics/i],
    href: '/terminal/fulfillment',
    label: 'Shipments & fulfillment',
    personas: ['operator', 'executive'],
  },
  {
    patterns: [/compar(e|ing)\s+supplier/i, /supplier/i, /sourc(e|ing)/i, /moq/i],
    href: '/terminal',
    label: 'Product discovery / suppliers',
    personas: ['researcher', 'operator'],
  },
  {
    patterns: [/revenue/i, /portfolio/i, /kpi/i, /profit/i, /cash\s*flow/i],
    href: '/terminal/portfolio',
    label: 'Portfolio & revenue',
    personas: ['executive', 'analyst'],
  },
  {
    patterns: [/inventor/i, /stock\s+out/i, /atp/i],
    href: '/terminal/orders',
    label: 'Orders & inventory actions',
    personas: ['operator'],
  },
  {
    patterns: [/connector/i, /integrat/i, /oauth/i, /sync\s+health/i, /ops\s+center/i],
    href: '/terminal/connectors',
    label: 'Connectors & integrations',
    personas: ['developer', 'administrator'],
  },
  {
    patterns: [/approv/i, /decision/i, /pending\s+publish/i],
    href: '/terminal/approvals',
    label: 'Approvals',
    personas: ['executive', 'operator'],
  },
  {
    patterns: [/order/i, /customer\s+order/i],
    href: '/terminal/orders',
    label: 'Orders',
    personas: ['operator'],
  },
  {
    patterns: [/signal/i, /anomal/i],
    href: '/terminal/signals',
    label: 'Signals',
    personas: ['analyst', 'executive'],
  },
  {
    patterns: [/opportunit/i, /score/i, /margin/i],
    href: '/terminal/opportunities',
    label: 'Opportunities',
    personas: ['researcher', 'analyst'],
  },
  {
    patterns: [/commerce\s+case/i, /process\s+board/i, /lifecycle/i],
    href: '/terminal/process',
    label: 'Process / Commerce Cases',
  },
  {
    patterns: [/payment/i, /payout/i, /reconcil/i, /stripe/i],
    href: '/terminal/finance/reconciliation',
    label: 'Channel finance',
    personas: ['operator', 'executive'],
  },
  {
    patterns: [/objective/i, /execution\s+package/i, /ai\s+run/i],
    href: '/terminal/objectives',
    label: 'Objectives history',
  },
  {
    patterns: [/workspace|switch\s+persona|role/i],
    href: '/terminal/workspace',
    label: 'Switch persona workspace',
  },
];

/**
 * Resolve a natural-language request to a workspace route.
 * Used by AI and command bar — primary discovery layer.
 */
export function resolveAiNavigation(
  query: string,
  persona?: OperatingPersona | null,
): {
  matched: boolean;
  href: string;
  label: string;
  confidence: number;
  alternatives: Array<{ href: string; label: string }>;
  note: string;
} {
  const q = query.trim();
  if (!q) {
    return {
      matched: false,
      href: persona ? PERSONA_DEFINITIONS[persona].homeHref : '/terminal/workspace',
      label: 'Workspace home',
      confidence: 0,
      alternatives: [],
      note: 'Empty query — stay in workspace home',
    };
  }

  const hits: Array<{ href: string; label: string; score: number }> = [];
  for (const intent of AI_NAVIGATION_INTENTS) {
    if (intent.personas && persona && !intent.personas.includes(persona)) {
      // Still allow but lower score
    }
    for (const re of intent.patterns) {
      if (re.test(q)) {
        let score = 1;
        if (intent.personas?.includes(persona as OperatingPersona)) score += 0.5;
        hits.push({ href: intent.href, label: intent.label, score });
        break;
      }
    }
  }

  hits.sort((a, b) => b.score - a.score);
  const top = hits[0];
  if (!top) {
    const home = persona ? PERSONA_DEFINITIONS[persona].homeHref : '/terminal/ai';
    return {
      matched: false,
      href: home,
      label: 'AI / workspace home',
      confidence: 0.2,
      alternatives: [
        { href: '/terminal/ai', label: 'Ask AI Operator' },
        { href: '/terminal/process', label: 'Process board' },
      ],
      note: 'No direct route match — open AI with the query as objective',
    };
  }

  return {
    matched: true,
    href: top.href,
    label: top.label,
    confidence: Math.min(1, top.score / 1.5),
    alternatives: hits.slice(1, 4).map((h) => ({ href: h.href, label: h.label })),
    note: 'AI-first navigation — route matched from intent catalog',
  };
}

function recommendNext(
  persona: OperatingPersona,
  input: WorkspaceResolveInput,
): ResolvedWorkspace['recommendedNextAction'] {
  if ((input.openBlockers ?? 0) > 0) {
    return {
      label: 'Resolve blockers',
      href: '/terminal/tasks',
      reason: `${input.openBlockers} open blockers`,
    };
  }
  if (
    (persona === 'executive' || persona === 'operator') &&
    (input.pendingApprovals ?? 0) > 0
  ) {
    return {
      label: 'Review approvals',
      href: '/terminal/approvals',
      procedureId: persona === 'executive' ? 'exec_approvals' : 'ops_listing_launch',
      reason: `${input.pendingApprovals} pending`,
    };
  }
  if ((input.openTasks ?? 0) > 0) {
    return {
      label: 'Work next task',
      href: '/terminal/tasks',
      reason: `${input.openTasks} open tasks`,
    };
  }
  const firstProc = proceduresForPersona(persona)[0];
  const firstStep = firstProc?.steps[0];
  if (firstStep) {
    return {
      label: firstStep.label,
      href: firstStep.href,
      procedureId: firstProc.id,
      reason: `Start ${firstProc.label}`,
    };
  }
  return null;
}

/** Inventory helper for audits / docs / Information Architecture map. */
export function listWorkspaceInventory() {
  const focusCounts = OPERATING_PERSONAS.map((id) => ({
    persona: id,
    focusItems: PERSONA_PRIMARY_NAV[id].length,
    moreItems: PERSONA_MORE_NAV[id].length + proceduresForPersona(id).length,
  }));
  return {
    principles: [
      'One User',
      'One Workspace',
      'One Objective',
      'One AI',
      'One Canonical Navigation Model',
    ],
    personas: OPERATING_PERSONAS.map((id) => PERSONA_DEFINITIONS[id]),
    procedures: Object.values(PROCEDURES),
    routeOwnership: ROUTE_OWNERSHIP,
    focusNav: focusCounts,
    aiNavigationIntents: AI_NAVIGATION_INTENTS.map((i) => ({
      href: i.href,
      label: i.label,
      personas: i.personas,
    })),
    pageCategories: [
      'workspace',
      'business_process',
      'commerce_case',
      'settings',
      'connector',
      'system_administration',
    ],
    note:
      'Pages without ownership should be merged, redirected, or AI-only. Primary sidebar = Focus only; More is collapsed.',
  };
}
