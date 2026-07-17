import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../identity/audit.service';

function asJson(value: unknown): object {
  return value as object;
}

/**
 * Merchant commerce payments — shopper money on channels.
 * Never mixed with SaaS BillingAccount / Subscription.
 */
@Injectable()
export class CommercePaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listPayments(organizationId: string) {
    const rows = await this.prisma.client.commercePayment.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        customerOrder: {
          select: { id: true, externalId: true, status: true, totalMinor: true },
        },
      },
    });
    return {
      domain: 'commerce_payments' as const,
      payments: rows.map((p) => ({
        id: p.id,
        customerOrderId: p.customerOrderId,
        orderExternalId: p.customerOrder.externalId,
        orderStatus: p.customerOrder.status,
        channel: p.channel,
        provider: p.provider,
        externalPaymentId: p.externalPaymentId,
        currency: p.currency,
        authorizedAmountMinor: p.authorizedAmountMinor,
        capturedAmountMinor: p.capturedAmountMinor,
        refundedAmountMinor: p.refundedAmountMinor,
        feeAmountMinor: p.feeAmountMinor,
        netAmountMinor: p.netAmountMinor,
        status: p.status,
        createdAt: p.createdAt,
      })),
      honesty: {
        note: 'These are channel/shopper payments — not TradeOps SaaS subscription charges.',
      },
    };
  }

  async listPayouts(organizationId: string) {
    const rows = await this.prisma.client.commercePayout.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return {
      domain: 'commerce_payouts' as const,
      payouts: rows,
      honesty: {
        note: 'Marketplace/processor payouts to the merchant — separate from Stripe SaaS invoices.',
      },
    };
  }

  async listReconciliations(organizationId: string) {
    const rows = await this.prisma.client.paymentReconciliation.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { commercePayout: true },
    });
    return { reconciliations: rows };
  }

  async listDisputes(organizationId: string) {
    const rows = await this.prisma.client.commerceDispute.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        commercePayment: {
          select: {
            id: true,
            externalPaymentId: true,
            customerOrderId: true,
            status: true,
            capturedAmountMinor: true,
            currency: true,
          },
        },
      },
    });
    return {
      domain: 'commerce_disputes' as const,
      disputes: rows,
      honesty: {
        note: 'Channel chargebacks/disputes — not SaaS billing dunning.',
      },
    };
  }

  async getPaymentDetail(organizationId: string, paymentId: string) {
    const payment = await this.prisma.client.commercePayment.findFirst({
      where: { id: paymentId, organizationId },
      include: {
        customerOrder: {
          select: {
            id: true,
            externalId: true,
            status: true,
            totalMinor: true,
            currency: true,
          },
        },
        refunds: { orderBy: { createdAt: 'desc' } },
        disputes: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!payment) throw new NotFoundException('Commerce payment not found');
    return {
      domain: 'commerce_payments' as const,
      payment,
      readiness: this.paymentReadinessForOrder(payment),
    };
  }

  /**
   * Normalize a channel payment event into CommercePayment.
   * Idempotent on (org, provider, externalPaymentId).
   */
  async upsertNormalizedPayment(input: {
    organizationId: string;
    customerOrderId: string;
    channel: string;
    provider: string;
    externalPaymentId: string;
    currency: string;
    authorizedAmountMinor?: number;
    capturedAmountMinor?: number;
    refundedAmountMinor?: number;
    feeAmountMinor?: number;
    status:
      | 'pending'
      | 'authorized'
      | 'captured'
      | 'partially_refunded'
      | 'refunded'
      | 'failed'
      | 'disputed'
      | 'cancelled';
    rawProviderStatus?: string;
    metadata?: Record<string, unknown>;
  }) {
    const order = await this.prisma.client.customerOrder.findFirst({
      where: { id: input.customerOrderId, organizationId: input.organizationId },
    });
    if (!order) throw new NotFoundException('Customer order not found');

    const captured = input.capturedAmountMinor ?? 0;
    const fee = input.feeAmountMinor ?? 0;
    const net = captured - fee - (input.refundedAmountMinor ?? 0);

    const payment = await this.prisma.client.commercePayment.upsert({
      where: {
        organizationId_provider_externalPaymentId: {
          organizationId: input.organizationId,
          provider: input.provider,
          externalPaymentId: input.externalPaymentId,
        },
      },
      create: {
        organizationId: input.organizationId,
        customerOrderId: input.customerOrderId,
        channel: input.channel,
        provider: input.provider,
        externalPaymentId: input.externalPaymentId,
        currency: input.currency,
        authorizedAmountMinor: input.authorizedAmountMinor ?? 0,
        capturedAmountMinor: captured,
        refundedAmountMinor: input.refundedAmountMinor ?? 0,
        feeAmountMinor: input.feeAmountMinor ?? null,
        netAmountMinor: net,
        status: input.status,
        rawProviderStatus: input.rawProviderStatus ?? null,
        metadataJson: asJson(input.metadata ?? {}),
      },
      update: {
        authorizedAmountMinor: input.authorizedAmountMinor ?? 0,
        capturedAmountMinor: captured,
        refundedAmountMinor: input.refundedAmountMinor ?? 0,
        feeAmountMinor: input.feeAmountMinor ?? null,
        netAmountMinor: net,
        status: input.status,
        rawProviderStatus: input.rawProviderStatus ?? null,
      },
    });

    return payment;
  }

  /**
   * When fixture/channel orders are ingested, attach a captured payment record.
   */
  async ensurePaymentForOrder(input: {
    organizationId: string;
    orderId: string;
    channel: string;
    totalMinor: number;
    currency: string;
    isFixture?: boolean;
  }) {
    return this.upsertNormalizedPayment({
      organizationId: input.organizationId,
      customerOrderId: input.orderId,
      channel: input.channel,
      provider: input.isFixture ? 'fixture-payments' : input.channel,
      externalPaymentId: `pay_${input.orderId}`,
      currency: input.currency,
      authorizedAmountMinor: input.totalMinor,
      capturedAmountMinor: input.totalMinor,
      feeAmountMinor: Math.round(input.totalMinor * 0.029) + 30,
      status: 'captured',
      rawProviderStatus: 'captured',
      metadata: {
        fixture: Boolean(input.isFixture),
        label: input.isFixture ? 'TEST FIXTURE — NOT LIVE PAYMENT' : 'channel_normalized',
      },
    });
  }

  /**
   * Source-ready gate: supplier PO must not proceed without acceptable payment.
   */
  async assertOrderPaymentReady(organizationId: string, orderId: string): Promise<void> {
    const order = await this.prisma.client.customerOrder.findFirst({
      where: { id: orderId, organizationId },
    });
    if (!order) throw new NotFoundException('Order not found');

    if (order.status === 'cancelled' || order.status === 'refunded') {
      throw new ForbiddenException('Order cancelled or refunded — cannot source');
    }

    const payment = await this.prisma.client.commercePayment.findFirst({
      where: { organizationId, customerOrderId: orderId },
      orderBy: { createdAt: 'desc' },
    });

    if (!payment) {
      throw new ForbiddenException(
        'No commerce payment record for order — cannot submit supplier purchase until payment is verified',
      );
    }

    if (!['captured', 'authorized'].includes(payment.status)) {
      throw new ForbiddenException(
        `Payment status ${payment.status} is not source-ready (need captured or authorized)`,
      );
    }

    if (payment.status === 'authorized') {
      // Policy: allow authorized only when configured
      if (process.env.TRADEOPS_ALLOW_AUTHORIZED_SOURCING !== 'true') {
        throw new ForbiddenException(
          'Payment authorized but not captured — set TRADEOPS_ALLOW_AUTHORIZED_SOURCING=true to allow sourcing',
        );
      }
    }

    if (payment.capturedAmountMinor + payment.authorizedAmountMinor <= 0) {
      throw new ForbiddenException('Payment amount is zero — cannot source');
    }

    if (payment.currency !== order.currency) {
      throw new ForbiddenException('Payment currency does not match order currency');
    }
  }

  async recordRefund(input: {
    organizationId: string;
    commercePaymentId: string;
    externalRefundId: string;
    amountMinor: number;
    currency: string;
    reason?: string;
    provider?: string;
  }) {
    const payment = await this.prisma.client.commercePayment.findFirst({
      where: { id: input.commercePaymentId, organizationId: input.organizationId },
    });
    if (!payment) throw new NotFoundException('Commerce payment not found');
    if (input.amountMinor <= 0) throw new BadRequestException('Refund amount must be positive');

    const refund = await this.prisma.client.commerceRefund.upsert({
      where: {
        organizationId_provider_externalRefundId: {
          organizationId: input.organizationId,
          provider: input.provider ?? payment.provider,
          externalRefundId: input.externalRefundId,
        },
      },
      create: {
        organizationId: input.organizationId,
        commercePaymentId: payment.id,
        customerOrderId: payment.customerOrderId,
        provider: input.provider ?? payment.provider,
        externalRefundId: input.externalRefundId,
        amountMinor: input.amountMinor,
        currency: input.currency,
        status: 'succeeded',
        reason: input.reason ?? null,
      },
      update: {
        amountMinor: input.amountMinor,
        status: 'succeeded',
        reason: input.reason ?? null,
      },
    });

    const newRefunded = payment.refundedAmountMinor + input.amountMinor;
    const status =
      newRefunded >= payment.capturedAmountMinor
        ? 'refunded'
        : newRefunded > 0
          ? 'partially_refunded'
          : payment.status;

    await this.prisma.client.commercePayment.update({
      where: { id: payment.id },
      data: {
        refundedAmountMinor: newRefunded,
        status,
        netAmountMinor:
          payment.capturedAmountMinor -
          (payment.feeAmountMinor ?? 0) -
          newRefunded,
      },
    });

    return refund;
  }

  /**
   * Fixture/demo payout + simple reconciliation against captured payments.
   */
  async createPayoutAndReconcile(input: {
    organizationId: string;
    provider?: string;
    externalPayoutId?: string;
    userId?: string | null;
  }) {
    const payments = await this.prisma.client.commercePayment.findMany({
      where: {
        organizationId: input.organizationId,
        status: { in: ['captured', 'partially_refunded', 'refunded'] },
      },
    });

    const gross = payments.reduce((s, p) => s + p.capturedAmountMinor, 0);
    const fees = payments.reduce((s, p) => s + (p.feeAmountMinor ?? 0), 0);
    const refunds = payments.reduce((s, p) => s + p.refundedAmountMinor, 0);
    const expectedNet = gross - fees - refunds;

    const payout = await this.prisma.client.commercePayout.upsert({
      where: {
        organizationId_provider_externalPayoutId: {
          organizationId: input.organizationId,
          provider: input.provider ?? 'fixture-marketplace',
          externalPayoutId:
            input.externalPayoutId ?? `po_fixture_${input.organizationId.slice(0, 8)}`,
        },
      },
      create: {
        organizationId: input.organizationId,
        provider: input.provider ?? 'fixture-marketplace',
        externalPayoutId:
          input.externalPayoutId ?? `po_fixture_${input.organizationId.slice(0, 8)}`,
        grossAmountMinor: gross,
        feeAmountMinor: fees,
        netAmountMinor: expectedNet,
        currency: payments[0]?.currency ?? 'USD',
        status: 'paid',
        arrivedAt: new Date(),
        metadataJson: {
          fixture: true,
          label: 'TEST FIXTURE PAYOUT — NOT LIVE SETTLEMENT',
        },
      },
      update: {
        grossAmountMinor: gross,
        feeAmountMinor: fees,
        netAmountMinor: expectedNet,
        status: 'paid',
        arrivedAt: new Date(),
      },
    });

    const variance = payout.netAmountMinor - expectedNet;
    const reconciliation = await this.prisma.client.paymentReconciliation.create({
      data: {
        organizationId: input.organizationId,
        commercePayoutId: payout.id,
        status: variance === 0 ? 'matched' : 'variance',
        expectedNetMinor: expectedNet,
        actualNetMinor: payout.netAmountMinor,
        varianceMinor: variance,
        matchedOrderCount: payments.length,
        unmatchedAmountMinor: Math.abs(variance),
        summaryJson: {
          grossSalesMinor: gross,
          refundsMinor: refunds,
          processorFeesMinor: fees,
          marketplaceFeesMinor: 0,
          netPayoutMinor: payout.netAmountMinor,
          unmatchedAmountMinor: Math.abs(variance),
        },
        closedAt: variance === 0 ? new Date() : null,
      },
    });

    await this.audit.write({
      action: 'commerce.payout.reconciled',
      resourceType: 'payment_reconciliation',
      resourceId: reconciliation.id,
      organizationId: input.organizationId,
      actorUserId: input.userId ?? null,
      metadata: { payoutId: payout.id, variance },
    });

    return { payout, reconciliation };
  }

  paymentReadinessForOrder(payment: {
    status: string;
    capturedAmountMinor: number;
    authorizedAmountMinor: number;
  }): { ready: boolean; reason: string } {
    if (payment.status === 'captured' && payment.capturedAmountMinor > 0) {
      return { ready: true, reason: 'Payment captured' };
    }
    if (
      payment.status === 'authorized' &&
      payment.authorizedAmountMinor > 0 &&
      process.env.TRADEOPS_ALLOW_AUTHORIZED_SOURCING === 'true'
    ) {
      return { ready: true, reason: 'Payment authorized (policy allows)' };
    }
    return { ready: false, reason: `Not source-ready: ${payment.status}` };
  }
}
