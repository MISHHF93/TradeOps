/**
 * Client-side nav catalog — mirrors packages/commerce-engine buildPersonaNav (AI-first).
 * Used when workspace API is offline and for ⌘K destinations.
 */

import type { WorkspaceNavGroup, WorkspaceNavItem } from './workspace';
import { resolveProductPacks } from './product-packs';

type Dest = { id: string; href: string; label: string; kind?: string };

const PRIMARY: Dest[] = [
  { id: 'home', href: '/terminal/workspace', label: 'Home', kind: 'procedure_hub' },
  { id: 'cases', href: '/terminal/process', label: 'Cases', kind: 'procedure_hub' },
  { id: 'connections', href: '/terminal/connectors', label: 'Connections', kind: 'procedure_step' },
];

const ADMIN: Dest[] = [
  { id: 'billing', href: '/app/billing', label: 'Billing', kind: 'admin' },
  { id: 'status', href: '/status', label: 'Status', kind: 'admin' },
  { id: 'system', href: '/app', label: 'System', kind: 'admin' },
];

const MORE: Dest[] = [
  { id: 'discover', href: '/terminal', label: 'Find products', kind: 'procedure_step' },
  { id: 'tasks', href: '/terminal/tasks', label: 'Tasks', kind: 'resource' },
  { id: 'orders', href: '/terminal/orders', label: 'Orders', kind: 'procedure_step' },
  { id: 'approvals', href: '/terminal/approvals', label: 'Approvals', kind: 'procedure_step' },
  { id: 'objectives', href: '/terminal/objectives', label: 'AI runs', kind: 'resource' },
  { id: 'switch', href: '/terminal/workspace?switch=1', label: 'Switch persona', kind: 'admin' },
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
    status: 'operational',
  };
}

/**
 * AI-first fallback nav when GET /workspace fails.
 */
export function buildClientFallbackNav(): WorkspaceNavGroup[] {
  const packs = resolveProductPacks();
  const used = new Set(PRIMARY.map((d) => hrefKey(d.href)));
  const admin = ADMIN.filter((d) => !used.has(hrefKey(d.href))).map((d) => {
    used.add(hrefKey(d.href));
    return toItem(d, 'ad-');
  });
  const more = MORE.filter((d) => !used.has(hrefKey(d.href))).map((d) => {
    used.add(hrefKey(d.href));
    return toItem(d);
  });
  if (packs.industrial && !used.has('/terminal/industrial')) {
    more.push(
      toItem({ id: 'industrial', href: '/terminal/industrial', label: 'Industrial OS' }),
    );
  }
  if (packs.engLabs && !used.has('/terminal/live-examples')) {
    more.push(
      toItem({ id: 'examples', href: '/terminal/live-examples', label: 'Live examples' }),
    );
  }

  return [
    { id: 'primary', label: 'TradeOps', items: PRIMARY.map((d) => toItem(d)) },
    { id: 'admin', label: 'Admin', items: admin },
    { id: 'more', label: 'More', items: more },
  ];
}

/** ⌘K destinations (core only; packs optional). */
export function listClientDestinations(): Array<{
  id: string;
  label: string;
  href: string;
  group: string;
}> {
  const packs = resolveProductPacks();
  const seen = new Set<string>();
  const out: Array<{ id: string; label: string; href: string; group: string }> = [];
  const push = (group: string, id: string, label: string, href: string) => {
    const k = hrefKey(href);
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ id, label, href, group });
  };
  for (const d of PRIMARY) push('Primary', d.id, d.label, d.href);
  for (const d of ADMIN) push('Admin', d.id, d.label, d.href);
  for (const d of MORE) push('More', d.id, d.label, d.href);
  if (packs.industrial) {
    push('More', 'industrial', 'Industrial OS', '/terminal/industrial');
  }
  if (packs.engLabs) {
    push('More', 'examples', 'Live examples', '/terminal/live-examples');
  }
  return out;
}
