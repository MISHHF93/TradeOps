import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../identity/audit.service';
import {
  SAAS_PLANS,
  getPlan,
  mapStripeSubscriptionStatus,
  planTierForSaasPlan,
  resolveStripePriceId,
  type SaasPlanId,
} from './billing-plans';
import { redactSecrets, verifyStripeWebhookSignature } from './stripe-crypto';

function asJson(value: unknown): object {
  return value as object;
}

function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

/**
 * TradeOps SaaS billing (orgs pay TradeOps).
 * Separate from merchant commerce payments on channels.
 */
@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  listPlans() {
    return {
      plans: SAAS_PLANS.map((p) => ({
        id: p.id,
        displayName: p.displayName,
        planTier: p.planTier,
        description: p.description,
        monthlyPriceMinor: p.monthlyPriceMinor,
        annualPriceMinor: p.annualPriceMinor,
        currency: p.currency,
        stripeLiveCheckout:
          Boolean(process.env[p.stripePriceMonthlyEnv]?.trim()) ||
          Boolean(process.env[p.stripePriceAnnualEnv]?.trim()),
      })),
      mode: stripeConfigured() ? 'stripe_live_or_test_keys' : 'development_fixture',
      honesty: {
        note: stripeConfigured()
          ? 'Stripe secret present — Checkout/Portal use Stripe API. Webhooks must verify signature.'
          : 'No STRIPE_SECRET_KEY — development fixture checkout activates local subscription without card data.',
      },
    };
  }

  async getSubscriptionStatus(organizationId: string) {
    const org = await this.prisma.client.organization.findUniqueOrThrow({
      where: { id: organizationId },
    });
    const account = await this.prisma.client.billingAccount.findUnique({
      where: {
        organizationId_provider: { organizationId, provider: 'stripe' },
      },
    });
    const sub = await this.prisma.client.billingSubscription.findFirst({
      where: { organizationId },
      orderBy: { updatedAt: 'desc' },
    });
    const invoices = await this.prisma.client.billingInvoice.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const accessAllowed = this.isAccessAllowed(account?.status, sub?.status);

    return {
      domain: 'saas_billing' as const,
      organizationId,
      planTier: org.planTier,
      accessAllowed,
      account: account
        ? {
            id: account.id,
            provider: account.provider,
            providerCustomerId: account.providerCustomerId.startsWith('cus_dev_')
              ? account.providerCustomerId
              : `cus_…${account.providerCustomerId.slice(-6)}`,
            status: account.status,
            defaultCurrency: account.defaultCurrency,
          }
        : null,
      subscription: sub
        ? {
            id: sub.id,
            planId: sub.planId,
            status: sub.status,
            periodStart: sub.periodStart,
            periodEnd: sub.periodEnd,
            cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
            providerSubscriptionId: sub.providerSubscriptionId.startsWith('sub_dev_')
              ? sub.providerSubscriptionId
              : `sub_…${sub.providerSubscriptionId.slice(-6)}`,
          }
        : null,
      invoices: invoices.map((i) => ({
        id: i.id,
        status: i.status,
        currency: i.currency,
        amountDueMinor: i.amountDueMinor,
        amountPaidMinor: i.amountPaidMinor,
        hostedInvoiceUrl: i.hostedInvoiceUrl,
        periodStart: i.periodStart,
        periodEnd: i.periodEnd,
      })),
      plans: this.listPlans().plans,
      mode: this.listPlans().mode,
      honesty: this.listPlans().honesty,
    };
  }

  /**
   * Create Checkout Session (Stripe) or activate local fixture subscription.
   * Never trust browser redirect alone — webhook / explicit activateDev confirm.
   */
  async createCheckoutSession(input: {
    organizationId: string;
    userId?: string | null;
    planId: string;
    interval?: 'month' | 'year';
    successUrl?: string;
    cancelUrl?: string;
  }) {
    const plan = getPlan(input.planId);
    if (!plan) throw new BadRequestException(`Unknown plan: ${input.planId}`);
    if (plan.id === 'enterprise' && !resolveStripePriceId(plan, 'month')) {
      throw new BadRequestException(
        'Enterprise plans require sales-assisted checkout or configured Stripe Price IDs',
      );
    }

    const interval = input.interval === 'year' ? 'year' : 'month';
    const webOrigin = process.env.WEB_ORIGIN?.trim() || 'http://localhost:3000';
    const successUrl =
      input.successUrl ??
      `${webOrigin}/app/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = input.cancelUrl ?? `${webOrigin}/app/billing?checkout=cancelled`;

    if (!stripeConfigured()) {
      // Development fixture — no card data; activates after explicit confirmation path
      const activated = await this.activateLocalSubscription({
        organizationId: input.organizationId,
        planId: plan.id,
        userId: input.userId,
        reason: 'dev_checkout_fixture',
      });
      await this.audit.write({
        action: 'billing.checkout.dev_activated',
        resourceType: 'billing_subscription',
        resourceId: activated.subscription.id,
        organizationId: input.organizationId,
        actorUserId: input.userId ?? null,
        metadata: { planId: plan.id, interval, mode: 'development_fixture' },
      });
      return {
        mode: 'development_fixture' as const,
        checkoutUrl: `${webOrigin}/app/billing?dev_activated=1&plan=${plan.id}`,
        sessionId: `cs_dev_${randomUUID()}`,
        subscription: activated.subscription,
        note: 'STRIPE_SECRET_KEY not set — local subscription activated without collecting card data.',
      };
    }

    const account = await this.ensureStripeCustomer(input.organizationId);
    const priceId = resolveStripePriceId(plan, interval);
    if (!priceId) {
      throw new BadRequestException(
        `Stripe Price ID not configured for ${plan.id} (${interval}). Set ${interval === 'year' ? plan.stripePriceAnnualEnv : plan.stripePriceMonthlyEnv}.`,
      );
    }

    const session = await this.stripeRequest<{ id: string; url: string | null }>(
      'POST',
      '/v1/checkout/sessions',
      {
        mode: 'subscription',
        customer: account.providerCustomerId,
        'line_items[0][price]': priceId,
        'line_items[0][quantity]': '1',
        success_url: successUrl,
        cancel_url: cancelUrl,
        client_reference_id: input.organizationId,
        'metadata[organizationId]': input.organizationId,
        'metadata[planId]': plan.id,
        'subscription_data[metadata][organizationId]': input.organizationId,
        'subscription_data[metadata][planId]': plan.id,
      },
    );

    await this.audit.write({
      action: 'billing.checkout.created',
      resourceType: 'billing_account',
      resourceId: account.id,
      organizationId: input.organizationId,
      actorUserId: input.userId ?? null,
      metadata: { planId: plan.id, interval, sessionId: session.id },
    });

    return {
      mode: 'stripe' as const,
      checkoutUrl: session.url,
      sessionId: session.id,
      note: 'Complete payment in Stripe Checkout. Access updates via verified webhook only.',
    };
  }

  async createPortalSession(input: {
    organizationId: string;
    userId?: string | null;
    returnUrl?: string;
  }) {
    const webOrigin = process.env.WEB_ORIGIN?.trim() || 'http://localhost:3000';
    const returnUrl = input.returnUrl ?? `${webOrigin}/app/billing`;

    if (!stripeConfigured()) {
      return {
        mode: 'development_fixture' as const,
        portalUrl: returnUrl,
        note: 'Stripe not configured — portal is a no-op in development fixture mode.',
      };
    }

    const account = await this.prisma.client.billingAccount.findUnique({
      where: {
        organizationId_provider: {
          organizationId: input.organizationId,
          provider: 'stripe',
        },
      },
    });
    if (!account) {
      throw new BadRequestException('No Stripe customer for this organization — start checkout first');
    }

    const session = await this.stripeRequest<{ url: string }>(
      'POST',
      '/v1/billing_portal/sessions',
      {
        customer: account.providerCustomerId,
        return_url: returnUrl,
      },
    );

    await this.audit.write({
      action: 'billing.portal.created',
      resourceType: 'billing_account',
      resourceId: account.id,
      organizationId: input.organizationId,
      actorUserId: input.userId ?? null,
      metadata: {},
    });

    return { mode: 'stripe' as const, portalUrl: session.url };
  }

  /**
   * Stripe webhook entry — verify signature, idempotent process, update entitlements.
   */
  async handleStripeWebhook(input: {
    rawBody: string;
    signatureHeader: string | undefined;
  }) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim() || '';
    const verify = secret
      ? verifyStripeWebhookSignature({
          rawBody: input.rawBody,
          signatureHeader: input.signatureHeader,
          secret,
        })
      : stripeConfigured()
        ? ({ ok: false as const, reason: 'STRIPE_WEBHOOK_SECRET required when STRIPE_SECRET_KEY is set' })
        : ({ ok: true as const, timestamp: Math.floor(Date.now() / 1000) });

    if (!verify.ok) {
      throw new BadRequestException(verify.reason);
    }

    let event: {
      id: string;
      type: string;
      data?: { object?: Record<string, unknown> };
    };
    try {
      event = JSON.parse(input.rawBody) as typeof event;
    } catch {
      throw new BadRequestException('Invalid JSON body');
    }

    if (!event.id || !event.type) {
      throw new BadRequestException('Invalid Stripe event payload');
    }

    const existing = await this.prisma.client.billingWebhookEvent.findUnique({
      where: {
        provider_externalEventId: {
          provider: 'stripe',
          externalEventId: event.id,
        },
      },
    });
    if (existing?.processed) {
      return { received: true, duplicate: true, eventId: event.id };
    }

    const row = existing
      ? existing
      : await this.prisma.client.billingWebhookEvent.create({
          data: {
            provider: 'stripe',
            externalEventId: event.id,
            eventType: event.type,
            signatureValid: true,
            payloadJson: asJson(redactSecrets(event)),
            processed: false,
          },
        });

    try {
      await this.processStripeEvent(event);
      await this.prisma.client.billingWebhookEvent.update({
        where: { id: row.id },
        data: { processed: true, processedAt: new Date() },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await this.prisma.client.billingWebhookEvent.update({
        where: { id: row.id },
        data: { errorMessage: msg.slice(0, 900) },
      });
      this.logger.error(`Stripe webhook processing failed: ${msg}`);
      throw e;
    }

    return { received: true, duplicate: false, eventId: event.id, type: event.type };
  }

  /** Server-side: block premium actions when subscription past_due/cancelled (not founder_direct bypass for AI if configured). */
  async assertBillingAccess(organizationId: string): Promise<void> {
    // Founder-direct local product remains usable without Stripe
    if ((process.env.TRADEOPS_ACCESS_MODE || 'founder_direct') === 'founder_direct') {
      return;
    }
    const status = await this.getSubscriptionStatus(organizationId);
    if (!status.accessAllowed) {
      throw new ServiceUnavailableException(
        'Subscription inactive or past due — update billing to restore full access',
      );
    }
  }

  // ——— internals ———

  private isAccessAllowed(
    accountStatus?: string | null,
    subStatus?: string | null,
  ): boolean {
    if (!accountStatus && !subStatus) {
      // No billing yet — evaluation tier still allowed
      return true;
    }
    if (accountStatus === 'suspended' || accountStatus === 'cancelled') return false;
    if (subStatus === 'active' || subStatus === 'trialing') return true;
    if (subStatus === 'past_due' || subStatus === 'unpaid' || subStatus === 'cancelled') {
      return false;
    }
    return true;
  }

  private async ensureStripeCustomer(organizationId: string) {
    const existing = await this.prisma.client.billingAccount.findUnique({
      where: {
        organizationId_provider: { organizationId, provider: 'stripe' },
      },
    });
    if (existing) return existing;

    const org = await this.prisma.client.organization.findUniqueOrThrow({
      where: { id: organizationId },
    });

    if (!stripeConfigured()) {
      return this.prisma.client.billingAccount.create({
        data: {
          organizationId,
          provider: 'stripe',
          providerCustomerId: `cus_dev_${organizationId.replace(/-/g, '').slice(0, 16)}`,
          status: 'active',
          metadataJson: { mode: 'development_fixture' },
        },
      });
    }

    const customer = await this.stripeRequest<{ id: string }>('POST', '/v1/customers', {
      name: org.name,
      'metadata[organizationId]': organizationId,
      'metadata[slug]': org.slug,
    });

    return this.prisma.client.billingAccount.create({
      data: {
        organizationId,
        provider: 'stripe',
        providerCustomerId: customer.id,
        status: 'active',
        metadataJson: {},
      },
    });
  }

  private async activateLocalSubscription(input: {
    organizationId: string;
    planId: SaasPlanId | string;
    userId?: string | null;
    reason: string;
  }) {
    const plan = getPlan(input.planId) ?? getPlan('founder')!;
    const account = await this.ensureStripeCustomer(input.organizationId);
    const periodStart = new Date();
    const periodEnd = new Date(periodStart);
    periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1);

    const sub = await this.prisma.client.billingSubscription.upsert({
      where: {
        providerSubscriptionId: `sub_dev_${input.organizationId}`,
      },
      create: {
        organizationId: input.organizationId,
        billingAccountId: account.id,
        providerSubscriptionId: `sub_dev_${input.organizationId}`,
        planId: plan.id,
        status: 'active',
        periodStart,
        periodEnd,
        metadataJson: { mode: 'development_fixture', reason: input.reason },
      },
      update: {
        planId: plan.id,
        status: 'active',
        periodStart,
        periodEnd,
        billingAccountId: account.id,
      },
    });

    await this.prisma.client.organization.update({
      where: { id: input.organizationId },
      data: { planTier: planTierForSaasPlan(plan.id) },
    });

    await this.prisma.client.billingAccount.update({
      where: { id: account.id },
      data: { status: 'active' },
    });

    return { account, subscription: sub };
  }

  private async processStripeEvent(event: {
    id: string;
    type: string;
    data?: { object?: Record<string, unknown> };
  }) {
    const obj = event.data?.object ?? {};
    switch (event.type) {
      case 'checkout.session.completed': {
        const orgId =
          (typeof obj.client_reference_id === 'string' && obj.client_reference_id) ||
          (typeof (obj.metadata as { organizationId?: string } | undefined)?.organizationId ===
          'string'
            ? (obj.metadata as { organizationId: string }).organizationId
            : null);
        const planId =
          typeof (obj.metadata as { planId?: string } | undefined)?.planId === 'string'
            ? (obj.metadata as { planId: string }).planId
            : 'founder';
        const subId = typeof obj.subscription === 'string' ? obj.subscription : null;
        if (orgId && subId) {
          await this.syncSubscriptionFromStripe(orgId, subId, planId);
        }
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.created': {
        const subId = typeof obj.id === 'string' ? obj.id : null;
        const orgId =
          typeof (obj.metadata as { organizationId?: string } | undefined)?.organizationId ===
          'string'
            ? (obj.metadata as { organizationId: string }).organizationId
            : null;
        const planId =
          typeof (obj.metadata as { planId?: string } | undefined)?.planId === 'string'
            ? (obj.metadata as { planId: string }).planId
            : 'founder';
        if (orgId && subId) {
          await this.applySubscriptionObject(orgId, obj, planId);
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const orgId =
          typeof (obj.metadata as { organizationId?: string } | undefined)?.organizationId ===
          'string'
            ? (obj.metadata as { organizationId: string }).organizationId
            : null;
        const subId = typeof obj.id === 'string' ? obj.id : null;
        if (orgId && subId) {
          await this.prisma.client.billingSubscription.updateMany({
            where: { organizationId: orgId, providerSubscriptionId: subId },
            data: { status: 'cancelled' },
          });
          await this.prisma.client.organization.update({
            where: { id: orgId },
            data: { planTier: 'evaluation' },
          });
        }
        break;
      }
      case 'invoice.paid':
      case 'invoice.payment_failed': {
        await this.syncInvoiceObject(obj, event.type);
        break;
      }
      default:
        this.logger.debug(`Unhandled Stripe event type ${event.type}`);
    }
  }

  private async syncSubscriptionFromStripe(
    organizationId: string,
    subscriptionId: string,
    planId: string,
  ) {
    if (!stripeConfigured()) return;
    const sub = await this.stripeRequest<Record<string, unknown>>(
      'GET',
      `/v1/subscriptions/${subscriptionId}`,
    );
    await this.applySubscriptionObject(organizationId, sub, planId);
  }

  private async applySubscriptionObject(
    organizationId: string,
    sub: Record<string, unknown>,
    planId: string,
  ) {
    const account = await this.ensureStripeCustomer(organizationId);
    const providerSubscriptionId = String(sub.id);
    const status = mapStripeSubscriptionStatus(String(sub.status ?? 'incomplete'));
    const periodStart =
      typeof sub.current_period_start === 'number'
        ? new Date(sub.current_period_start * 1000)
        : null;
    const periodEnd =
      typeof sub.current_period_end === 'number'
        ? new Date(sub.current_period_end * 1000)
        : null;

    await this.prisma.client.billingSubscription.upsert({
      where: { providerSubscriptionId },
      create: {
        organizationId,
        billingAccountId: account.id,
        providerSubscriptionId,
        planId,
        status,
        periodStart,
        periodEnd,
        cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
        metadataJson: asJson({ stripe: true }),
      },
      update: {
        planId,
        status,
        periodStart,
        periodEnd,
        cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
        billingAccountId: account.id,
      },
    });

    if (status === 'active' || status === 'trialing') {
      await this.prisma.client.organization.update({
        where: { id: organizationId },
        data: { planTier: planTierForSaasPlan(planId) },
      });
      await this.prisma.client.billingAccount.update({
        where: { id: account.id },
        data: { status: 'active' },
      });
    } else if (status === 'past_due' || status === 'unpaid') {
      await this.prisma.client.billingAccount.update({
        where: { id: account.id },
        data: { status: 'past_due' },
      });
    } else if (status === 'cancelled') {
      await this.prisma.client.organization.update({
        where: { id: organizationId },
        data: { planTier: 'evaluation' },
      });
    }
  }

  private async syncInvoiceObject(obj: Record<string, unknown>, eventType: string) {
    const providerInvoiceId = typeof obj.id === 'string' ? obj.id : null;
    const customerId = typeof obj.customer === 'string' ? obj.customer : null;
    if (!providerInvoiceId || !customerId) return;

    const account = await this.prisma.client.billingAccount.findFirst({
      where: { provider: 'stripe', providerCustomerId: customerId },
    });
    if (!account) return;

    const amountDue = Math.round(Number(obj.amount_due ?? 0));
    const amountPaid = Math.round(Number(obj.amount_paid ?? 0));

    await this.prisma.client.billingInvoice.upsert({
      where: { providerInvoiceId },
      create: {
        organizationId: account.organizationId,
        billingAccountId: account.id,
        providerInvoiceId,
        status: String(obj.status ?? (eventType.includes('failed') ? 'open' : 'paid')),
        currency: String(obj.currency ?? 'usd').toUpperCase(),
        amountDueMinor: amountDue,
        amountPaidMinor: amountPaid,
        hostedInvoiceUrl:
          typeof obj.hosted_invoice_url === 'string' ? obj.hosted_invoice_url : null,
        invoicePdfUrl: typeof obj.invoice_pdf === 'string' ? obj.invoice_pdf : null,
        metadataJson: asJson({ eventType }),
      },
      update: {
        status: String(obj.status ?? 'paid'),
        amountDueMinor: amountDue,
        amountPaidMinor: amountPaid,
        hostedInvoiceUrl:
          typeof obj.hosted_invoice_url === 'string' ? obj.hosted_invoice_url : null,
      },
    });

    if (eventType === 'invoice.payment_failed') {
      await this.prisma.client.billingAccount.update({
        where: { id: account.id },
        data: { status: 'past_due' },
      });
    }
  }

  private async stripeRequest<T>(
    method: 'GET' | 'POST',
    path: string,
    form?: Record<string, string>,
  ): Promise<T> {
    const key = process.env.STRIPE_SECRET_KEY?.trim();
    if (!key) throw new ServiceUnavailableException('STRIPE_SECRET_KEY not configured');

    const url = `https://api.stripe.com${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
    };
    let body: string | undefined;
    if (form && method === 'POST') {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      body = new URLSearchParams(form).toString();
    }

    const res = await fetch(url, { method, headers, body });
    const json = (await res.json()) as T & { error?: { message?: string } };
    if (!res.ok) {
      throw new BadRequestException(
        json.error?.message ?? `Stripe API error HTTP ${res.status}`,
      );
    }
    return json;
  }
}
