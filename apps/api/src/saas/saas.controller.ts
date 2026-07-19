import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import type { CustomerSegment, WorkspacePersona } from '@tradeops/saas-entitlements';
import { CurrentAuth, RequirePermissions } from '../identity/decorators';
import { requireOrgId } from '../identity/require-tenant';
import type { AuthContext } from '../identity/types';
import { SaasService } from './saas.service';

/**
 * SaaS surface — always tenant-scoped via server-resolved membership (requireOrgId).
 */
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
    const organizationId = requireOrgId(auth);
    return this.saas.getTenantContext(organizationId, auth.userId);
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
    const organizationId = requireOrgId(auth);
    return this.saas.updateOnboarding(organizationId, auth.userId, body);
  }

  @Put('workspace-persona')
  @RequirePermissions('org:read')
  setPersona(
    @CurrentAuth() auth: AuthContext,
    @Body() body: { workspacePersona?: WorkspacePersona },
  ) {
    const organizationId = requireOrgId(auth);
    if (!body.workspacePersona) {
      return { error: 'workspacePersona required' };
    }
    return this.saas.setWorkspacePersona(organizationId, auth.userId, body.workspacePersona);
  }

  @Get('founder-cockpit')
  @RequirePermissions('analytics:read', 'products:read')
  founderCockpit(@CurrentAuth() auth: AuthContext) {
    return this.saas.founderCockpit(requireOrgId(auth));
  }

  @Get('channel-profitability/:productId')
  @RequirePermissions('analytics:read', 'products:read')
  channelProfit(
    @CurrentAuth() auth: AuthContext,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    return this.saas.channelProfitability(requireOrgId(auth), productId);
  }

  @Get('agentic-readiness')
  @RequirePermissions('analytics:read', 'products:read')
  agenticTenant(@CurrentAuth() auth: AuthContext) {
    return this.saas.agenticReadiness(requireOrgId(auth));
  }

  @Get('agentic-readiness/:productId')
  @RequirePermissions('analytics:read', 'products:read')
  agenticProduct(
    @CurrentAuth() auth: AuthContext,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    return this.saas.agenticReadiness(requireOrgId(auth), productId);
  }

  @Get('control-tower')
  @RequirePermissions('analytics:read')
  controlTower(@CurrentAuth() auth: AuthContext) {
    return this.saas.controlTower(requireOrgId(auth));
  }

  @Get('atp/:productId')
  @RequirePermissions('inventory:read', 'products:read')
  atp(
    @CurrentAuth() auth: AuthContext,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    return this.saas.productAtp(requireOrgId(auth), productId);
  }

  @Get('customers/intelligence')
  @RequirePermissions('analytics:read', 'orders:read')
  customers(@CurrentAuth() auth: AuthContext) {
    return this.saas.customerIntelligenceFromOrders(requireOrgId(auth));
  }

  @Get('agency/clients')
  @RequirePermissions('org:read')
  agencyClients(@CurrentAuth() auth: AuthContext) {
    return this.saas.listAgencyClients(requireOrgId(auth), auth.userId);
  }

  @Post('agency/clients')
  @RequirePermissions('org:write')
  createAgencyClient(
    @CurrentAuth() auth: AuthContext,
    @Body() body: { name?: string },
  ) {
    const organizationId = requireOrgId(auth);
    if (!body.name?.trim()) return { error: 'name required' };
    return this.saas.createAgencyClient(organizationId, auth.userId, {
      name: body.name,
    });
  }
}
