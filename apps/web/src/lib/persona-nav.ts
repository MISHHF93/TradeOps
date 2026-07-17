/**
 * Persona navigation — delegates to commerce-engine workspace model.
 * @deprecated Prefer GET /api/v1/workspace (ResolvedWorkspace.nav).
 */

export type NavItem = {
  href: string;
  label: string;
  status: 'operational' | 'approval_controlled' | 'credential_blocked';
  personas?: string[];
};

/** Operating persona ids used by Commerce OS */
export const OPERATING_PERSONAS = [
  'executive',
  'operator',
  'researcher',
  'analyst',
  'developer',
  'administrator',
] as const;

export type OperatingPersona = (typeof OPERATING_PERSONAS)[number];

const PERSONA_HOME: Record<string, string> = {
  executive: '/terminal/workspace/executive',
  operator: '/terminal/workspace/operator',
  researcher: '/terminal/workspace/researcher',
  analyst: '/terminal/workspace/analyst',
  developer: '/terminal/workspace/developer',
  administrator: '/terminal/workspace/administrator',
  founder: '/terminal/workspace/researcher',
  procurement: '/terminal/workspace/operator',
  finance: '/terminal/workspace/executive',
  agency: '/terminal/workspace/administrator',
  auditor: '/terminal/workspace/executive',
};

/** Ordered primary hubs when client-side only (no workspace API). */
export function navForPersona(persona: string | null | undefined): NavItem[] {
  const home = PERSONA_HOME[persona ?? 'researcher'] ?? '/terminal/workspace';
  return [
    { href: home, label: 'Persona home', status: 'operational' },
    { href: '/terminal/process', label: 'Process spine', status: 'operational' },
    { href: '/terminal/tasks', label: 'Tasks', status: 'operational' },
    { href: '/terminal/ai', label: 'AI Operator', status: 'approval_controlled' },
    { href: '/terminal/workspace', label: 'Switch persona', status: 'operational' },
  ];
}

export function homeForPersona(persona: string | null | undefined): string {
  return PERSONA_HOME[persona ?? 'researcher'] ?? '/terminal/workspace';
}
