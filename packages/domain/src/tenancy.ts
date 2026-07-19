/**
 * Multi-tenant isolation helpers.
 * Every repository query for merchant data must include organizationId (tenantId).
 * Organization is the canonical Tenant entity.
 */

export class TenantIsolationError extends Error {
  constructor(message = 'Organization context required') {
    super(message);
    this.name = 'TenantIsolationError';
  }
}

export function requireOrganizationId(organizationId: string | null | undefined): string {
  if (!organizationId) {
    throw new TenantIsolationError();
  }
  return organizationId;
}

/** Alias — prefer requireTenantId in new code. */
export const requireTenantId = requireOrganizationId;

/**
 * Ensures a resource's organization matches the caller's active organization.
 * Prevents IDOR across tenants when resource IDs are guessable/leaked.
 */
export function assertSameOrganization(
  resourceOrganizationId: string,
  actorOrganizationId: string | null | undefined,
): void {
  const orgId = requireOrganizationId(actorOrganizationId);
  if (resourceOrganizationId !== orgId) {
    throw new TenantIsolationError('Resource does not belong to the active organization');
  }
}

/** Alias for assertSameOrganization. */
export const assertSameTenant = assertSameOrganization;

/**
 * Prisma where fragment for tenant isolation.
 */
export function tenantWhere(organizationId: string | null | undefined): { organizationId: string } {
  return { organizationId: requireOrganizationId(organizationId) };
}

/**
 * Optional workspace filter when a resource supports workspace scoping.
 */
export function tenantWorkspaceWhere(
  organizationId: string | null | undefined,
  workspaceId?: string | null,
): { organizationId: string; workspaceId?: string } {
  const base = tenantWhere(organizationId);
  if (workspaceId) return { ...base, workspaceId };
  return base;
}
