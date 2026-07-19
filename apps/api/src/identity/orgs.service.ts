import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthResponse, CreateOrganizationRequest, OrganizationDto } from '@tradeops/contracts';
import { isValidOrganizationSlug, roleHasPermission, slugifyOrganizationName } from '@tradeops/domain';
import type { SystemRole } from '@tradeops/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from './audit.service';
import { toAuthResponse, toOrganizationDto } from './dto/mappers';
import { SessionService, type RequestMeta } from './session.service';

@Injectable()
export class OrgsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    private readonly audit: AuditService,
  ) {}

  async listForUser(userId: string): Promise<OrganizationDto[]> {
    const memberships = await this.prisma.client.membership.findMany({
      where: { userId },
      include: { organization: true },
      orderBy: { createdAt: 'asc' },
    });
    return memberships.map((m) => toOrganizationDto(m.organization));
  }

  async create(
    userId: string,
    sessionId: string,
    input: CreateOrganizationRequest,
    meta: RequestMeta,
  ): Promise<AuthResponse> {
    let slug = input.slug?.trim() || slugifyOrganizationName(input.name);
    if (!isValidOrganizationSlug(slug)) {
      throw new ConflictException('Invalid organization slug');
    }

    const existing = await this.prisma.client.organization.findUnique({ where: { slug } });
    if (existing) {
      throw new ConflictException('Organization slug already taken');
    }

    const organization = await this.prisma.client.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: input.name.trim(),
          slug,
          organizationType: 'retailer',
          commerceMode: 'retail',
          tenantStatus: 'active',
          subscriptionStatus: 'trialing',
          onboardingStatus: 'created',
        },
      });
      const membership = await tx.membership.create({
        data: {
          userId,
          organizationId: org.id,
          role: 'owner',
          status: 'active',
        },
      });
      const workspace = await tx.workspace.create({
        data: {
          organizationId: org.id,
          name: 'Default',
          slug: 'default',
          kind: 'default',
          isDefault: true,
          status: 'active',
        },
      });
      await tx.workspaceMembership.create({
        data: {
          workspaceId: workspace.id,
          membershipId: membership.id,
          userId,
          organizationId: org.id,
          role: 'owner',
        },
      });
      return { org, workspaceId: workspace.id };
    });

    await this.sessions.setActiveTenant(sessionId, organization.org.id, organization.workspaceId);

    await this.audit.write({
      action: 'org.create',
      resourceType: 'organization',
      resourceId: organization.org.id,
      organizationId: organization.org.id,
      actorUserId: userId,
      metadata: { slug: organization.org.slug },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    const user = await this.prisma.client.user.findUniqueOrThrow({ where: { id: userId } });
    const memberships = await this.prisma.client.membership.findMany({
      where: { userId },
      include: { organization: true },
      orderBy: { createdAt: 'asc' },
    });

    return toAuthResponse({
      user,
      memberships,
      activeOrganizationId: organization.org.id,
      activeWorkspaceId: organization.workspaceId,
    });
  }

  async switchActive(
    userId: string,
    sessionId: string,
    organizationId: string,
    meta: RequestMeta,
  ): Promise<AuthResponse> {
    const membership = await this.prisma.client.membership.findUnique({
      where: {
        organizationId_userId: { organizationId, userId },
      },
    });

    if (!membership) {
      await this.audit.write({
        action: 'org.switch_denied',
        resourceType: 'organization',
        resourceId: organizationId,
        actorUserId: userId,
        metadata: { reason: 'not_a_member' },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
      throw new ForbiddenException('You are not a member of this organization');
    }

    let defaultWs = await this.prisma.client.workspace.findFirst({
      where: { organizationId, isDefault: true },
    });
    if (!defaultWs) {
      defaultWs = await this.prisma.client.workspace.create({
        data: {
          organizationId,
          name: 'Default',
          slug: 'default',
          kind: 'default',
          isDefault: true,
          status: 'active',
        },
      });
      await this.prisma.client.workspaceMembership.upsert({
        where: {
          workspaceId_userId: { workspaceId: defaultWs.id, userId },
        },
        create: {
          workspaceId: defaultWs.id,
          membershipId: membership.id,
          userId,
          organizationId,
          role: membership.role,
        },
        update: {},
      });
    }

    await this.sessions.setActiveTenant(sessionId, organizationId, defaultWs.id);

    await this.audit.write({
      action: 'org.switch',
      resourceType: 'organization',
      resourceId: organizationId,
      organizationId,
      actorUserId: userId,
      metadata: { workspaceId: defaultWs.id },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    const user = await this.prisma.client.user.findUniqueOrThrow({ where: { id: userId } });
    const memberships = await this.prisma.client.membership.findMany({
      where: { userId },
      include: { organization: true },
      orderBy: { createdAt: 'asc' },
    });

    return toAuthResponse({
      user,
      memberships,
      activeOrganizationId: organizationId,
      activeWorkspaceId: defaultWs.id,
    });
  }

  async listMembers(
    actorUserId: string,
    activeOrganizationId: string | null,
    organizationId: string,
  ): Promise<
    Array<{
      id: string;
      organizationId: string;
      userId: string;
      role: SystemRole;
      createdAt: string;
      updatedAt: string;
      user: {
        id: string;
        email: string;
        displayName: string;
        createdAt: string;
        updatedAt: string;
      };
    }>
  > {
    if (!activeOrganizationId || activeOrganizationId !== organizationId) {
      throw new ForbiddenException('Switch to this organization before listing members');
    }

    const actorMembership = await this.prisma.client.membership.findUnique({
      where: {
        organizationId_userId: { organizationId, userId: actorUserId },
      },
    });
    if (!actorMembership) {
      throw new ForbiddenException('Not a member of this organization');
    }

    if (!roleHasPermission(actorMembership.role as SystemRole, 'members:read')) {
      throw new ForbiddenException('Missing permission: members:read');
    }

    const members = await this.prisma.client.membership.findMany({
      where: { organizationId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return members.map((m) => ({
      id: m.id,
      organizationId: m.organizationId,
      userId: m.userId,
      role: m.role as SystemRole,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
      user: {
        id: m.user.id,
        email: m.user.email,
        displayName: m.user.displayName,
        createdAt: m.user.createdAt.toISOString(),
        updatedAt: m.user.updatedAt.toISOString(),
      },
    }));
  }

  async getOrganizationForMember(
    userId: string,
    organizationId: string,
  ): Promise<OrganizationDto> {
    const membership = await this.prisma.client.membership.findUnique({
      where: {
        organizationId_userId: { organizationId, userId },
      },
      include: { organization: true },
    });
    if (!membership) {
      throw new NotFoundException('Organization not found');
    }
    return toOrganizationDto(membership.organization);
  }
}
