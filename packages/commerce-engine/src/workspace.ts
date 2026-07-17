/**
 * Persona-driven operating workspaces.
 *
 * TradeOps is a Commerce Operating System: every nav item, page, and AI prompt
 * belongs to a persona procedure — not a feature module catalog.
 */

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
  // Capital/network gated investment-style surfaces — executive only, not default ops
  { path: '/capital', primaryPersona: 'executive', kind: 'admin', orphan: true },
  { path: '/network', primaryPersona: 'executive', kind: 'admin', orphan: true },
  // Core operational
  { path: '/terminal', primaryPersona: 'researcher', secondaryPersonas: ['operator', 'analyst'], procedureId: 'research_discover', kind: 'procedure_step' },
  { path: '/terminal/process', primaryPersona: 'operator', secondaryPersonas: ['researcher', 'analyst'], kind: 'procedure_hub' },
  { path: '/terminal/tasks', primaryPersona: 'operator', secondaryPersonas: ['executive', 'researcher'], kind: 'procedure_step' },
  { path: '/terminal/workspace', primaryPersona: 'administrator', kind: 'procedure_hub' },
  { path: '/terminal/ai', primaryPersona: 'operator', secondaryPersonas: OPERATING_PERSONAS.slice(), kind: 'resource' },
  { path: '/terminal/connectors', primaryPersona: 'developer', kind: 'procedure_step' },
  { path: '/app/billing', primaryPersona: 'administrator', secondaryPersonas: ['executive'], kind: 'procedure_step' },
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
 * Build dynamic sidebar groups for a persona.
 * Every item is a procedure hub or step — not a feature dump.
 */
export function buildPersonaNav(
  persona: OperatingPersona,
  options?: {
    pendingApprovals?: number;
    openTasks?: number;
    openBlockers?: number;
    connectorIssues?: number;
  },
): WorkspaceNavGroup[] {
  const def = PERSONA_DEFINITIONS[persona];
  const procs = proceduresForPersona(persona);

  const procedureItems: WorkspaceNavItem[] = procs.map((p) => ({
    id: `proc-${p.id}`,
    href: `${def.homeHref}?procedure=${p.id}`,
    label: p.label,
    kind: 'procedure_hub',
    procedureId: p.id,
    status: 'operational',
  }));

  // Flatten first step of each procedure as quick actions (unique hrefs)
  const stepItems: WorkspaceNavItem[] = [];
  const seen = new Set<string>();
  for (const p of procs) {
    for (const s of p.steps) {
      if (seen.has(s.href)) continue;
      seen.add(s.href);
      stepItems.push({
        id: `step-${p.id}-${s.id}`,
        href: s.href,
        label: s.label,
        kind: 'procedure_step',
        procedureId: p.id,
        stepId: s.id,
        status: 'operational',
      });
    }
  }

  const shared: WorkspaceNavItem[] = [
    {
      id: 'home',
      href: def.homeHref,
      label: `${def.label} home`,
      kind: 'procedure_hub',
      status: 'operational',
    },
    {
      id: 'process',
      href: '/terminal/process',
      label: 'Process',
      kind: 'resource',
      status: 'operational',
      badge: options?.openBlockers ? String(options.openBlockers) : undefined,
    },
    {
      id: 'tasks',
      href: '/terminal/tasks',
      label: 'Tasks',
      kind: 'resource',
      status: 'operational',
      badge: options?.openTasks ? String(options.openTasks) : undefined,
    },
    {
      id: 'discover',
      href: '/terminal',
      label: 'Discover',
      kind: 'procedure_step',
      status: 'operational',
    },
    {
      id: 'ai',
      href: '/terminal/ai',
      label: 'AI Operator',
      kind: 'resource',
      status: 'approval_controlled',
    },
  ];

  if (persona === 'executive' || persona === 'operator') {
    shared.push({
      id: 'approvals',
      href: '/terminal/approvals',
      label: 'Approvals',
      kind: 'procedure_step',
      status: 'operational',
      badge: options?.pendingApprovals ? String(options.pendingApprovals) : undefined,
    });
  }

  if (persona === 'developer') {
    shared.push({
      id: 'connectors',
      href: '/terminal/connectors',
      label: 'Connectors',
      kind: 'procedure_step',
      status: options?.connectorIssues ? 'credential_blocked' : 'operational',
      badge: options?.connectorIssues ? String(options.connectorIssues) : undefined,
    });
  }

  if (persona === 'administrator') {
    shared.push({
      id: 'billing',
      href: '/app/billing',
      label: 'Billing',
      kind: 'admin',
      status: 'operational',
    });
  }

  shared.push({
    id: 'switch',
    href: '/terminal/workspace',
    label: 'Switch persona',
    kind: 'admin',
    status: 'operational',
  });

  return [
    {
      id: 'workspace',
      label: `${def.label} workspace`,
      items: shared,
    },
    {
      id: 'procedures',
      label: 'Procedures',
      items: procedureItems,
    },
    {
      id: 'steps',
      label: 'Work steps',
      items: stepItems.slice(0, 12),
    },
  ];
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
};

/**
 * Pure Workspace Resolver — API loads counts then calls this.
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
  });
  const procedures = proceduresForPersona(persona).map((p) => ({
    ...p,
    progress: {
      total: p.steps.length,
      completedHint: 0,
    },
    activeStepId: p.steps[0]?.id ?? null,
  }));

  const recommendedNextAction = recommendNext(persona, input);
  const currentObjective = input.currentObjective?.trim() || def.defaultObjective;
  const allowedAiTools = aiToolsForPersona(persona);

  const aiContextPreamble = [
    `You are the TradeOps AI Operator inside the ${def.label} workspace.`,
    `Mission: ${def.mission}`,
    `Organization: ${input.organizationName ?? input.organizationId}`,
    input.userEmail ? `User: ${input.userEmail}` : null,
    `Open tasks: ${input.openTasks ?? 0}; blockers: ${input.openBlockers ?? 0}; pending approvals: ${input.pendingApprovals ?? 0}; active cases: ${input.activeCaseCount ?? 0}.`,
    `Allowed tools for this persona: ${allowedAiTools.join(', ')}.`,
    `Recommend only actions relevant to ${def.label} procedures. Do not invent investment/custody features.`,
    recommendedNextAction
      ? `Recommended next action: ${recommendedNextAction.label} → ${recommendedNextAction.href} (${recommendedNextAction.reason})`
      : null,
    `Current objective:\n${currentObjective}`,
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

/** Inventory helper for audits / docs. */
export function listWorkspaceInventory() {
  return {
    personas: OPERATING_PERSONAS.map((id) => PERSONA_DEFINITIONS[id]),
    procedures: Object.values(PROCEDURES),
    routeOwnership: ROUTE_OWNERSHIP,
    note: 'Pages without ownership should be merged, redirected, or removed.',
  };
}
