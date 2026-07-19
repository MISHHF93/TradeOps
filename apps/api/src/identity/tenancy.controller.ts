import { BadRequestException, Body, Controller, Get, Post, Req } from '@nestjs/common';
import {
  assignMembershipRoleRequestSchema,
  createTeamRequestSchema,
  createWorkspaceRequestSchema,
  switchWorkspaceRequestSchema,
  type AssignMembershipRoleRequest,
  type AuthResponse,
  type CreateTeamRequest,
  type CreateWorkspaceRequest,
  type SwitchWorkspaceRequest,
  type TeamDto,
  type TenantContextEnrichedDto,
  type TenantMemberDto,
  type WorkspaceDto,
} from '@tradeops/contracts';
import type { Request } from 'express';
import { CurrentAuth, RequirePermissions } from './decorators';
import { toAuthResponse } from './dto/mappers';
import { PrismaService } from '../prisma/prisma.service';
import { TenancyService } from './tenancy.service';
import type { AuthContext } from './types';

function requestMeta(req: Request) {
  return {
    ipAddress: req.ip ?? req.socket.remoteAddress ?? null,
    userAgent: req.headers['user-agent'] ?? null,
  };
}

function parseBody<T>(
  schema: {
    safeParse: (
      data: unknown,
    ) =>
      | { success: true; data: T }
      | { success: false; error: { issues: { message: string; path: (string | number)[] }[] } };
  },
  body: unknown,
): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    const message = result.error.issues
      .map((i) => `${i.path.join('.') || 'body'}: ${i.message}`)
      .join('; ');
    throw new BadRequestException(message);
  }
  return result.data;
}

@Controller('tenancy')
export class TenancyController {
  constructor(
    private readonly tenancy: TenancyService,
    private readonly prisma: PrismaService,
  ) {}

  /** Server-resolved tenant context for the current session (never client-only). */
  @Get('context')
  @RequirePermissions('org:read')
  async context(@CurrentAuth() auth: AuthContext): Promise<TenantContextEnrichedDto | null> {
    return this.tenancy.getCurrentTenant(auth);
  }

  @Get('members')
  @RequirePermissions('members:read')
  async members(@CurrentAuth() auth: AuthContext): Promise<TenantMemberDto[]> {
    return this.tenancy.listMembers(auth);
  }

  @Post('members/roles')
  @RequirePermissions('members:write')
  async assignRole(
    @CurrentAuth() auth: AuthContext,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<TenantMemberDto> {
    const input = parseBody<AssignMembershipRoleRequest>(
      assignMembershipRoleRequestSchema,
      body,
    );
    return this.tenancy.assignMembershipRole(auth, input, requestMeta(req));
  }

  @Get('workspaces')
  @RequirePermissions('org:read')
  async workspaces(@CurrentAuth() auth: AuthContext): Promise<WorkspaceDto[]> {
    return this.tenancy.listWorkspaces(auth);
  }

  @Post('workspaces')
  @RequirePermissions('org:write')
  async createWorkspace(
    @CurrentAuth() auth: AuthContext,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<WorkspaceDto> {
    const input = parseBody<CreateWorkspaceRequest>(createWorkspaceRequestSchema, body);
    return this.tenancy.createWorkspace(auth, input, requestMeta(req));
  }

  @Post('workspaces/switch')
  @RequirePermissions('org:read')
  async switchWorkspace(
    @CurrentAuth() auth: AuthContext,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<AuthResponse> {
    const input = parseBody<SwitchWorkspaceRequest>(switchWorkspaceRequestSchema, body);
    const next = await this.tenancy.switchWorkspace(auth, input.workspaceId, requestMeta(req));

    const user = await this.prisma.client.user.findUniqueOrThrow({ where: { id: next.userId } });
    const memberships = await this.prisma.client.membership.findMany({
      where: { userId: next.userId },
      include: { organization: true },
      orderBy: { createdAt: 'asc' },
    });

    return toAuthResponse({
      user,
      memberships,
      activeOrganizationId: next.activeOrganizationId,
      activeWorkspaceId: next.activeWorkspaceId,
    });
  }

  @Get('teams')
  @RequirePermissions('members:read')
  async teams(@CurrentAuth() auth: AuthContext): Promise<TeamDto[]> {
    return this.tenancy.listTeams(auth);
  }

  @Post('teams')
  @RequirePermissions('members:write')
  async createTeam(
    @CurrentAuth() auth: AuthContext,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<TeamDto> {
    const input = parseBody<CreateTeamRequest>(createTeamRequestSchema, body);
    return this.tenancy.createTeam(auth, input, requestMeta(req));
  }
}
