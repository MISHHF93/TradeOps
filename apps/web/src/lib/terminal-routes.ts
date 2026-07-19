/**
 * Terminal route registry — single source of truth for the Commerce OS shell.
 *
 * Rules:
 * 1. Every reachable terminal list/stage page is `canonical`.
 * 2. `legacy_redirect` routes must not appear in Focus/More/command palette.
 * 3. `detail` routes are deep-links only (case, product, objective id).
 * 4. Nav (persona Focus/More) lives in commerce-engine; this registry owns
 *    command palette, procedure spine, and smoke inventory.
 */

export type TerminalRouteKind = 'canonical' | 'detail' | 'legacy_redirect';

export type TerminalRouteGroup =
  | 'workspace'
  | 'commerce'
  | 'intelligence'
  | 'finance'
  | 'ai'
  | 'platform';

export type TerminalRoute = {
  id: string;
  /** Path pattern (no dynamic segments except for detail docs) */
  path: string;
  label: string;
  group: TerminalRouteGroup;
  kind: TerminalRouteKind;
  /** When kind=legacy_redirect */
  redirectTo?: string;
  /** Show in ⌘K */
  command?: boolean;
  /** Show on process related strip */
  related?: boolean;
  relatedId?:
    | 'workspace'
    | 'discover'
    | 'opportunities'
    | 'process'
    | 'tasks'
    | 'listings'
    | 'approvals'
    | 'orders'
    | 'finance'
    | 'ai';
  /** Primary API prefixes (docs / honesty) */
  apis?: string[];
};

/** Canonical + detail + legacy inventory */
export const TERMINAL_ROUTES: TerminalRoute[] = [
  // —— Workspace ——
  {
    id: 'workspace',
    path: '/terminal/workspace',
    label: 'Switch persona',
    group: 'workspace',
    kind: 'canonical',
    command: true,
    related: true,
    relatedId: 'workspace',
    apis: ['/api/v1/workspace'],
  },
  {
    id: 'workspace-persona',
    path: '/terminal/workspace/[persona]',
    label: 'Persona home',
    group: 'workspace',
    kind: 'detail',
    apis: ['/api/v1/workspace'],
  },

  // —— Commerce spine ——
  {
    id: 'discover',
    path: '/terminal',
    label: 'Discover products',
    group: 'commerce',
    kind: 'canonical',
    command: true,
    related: true,
    relatedId: 'discover',
    apis: ['/api/v1/terminal/scanner'],
  },
  {
    id: 'process',
    path: '/terminal/process',
    label: 'Commerce cases',
    group: 'commerce',
    kind: 'canonical',
    command: true,
    related: true,
    relatedId: 'process',
    apis: ['/api/v1/commerce/process', '/api/v1/commerce/runtime'],
  },
  {
    id: 'case',
    path: '/terminal/process/[caseId]',
    label: 'Case detail',
    group: 'commerce',
    kind: 'detail',
    apis: ['/api/v1/commerce/cases/:id', '/api/v1/commerce/cases/:id/workspace'],
  },
  {
    id: 'product',
    path: '/terminal/products/[productId]',
    label: 'Product twin',
    group: 'commerce',
    kind: 'detail',
    apis: ['/api/v1/products/:id'],
  },
  {
    id: 'tasks',
    path: '/terminal/tasks',
    label: 'Tasks & blockers',
    group: 'commerce',
    kind: 'canonical',
    command: true,
    related: true,
    relatedId: 'tasks',
    apis: ['/api/v1/commerce/tasks'],
  },
  {
    id: 'opportunities',
    path: '/terminal/opportunities',
    label: 'Opportunities',
    group: 'commerce',
    kind: 'canonical',
    command: true,
    related: true,
    relatedId: 'opportunities',
    apis: ['/api/v1/terminal/scanner', '/api/v1/commerce/process'],
  },
  {
    id: 'watchlist',
    path: '/terminal/watchlist',
    label: 'Watchlist',
    group: 'commerce',
    kind: 'canonical',
    command: true,
    apis: ['/api/v1/watchlist'],
  },
  {
    id: 'listings',
    path: '/terminal/listings',
    label: 'Listings',
    group: 'commerce',
    kind: 'canonical',
    command: true,
    related: true,
    relatedId: 'listings',
    apis: ['/api/v1/commerce/process'],
  },
  {
    id: 'orders',
    path: '/terminal/orders',
    label: 'Orders',
    group: 'commerce',
    kind: 'canonical',
    command: true,
    related: true,
    relatedId: 'orders',
    apis: ['/api/v1/orders'],
  },
  {
    id: 'fulfillment',
    path: '/terminal/fulfillment',
    label: 'Fulfillment',
    group: 'commerce',
    kind: 'canonical',
    command: true,
    apis: ['/api/v1/orders', '/api/v1/commerce/process'],
  },
  {
    id: 'approvals',
    path: '/terminal/approvals',
    label: 'Approvals',
    group: 'commerce',
    kind: 'canonical',
    command: true,
    related: true,
    relatedId: 'approvals',
    apis: ['/api/v1/approvals'],
  },

  // —— Intelligence ——
  {
    id: 'signals',
    path: '/terminal/signals',
    label: 'Signals',
    group: 'intelligence',
    kind: 'canonical',
    command: true,
    apis: ['/api/v1/terminal/signals'],
  },
  {
    id: 'portfolio',
    path: '/terminal/portfolio',
    label: 'Portfolio',
    group: 'intelligence',
    kind: 'canonical',
    command: true,
    apis: ['/api/v1/terminal/portfolio'],
  },
  {
    id: 'cashflow',
    path: '/terminal/cashflow',
    label: 'Cash flow',
    group: 'intelligence',
    kind: 'canonical',
    command: true,
    apis: ['/api/v1/terminal/portfolio'],
  },
  {
    id: 'customers',
    path: '/terminal/customers',
    label: 'Customers',
    group: 'intelligence',
    kind: 'canonical',
    command: true,
    apis: ['/api/v1/saas/customers/intelligence'],
  },

  // —— Finance (channel money, not SaaS billing) ——
  {
    id: 'finance-payments',
    path: '/terminal/finance/payments',
    label: 'Channel payments',
    group: 'finance',
    kind: 'canonical',
    command: true,
    related: true,
    relatedId: 'finance',
    apis: ['/api/v1/finance/payments'],
  },
  {
    id: 'finance-payouts',
    path: '/terminal/finance/payouts',
    label: 'Payouts',
    group: 'finance',
    kind: 'canonical',
    command: true,
    apis: ['/api/v1/finance/payouts'],
  },
  {
    id: 'finance-recon',
    path: '/terminal/finance/reconciliation',
    label: 'Reconciliation',
    group: 'finance',
    kind: 'canonical',
    command: true,
    apis: ['/api/v1/finance/reconciliations'],
  },
  {
    id: 'finance-disputes',
    path: '/terminal/finance/disputes',
    label: 'Disputes',
    group: 'finance',
    kind: 'canonical',
    command: true,
    apis: ['/api/v1/finance/disputes'],
  },

  // —— AI (rail is the composer; these pages are platform + durable history) ——
  {
    id: 'objectives',
    path: '/terminal/objectives',
    label: 'AI run history',
    group: 'ai',
    kind: 'canonical',
    command: true,
    related: true,
    relatedId: 'ai',
    apis: ['/api/v1/ai/runs'],
  },
  {
    id: 'objective-detail',
    path: '/terminal/objectives/[id]',
    label: 'AI run detail',
    group: 'ai',
    kind: 'detail',
    apis: ['/api/v1/ai/runs/:id'],
  },
  {
    id: 'ai',
    path: '/terminal/ai',
    label: 'AI platform',
    group: 'ai',
    kind: 'canonical',
    command: true,
    related: false,
    apis: [
      '/api/v1/ai/chat',
      '/api/v1/ai/tools',
      '/api/v1/ai/runs',
      '/api/v1/ai/operator/run',
    ],
  },
  {
    id: 'ai-runtime-lab',
    path: '/terminal/ai/runtime-lab',
    label: 'AI runtime lab',
    group: 'ai',
    kind: 'canonical',
    command: true,
    apis: ['/api/v1/ai/chat', '/api/v1/ai/health'],
  },
  {
    id: 'live-examples',
    path: '/terminal/live-examples',
    label: 'Live examples',
    group: 'ai',
    kind: 'canonical',
    command: true,
    apis: ['/api/v1/ai/live-examples'],
  },

  // —— Platform ——
  {
    id: 'ops',
    path: '/terminal/ops',
    label: 'Ops Center',
    group: 'platform',
    kind: 'canonical',
    command: true,
    apis: ['/api/v1/ops/command-center', '/api/v1/ops/connectors/health'],
  },
  {
    id: 'integrations',
    path: '/terminal/integrations',
    label: 'Integration Hub',
    group: 'platform',
    kind: 'canonical',
    command: true,
    apis: ['/api/v1/ops/connectors/production', '/api/v1/saas/tenant'],
  },
  {
    id: 'connectors',
    path: '/terminal/connectors',
    label: 'Connectors',
    group: 'platform',
    kind: 'canonical',
    command: true,
    apis: ['/api/v1/ops/connectors/health', '/api/v1/connectors'],
  },
  {
    id: 'ecosystem',
    path: '/terminal/ecosystem',
    label: 'Ecosystem / graph',
    group: 'platform',
    kind: 'canonical',
    command: true,
    apis: [
      '/api/v1/ecosystem/partners',
      '/api/v1/ecosystem/capabilities',
      '/api/v1/ecosystem/knowledge-graph',
    ],
  },
  {
    id: 'automations',
    path: '/terminal/automations',
    label: 'Automations',
    group: 'platform',
    kind: 'canonical',
    command: true,
    apis: ['/api/v1/automation/feeds', '/api/v1/automation/google/weekend/status'],
  },
  {
    id: 'agency',
    path: '/terminal/agency',
    label: 'Agency clients',
    group: 'platform',
    kind: 'canonical',
    command: true,
    apis: ['/api/v1/saas/agency/clients'],
  },
  {
    id: 'industrial',
    path: '/terminal/industrial',
    label: 'Industrial commerce',
    group: 'platform',
    kind: 'canonical',
    command: true,
    apis: ['/api/v1/commerce/industrial'],
  },
  {
    id: 'industrial-products',
    path: '/terminal/industrial/products',
    label: 'Industrial catalog',
    group: 'platform',
    kind: 'canonical',
    command: true,
    apis: ['/api/v1/commerce/industrial'],
  },

  // —— Legacy only (not in nav / palette) ——
  {
    id: 'legacy-pipeline',
    path: '/terminal/pipeline',
    label: 'Pipeline (legacy)',
    group: 'commerce',
    kind: 'legacy_redirect',
    redirectTo: '/terminal/process',
  },
  {
    id: 'legacy-cockpit',
    path: '/terminal/cockpit',
    label: 'Cockpit (legacy)',
    group: 'intelligence',
    kind: 'legacy_redirect',
    redirectTo: '/terminal/workspace/executive',
  },
  {
    id: 'legacy-control-tower',
    path: '/terminal/control-tower',
    label: 'Control tower (legacy)',
    group: 'platform',
    kind: 'legacy_redirect',
    redirectTo: '/terminal/ops',
  },
];

export function canonicalRoutes(): TerminalRoute[] {
  return TERMINAL_ROUTES.filter((r) => r.kind === 'canonical');
}

export function legacyRedirects(): Array<{ source: string; destination: string }> {
  return TERMINAL_ROUTES.filter((r) => r.kind === 'legacy_redirect' && r.redirectTo).map((r) => ({
    source: r.path,
    destination: r.redirectTo!,
  }));
}

/** ⌘K command list — no legacy routes */
export function commandPaletteEntries(): Array<{
  id: string;
  label: string;
  href: string;
  group: string;
}> {
  const groupLabel: Record<TerminalRouteGroup, string> = {
    workspace: 'Workspace',
    commerce: 'Commerce',
    intelligence: 'Intelligence',
    finance: 'Finance',
    ai: 'AI',
    platform: 'Platform',
  };
  return TERMINAL_ROUTES.filter((r) => r.command && r.kind === 'canonical').map((r) => ({
    id: r.id,
    label: r.label,
    href: r.path.includes('[') ? r.path.split('[')[0]!.replace(/\/$/, '') || r.path : r.path,
    group: groupLabel[r.group],
  }));
}

/** Procedure spine under page headers */
export function processRelatedEntries(): Array<{
  id: NonNullable<TerminalRoute['relatedId']>;
  href: string;
  label: string;
}> {
  const order: NonNullable<TerminalRoute['relatedId']>[] = [
    'workspace',
    'discover',
    'opportunities',
    'process',
    'tasks',
    'listings',
    'approvals',
    'orders',
    'finance',
    'ai',
  ];
  const byId = new Map(
    TERMINAL_ROUTES.filter((r) => r.related && r.relatedId).map((r) => [r.relatedId!, r]),
  );
  // Finance spine points at reconciliation as the hub
  const finance = byId.get('finance');
  return order
    .map((id) => {
      const r = byId.get(id);
      if (!r) return null;
      const label =
        id === 'workspace'
          ? 'Home'
          : id === 'process'
            ? 'Cases'
            : id === 'finance'
              ? 'Finance'
              : id === 'ai'
                ? 'Run history'
                : r.label.replace(/^Channel /, '');
      return { id, href: r.path, label };
    })
    .filter(Boolean) as Array<{
    id: NonNullable<TerminalRoute['relatedId']>;
    href: string;
    label: string;
  }>;
}

/** Paths safe to smoke (no dynamic segments) */
export function smokePaths(): string[] {
  return TERMINAL_ROUTES.filter((r) => r.kind === 'canonical' && !r.path.includes('[')).map(
    (r) => r.path,
  );
}
