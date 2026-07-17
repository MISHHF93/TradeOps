import { ForbiddenException } from '@nestjs/common';
import type { TenantContext } from '@tradeops/domain';
import type { AuthContext } from './types';

/**
 * Require a fully resolved tenant context from AuthGuard.
 * Use at the top of every tenant-scoped controller method / service entry.
 */
export function requireTenant(auth: AuthContext): TenantContext {
  if (!auth.tenant || !auth.activeOrganizationId || !auth.membershipId || !auth.role) {
    throw new ForbiddenException('Active organization membership required');
  }
  return auth.tenant;
}

/** Convenience: organizationId string for Prisma where clauses. */
export function requireOrgId(auth: AuthContext): string {
  return requireTenant(auth).organizationId;
}
