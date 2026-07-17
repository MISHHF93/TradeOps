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
import { CapitalService } from './capital.service';
import { MarketplaceAccountsService } from './marketplace-accounts.service';
import type { WaterfallInputs } from './distribution-waterfall';

@Controller()
export class CapitalController {
  constructor(
    private readonly capital: CapitalService,
    private readonly marketplace: MarketplaceAccountsService,
  ) {}

  // ——— Domain catalog & gates (always readable for honesty) ———

  @Get('capital/status')
  @RequirePermissions('analytics:read')
  networkStatus() {
    return this.capital.getNetworkStatus();
  }

  @Get('capital/gates')
  @RequirePermissions('analytics:read')
  gates() {
    return this.capital.getNetworkStatus();
  }

  // ——— Marketplace Connect (domain 2b) ———

  @Get('marketplace/accounts')
  @RequirePermissions('connectors:read')
  listMarketplaceAccounts(@CurrentAuth() auth: AuthContext) {
    this.requireOrg(auth);
    return this.marketplace.listAccounts(auth.activeOrganizationId!);
  }

  @Get('marketplace/status')
  @RequirePermissions('connectors:read')
  marketplaceStatus(@CurrentAuth() auth: AuthContext) {
    this.requireOrg(auth);
    return this.marketplace.getStatus(auth.activeOrganizationId!);
  }

  @Post('marketplace/accounts/onboard')
  @RequirePermissions('org:write')
  onboardMarketplace(
    @CurrentAuth() auth: AuthContext,
    @Body() body: { role?: 'merchant' | 'supplier' | 'service_provider' },
  ) {
    this.requireOrg(auth);
    return this.marketplace.startOnboarding({
      organizationId: auth.activeOrganizationId!,
      userId: auth.userId,
      role: body?.role,
    });
  }

  @Post('marketplace/transfers')
  @RequirePermissions('org:write')
  proposeTransfer(
    @CurrentAuth() auth: AuthContext,
    @Body()
    body: {
      amountMinor?: number;
      currency?: string;
      purpose?: string;
      platformFeeMinor?: number;
      idempotencyKey?: string;
      toAccountId?: string;
    },
  ) {
    this.requireOrg(auth);
    if (body.amountMinor == null) throw new BadRequestException('amountMinor required');
    if (!body.currency?.trim()) throw new BadRequestException('currency required');
    if (!body.purpose?.trim()) throw new BadRequestException('purpose required');
    if (!body.idempotencyKey?.trim()) throw new BadRequestException('idempotencyKey required');
    return this.marketplace.proposeTransfer({
      organizationId: auth.activeOrganizationId!,
      userId: auth.userId,
      amountMinor: body.amountMinor,
      currency: body.currency,
      purpose: body.purpose,
      platformFeeMinor: body.platformFeeMinor,
      idempotencyKey: body.idempotencyKey,
      toAccountId: body.toAccountId,
    });
  }

  // ——— Commerce Capital (domain 3) ———

  @Get('capital/campaigns')
  @RequirePermissions('analytics:read')
  listCampaigns(@CurrentAuth() auth: AuthContext) {
    this.requireOrg(auth);
    return this.capital.listCampaigns(auth.activeOrganizationId!);
  }

  @Get('capital/campaigns/:campaignId')
  @RequirePermissions('analytics:read')
  getCampaign(
    @CurrentAuth() auth: AuthContext,
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
  ) {
    this.requireOrg(auth);
    return this.capital.getCampaign(auth.activeOrganizationId!, campaignId);
  }

  @Post('capital/campaigns')
  @RequirePermissions('org:write')
  createCampaign(
    @CurrentAuth() auth: AuthContext,
    @Body()
    body: {
      title?: string;
      description?: string;
      capitalTargetMinor?: number;
      currency?: string;
      fundingModel?: string;
      inventoryBudgetMinor?: number;
      advertisingBudgetMinor?: number;
      fulfillmentBudgetMinor?: number;
      operatingReserveMinor?: number;
      platformFeesMinor?: number;
      productId?: string;
      supplierId?: string;
      economicsJson?: Record<string, unknown>;
      riskDisclosureJson?: Record<string, unknown>;
    },
  ) {
    this.requireOrg(auth);
    if (!body.title?.trim()) throw new BadRequestException('title required');
    if (body.capitalTargetMinor == null) {
      throw new BadRequestException('capitalTargetMinor required');
    }
    return this.capital.createCampaign({
      organizationId: auth.activeOrganizationId!,
      userId: auth.userId,
      title: body.title,
      description: body.description,
      capitalTargetMinor: body.capitalTargetMinor,
      currency: body.currency,
      fundingModel: body.fundingModel,
      inventoryBudgetMinor: body.inventoryBudgetMinor,
      advertisingBudgetMinor: body.advertisingBudgetMinor,
      fulfillmentBudgetMinor: body.fulfillmentBudgetMinor,
      operatingReserveMinor: body.operatingReserveMinor,
      platformFeesMinor: body.platformFeesMinor,
      productId: body.productId,
      supplierId: body.supplierId,
      economicsJson: body.economicsJson,
      riskDisclosureJson: body.riskDisclosureJson,
    });
  }

  @Post('capital/providers')
  @RequirePermissions('org:write')
  createProvider(
    @CurrentAuth() auth: AuthContext,
    @Body() body: { displayName?: string; jurisdiction?: string },
  ) {
    this.requireOrg(auth);
    if (!body.displayName?.trim()) throw new BadRequestException('displayName required');
    return this.capital.createSandboxProvider({
      organizationId: auth.activeOrganizationId!,
      userId: auth.userId,
      displayName: body.displayName,
      jurisdiction: body.jurisdiction,
    });
  }

  @Post('capital/commitments')
  @RequirePermissions('org:write')
  createCommitment(
    @CurrentAuth() auth: AuthContext,
    @Body()
    body: {
      campaignId?: string;
      capitalProviderId?: string;
      committedAmountMinor?: number;
      simulateFunded?: boolean;
    },
  ) {
    this.requireOrg(auth);
    if (!body.campaignId) throw new BadRequestException('campaignId required');
    if (!body.capitalProviderId) throw new BadRequestException('capitalProviderId required');
    if (body.committedAmountMinor == null) {
      throw new BadRequestException('committedAmountMinor required');
    }
    return this.capital.createCommitment({
      organizationId: auth.activeOrganizationId!,
      userId: auth.userId,
      campaignId: body.campaignId,
      capitalProviderId: body.capitalProviderId,
      committedAmountMinor: body.committedAmountMinor,
      simulateFunded: body.simulateFunded,
    });
  }

  @Post('capital/disbursements')
  @RequirePermissions('org:write')
  proposeDisbursement(
    @CurrentAuth() auth: AuthContext,
    @Body()
    body: {
      campaignId?: string;
      budgetLine?: string;
      amountMinor?: number;
      purpose?: string;
      recipientType?: string;
      recipientId?: string;
      idempotencyKey?: string;
      evidenceJson?: Record<string, unknown>;
    },
  ) {
    this.requireOrg(auth);
    if (!body.campaignId) throw new BadRequestException('campaignId required');
    if (!body.budgetLine) throw new BadRequestException('budgetLine required');
    if (body.amountMinor == null) throw new BadRequestException('amountMinor required');
    if (!body.purpose?.trim()) throw new BadRequestException('purpose required');
    if (!body.recipientType?.trim()) throw new BadRequestException('recipientType required');
    if (!body.idempotencyKey?.trim()) throw new BadRequestException('idempotencyKey required');
    return this.capital.proposeDisbursement({
      organizationId: auth.activeOrganizationId!,
      userId: auth.userId,
      campaignId: body.campaignId,
      budgetLine: body.budgetLine,
      amountMinor: body.amountMinor,
      purpose: body.purpose,
      recipientType: body.recipientType,
      recipientId: body.recipientId,
      idempotencyKey: body.idempotencyKey,
      evidenceJson: body.evidenceJson,
    });
  }

  @Post('capital/disbursements/:disbursementId/approve-sandbox')
  @RequirePermissions('org:write')
  approveDisbursement(
    @CurrentAuth() auth: AuthContext,
    @Param('disbursementId', ParseUUIDPipe) disbursementId: string,
  ) {
    this.requireOrg(auth);
    return this.capital.approveSandboxDisbursement({
      organizationId: auth.activeOrganizationId!,
      userId: auth.userId,
      disbursementId,
    });
  }

  @Post('capital/waterfall/dry-run')
  @RequirePermissions('analytics:read')
  dryRunWaterfall(@Body() body: WaterfallInputs) {
    if (body?.grossSalesMinor == null || body?.capitalFundedMinor == null) {
      throw new BadRequestException('waterfall inputs required');
    }
    return this.capital.dryRunWaterfall({
      currency: body.currency ?? 'CAD',
      grossSalesMinor: Number(body.grossSalesMinor),
      refundsMinor: Number(body.refundsMinor ?? 0),
      taxesMinor: Number(body.taxesMinor ?? 0),
      processorFeesMinor: Number(body.processorFeesMinor ?? 0),
      marketplaceFeesMinor: Number(body.marketplaceFeesMinor ?? 0),
      supplierCostsMinor: Number(body.supplierCostsMinor ?? 0),
      fulfillmentCostsMinor: Number(body.fulfillmentCostsMinor ?? 0),
      advertisingSpendMinor: Number(body.advertisingSpendMinor ?? 0),
      reserveRestoreMinor: Number(body.reserveRestoreMinor ?? 0),
      capitalFundedMinor: Number(body.capitalFundedMinor),
      platformFeeBps: Number(body.platformFeeBps ?? 0),
      capitalProfitShareBps: Number(body.capitalProfitShareBps ?? 0),
    });
  }

  @Post('capital/campaigns/:campaignId/distributions/calculate')
  @RequirePermissions('org:write')
  calculateDistribution(
    @CurrentAuth() auth: AuthContext,
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Body() body: WaterfallInputs,
  ) {
    this.requireOrg(auth);
    return this.capital.calculateAndStoreDistribution({
      organizationId: auth.activeOrganizationId!,
      userId: auth.userId,
      campaignId,
      waterfall: {
        currency: body.currency ?? 'CAD',
        grossSalesMinor: Number(body.grossSalesMinor ?? 0),
        refundsMinor: Number(body.refundsMinor ?? 0),
        taxesMinor: Number(body.taxesMinor ?? 0),
        processorFeesMinor: Number(body.processorFeesMinor ?? 0),
        marketplaceFeesMinor: Number(body.marketplaceFeesMinor ?? 0),
        supplierCostsMinor: Number(body.supplierCostsMinor ?? 0),
        fulfillmentCostsMinor: Number(body.fulfillmentCostsMinor ?? 0),
        advertisingSpendMinor: Number(body.advertisingSpendMinor ?? 0),
        reserveRestoreMinor: Number(body.reserveRestoreMinor ?? 0),
        capitalFundedMinor: Number(body.capitalFundedMinor ?? 0),
        platformFeeBps: Number(body.platformFeeBps ?? 0),
        capitalProfitShareBps: Number(body.capitalProfitShareBps ?? 0),
      },
    });
  }

  private requireOrg(auth: AuthContext): asserts auth is AuthContext & {
    activeOrganizationId: string;
  } {
    if (!auth.activeOrganizationId) {
      throw new BadRequestException('Active organization required');
    }
  }
}
