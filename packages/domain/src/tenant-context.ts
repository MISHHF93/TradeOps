/**
 * Canonical server-side tenant context.
 * Never trust frontend-supplied tenantId without membership validation.
 */

import type { Permission, SystemRole } from '@tradeops/contracts';
import { TenantIsolationError, requireOrganizationId } from './tenancy';
import { permissionsForRole } from './rbac';

export type TenantContext = {
  userId: string;
  /** Canonical tenant id (= Organization.id) */
  tenantId: string;
  /** Alias of tenantId for existing codepaths */
  organizationId: string;
  workspaceId?: string;
  membershipId: string;
  roleIds: string[];
  /** Primary legacy system role (membership-scoped; never global on User) */
  role: SystemRole;
  permissions: Permission[];
  featureFlags: string[];
  subscriptionStatus: string;
  subscriptionPlan: string;
  connectedCapabilities: string[];
  currentObjectiveId?: string;
};

export type TenantContextInput = {
  userId: string;
  tenantId: string | null | undefined;
  workspaceId?: string | null;
  membershipId: string | null | undefined;
  roleIds?: string[];
  role: SystemRole | null | undefined;
  permissions?: readonly Permission[] | Permission[];
  featureFlags?: string[] | Record<string, unknown> | null;
  subscriptionStatus?: string | null;
  subscriptionPlan?: string | null;
  connectedCapabilities?: string[];
  currentObjectiveId?: string | null;
};

/**
 * Build a validated TenantContext. Throws if tenant or membership is missing.
 */
export function buildTenantContext(input: TenantContextInput): TenantContext {
  const tenantId = requireOrganizationId(input.tenantId);
  if (!input.membershipId) {
    throw new TenantIsolationError('Membership required for tenant context');
  }
  if (!input.role) {
    throw new TenantIsolationError('Membership-scoped role required for tenant context');
  }

  const permissions = input.permissions?.length
    ? ([...input.permissions] as Permission[])
    : ([...permissionsForRole(input.role)] as Permission[]);

  return {
    userId: input.userId,
    tenantId,
    organizationId: tenantId,
    workspaceId: input.workspaceId ?? undefined,
    membershipId: input.membershipId,
    roleIds: input.roleIds ?? [],
    role: input.role,
    permissions,
    featureFlags: normalizeFeatureFlags(input.featureFlags),
    subscriptionStatus: input.subscriptionStatus ?? 'trialing',
    subscriptionPlan: input.subscriptionPlan ?? 'evaluation',
    connectedCapabilities: input.connectedCapabilities ?? [],
    currentObjectiveId: input.currentObjectiveId ?? undefined,
  };
}

export function normalizeFeatureFlags(
  flags: string[] | Record<string, unknown> | null | undefined,
): string[] {
  if (!flags) return [];
  if (Array.isArray(flags)) return flags.map(String);
  return Object.entries(flags)
    .filter(([, v]) => v === true || v === 1 || v === '1' || v === 'true')
    .map(([k]) => k);
}

/**
 * Merge base role permissions with allow/deny overrides.
 * Deny wins over allow.
 */
export function resolveEffectivePermissions(params: {
  base: readonly Permission[];
  allows?: readonly string[];
  denies?: readonly string[];
}): Permission[] {
  const set = new Set<string>(params.base);
  for (const a of params.allows ?? []) set.add(a);
  for (const d of params.denies ?? []) set.delete(d);
  return [...set] as Permission[];
}

export function tenantHasPermission(ctx: TenantContext, permission: Permission): boolean {
  return ctx.permissions.includes(permission);
}

export function assertTenantAccess(
  resourceOrganizationId: string,
  ctx: Pick<TenantContext, 'tenantId'> | { organizationId?: string | null; tenantId?: string | null },
): void {
  const tenantId =
    'tenantId' in ctx && ctx.tenantId
      ? ctx.tenantId
      : 'organizationId' in ctx
        ? ctx.organizationId
        : null;
  const orgId = requireOrganizationId(tenantId);
  if (resourceOrganizationId !== orgId) {
    throw new TenantIsolationError('Resource does not belong to the active tenant');
  }
}

export function assertWorkspaceAccess(
  resourceWorkspaceId: string | null | undefined,
  ctx: Pick<TenantContext, 'workspaceId'>,
): void {
  if (!resourceWorkspaceId) return;
  if (!ctx.workspaceId || resourceWorkspaceId !== ctx.workspaceId) {
    throw new TenantIsolationError('Resource does not belong to the active workspace');
  }
}
