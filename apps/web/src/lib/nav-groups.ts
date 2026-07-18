/**
 * @deprecated Prefer GET /api/v1/workspace (ResolvedWorkspace.nav) and
 * apps/web/src/lib/nav-catalog.ts hybrid catalog (Focus · Operate · Platform · More).
 * Static groups retained only for type compatibility — do not add new links here.
 *
 * Architecture: presentation nav is owned by Workspace Layer + commerce-engine buildPersonaNav.
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
