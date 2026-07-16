import type {
  AuthResponse,
  MembershipWithOrgDto,
  OrganizationDto,
  Permission,
  SystemRole,
  UserDto,
} from '@tradeops/contracts';
import { permissionsForRole } from '@tradeops/domain';
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
}): AuthResponse {
  const memberships = params.memberships.map(toMembershipWithOrgDto);
  const active = memberships.find((m) => m.organizationId === params.activeOrganizationId) ?? null;
  const role = (active?.role ?? null) as SystemRole | null;
  const permissions: Permission[] = role ? [...permissionsForRole(role)] : [];

  return {
    user: toUserDto(params.user),
    activeOrganization: active?.organization ?? null,
    activeRole: role,
    permissions,
    memberships,
  };
}
