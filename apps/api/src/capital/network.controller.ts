import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
} from '@nestjs/common';
import { CurrentAuth, RequirePermissions } from '../identity/decorators';
import type { AuthContext } from '../identity/types';
import { NetworkCapitalService } from './network-capital.service';
import { listProviderCapabilities } from './providers/types';
import { capitalModeCatalog } from '@tradeops/config';

@Controller('network')
export class NetworkController {
  constructor(private readonly network: NetworkCapitalService) {}

  @Get('status')
  @RequirePermissions('analytics:read')
  status() {
    return this.network.getNetworkOverview();
  }

  @Get('providers')
  @RequirePermissions('connectors:read')
  providers() {
    return {
      providers: listProviderCapabilities(),
      mode: capitalModeCatalog(),
    };
  }

  @Get('portfolio')
  @RequirePermissions('analytics:read')
  portfolio(@CurrentAuth() auth: AuthContext) {
    this.requireOrg(auth);
    return this.network.getPortfolio(auth.activeOrganizationId!);
  }

  @Get('capital')
  @RequirePermissions('analytics:read')
  capital(@CurrentAuth() auth: AuthContext) {
    this.requireOrg(auth);
    return this.network.getPortfolio(auth.activeOrganizationId!);
  }

  @Post('capital/accounts')
  @RequirePermissions('org:write')
  createAccount(
    @CurrentAuth() auth: AuthContext,
    @Body() body: { currency?: string },
  ) {
    this.requireOrg(auth);
    return this.network.getOrCreateCapitalAccount({
      organizationId: auth.activeOrganizationId!,
      userId: auth.userId,
      currency: body?.currency,
    });
  }

  @Post('capital/mandates')
  @RequirePermissions('org:write')
  createMandate(
    @CurrentAuth() auth: AuthContext,
    @Body()
    body: {
      capitalAccountId?: string;
      maximumCapitalMinor?: number;
      maximumProductExposureMinor?: number;
      maximumDailySpendMinor?: number;
      maximumMonthlySpendMinor?: number;
      maximumAdvertisingMinor?: number;
      minimumMarginBps?: number;
      approvalThresholdMinor?: number;
      maximumDeliveryDays?: number;
      allowedChannels?: string[];
      allowedCategories?: string[];
      allowedCountries?: string[];
      riskLevel?: 'conservative' | 'balanced' | 'growth';
      approve?: boolean;
    },
  ) {
    this.requireOrg(auth);
    if (!body.capitalAccountId) throw new BadRequestException('capitalAccountId required');
    if (body.maximumCapitalMinor == null) {
      throw new BadRequestException('maximumCapitalMinor required');
    }
    return this.network.upsertMandate({
      organizationId: auth.activeOrganizationId!,
      userId: auth.userId,
      capitalAccountId: body.capitalAccountId,
      maximumCapitalMinor: body.maximumCapitalMinor,
      maximumProductExposureMinor: body.maximumProductExposureMinor,
      maximumDailySpendMinor: body.maximumDailySpendMinor,
      maximumMonthlySpendMinor: body.maximumMonthlySpendMinor,
      maximumAdvertisingMinor: body.maximumAdvertisingMinor,
      minimumMarginBps: body.minimumMarginBps,
      approvalThresholdMinor: body.approvalThresholdMinor,
      maximumDeliveryDays: body.maximumDeliveryDays,
      allowedChannels: body.allowedChannels,
      allowedCategories: body.allowedCategories,
      allowedCountries: body.allowedCountries,
      riskLevel: body.riskLevel,
      approve: body.approve,
    });
  }

  @Post('capital/funding')
  @RequirePermissions('org:write')
  funding(
    @CurrentAuth() auth: AuthContext,
    @Body()
    body: {
      capitalAccountId?: string;
      amountMinor?: number;
      currency?: string;
      idempotencyKey?: string;
      simulateConfirm?: boolean;
    },
  ) {
    this.requireOrg(auth);
    if (!body.capitalAccountId) throw new BadRequestException('capitalAccountId required');
    if (body.amountMinor == null) throw new BadRequestException('amountMinor required');
    if (!body.idempotencyKey?.trim()) throw new BadRequestException('idempotencyKey required');
    return this.network.createFundingIntent({
      organizationId: auth.activeOrganizationId!,
      userId: auth.userId,
      capitalAccountId: body.capitalAccountId,
      amountMinor: body.amountMinor,
      currency: body.currency,
      idempotencyKey: body.idempotencyKey,
      simulateConfirm: body.simulateConfirm,
    });
  }

  @Get('allocations')
  @RequirePermissions('analytics:read')
  allocations(@CurrentAuth() auth: AuthContext) {
    this.requireOrg(auth);
    return this.network.listAllocations(auth.activeOrganizationId!);
  }

  @Post('allocations')
  @RequirePermissions('org:write')
  proposeAllocation(
    @CurrentAuth() auth: AuthContext,
    @Body()
    body: {
      capitalAccountId?: string;
      mandateId?: string;
      amountMinor?: number;
      productId?: string;
      commerceCaseId?: string;
      channel?: string;
      category?: string;
      country?: string;
      expectedMarginBps?: number;
      deliveryDays?: number;
      isAdvertising?: boolean;
      idempotencyKey?: string;
      economicsJson?: Record<string, unknown>;
    },
  ) {
    this.requireOrg(auth);
    if (!body.capitalAccountId) throw new BadRequestException('capitalAccountId required');
    if (body.amountMinor == null) throw new BadRequestException('amountMinor required');
    if (!body.idempotencyKey?.trim()) throw new BadRequestException('idempotencyKey required');
    return this.network.proposeAllocation({
      organizationId: auth.activeOrganizationId!,
      userId: auth.userId,
      capitalAccountId: body.capitalAccountId,
      mandateId: body.mandateId,
      amountMinor: body.amountMinor,
      productId: body.productId,
      commerceCaseId: body.commerceCaseId,
      channel: body.channel,
      category: body.category,
      country: body.country,
      expectedMarginBps: body.expectedMarginBps,
      deliveryDays: body.deliveryDays,
      isAdvertising: body.isAdvertising,
      idempotencyKey: body.idempotencyKey,
      economicsJson: body.economicsJson,
    });
  }

  @Get('performance')
  @RequirePermissions('analytics:read')
  performance(@CurrentAuth() auth: AuthContext) {
    this.requireOrg(auth);
    return this.network.getPortfolio(auth.activeOrganizationId!);
  }

  @Get('payouts')
  @RequirePermissions('analytics:read')
  payouts(@CurrentAuth() auth: AuthContext) {
    this.requireOrg(auth);
    return {
      payouts: [],
      withdrawableMinor: 0,
      note: 'Client payouts require partner rails, settlement matching, and reserve rules. Not available as internal transfer.',
      blocked: [
        'unsettled revenue',
        'disputed funds',
        'required reserves',
        'open supplier allocations',
        'compliance review holds',
      ],
      organizationId: auth.activeOrganizationId,
    };
  }

  private requireOrg(auth: AuthContext): asserts auth is AuthContext & {
    activeOrganizationId: string;
  } {
    if (!auth.activeOrganizationId) {
      throw new BadRequestException('Active organization required');
    }
  }
}
