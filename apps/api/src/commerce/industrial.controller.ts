import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { CurrentAuth, RequirePermissions } from '../identity/decorators';
import type { AuthContext } from '../identity/types';
import { IndustrialService } from './industrial.service';
import type {
  IndustrialProductProfile,
  SupplierQuoteLine,
  TechnicalRequirement,
} from '@tradeops/commerce-engine';

@Controller('industrial')
export class IndustrialController {
  constructor(private readonly industrial: IndustrialService) {}

  private requireOrg(auth: AuthContext): string {
    if (!auth.activeOrganizationId) throw new Error('No active organization');
    return auth.activeOrganizationId;
  }

  @Get('catalog')
  @RequirePermissions('products:read')
  catalog(@CurrentAuth() auth: AuthContext) {
    this.requireOrg(auth);
    return this.industrial.catalog();
  }

  @Get('products')
  @RequirePermissions('products:read')
  listProducts(@CurrentAuth() auth: AuthContext, @Query('take') take?: string) {
    return this.industrial.listIndustrialProducts(
      this.requireOrg(auth),
      Number(take ?? 50) || 50,
    );
  }

  @Get('products/:productId')
  @RequirePermissions('products:read')
  getProduct(
    @CurrentAuth() auth: AuthContext,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    return this.industrial.getIndustrialProduct(this.requireOrg(auth), productId);
  }

  @Post('products/:productId/profile')
  @RequirePermissions('products:write')
  upsertProfile(
    @CurrentAuth() auth: AuthContext,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() body: Partial<IndustrialProductProfile>,
  ) {
    return this.industrial.upsertIndustrialProfile(
      this.requireOrg(auth),
      productId,
      body ?? {},
    );
  }

  @Post('procurement/evaluate')
  @RequirePermissions('products:read', 'ai:read')
  evaluateProcurement(
    @CurrentAuth() auth: AuthContext,
    @Body()
    body: {
      productId: string;
      requirements?: TechnicalRequirement[];
      quotes?: SupplierQuoteLine[];
      quantity?: number;
    },
  ) {
    if (!body?.productId) {
      return { error: 'productId is required' };
    }
    return this.industrial.evaluateProcurement(this.requireOrg(auth), body);
  }

  @Get('twin')
  @RequirePermissions('products:read', 'analytics:read')
  twin(@CurrentAuth() auth: AuthContext) {
    return this.industrial.digitalTwin(this.requireOrg(auth));
  }

  @Get('twin/neighborhood')
  @RequirePermissions('products:read', 'analytics:read')
  twinNeighborhood(
    @CurrentAuth() auth: AuthContext,
    @Query('nodeId') nodeId?: string,
  ) {
    if (!nodeId?.trim()) return { error: 'nodeId is required' };
    return this.industrial.twinFocus(this.requireOrg(auth), nodeId.trim());
  }
}
