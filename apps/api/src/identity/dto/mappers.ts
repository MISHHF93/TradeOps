import type {
  AuthResponse,
  MembershipWithOrgDto,
  OrganizationDto,
  Permission,
  SystemRole,
  UserDto,
} from '@tradeops/contracts';
import { buildTenantContext, permissionsForRole } from '@tradeops/domain';
import type { Membership, Organization, User } from '@tradeops/database';

type MembershipWithOrganization = Membership & { organization: Organization };

export function toUserDto(user: User): UserDto {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export function toOrganizationDto(org: Organization): OrganizationDto {
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    publicId: (org as Organization & { publicId?: string }).publicId,
    organizationType: (org as Organization & { organizationType?: string }).organizationType,
    commerceMode: (org as Organization & { commerceMode?: string }).commerceMode,
    tenantStatus: (org as Organization & { tenantStatus?: string }).tenantStatus,
    subscriptionStatus: (org as Organization & { subscriptionStatus?: string }).subscriptionStatus,
    createdAt: org.createdAt.toISOString(),
    updatedAt: org.updatedAt.toISOString(),
  };
}

export function toMembershipWithOrgDto(m: MembershipWithOrganization): MembershipWithOrgDto {
  return {
    id: m.id,
    organizationId: m.organizationId,
    role: m.role as SystemRole,
    organization: toOrganizationDto(m.organization),
  };
}

export function toAuthResponse(params: {
  user: User;
  memberships: MembershipWithOrganization[];
  activeOrganizationId: string | null;
  activeWorkspaceId?: string | null;
}): AuthResponse {
  const memberships = params.memberships.map(toMembershipWithOrgDto);
  const active = memberships.find((m) => m.organizationId === params.activeOrganizationId) ?? null;
  const role = (active?.role ?? null) as SystemRole | null;
  const permissions: Permission[] = role ? [...permissionsForRole(role)] : [];
  const activeMembership = params.memberships.find(
    (m) => m.organizationId === params.activeOrganizationId,
  );
  const org = activeMembership?.organization;

  const tenant =
    activeMembership && role && params.activeOrganizationId
      ? buildTenantContext({
          userId: params.user.id,
          tenantId: params.activeOrganizationId,
          workspaceId: params.activeWorkspaceId,
          membershipId: activeMembership.id,
          role,
          permissions,
          featureFlags: (org as Organization & { featureFlags?: unknown })?.featureFlags as
            | Record<string, unknown>
            | undefined,
          subscriptionStatus: (org as Organization & { subscriptionStatus?: string })
            ?.subscriptionStatus,
          subscriptionPlan:
            (org as Organization & { subscriptionPlan?: string | null })?.subscriptionPlan ??
            (org as Organization & { planTier?: string })?.planTier,
        })
      : null;

  return {
    user: toUserDto(params.user),
    activeOrganization: active?.organization ?? null,
    activeWorkspaceId: params.activeWorkspaceId ?? null,
    activeRole: role,
    permissions,
    memberships,
    tenant,
  };
}
