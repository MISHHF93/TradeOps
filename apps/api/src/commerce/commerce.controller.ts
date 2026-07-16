import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { CurrentAuth, RequirePermissions } from '../identity/decorators';
import type { AuthContext } from '../identity/types';
import { CommerceService } from './commerce.service';

@Controller()
export class CommerceController {
  constructor(private readonly commerce: CommerceService) {}

  @Get('connectors')
  @RequirePermissions('connectors:read')
  listConnectors(@CurrentAuth() auth: AuthContext) {
    this.requireOrg(auth);
    return this.commerce.listConnectors(auth.activeOrganizationId!);
  }

  @Post('commerce/import/fixture-supplier')
  @RequirePermissions('products:write')
  importFixture(@CurrentAuth() auth: AuthContext) {
    this.requireOrg(auth);
    return this.commerce.importFromFixtureSupplier(auth.activeOrganizationId!, auth.userId);
  }

  @Get('terminal/scanner')
  @RequirePermissions('products:read')
  scanner(@CurrentAuth() auth: AuthContext) {
    this.requireOrg(auth);
    return this.commerce.scanner(auth.activeOrganizationId!);
  }

  @Get('terminal/signals')
  @RequirePermissions('analytics:read')
  signals(@CurrentAuth() auth: AuthContext) {
    this.requireOrg(auth);
    return this.commerce.signalFeed(auth.activeOrganizationId!);
  }

  @Get('terminal/portfolio')
  @RequirePermissions('analytics:read')
  portfolio(@CurrentAuth() auth: AuthContext) {
    this.requireOrg(auth);
    return this.commerce.portfolio(auth.activeOrganizationId!);
  }

  @Get('products/:productId')
  @RequirePermissions('products:read')
  product(
    @CurrentAuth() auth: AuthContext,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    this.requireOrg(auth);
    return this.commerce.productDetail(auth.activeOrganizationId!, productId);
  }

  @Post('products/:productId/rescore')
  @RequirePermissions('products:write')
  rescore(
    @CurrentAuth() auth: AuthContext,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    this.requireOrg(auth);
    return this.commerce.rescoreProduct(auth.activeOrganizationId!, productId);
  }

  @Post('products/:productId/listing-draft')
  @RequirePermissions('products:write')
  listingDraft(
    @CurrentAuth() auth: AuthContext,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    this.requireOrg(auth);
    return this.commerce.createListingDraft(auth.activeOrganizationId!, auth.userId, productId);
  }

  @Post('products/:productId/simulate')
  @RequirePermissions('ai:write')
  simulate(
    @CurrentAuth() auth: AuthContext,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    this.requireOrg(auth);
    return this.commerce.runSimulation(auth.activeOrganizationId!, auth.userId, productId);
  }

  @Get('approvals')
  @RequirePermissions('orders:read')
  approvals(@CurrentAuth() auth: AuthContext) {
    this.requireOrg(auth);
    return this.commerce.listApprovals(auth.activeOrganizationId!);
  }

  @Post('approvals/:approvalId/decide')
  @RequirePermissions('orders:write')
  decide(
    @CurrentAuth() auth: AuthContext,
    @Param('approvalId', ParseUUIDPipe) approvalId: string,
    @Body() body: { decision?: string },
  ) {
    this.requireOrg(auth);
    const decision = body.decision === 'rejected' ? 'rejected' : 'approved';
    return this.commerce.decideApproval(
      auth.activeOrganizationId!,
      auth.userId,
      approvalId,
      decision,
    );
  }

  @Post('orders/ingest/fixture')
  @RequirePermissions('orders:write')
  ingestOrders(@CurrentAuth() auth: AuthContext) {
    this.requireOrg(auth);
    return this.commerce.ingestFixtureOrders(auth.activeOrganizationId!, auth.userId);
  }

  @Get('orders')
  @RequirePermissions('orders:read')
  orders(@CurrentAuth() auth: AuthContext) {
    this.requireOrg(auth);
    return this.commerce.listOrders(auth.activeOrganizationId!);
  }

  @Get('terminal/pipeline')
  @RequirePermissions('analytics:read')
  pipeline(@CurrentAuth() auth: AuthContext) {
    this.requireOrg(auth);
    return this.commerce.getPipelineStatus(auth.activeOrganizationId!);
  }

  @Post('orders/:orderId/complete-fulfillment')
  @RequirePermissions('orders:write')
  completeFulfillment(
    @CurrentAuth() auth: AuthContext,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    this.requireOrg(auth);
    return this.commerce.completeFulfillment(
      auth.activeOrganizationId!,
      auth.userId,
      orderId,
    );
  }

  @Post('terminal/evaluate')
  @RequirePermissions('ai:write')
  evaluate(@CurrentAuth() auth: AuthContext) {
    this.requireOrg(auth);
    return this.commerce.evaluateAndImprove(auth.activeOrganizationId!, auth.userId);
  }

  /**
   * Local vertical-slice one-shot: sim → listing → approve → orders → fulfill → evaluate.
   */
  @Post('terminal/demo-loop')
  @RequirePermissions('products:write', 'orders:write', 'ai:write')
  demoLoop(@CurrentAuth() auth: AuthContext) {
    this.requireOrg(auth);
    return this.commerce.runDemoLoop(auth.activeOrganizationId!, auth.userId);
  }

  @Get('terminal/prediction-outcomes')
  @RequirePermissions('analytics:read')
  outcomes(@CurrentAuth() auth: AuthContext) {
    this.requireOrg(auth);
    return this.commerce.listPredictionOutcomes(auth.activeOrganizationId!);
  }

  private requireOrg(auth: AuthContext): asserts auth is AuthContext & {
    activeOrganizationId: string;
  } {
    if (!auth.activeOrganizationId) {
      throw new BadRequestException('Active organization required');
    }
  }
}
