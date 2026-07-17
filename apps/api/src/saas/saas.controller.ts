import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import type { CustomerSegment, WorkspacePersona } from '@tradeops/saas-entitlements';
import { CurrentAuth, RequirePermissions } from '../identity/decorators';
import type { AuthContext } from '../identity/types';
import { SaasService } from './saas.service';

@Controller('saas')
export class SaasController {
  constructor(private readonly saas: SaasService) {}

  @Get('packs')
  @RequirePermissions('org:read')
  packs() {
    return this.saas.listPacks();
  }

  @Get('tenant')
  @RequirePermissions('org:read')
  tenant(@CurrentAuth() auth: AuthContext) {
    if (!auth.activeOrganizationId) {
      return { error: 'No active organization' };
    }
    return this.saas.getTenantContext(auth.activeOrganizationId, auth.userId);
  }

  @Post('onboarding')
  @RequirePermissions('org:write')
  onboarding(
    @CurrentAuth() auth: AuthContext,
    @Body()
    body: {
      segment?: CustomerSegment;
      businessModel?: string;
      onboardingStep?: string;
      onboardingComplete?: boolean;
      workspacePersona?: WorkspacePersona;
    },
  ) {
    if (!auth.activeOrganizationId) {
      return { error: 'No active organization' };
    }
    return this.saas.updateOnboarding(auth.activeOrganizationId, auth.userId, body);
  }

  @Put('workspace-persona')
  @RequirePermissions('org:read')
  setPersona(
    @CurrentAuth() auth: AuthContext,
    @Body() body: { workspacePersona?: WorkspacePersona },
  ) {
    if (!auth.activeOrganizationId || !body.workspacePersona) {
      return { error: 'organization and workspacePersona required' };
    }
    return this.saas.setWorkspacePersona(
      auth.activeOrganizationId,
      auth.userId,
      body.workspacePersona,
    );
  }

  @Get('founder-cockpit')
  @RequirePermissions('analytics:read', 'products:read')
  founderCockpit(@CurrentAuth() auth: AuthContext) {
    if (!auth.activeOrganizationId) return { error: 'No active organization' };
    return this.saas.founderCockpit(auth.activeOrganizationId);
  }

  @Get('channel-profitability/:productId')
  @RequirePermissions('analytics:read', 'products:read')
  channelProfit(
    @CurrentAuth() auth: AuthContext,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    if (!auth.activeOrganizationId) return { error: 'No active organization' };
    return this.saas.channelProfitability(auth.activeOrganizationId, productId);
  }

  @Get('agentic-readiness')
  @RequirePermissions('analytics:read', 'products:read')
  agenticTenant(@CurrentAuth() auth: AuthContext) {
    if (!auth.activeOrganizationId) return { error: 'No active organization' };
    return this.saas.agenticReadiness(auth.activeOrganizationId);
  }

  @Get('agentic-readiness/:productId')
  @RequirePermissions('analytics:read', 'products:read')
  agenticProduct(
    @CurrentAuth() auth: AuthContext,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    if (!auth.activeOrganizationId) return { error: 'No active organization' };
    return this.saas.agenticReadiness(auth.activeOrganizationId, productId);
  }

  @Get('control-tower')
  @RequirePermissions('analytics:read')
  controlTower(@CurrentAuth() auth: AuthContext) {
    if (!auth.activeOrganizationId) return { error: 'No active organization' };
    return this.saas.controlTower(auth.activeOrganizationId);
  }

  @Get('atp/:productId')
  @RequirePermissions('inventory:read', 'products:read')
  atp(
    @CurrentAuth() auth: AuthContext,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    if (!auth.activeOrganizationId) return { error: 'No active organization' };
    return this.saas.productAtp(auth.activeOrganizationId, productId);
  }

  @Get('customers/intelligence')
  @RequirePermissions('analytics:read', 'orders:read')
  customers(@CurrentAuth() auth: AuthContext) {
    if (!auth.activeOrganizationId) return { error: 'No active organization' };
    return this.saas.customerIntelligenceFromOrders(auth.activeOrganizationId);
  }

  @Get('agency/clients')
  @RequirePermissions('org:read')
  agencyClients(@CurrentAuth() auth: AuthContext) {
    if (!auth.activeOrganizationId) return { error: 'No active organization' };
    return this.saas.listAgencyClients(auth.activeOrganizationId, auth.userId);
  }

  @Post('agency/clients')
  @RequirePermissions('org:write')
  createAgencyClient(
    @CurrentAuth() auth: AuthContext,
    @Body() body: { name?: string },
  ) {
    if (!auth.activeOrganizationId) return { error: 'No active organization' };
    if (!body.name?.trim()) return { error: 'name required' };
    return this.saas.createAgencyClient(auth.activeOrganizationId, auth.userId, {
      name: body.name,
    });
  }
}
