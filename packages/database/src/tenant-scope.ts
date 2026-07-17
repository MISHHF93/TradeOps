/**
 * Prisma query helpers for mandatory tenant isolation.
 * Prefer these over ad-hoc `{ organizationId }` so every call site is explicit.
 */

export type TenantScope = {
  organizationId: string;
  workspaceId?: string;
};

export function assertTenantId(organizationId: string | null | undefined): string {
  if (!organizationId || typeof organizationId !== 'string') {
    throw new Error('TenantIsolationError: organizationId required');
  }
  return organizationId;
}

/** Standard where clause for org-owned rows */
export function orgWhere(organizationId: string | null | undefined): { organizationId: string } {
  return { organizationId: assertTenantId(organizationId) };
}

/**
 * Optional workspace filter when the model has workspaceId.
 * Does not invent a column — callers only use this when the model supports it.
 */
export function orgWorkspaceWhere(
  organizationId: string | null | undefined,
  workspaceId?: string | null,
): { organizationId: string; workspaceId?: string } {
  const base = orgWhere(organizationId);
  if (workspaceId) return { ...base, workspaceId };
  return base;
}

/** Create payload fragment — always stamp tenant on writes */
export function orgCreateData(
  organizationId: string | null | undefined,
  extra: Record<string, unknown> = {},
): { organizationId: string } & Record<string, unknown> {
  return { organizationId: assertTenantId(organizationId), ...extra };
}
