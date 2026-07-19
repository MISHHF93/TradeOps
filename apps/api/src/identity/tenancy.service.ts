import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  AssignMembershipRoleRequest,
  CreateTeamRequest,
  CreateWorkspaceRequest,
  SystemRole,
  TeamDto,
  TenantContextEnrichedDto,
  TenantMemberDto,
  WorkspaceDto,
} from '@tradeops/contracts';
import { slugifyOrganizationName } from '@tradeops/domain';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from './audit.service';
import { SessionService, type RequestMeta } from './session.service';
import { TenantContextService } from './tenant-context.service';
import type { AuthContext } from './types';

const SYSTEM_ROLES = new Set<string>([
  'owner',
  'admin',
  'manager',
  'analyst',
  'viewer',
  'developer',
]);

@Injectable()
export class TenancyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    private readonly audit: AuditService,
    private readonly tenantContext: TenantContextService,
  ) {}

  toWorkspaceDto(w: {
    id: string;
    organizationId: string;
    publicId: string;
    name: string;
    slug: string;
    kind: string;
    isDefault: boolean;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  }): WorkspaceDto {
    return {
      id: w.id,
      organizationId: w.organizationId,
      publicId: w.publicId,
      name: w.name,
      slug: w.slug,
      kind: w.kind as WorkspaceDto['kind'],
      isDefault: w.isDefault,
      status: w.status as WorkspaceDto['status'],
      createdAt: w.createdAt.toISOString(),
      updatedAt: w.updatedAt.toISOString(),
    };
  }

  toTeamDto(t: {
    id: string;
    organizationId: string;
    workspaceId: string | null;
    name: string;
    slug: string;
    description: string | null;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  }): TeamDto {
    return {
      id: t.id,
      organizationId: t.organizationId,
      workspaceId: t.workspaceId,
      name: t.name,
      slug: t.slug,
      description: t.description,
      status: t.status as TeamDto['status'],
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    };
  }

  async getCurrentTenant(auth: AuthContext): Promise<TenantContextEnrichedDto | null> {
    if (!auth.tenant) return null;
    const base = auth.tenant;
    const org = await this.prisma.client.organization.findUnique({
      where: { id: base.organizationId },
      select: {
        name: true,
        slug: true,
        commerceMode: true,
        organizationType: true,
      },
    });
    let workspaceName: string | undefined;
    let workspaceSlug: string | undefined;
    if (base.workspaceId) {
      const ws = await this.prisma.client.workspace.findUnique({
        where: { id: base.workspaceId },
        select: { name: true, slug: true },
      });
      workspaceName = ws?.name;
      workspaceSlug = ws?.slug;
    }
    return {
      ...base,
      organizationName: org?.name,
      organizationSlug: org?.slug,
      workspaceName,
      workspaceSlug,
      commerceMode: org?.commerceMode,
      organizationType: org?.organizationType,
    };
  }

  async listMembers(auth: AuthContext): Promise<TenantMemberDto[]> {
    const tenant = this.tenantContext.requireTenant(auth);
    const rows = await this.prisma.client.membership.findMany({
      where: { organizationId: tenant.organizationId },
      include: {
        user: true,
        membershipRoles: { select: { roleId: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((m) => ({
      membershipId: m.id,
      userId: m.userId,
      email: m.user.email,
      displayName: m.user.displayName,
      role: m.role as SystemRole,
      status: m.status,
      workspacePersona: m.workspacePersona,
      roleIds: m.membershipRoles.map((r) => r.roleId),
      createdAt: m.createdAt.toISOString(),
    }));
  }

  async assignMembershipRole(
    auth: AuthContext,
    input: AssignMembershipRoleRequest,
    meta: RequestMeta,
  ): Promise<TenantMemberDto> {
    const tenant = this.tenantContext.requireTenant(auth);
    if (!auth.permissions.includes('members:write' as never)) {
      throw new ForbiddenException('Missing members:write');
    }

    const membership = await this.prisma.client.membership.findFirst({
      where: {
        id: input.membershipId,
        organizationId: tenant.organizationId,
      },
      include: { user: true, membershipRoles: { select: { roleId: true } } },
    });
    if (!membership) {
      throw new NotFoundException('Membership not found in active tenant');
    }

    let roleId = input.roleId;
    let roleKey = input.roleKey;

    if (!roleId && roleKey) {
      const system = await this.prisma.client.role.findFirst({
        where: { key: roleKey, isSystem: true, organizationId: null },
      });
      if (system) {
        roleId = system.id;
      } else {
        const custom = await this.prisma.client.role.findFirst({
          where: { key: roleKey, organizationId: tenant.organizationId },
        });
        if (!custom) {
          throw new NotFoundException(`Role not found: ${roleKey}`);
        }
        roleId = custom.id;
      }
    }

    if (!roleId) {
      throw new ConflictException('roleId or roleKey required');
    }

    // Ensure role is system or belongs to this tenant
    const role = await this.prisma.client.role.findUnique({ where: { id: roleId } });
    if (!role) throw new NotFoundException('Role not found');
    if (role.organizationId && role.organizationId !== tenant.organizationId) {
      throw new ForbiddenException('Role does not belong to active tenant');
    }

    await this.prisma.client.membershipRole.upsert({
      where: {
        membershipId_roleId: { membershipId: membership.id, roleId },
      },
      create: { membershipId: membership.id, roleId },
      update: {},
    });

    if (input.setPrimary !== false && roleKey && SYSTEM_ROLES.has(roleKey)) {
      await this.prisma.client.membership.update({
        where: { id: membership.id },
        data: { role: roleKey as SystemRole },
      });
    }

    await this.audit.write({
      action: 'membership.role.assign',
      resourceType: 'membership',
      resourceId: membership.id,
      organizationId: tenant.organizationId,
      actorUserId: auth.userId,
      metadata: { roleId, roleKey: role.key },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    const refreshed = await this.prisma.client.membership.findUniqueOrThrow({
      where: { id: membership.id },
      include: {
        user: true,
        membershipRoles: { select: { roleId: true } },
      },
    });

    return {
      membershipId: refreshed.id,
      userId: refreshed.userId,
      email: refreshed.user.email,
      displayName: refreshed.user.displayName,
      role: refreshed.role as SystemRole,
      status: refreshed.status,
      workspacePersona: refreshed.workspacePersona,
      roleIds: refreshed.membershipRoles.map((r) => r.roleId),
      createdAt: refreshed.createdAt.toISOString(),
    };
  }

  async listWorkspaces(auth: AuthContext): Promise<WorkspaceDto[]> {
    const tenant = this.tenantContext.requireTenant(auth);
    const rows = await this.prisma.client.workspace.findMany({
      where: { organizationId: tenant.organizationId },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
    return rows.map((w) => this.toWorkspaceDto(w));
  }

  async createWorkspace(
    auth: AuthContext,
    input: CreateWorkspaceRequest,
    meta: RequestMeta,
  ): Promise<WorkspaceDto> {
    const tenant = this.tenantContext.requireTenant(auth);
    if (!auth.permissions.includes('org:write' as never) && !auth.permissions.includes('settings:write' as never)) {
      throw new ForbiddenException('Missing permission to create workspace');
    }

    const slug = input.slug?.trim() || slugifyOrganizationName(input.name);
    const existing = await this.prisma.client.workspace.findUnique({
      where: {
        organizationId_slug: { organizationId: tenant.organizationId, slug },
      },
    });
    if (existing) {
      throw new ConflictException('Workspace slug already taken in this tenant');
    }

    const workspace = await this.prisma.client.workspace.create({
      data: {
        organizationId: tenant.organizationId,
        name: input.name.trim(),
        slug,
        kind: input.kind ?? 'business_unit',
        isDefault: false,
        status: 'active',
      },
    });

    // Grant creator workspace membership
    await this.prisma.client.workspaceMembership.create({
      data: {
        workspaceId: workspace.id,
        membershipId: tenant.membershipId,
        userId: auth.userId,
        organizationId: tenant.organizationId,
        role: auth.role ?? 'viewer',
      },
    });

    await this.audit.write({
      action: 'workspace.create',
      resourceType: 'workspace',
      resourceId: workspace.id,
      organizationId: tenant.organizationId,
      actorUserId: auth.userId,
      metadata: { slug },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return this.toWorkspaceDto(workspace);
  }

  async switchWorkspace(
    auth: AuthContext,
    workspaceId: string,
    meta: RequestMeta,
  ): Promise<AuthContext> {
    const tenant = this.tenantContext.requireTenant(auth);

    const workspace = await this.prisma.client.workspace.findFirst({
      where: {
        id: workspaceId,
        organizationId: tenant.organizationId,
        status: 'active',
      },
    });
    if (!workspace) {
      throw new NotFoundException('Workspace not found in active tenant');
    }

    const privileged = auth.role === 'owner' || auth.role === 'admin';
    if (!privileged && !workspace.isDefault) {
      const wm = await this.prisma.client.workspaceMembership.findUnique({
        where: {
          workspaceId_userId: { workspaceId, userId: auth.userId },
        },
      });
      if (!wm) {
        await this.audit.write({
          action: 'workspace.switch_denied',
          resourceType: 'workspace',
          resourceId: workspaceId,
          organizationId: tenant.organizationId,
          actorUserId: auth.userId,
          metadata: { reason: 'not_a_workspace_member' },
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
        });
        throw new ForbiddenException('You are not a member of this workspace');
      }
    }

    await this.sessions.setActiveWorkspace(auth.sessionId, workspaceId);

    await this.audit.write({
      action: 'workspace.switch',
      resourceType: 'workspace',
      resourceId: workspaceId,
      organizationId: tenant.organizationId,
      actorUserId: auth.userId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return this.tenantContext.resolve({
      userId: auth.userId,
      sessionId: auth.sessionId,
      email: auth.email,
      displayName: auth.displayName,
      activeOrganizationId: tenant.organizationId,
      activeWorkspaceId: workspaceId,
    });
  }

  async listTeams(auth: AuthContext): Promise<TeamDto[]> {
    const tenant = this.tenantContext.requireTenant(auth);
    const rows = await this.prisma.client.team.findMany({
      where: { organizationId: tenant.organizationId },
      orderBy: { name: 'asc' },
    });
    return rows.map((t) => this.toTeamDto(t));
  }

  async createTeam(
    auth: AuthContext,
    input: CreateTeamRequest,
    meta: RequestMeta,
  ): Promise<TeamDto> {
    const tenant = this.tenantContext.requireTenant(auth);
    if (!auth.permissions.includes('members:write' as never) && !auth.permissions.includes('org:write' as never)) {
      throw new ForbiddenException('Missing permission to create team');
    }

    const slug = input.slug?.trim() || slugifyOrganizationName(input.name);
    if (input.workspaceId) {
      const ws = await this.prisma.client.workspace.findFirst({
        where: { id: input.workspaceId, organizationId: tenant.organizationId },
      });
      if (!ws) {
        throw new NotFoundException('Workspace not found in active tenant');
      }
    }

    const existing = await this.prisma.client.team.findUnique({
      where: {
        organizationId_slug: { organizationId: tenant.organizationId, slug },
      },
    });
    if (existing) {
      throw new ConflictException('Team slug already taken in this tenant');
    }

    const team = await this.prisma.client.team.create({
      data: {
        organizationId: tenant.organizationId,
        workspaceId: input.workspaceId ?? tenant.workspaceId ?? null,
        name: input.name.trim(),
        slug,
        description: input.description?.trim() ?? null,
        status: 'active',
      },
    });

    await this.prisma.client.teamMembership.create({
      data: {
        teamId: team.id,
        membershipId: tenant.membershipId,
        userId: auth.userId,
        organizationId: tenant.organizationId,
        role: auth.role ?? 'viewer',
      },
    });

    await this.audit.write({
      action: 'team.create',
      resourceType: 'team',
      resourceId: team.id,
      organizationId: tenant.organizationId,
      actorUserId: auth.userId,
      metadata: { slug },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return this.toTeamDto(team);
  }

  /**
   * Ensure every tenant has a default workspace (idempotent).
   */
  async ensureDefaultWorkspace(organizationId: string, membershipId: string, userId: string) {
    let workspace = await this.prisma.client.workspace.findFirst({
      where: { organizationId, isDefault: true },
    });
    if (!workspace) {
      workspace = await this.prisma.client.workspace.create({
        data: {
          organizationId,
          name: 'Default',
          slug: 'default',
          kind: 'default',
          isDefault: true,
          status: 'active',
        },
      });
    }
    await this.prisma.client.workspaceMembership.upsert({
      where: {
        workspaceId_userId: { workspaceId: workspace.id, userId },
      },
      create: {
        workspaceId: workspace.id,
        membershipId,
        userId,
        organizationId,
      },
      update: {},
    });
    return workspace;
  }
}
