/**
 * @deprecated Static nav groups replaced by Workspace Resolver.
 * Dynamic sidebar is built server-side via GET /api/v1/workspace
 * and rendered in TerminalSidebar from ResolvedWorkspace.nav.
 *
 * Kept for type compatibility and fallbacks only.
 */

export type NavStatus = 'operational' | 'approval_controlled' | 'credential_blocked' | 'planned';

export type NavLink = {
  href: string;
  label: string;
  status: NavStatus;
};

export type NavGroup = {
  id: string;
  label: string;
  items: NavLink[];
};

/** Minimal fallback — prefer ResolvedWorkspace.nav */
export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'workspace',
    label: 'Workspace',
    items: [
      { href: '/terminal/workspace', label: 'Personas', status: 'operational' },
      { href: '/terminal/process', label: 'Process', status: 'operational' },
      { href: '/terminal/tasks', label: 'Tasks', status: 'operational' },
      { href: '/terminal', label: 'Discover', status: 'operational' },
      { href: '/terminal/ai', label: 'AI Operator', status: 'approval_controlled' },
    ],
  },
];

export function filterNavGroups(_options: {
  founderDirect?: boolean;
  showAgency?: boolean;
}): NavGroup[] {
  return NAV_GROUPS;
}
