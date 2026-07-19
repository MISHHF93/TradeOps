import { ForbiddenException, Injectable } from '@nestjs/common';
import type { Permission, SystemRole } from '@tradeops/contracts';
import {
  buildTenantContext,
  normalizeFeatureFlags,
  permissionsForRole,
  resolveEffectivePermissions,
  type TenantContext,
} from '@tradeops/domain';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthContext } from './types';

/**
 * Trusted Tenant Context Resolver.
 * Validates membership server-side; never trusts frontend tenant claims alone.
 */
@Injectable()
export class TenantContextService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolve full tenant context for a user + optional active tenant/workspace.
   * Clears invalid active org/workspace rather than leaking cross-tenant access.
   */
  async resolve(params: {
    userId: string;
    sessionId: string;
    email: string;
    displayName: string;
    activeOrganizationId: string | null;
    activeWorkspaceId?: string | null;
  }): Promise<AuthContext> {
    let activeOrganizationId = params.activeOrganizationId;
    let activeWorkspaceId = params.activeWorkspaceId ?? null;
    let membershipId: string | null = null;
    let role: SystemRole | null = null;
    let roleIds: string[] = [];
    let permissions: readonly Permission[] = [];
    let featureFlags: string[] = [];
    let subscriptionStatus: string | null = null;
    let subscriptionPlan: string | null = null;
    let connectedCapabilities: string[] = [];
    let tenant: TenantContext | null = null;

    if (activeOrganizationId) {
      const membership = await this.prisma.client.membership.findUnique({
        where: {
          organizationId_userId: {
            organizationId: activeOrganizationId,
            userId: params.userId,
          },
        },
        include: {
          organization: true,
          membershipRoles: {
            include: {
              role: {
                include: {
                  rolePermissions: { include: { permission: true } },
                },
              },
            },
          },
          permissionOverrides: {
            include: { permission: true },
          },
        },
      });

      if (!membership || membership.status !== 'active') {
        activeOrganizationId = null;
        activeWorkspaceId = null;
      } else if (membership.organization.tenantStatus === 'closed') {
        activeOrganizationId = null;
        activeWorkspaceId = null;
      } else {
        membershipId = membership.id;
        role = membership.role as SystemRole;

        // Base permissions from legacy system role matrix
        let base = [...permissionsForRole(role)] as Permission[];

        // Union permissions from assigned DB roles
        roleIds = membership.membershipRoles.map((mr) => mr.roleId);
        for (const mr of membership.membershipRoles) {
          for (const rp of mr.role.rolePermissions) {
            base.push(rp.permission.key as Permission);
          }
        }

        const allows = membership.permissionOverrides
          .filter((o) => o.effect === 'allow')
          .map((o) => o.permission.key);
        const denies = membership.permissionOverrides
          .filter((o) => o.effect === 'deny')
          .map((o) => o.permission.key);

        permissions = resolveEffectivePermissions({ base, allows, denies });

        featureFlags = normalizeFeatureFlags(
          membership.organization.featureFlags as Record<string, unknown> | string[] | null,
        );
        subscriptionStatus = membership.organization.subscriptionStatus;
        subscriptionPlan =
          membership.organization.subscriptionPlan ?? membership.organization.planTier;

        // Connected capabilities from connector installs
        const installs = await this.prisma.client.connectorInstallation.findMany({
          where: { organizationId: activeOrganizationId },
          select: { providerKey: true, status: true },
        });
        connectedCapabilities = installs
          .filter((i) => i.status === 'connected')
          .map((i) => i.providerKey);

        // Validate workspace membership if set
        if (activeWorkspaceId) {
          const ws = await this.prisma.client.workspace.findFirst({
            where: {
              id: activeWorkspaceId,
              organizationId: activeOrganizationId,
              status: 'active',
            },
          });
          if (!ws) {
            activeWorkspaceId = null;
          } else {
            // Owner/admin inherit all workspaces; others need workspace membership or default
            const privileged = role === 'owner' || role === 'admin';
            if (!privileged && !ws.isDefault) {
              const wm = await this.prisma.client.workspaceMembership.findUnique({
                where: {
                  workspaceId_userId: {
                    workspaceId: activeWorkspaceId,
                    userId: params.userId,
                  },
                },
              });
              if (!wm) {
                activeWorkspaceId = null;
              } else if (wm.role) {
                // Workspace-local role can further restrict (intersection not expand)
                const wsPerms = new Set(permissionsForRole(wm.role as SystemRole));
                permissions = permissions.filter((p) => wsPerms.has(p));
              }
            }
          }
        }

        // Default workspace if none selected
        if (!activeWorkspaceId) {
          const defaultWs = await this.prisma.client.workspace.findFirst({
            where: { organizationId: activeOrganizationId, isDefault: true },
            orderBy: { createdAt: 'asc' },
          });
          activeWorkspaceId = defaultWs?.id ?? null;
        }

        tenant = buildTenantContext({
          userId: params.userId,
          tenantId: activeOrganizationId,
          workspaceId: activeWorkspaceId,
          membershipId,
          roleIds,
          role,
          permissions,
          featureFlags,
          subscriptionStatus,
          subscriptionPlan,
          connectedCapabilities,
        });
      }
    }

    return {
      userId: params.userId,
      sessionId: params.sessionId,
      activeOrganizationId,
      activeWorkspaceId,
      membershipId,
      role,
      roleIds,
      permissions,
      featureFlags,
      subscriptionStatus,
      subscriptionPlan,
      connectedCapabilities,
      email: params.email,
      displayName: params.displayName,
      tenant,
    };
  }

  /** Require active tenant context or throw 403. */
  requireTenant(auth: AuthContext): TenantContext {
    if (!auth.tenant || !auth.activeOrganizationId || !auth.membershipId) {
      throw new ForbiddenException('Active organization membership required');
    }
    return auth.tenant;
  }

  /** Ensure client-supplied org matches resolved tenant (anti-IDOR). */
  assertRequestedTenant(auth: AuthContext, requestedOrganizationId: string): TenantContext {
    const tenant = this.requireTenant(auth);
    if (tenant.tenantId !== requestedOrganizationId) {
      throw new ForbiddenException('Switch to this organization before accessing it');
    }
    return tenant;
  }
}
