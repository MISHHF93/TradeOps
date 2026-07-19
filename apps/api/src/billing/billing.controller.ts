import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentAuth, Public, RequirePermissions } from '../identity/decorators';
import type { AuthContext } from '../identity/types';
import { BillingService } from './billing.service';
import { CommercePaymentService } from './commerce-payment.service';

@Controller()
export class BillingController {
  constructor(
    private readonly billing: BillingService,
    private readonly commercePayments: CommercePaymentService,
  ) {}

  @Get('billing/plans')
  @RequirePermissions('analytics:read')
  plans() {
    return this.billing.listPlans();
  }

  @Get('billing/subscription')
  @RequirePermissions('analytics:read')
  subscription(@CurrentAuth() auth: AuthContext) {
    this.requireOrg(auth);
    return this.billing.getSubscriptionStatus(auth.activeOrganizationId!);
  }

  @Post('billing/checkout')
  @RequirePermissions('org:write')
  checkout(
    @CurrentAuth() auth: AuthContext,
    @Body()
    body: { planId?: string; interval?: 'month' | 'year'; successUrl?: string; cancelUrl?: string },
  ) {
    this.requireOrg(auth);
    if (!body.planId?.trim()) throw new BadRequestException('planId is required');
    return this.billing.createCheckoutSession({
      organizationId: auth.activeOrganizationId!,
      userId: auth.userId,
      planId: body.planId.trim(),
      interval: body.interval,
      successUrl: body.successUrl,
      cancelUrl: body.cancelUrl,
    });
  }

  @Post('billing/portal')
  @RequirePermissions('org:write')
  portal(
    @CurrentAuth() auth: AuthContext,
    @Body() body: { returnUrl?: string },
  ) {
    this.requireOrg(auth);
    return this.billing.createPortalSession({
      organizationId: auth.activeOrganizationId!,
      userId: auth.userId,
      returnUrl: body?.returnUrl,
    });
  }

  /** Stripe SaaS billing webhooks — signature verified; never trust browser redirect alone */
  @Public()
  @Post('webhooks/stripe')
  stripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string | undefined,
  ) {
    const rawBody =
      req.rawBody?.toString('utf8') ??
      (typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {}));
    return this.billing.handleStripeWebhook({
      rawBody,
      signatureHeader: signature,
    });
  }

  // ——— Commerce payment intelligence (separate domain) ———

  @Get('finance/payments')
  @RequirePermissions('orders:read')
  listPayments(@CurrentAuth() auth: AuthContext) {
    this.requireOrg(auth);
    return this.commercePayments.listPayments(auth.activeOrganizationId!);
  }

  @Get('finance/payouts')
  @RequirePermissions('orders:read')
  listPayouts(@CurrentAuth() auth: AuthContext) {
    this.requireOrg(auth);
    return this.commercePayments.listPayouts(auth.activeOrganizationId!);
  }

  @Get('finance/reconciliations')
  @RequirePermissions('orders:read')
  listReconciliations(@CurrentAuth() auth: AuthContext) {
    this.requireOrg(auth);
    return this.commercePayments.listReconciliations(auth.activeOrganizationId!);
  }

  @Get('finance/disputes')
  @RequirePermissions('orders:read')
  listDisputes(@CurrentAuth() auth: AuthContext) {
    this.requireOrg(auth);
    return this.commercePayments.listDisputes(auth.activeOrganizationId!);
  }

  @Get('finance/payments/:paymentId')
  @RequirePermissions('orders:read')
  getPayment(
    @CurrentAuth() auth: AuthContext,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
  ) {
    this.requireOrg(auth);
    return this.commercePayments.getPaymentDetail(auth.activeOrganizationId!, paymentId);
  }

  @Post('finance/payouts/fixture-reconcile')
  @RequirePermissions('orders:write')
  fixtureReconcile(@CurrentAuth() auth: AuthContext) {
    this.requireOrg(auth);
    return this.commercePayments.createPayoutAndReconcile({
      organizationId: auth.activeOrganizationId!,
      userId: auth.userId,
    });
  }

  private requireOrg(auth: AuthContext): asserts auth is AuthContext & {
    activeOrganizationId: string;
    tenant: NonNullable<AuthContext['tenant']>;
    membershipId: string;
  } {
    if (!auth.activeOrganizationId || !auth.tenant || !auth.membershipId) {
      throw new BadRequestException('Active organization membership required');
    }
  }
}
