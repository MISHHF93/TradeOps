/**
 * Client-side hybrid nav catalog — mirrors packages/commerce-engine buildPersonaNav.
 * Keep in sync when SHARED_OPERATE_NAV / SHARED_PLATFORM_NAV change.
 * Used when workspace API is offline and for ⌘K destinations.
 */

import type { WorkspaceNavGroup, WorkspaceNavItem } from './workspace';

type Dest = { id: string; href: string; label: string; kind?: string };

const OPERATE: Dest[] = [
  { id: 'discover', href: '/terminal', label: 'Discover', kind: 'procedure_step' },
  { id: 'cases', href: '/terminal/process', label: 'Cases', kind: 'procedure_hub' },
  { id: 'tasks', href: '/terminal/tasks', label: 'Tasks', kind: 'resource' },
  { id: 'orders', href: '/terminal/orders', label: 'Orders', kind: 'procedure_step' },
  { id: 'approvals', href: '/terminal/approvals', label: 'Approvals', kind: 'procedure_step' },
  { id: 'opportunities', href: '/terminal/opportunities', label: 'Opportunities', kind: 'procedure_step' },
  { id: 'fulfillment', href: '/terminal/fulfillment', label: 'Fulfillment', kind: 'procedure_step' },
];

const PLATFORM: Dest[] = [
  { id: 'ops', href: '/terminal/ops', label: 'Ops Center', kind: 'admin' },
  { id: 'integrations', href: '/terminal/integrations', label: 'Integration Hub', kind: 'admin' },
  { id: 'connectors', href: '/terminal/connectors', label: 'Connectors', kind: 'procedure_step' },
  { id: 'ecosystem', href: '/terminal/ecosystem', label: 'Ecosystem', kind: 'resource' },
  { id: 'automations', href: '/terminal/automations', label: 'Automations', kind: 'procedure_step' },
  { id: 'system', href: '/app', label: 'System', kind: 'admin' },
  { id: 'billing', href: '/app/billing', label: 'Billing', kind: 'admin' },
  { id: 'status', href: '/status', label: 'Capability status', kind: 'admin' },
];

/** Default Focus when persona unknown (researcher-shaped). */
const DEFAULT_FOCUS: Dest[] = [
  { id: 'home', href: '/terminal/workspace', label: 'Workspace', kind: 'procedure_hub' },
  { id: 'discover', href: '/terminal', label: 'Product Discovery', kind: 'procedure_step' },
  { id: 'opps', href: '/terminal/opportunities', label: 'Opportunities', kind: 'procedure_step' },
  { id: 'process', href: '/terminal/process', label: 'Cases', kind: 'procedure_hub' },
  { id: 'ai', href: '/terminal/ai', label: 'AI', kind: 'resource' },
];

const DEFAULT_MORE: Dest[] = [
  { id: 'industrial', href: '/terminal/industrial/products', label: 'Industrial catalog' },
  { id: 'watchlist', href: '/terminal/watchlist', label: 'Watchlist' },
  { id: 'tasks', href: '/terminal/tasks', label: 'Tasks' },
  { id: 'objectives', href: '/terminal/objectives', label: 'Objectives' },
  { id: 'portfolio', href: '/terminal/portfolio', label: 'Portfolio' },
  { id: 'cash', href: '/terminal/cashflow', label: 'Cash flow' },
  { id: 'signals', href: '/terminal/signals', label: 'Signals' },
  { id: 'customers', href: '/terminal/customers', label: 'Customers' },
  { id: 'live-examples', href: '/terminal/live-examples', label: 'Live examples' },
  { id: 'switch', href: '/terminal/workspace?switch=1', label: 'Switch persona' },
];

function hrefKey(href: string): string {
  const q = href.indexOf('?');
  return q >= 0 ? href.slice(0, q) : href;
}

function toItem(d: Dest, idPrefix = ''): WorkspaceNavItem {
  return {
    id: idPrefix ? `${idPrefix}${d.id}` : d.id,
    href: d.href,
    label: d.label,
    kind: d.kind ?? 'resource',
    status: d.href === '/terminal/ai' ? 'approval_controlled' : 'operational',
  };
}

/**
 * Full hybrid nav when GET /api/v1/workspace is unavailable.
 * Never collapse the OS to four links.
 */
export function buildClientFallbackNav(): WorkspaceNavGroup[] {
  const focus = DEFAULT_FOCUS.map((d) => toItem(d));
  const focusHrefs = new Set(focus.map((i) => hrefKey(i.href)));
  const operate = OPERATE.filter((d) => !focusHrefs.has(hrefKey(d.href))).map((d) =>
    toItem(d, 'op-'),
  );
  const used = new Set([...focusHrefs, ...operate.map((i) => hrefKey(i.href))]);
  const platform = PLATFORM.filter((d) => !used.has(hrefKey(d.href))).map((d) => toItem(d, 'pl-'));
  for (const i of platform) used.add(hrefKey(i.href));
  const more = DEFAULT_MORE.filter((d) => !used.has(hrefKey(d.href))).map((d) => toItem(d));

  return [
    { id: 'focus', label: 'Focus', items: focus },
    { id: 'operate', label: 'Operate', items: operate },
    { id: 'platform', label: 'Platform', items: platform },
    { id: 'more', label: 'More', items: more },
  ];
}

/** ⌘K / command palette destinations (unique hrefs). */
export function listClientDestinations(): Array<{
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
  for (const d of DEFAULT_FOCUS) push('Focus', d.id, d.label, d.href);
  for (const d of OPERATE) push('Operate', d.id, d.label, d.href);
  for (const d of PLATFORM) push('Platform', d.id, d.label, d.href);
  for (const d of DEFAULT_MORE) push('More', d.id, d.label, d.href);
  return out;
}
