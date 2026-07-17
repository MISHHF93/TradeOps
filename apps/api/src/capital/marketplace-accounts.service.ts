import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  assertFinancialGate,
  isFinancialGateEnabled,
} from '@tradeops/config';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../identity/audit.service';

function asJson(value: unknown): object {
  return value as object;
}

/**
 * Platform marketplace payment accounts (Stripe Connect abstraction).
 * Separate from SaaS BillingAccount and Commerce Capital.
 * Live Connect onboarding requires MARKETPLACE_CONNECT_ENABLED.
 */
@Injectable()
export class MarketplaceAccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  getStatus(organizationId: string) {
    return {
      domain: 'platform_marketplace_payments' as const,
      organizationId,
      connectEnabled: isFinancialGateEnabled('MARKETPLACE_CONNECT_ENABLED'),
      honesty: {
        note: isFinancialGateEnabled('MARKETPLACE_CONNECT_ENABLED')
          ? 'Marketplace Connect gate is ON — still requires Stripe Connect platform configuration.'
          : 'Marketplace Connect is architected but disabled. Channel payment intelligence remains available under /finance/*.',
      },
    };
  }

  async listAccounts(organizationId: string) {
    const accounts = await this.prisma.client.platformConnectedAccount.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
    return {
      domain: 'platform_marketplace_payments' as const,
      connectEnabled: isFinancialGateEnabled('MARKETPLACE_CONNECT_ENABLED'),
      accounts: accounts.map((a) => ({
        id: a.id,
        role: a.role,
        provider: a.provider,
        status: a.status,
        chargesEnabled: a.chargesEnabled,
        payoutsEnabled: a.payoutsEnabled,
        detailsSubmitted: a.detailsSubmitted,
        verificationStatus: a.verificationStatus,
        providerAccountId: a.providerAccountId
          ? a.providerAccountId.startsWith('acct_sandbox')
            ? a.providerAccountId
            : `acct_…${a.providerAccountId.slice(-6)}`
          : null,
      })),
    };
  }

  /**
   * Create a sandbox/local connected-account record for architecture testing.
   * Does not call Stripe unless MARKETPLACE_CONNECT_ENABLED + STRIPE_SECRET_KEY.
   */
  async startOnboarding(input: {
    organizationId: string;
    userId?: string | null;
    role?: 'merchant' | 'supplier' | 'service_provider';
  }) {
    const role = input.role ?? 'merchant';

    if (!isFinancialGateEnabled('MARKETPLACE_CONNECT_ENABLED')) {
      // Allow sandbox record only when capital sandbox is on (architecture dry-run)
      if (!isFinancialGateEnabled('CAPITAL_SANDBOX_ENABLED')) {
        throw new ForbiddenException(
          'Marketplace Connect is disabled (MARKETPLACE_CONNECT_ENABLED=false). Pending provider and compliance setup.',
        );
      }
    } else {
      assertFinancialGate('MARKETPLACE_CONNECT_ENABLED');
      if (!process.env.STRIPE_SECRET_KEY?.trim()) {
        throw new ServiceUnavailableException(
          'MARKETPLACE_CONNECT_ENABLED but STRIPE_SECRET_KEY missing — cannot start live Connect onboarding.',
        );
      }
      // Live Connect Account Links would be implemented here against Stripe API.
      throw new ServiceUnavailableException(
        'Live Stripe Connect onboarding not fully configured for this deployment — use sandbox records or complete Connect platform setup.',
      );
    }

    const account = await this.prisma.client.platformConnectedAccount.upsert({
      where: {
        organizationId_role_provider: {
          organizationId: input.organizationId,
          role,
          provider: 'stripe_connect',
        },
      },
      create: {
        organizationId: input.organizationId,
        role,
        provider: 'stripe_connect',
        providerAccountId: `acct_sandbox_${input.organizationId.replace(/-/g, '').slice(0, 12)}_${role}`,
        status: 'onboarding',
        verificationStatus: 'sandbox_pending',
        metadataJson: asJson({
          sandbox: true,
          label: 'SANDBOX — NOT A LIVE STRIPE CONNECT ACCOUNT',
        }),
      },
      update: {
        status: 'onboarding',
      },
    });

    await this.audit.write({
      action: 'marketplace.account.sandbox_onboarding',
      resourceType: 'platform_connected_account',
      resourceId: account.id,
      organizationId: input.organizationId,
      actorUserId: input.userId ?? null,
      metadata: { role, sandbox: true },
    });

    return {
      account,
      mode: 'sandbox' as const,
      note: 'Sandbox connected-account record only. Not live KYC. Not transferable funds.',
    };
  }

  async proposeTransfer(input: {
    organizationId: string;
    userId?: string | null;
    amountMinor: number;
    currency: string;
    purpose: string;
    platformFeeMinor?: number;
    idempotencyKey: string;
    toAccountId?: string;
  }) {
    if (input.amountMinor <= 0) throw new BadRequestException('amount must be positive');
    if (!input.idempotencyKey?.trim()) throw new BadRequestException('idempotencyKey required');

    if (
      !isFinancialGateEnabled('MARKETPLACE_CONNECT_ENABLED') &&
      !isFinancialGateEnabled('CAPITAL_SANDBOX_ENABLED')
    ) {
      throw new ForbiddenException('Platform transfers disabled');
    }

    const existing = await this.prisma.client.platformTransfer.findUnique({
      where: {
        organizationId_idempotencyKey: {
          organizationId: input.organizationId,
          idempotencyKey: input.idempotencyKey,
        },
      },
    });
    if (existing) return { transfer: existing, duplicate: true };

    const transfer = await this.prisma.client.platformTransfer.create({
      data: {
        organizationId: input.organizationId,
        toAccountId: input.toAccountId ?? null,
        amountMinor: input.amountMinor,
        currency: input.currency.toUpperCase(),
        platformFeeMinor: input.platformFeeMinor ?? 0,
        purpose: input.purpose.slice(0, 64),
        status: 'proposed',
        idempotencyKey: input.idempotencyKey,
        metadataJson: asJson({
          sandbox: !isFinancialGateEnabled('MARKETPLACE_CONNECT_ENABLED'),
          note: 'Proposed only — not executed without Connect + provider confirmation',
        }),
      },
    });

    await this.audit.write({
      action: 'marketplace.transfer.proposed',
      resourceType: 'platform_transfer',
      resourceId: transfer.id,
      organizationId: input.organizationId,
      actorUserId: input.userId ?? null,
      metadata: { amountMinor: input.amountMinor, purpose: input.purpose },
    });

    return {
      transfer,
      duplicate: false,
      note: 'Transfer proposed. Execution requires MARKETPLACE_CONNECT_ENABLED and provider confirmation. Status is not paid.',
    };
  }
}
