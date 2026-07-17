/**
 * Central access-mode resolution for TradeOps.
 *
 * Do not scatter founder_direct checks across the codebase — import from here
 * (or from @tradeops/config re-exports).
 *
 * Modes:
 * - founder_direct  — single-operator workspace; no login UX required
 * - authenticated   — session cookie required (classic multi-user ready)
 * - multi_tenant    — full SaaS signup / multi-org (same auth path as authenticated)
 */

export type TradeOpsAccessMode = 'founder_direct' | 'authenticated' | 'multi_tenant';

export const ACCESS_MODES: readonly TradeOpsAccessMode[] = [
  'founder_direct',
  'authenticated',
  'multi_tenant',
] as const;

export const FOUNDER_DIRECT_DEFAULTS = {
  email: 'founder@tradeops.local',
  displayName: 'TradeOps Founder',
  /** Prefer seeded commerce org so fixture products are preserved */
  organizationSlug: 'demo-commerce',
  organizationName: 'TradeOps Founder Workspace',
  /** Fallback slug if demo-commerce must not be used */
  fallbackOrganizationSlug: 'tradeops-founder',
  role: 'owner' as const,
  /**
   * Stored as founder for backward-compatible Prisma enum;
   * Workspace Resolver maps founder → researcher (discovery-first OS).
   */
  workspacePersona: 'founder' as const,
} as const;

export function parseAccessMode(raw: unknown): TradeOpsAccessMode {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_');
  if (s === 'authenticated' || s === 'auth') return 'authenticated';
  if (s === 'multi_tenant' || s === 'multitenant' || s === 'saas') return 'multi_tenant';
  if (s === 'founder_direct' || s === 'founder' || s === 'direct') return 'founder_direct';
  // Empty / missing → founder_direct for current development phase
  if (!s) return 'founder_direct';
  return 'founder_direct';
}

export type AccessModeEnvSlice = {
  TRADEOPS_ACCESS_MODE?: string;
  NODE_ENV?: string;
  AUTH_BYPASS?: boolean | string;
  WEB_ORIGIN?: string;
  TRADEOPS_PUBLIC_WARNING?: string | boolean;
};

/**
 * Resolve active access mode from environment.
 * Default: founder_direct (current founder-operated phase).
 */
export function getAccessMode(env: AccessModeEnvSlice = process.env): TradeOpsAccessMode {
  return parseAccessMode(env.TRADEOPS_ACCESS_MODE);
}

export function isFounderDirectAccess(env: AccessModeEnvSlice = process.env): boolean {
  return getAccessMode(env) === 'founder_direct';
}

export function isAuthenticatedAccessMode(env: AccessModeEnvSlice = process.env): boolean {
  const m = getAccessMode(env);
  return m === 'authenticated' || m === 'multi_tenant';
}

/**
 * True when server may attach a synthetic founder identity without a session cookie.
 * founder_direct enables this even in NODE_ENV=production (private founder deploy).
 * Legacy AUTH_BYPASS remains development-only unless founder_direct is set.
 */
export function isDirectIdentityEnabled(env: AccessModeEnvSlice & {
  AUTH_BYPASS?: boolean;
  NODE_ENV?: string;
} = process.env as AccessModeEnvSlice & { AUTH_BYPASS?: boolean; NODE_ENV?: string }): boolean {
  if (isFounderDirectAccess(env)) return true;
  const bypass =
    typeof env.AUTH_BYPASS === 'boolean'
      ? env.AUTH_BYPASS
      : ['1', 'true', 'yes', 'on'].includes(String(env.AUTH_BYPASS ?? '').trim().toLowerCase());
  return Boolean(bypass) && env.NODE_ENV !== 'production';
}

/**
 * Heuristic: WEB_ORIGIN is not loopback, or explicit TRADEOPS_PUBLIC_WARNING.
 * Used only to surface a founder-mode warning — not a hard block.
 */
export function isLikelyPublicDeployment(env: AccessModeEnvSlice = process.env): boolean {
  const flag = env.TRADEOPS_PUBLIC_WARNING;
  if (flag === true || flag === 'true' || flag === '1' || flag === 'yes') return true;
  const origin = env.WEB_ORIGIN ?? '';
  try {
    const host = new URL(origin).hostname.toLowerCase();
    if (!host || host === 'localhost' || host === '127.0.0.1' || host === '::1') return false;
    if (host.endsWith('.local') || host.endsWith('.localhost')) return false;
    return true;
  } catch {
    return false;
  }
}

export function founderDirectPublicWarning(env: AccessModeEnvSlice = process.env): string | null {
  if (!isFounderDirectAccess(env)) return null;
  if (!isLikelyPublicDeployment(env)) return null;
  return 'Direct Founder Access is enabled. This deployment should not be treated as a public multi-user environment.';
}
