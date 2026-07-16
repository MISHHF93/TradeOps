/**
 * Multi-tenant isolation helpers.
 * Every repository query for merchant data must include organizationId.
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
