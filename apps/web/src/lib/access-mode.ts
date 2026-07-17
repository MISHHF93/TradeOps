/**
 * Web-side access mode helpers.
 * Mirrors @tradeops/config logic so UI routing stays in sync without importing Nest.
 *
 * Prefer TRADEOPS_ACCESS_MODE / NEXT_PUBLIC_TRADEOPS_ACCESS_MODE.
 */

export type TradeOpsAccessMode = 'founder_direct' | 'authenticated' | 'multi_tenant';

export function parseAccessMode(raw: unknown): TradeOpsAccessMode {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_');
  if (s === 'authenticated' || s === 'auth') return 'authenticated';
  if (s === 'multi_tenant' || s === 'multitenant' || s === 'saas') return 'multi_tenant';
  if (s === 'founder_direct' || s === 'founder' || s === 'direct') return 'founder_direct';
  return 'founder_direct';
}

export function getAccessMode(): TradeOpsAccessMode {
  return parseAccessMode(
    process.env.NEXT_PUBLIC_TRADEOPS_ACCESS_MODE ??
      process.env.TRADEOPS_ACCESS_MODE ??
      'founder_direct',
  );
}

export function isFounderDirectAccess(): boolean {
  return getAccessMode() === 'founder_direct';
}

/**
 * Default landing for founder / post-auth: Workspace Resolver entry.
 * Resolves to persona home (intelligence surface). Process remains at /terminal/process.
 */
export const FOUNDER_WORKSPACE_PATH = '/terminal/workspace';

export function authRouteRedirectTarget(): string {
  return FOUNDER_WORKSPACE_PATH;
}
