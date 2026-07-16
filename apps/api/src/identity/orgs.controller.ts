import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import {
  createOrganizationRequestSchema,
  switchOrganizationRequestSchema,
  type AuthResponse,
  type CreateOrganizationRequest,
  type OrganizationDto,
  type SwitchOrganizationRequest,
} from '@tradeops/contracts';
import { BadRequestException } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentAuth, RequirePermissions } from './decorators';
import { OrgsService } from './orgs.service';
import type { AuthContext } from './types';

function requestMeta(req: Request) {
  return {
    ipAddress: req.ip ?? req.socket.remoteAddress ?? null,
    userAgent: req.headers['user-agent'] ?? null,
  };
}

function parseBody<T>(schema: { safeParse: (data: unknown) => { success: true; data: T } | { success: false; error: { issues: { message: string; path: (string | number)[] }[] } } }, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    const message = result.error.issues
      .map((i) => `${i.path.join('.') || 'body'}: ${i.message}`)
      .join('; ');
    throw new BadRequestException(message);
  }
  return result.data;
}

@Controller('organizations')
export class OrgsController {
  constructor(private readonly orgsService: OrgsService) {}

  @Get()
  async list(@CurrentAuth() auth: AuthContext): Promise<OrganizationDto[]> {
    return this.orgsService.listForUser(auth.userId);
  }

  @Post()
  async create(
    @CurrentAuth() auth: AuthContext,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<AuthResponse> {
    const input = parseBody<CreateOrganizationRequest>(createOrganizationRequestSchema, body);
    return this.orgsService.create(auth.userId, auth.sessionId, input, requestMeta(req));
  }

  @Post('switch')
  async switchOrg(
    @CurrentAuth() auth: AuthContext,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<AuthResponse> {
    const input = parseBody<SwitchOrganizationRequest>(switchOrganizationRequestSchema, body);
    return this.orgsService.switchActive(
      auth.userId,
      auth.sessionId,
      input.organizationId,
      requestMeta(req),
    );
  }

  @Get(':organizationId')
  @RequirePermissions('org:read')
  async getOne(
    @CurrentAuth() auth: AuthContext,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
  ): Promise<OrganizationDto> {
    // Enforce path org matches active org via service membership check + permission guard
    if (auth.activeOrganizationId !== organizationId) {
      throw new BadRequestException('Switch to this organization before accessing it');
    }
    return this.orgsService.getOrganizationForMember(auth.userId, organizationId);
  }

  @Get(':organizationId/members')
  @RequirePermissions('members:read')
  async members(
    @CurrentAuth() auth: AuthContext,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
  ): Promise<Awaited<ReturnType<OrgsService['listMembers']>>> {
    return this.orgsService.listMembers(auth.userId, auth.activeOrganizationId, organizationId);
  }
}
