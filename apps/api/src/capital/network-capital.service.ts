import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  capitalModeCatalog,
  getCapitalProductMode,
  isGuaranteedReturnsEnabled,
  isInternalCustodyEnabled,
  isPooledInvestmentEnabled,
} from '@tradeops/config';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../identity/audit.service';
import { evaluateMandate } from './mandate-policy';
import { listProviderCapabilities } from './providers/types';
import {
  assertJournalBalanced,
  buildFundingJournal,
  deriveBalances,
} from './capital-ledger';
import { randomUUID } from 'node:crypto';

function asJson(value: unknown): object {
  return value as object;
}

function asStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  return [];
}

/**
 * Client-owned commerce network capital.
 * Operating budget under CommerceMandate — not pooled investment, not guaranteed returns.
 */
@Injectable()
export class NetworkCapitalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  getNetworkOverview() {
    const mode = capitalModeCatalog();
    return {
      productMode: getCapitalProductMode(),
      catalog: mode,
      providers: listProviderCapabilities(),
      hardBlocks: {
        pooledInvestmentEnabled: isPooledInvestmentEnabled(),
        guaranteedReturnsEnabled: isGuaranteedReturnsEnabled(),
        internalCustodyEnabled: isInternalCustodyEnabled(),
      },
      honesty: {
        note: mode.honesty.note,
        balanceSourceOfTruth:
          'Derived from posted ledger entries and confirmed funding intents — never an editable balance field.',
        usableCapitalRequires:
          'Verified provider event (or explicit sandbox simulation). Browser redirect alone is not funding proof.',
      },
    };
  }

  async getOrCreateCapitalAccount(input: {
    organizationId: string;
    userId?: string | null;
    currency?: string;
  }) {
    this.assertClientOwnedMode();
    const currency = (input.currency ?? 'CAD').toUpperCase();

    let account = await this.prisma.client.commerceCapitalAccount.findUnique({
      where: {
        organizationId_currency: {
          organizationId: input.organizationId,
          currency,
        },
      },
    });

    if (!account) {
      account = await this.prisma.client.commerceCapitalAccount.create({
        data: {
          organizationId: input.organizationId,
          ownerType: 'business',
          provider: 'pending',
          currency,
          status: 'pending_verification',
          sandbox: true,
          verificationJson: asJson({
            kyc: 'incomplete',
            kyb: 'incomplete',
            note: 'Do not invent verification results',
          }),
          capabilityJson: asJson({
            paymentsEnabled: false,
            fundingEnabled: false,
            payoutsEnabled: false,
          }),
          metadataJson: asJson({
            label: 'CLIENT_OWNED_SANDBOX — not live custody',
            mode: getCapitalProductMode(),
          }),
        },
      });

      await this.audit.write({
        action: 'network.capital_account.created',
        resourceType: 'commerce_capital_account',
        resourceId: account.id,
        organizationId: input.organizationId,
        actorUserId: input.userId ?? null,
        metadata: { currency, sandbox: true },
      });
    }

    return {
      account: this.publicAccount(account),
      note: 'Account is not active until verification and partner funding rails confirm. Form submit alone is insufficient.',
    };
  }

  async getPortfolio(organizationId: string) {
    this.assertClientOwnedMode();
    const account = await this.prisma.client.commerceCapitalAccount.findFirst({
      where: { organizationId },
      orderBy: { createdAt: 'asc' },
    });
    if (!account) {
      return {
        hasAccount: false,
        note: 'No commerce capital account yet. Create one under /network/capital.',
        labels: this.moneyLabels(),
      };
    }

    const [mandates, allocations, funding, ledger] = await Promise.all([
      this.prisma.client.commerceMandate.findMany({
        where: { organizationId, capitalAccountId: account.id },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.client.capitalAllocation.findMany({
        where: { organizationId, capitalAccountId: account.id },
        orderBy: { updatedAt: 'desc' },
        take: 100,
      }),
      this.prisma.client.fundingIntent.findMany({
        where: { organizationId, capitalAccountId: account.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.client.capitalLedgerEntry.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'asc' },
        take: 1000,
      }),
    ]);

    const balances = deriveBalances(ledger);
    const fundedConfirmed = funding
      .filter((f) => f.status === 'confirmed')
      .reduce((s, f) => s + f.amountMinor, 0);
    const reserved = allocations
      .filter((a) => ['reserved', 'approved', 'proposed'].includes(a.status))
      .reduce((s, a) => s + a.amountReservedMinor, 0);
    const deployed = allocations
      .filter((a) => ['deployed', 'reconciling'].includes(a.status))
      .reduce((s, a) => s + a.amountDeployedMinor, 0);
    const returned = allocations.reduce((s, a) => s + a.amountReturnedMinor, 0);

    // Available ≈ confirmed funding − reserved − deployed + returned (sandbox ledger approximation)
    const cashSafeguarded = Math.max(0, balances.cash_safeguarded ?? fundedConfirmed);
    const available = Math.max(0, cashSafeguarded - reserved - deployed + returned);

    return {
      hasAccount: true,
      productMode: getCapitalProductMode(),
      account: this.publicAccount(account),
      activeMandate: mandates.find((m) => m.status === 'approved') ?? mandates[0] ?? null,
      capital: {
        currency: account.currency,
        /** Verified/sandbox-confirmed funding only */
        fundedSettledMinor: fundedConfirmed,
        availableMinor: available,
        reservedMinor: reserved,
        deployedMinor: deployed,
        returnedMinor: returned,
        pendingSettlementsMinor: 0,
        withdrawableMinor: 0, // never claim withdrawable without partner settlement rules
        ledgerBalances: balances,
      },
      labels: this.moneyLabels(),
      allocations: allocations.map((a) => ({
        id: a.id,
        status: a.status,
        amountReservedMinor: a.amountReservedMinor,
        amountDeployedMinor: a.amountDeployedMinor,
        amountReturnedMinor: a.amountReturnedMinor,
        productId: a.productId,
        commerceCaseId: a.commerceCaseId,
        economics: a.economicsJson,
      })),
      fundingIntents: funding.map((f) => ({
        id: f.id,
        amountMinor: f.amountMinor,
        status: f.status,
        provider: f.provider,
        confirmedAt: f.confirmedAt,
      })),
      honesty: {
        note: 'Forecast ≠ committed ≠ settled ≠ realized ≠ withdrawable. Projected profit is never earned profit.',
        withdrawable:
          'Withdrawable remains 0 until partner settlement + reserve rules are implemented and verified.',
        sandbox: account.sandbox,
      },
    };
  }

  async upsertMandate(input: {
    organizationId: string;
    userId?: string | null;
    capitalAccountId: string;
    maximumCapitalMinor: number;
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
  }) {
    this.assertClientOwnedMode();
    if (input.maximumCapitalMinor <= 0) {
      throw new BadRequestException('maximumCapitalMinor must be positive');
    }

    const account = await this.prisma.client.commerceCapitalAccount.findFirst({
      where: { id: input.capitalAccountId, organizationId: input.organizationId },
    });
    if (!account) throw new NotFoundException('Capital account not found');

    const mandate = await this.prisma.client.commerceMandate.create({
      data: {
        organizationId: input.organizationId,
        capitalAccountId: account.id,
        maximumCapitalMinor: input.maximumCapitalMinor,
        maximumProductExposureMinor: input.maximumProductExposureMinor ?? input.maximumCapitalMinor,
        maximumDailySpendMinor: input.maximumDailySpendMinor ?? 0,
        maximumMonthlySpendMinor: input.maximumMonthlySpendMinor ?? 0,
        maximumAdvertisingMinor: input.maximumAdvertisingMinor ?? 0,
        minimumMarginBps: input.minimumMarginBps ?? 0,
        approvalThresholdMinor: input.approvalThresholdMinor ?? 0,
        maximumDeliveryDays: input.maximumDeliveryDays ?? 30,
        allowedChannelsJson: asJson(input.allowedChannels ?? ['amazon', 'shopify']),
        allowedCategoriesJson: asJson(input.allowedCategories ?? []),
        allowedCountriesJson: asJson(input.allowedCountries ?? ['CA']),
        riskLevel: input.riskLevel ?? 'conservative',
        status: input.approve ? 'approved' : 'draft',
        approvedAt: input.approve ? new Date() : null,
        metadataJson: asJson({ mode: getCapitalProductMode() }),
      },
    });

    await this.audit.write({
      action: 'network.mandate.created',
      resourceType: 'commerce_mandate',
      resourceId: mandate.id,
      organizationId: input.organizationId,
      actorUserId: input.userId ?? null,
      metadata: { status: mandate.status, maximumCapitalMinor: mandate.maximumCapitalMinor },
    });

    return {
      mandate,
      note: input.approve
        ? 'Mandate approved. AI and workflows must stay within these limits.'
        : 'Mandate draft — approve before deployment.',
    };
  }

  /**
   * Funding intent. Sandbox may confirm after explicit simulateConfirm.
   * Live mode requires provider webhook — never browser redirect alone.
   */
  async createFundingIntent(input: {
    organizationId: string;
    userId?: string | null;
    capitalAccountId: string;
    amountMinor: number;
    currency?: string;
    idempotencyKey: string;
    simulateConfirm?: boolean;
  }) {
    this.assertClientOwnedMode();
    if (isInternalCustodyEnabled() && process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('Internal custody blocked in production');
    }
    if (input.amountMinor <= 0) throw new BadRequestException('amount must be positive');
    if (!input.idempotencyKey?.trim()) throw new BadRequestException('idempotencyKey required');

    const existing = await this.prisma.client.fundingIntent.findUnique({
      where: {
        organizationId_idempotencyKey: {
          organizationId: input.organizationId,
          idempotencyKey: input.idempotencyKey,
        },
      },
    });
    if (existing) return { fundingIntent: existing, duplicate: true };

    const account = await this.prisma.client.commerceCapitalAccount.findFirst({
      where: { id: input.capitalAccountId, organizationId: input.organizationId },
    });
    if (!account) throw new NotFoundException('Capital account not found');

    let status: 'created' | 'pending' | 'confirmed' = 'created';
    let providerRef: string | null = null;
    let confirmedAt: Date | null = null;

    if (input.simulateConfirm) {
      if (!account.sandbox) {
        throw new ForbiddenException(
          'simulateConfirm only allowed on sandbox capital accounts. Live funding requires provider confirmation.',
        );
      }
      status = 'confirmed';
      providerRef = `sandbox_fund_${randomUUID().slice(0, 12)}`;
      confirmedAt = new Date();
    }

    const fundingIntent = await this.prisma.client.fundingIntent.create({
      data: {
        organizationId: input.organizationId,
        capitalAccountId: account.id,
        amountMinor: input.amountMinor,
        currency: (input.currency ?? account.currency).toUpperCase(),
        status,
        provider: account.sandbox ? 'sandbox' : 'partner_pending',
        providerReference: providerRef,
        idempotencyKey: input.idempotencyKey,
        confirmedAt,
        metadataJson: asJson({
          simulated: Boolean(input.simulateConfirm),
          note: 'Not credited from browser redirect',
        }),
      },
    });

    if (status === 'confirmed' && account.sandbox) {
      const journal = buildFundingJournal({
        amountMinor: input.amountMinor,
        currency: fundingIntent.currency,
        campaignId: account.id,
        commitmentId: fundingIntent.id,
      });
      assertJournalBalanced(journal.lines);
      for (const line of journal.lines) {
        await this.prisma.client.capitalLedgerEntry.create({
          data: {
            organizationId: input.organizationId,
            campaignId: null,
            journalId: journal.journalId,
            accountCode: line.accountCode,
            direction: line.direction,
            amountMinor: line.amountMinor,
            currency: journal.currency,
            memo: line.memo.slice(0, 500),
            idempotencyKey: `${line.idempotencyKey}_${fundingIntent.id.slice(0, 8)}`,
            referenceType: 'funding_intent',
            referenceId: fundingIntent.id,
            metadataJson: asJson({ capitalAccountId: account.id }),
          },
        });
      }

      await this.prisma.client.commerceCapitalAccount.update({
        where: { id: account.id },
        data: {
          status: 'funding_enabled',
          capabilityJson: asJson({
            paymentsEnabled: false,
            fundingEnabled: true,
            payoutsEnabled: false,
            note: 'Sandbox funding simulated — not partner custody',
          }),
        },
      });
    }

    await this.audit.write({
      action: 'network.funding_intent.created',
      resourceType: 'funding_intent',
      resourceId: fundingIntent.id,
      organizationId: input.organizationId,
      actorUserId: input.userId ?? null,
      metadata: { status, amountMinor: input.amountMinor },
    });

    return {
      fundingIntent,
      duplicate: false,
      note:
        status === 'confirmed'
          ? 'Sandbox funding confirmed + ledger posted. NOT real money. NOT partner custody.'
          : 'Funding intent created. Usable capital posts only after verified provider event.',
    };
  }

  async proposeAllocation(input: {
    organizationId: string;
    userId?: string | null;
    capitalAccountId: string;
    mandateId?: string;
    amountMinor: number;
    productId?: string;
    commerceCaseId?: string;
    channel?: string;
    category?: string;
    country?: string;
    expectedMarginBps?: number;
    deliveryDays?: number;
    isAdvertising?: boolean;
    idempotencyKey: string;
    economicsJson?: Record<string, unknown>;
  }) {
    this.assertClientOwnedMode();
    if (isPooledInvestmentEnabled() && process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('Pooled investment disabled');
    }
    if (input.amountMinor <= 0) throw new BadRequestException('amount must be positive');
    if (!input.idempotencyKey?.trim()) throw new BadRequestException('idempotencyKey required');

    const existing = await this.prisma.client.capitalAllocation.findUnique({
      where: {
        organizationId_idempotencyKey: {
          organizationId: input.organizationId,
          idempotencyKey: input.idempotencyKey,
        },
      },
    });
    if (existing) return { allocation: existing, duplicate: true, mandateCheck: null };

    const account = await this.prisma.client.commerceCapitalAccount.findFirst({
      where: { id: input.capitalAccountId, organizationId: input.organizationId },
    });
    if (!account) throw new NotFoundException('Capital account not found');

    const mandate = input.mandateId
      ? await this.prisma.client.commerceMandate.findFirst({
          where: { id: input.mandateId, organizationId: input.organizationId },
        })
      : await this.prisma.client.commerceMandate.findFirst({
          where: {
            organizationId: input.organizationId,
            capitalAccountId: account.id,
            status: 'approved',
          },
          orderBy: { approvedAt: 'desc' },
        });

    if (!mandate) {
      throw new ForbiddenException('No approved CommerceMandate — create and approve a mandate first');
    }

    const dailyDeployed = await this.sumDailyDeployed(input.organizationId, account.id);

    const mandateCheck = evaluateMandate(
      {
        status: mandate.status,
        maximumCapitalMinor: mandate.maximumCapitalMinor,
        maximumProductExposureMinor: mandate.maximumProductExposureMinor,
        maximumDailySpendMinor: mandate.maximumDailySpendMinor,
        maximumAdvertisingMinor: mandate.maximumAdvertisingMinor,
        minimumMarginBps: mandate.minimumMarginBps,
        approvalThresholdMinor: mandate.approvalThresholdMinor,
        maximumDeliveryDays: mandate.maximumDeliveryDays,
        allowedChannels: asStringArray(mandate.allowedChannelsJson),
        allowedCategories: asStringArray(mandate.allowedCategoriesJson),
        allowedCountries: asStringArray(mandate.allowedCountriesJson),
      },
      {
        amountMinor: input.amountMinor,
        channel: input.channel,
        category: input.category,
        country: input.country,
        expectedMarginBps: input.expectedMarginBps,
        deliveryDays: input.deliveryDays,
        isAdvertising: input.isAdvertising,
        dailyDeployedSoFarMinor: dailyDeployed,
      },
    );

    if (!mandateCheck.allowed) {
      throw new ForbiddenException(
        `Out of mandate: ${mandateCheck.reasons.join('; ')}`,
      );
    }

    const portfolio = await this.getPortfolio(input.organizationId);
    const available =
      portfolio.hasAccount && portfolio.capital
        ? portfolio.capital.availableMinor
        : 0;
    if (input.amountMinor > available) {
      throw new BadRequestException(
        `Insufficient available capital: need ${input.amountMinor}, available ${available}`,
      );
    }

    const status = mandateCheck.requiresApproval ? 'proposed' : 'reserved';

    const allocation = await this.prisma.client.capitalAllocation.create({
      data: {
        organizationId: input.organizationId,
        capitalAccountId: account.id,
        mandateId: mandate.id,
        productId: input.productId ?? null,
        commerceCaseId: input.commerceCaseId ?? null,
        amountReservedMinor: input.amountMinor,
        amountDeployedMinor: 0,
        amountReturnedMinor: 0,
        currency: account.currency,
        status,
        economicsJson: asJson({
          ...(input.economicsJson ?? {}),
          expectedMarginBps: input.expectedMarginBps ?? null,
          label: 'forecast', // never claim realized here
        }),
        evidenceJson: asJson({
          channel: input.channel,
          category: input.category,
          country: input.country,
          mandateCheck,
        }),
        idempotencyKey: input.idempotencyKey,
        metadataJson: asJson({ mode: getCapitalProductMode() }),
      },
    });

    await this.audit.write({
      action: 'network.allocation.proposed',
      resourceType: 'capital_allocation',
      resourceId: allocation.id,
      organizationId: input.organizationId,
      actorUserId: input.userId ?? null,
      metadata: { status, amountMinor: input.amountMinor, requiresApproval: mandateCheck.requiresApproval },
    });

    return {
      allocation,
      mandateCheck,
      duplicate: false,
      note:
        status === 'reserved'
          ? 'Capital reserved within mandate. Deployment still requires supplier/ad action + verification.'
          : 'Allocation proposed — client approval required by mandate threshold. AI cannot auto-transfer.',
    };
  }

  async listAllocations(organizationId: string) {
    const rows = await this.prisma.client.capitalAllocation.findMany({
      where: { organizationId },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
    return { allocations: rows, labels: this.moneyLabels() };
  }

  // ——— internals ———

  private assertClientOwnedMode() {
    const mode = getCapitalProductMode();
    if (mode === 'disabled') {
      throw new ForbiddenException('TRADEOPS_CAPITAL_MODE=disabled');
    }
    // sandbox, client_owned, private_agreement, network all allowed for architecture
    if (isGuaranteedReturnsEnabled() && process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('Guaranteed returns disabled in production');
    }
  }

  private moneyLabels() {
    return {
      forecast: 'Projected economics — not earned',
      committed: 'Reserved or approved allocation — not yet settled',
      settled: 'Partner/processor settlement confirmed',
      realized: 'Closed loop with matched costs and revenue',
      withdrawable: 'Settled proceeds minus reserves, holds, open POs — partner payout only',
    };
  }

  private publicAccount(account: {
    id: string;
    organizationId: string;
    ownerType: string;
    provider: string;
    providerAccountId: string | null;
    currency: string;
    status: string;
    sandbox: boolean;
    verificationJson: unknown;
    capabilityJson: unknown;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: account.id,
      organizationId: account.organizationId,
      ownerType: account.ownerType,
      provider: account.provider,
      providerAccountId: account.providerAccountId
        ? account.providerAccountId.startsWith('sandbox') ||
          account.providerAccountId.startsWith('acct_sandbox')
          ? account.providerAccountId
          : `…${account.providerAccountId.slice(-6)}`
        : null,
      currency: account.currency,
      status: account.status,
      sandbox: account.sandbox,
      verification: account.verificationJson,
      capabilities: account.capabilityJson,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    };
  }

  private async sumDailyDeployed(organizationId: string, capitalAccountId: string) {
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    const rows = await this.prisma.client.capitalAllocation.findMany({
      where: {
        organizationId,
        capitalAccountId,
        updatedAt: { gte: start },
        status: { in: ['reserved', 'deployed', 'approved', 'proposed'] },
      },
    });
    return rows.reduce((s, r) => s + r.amountReservedMinor + r.amountDeployedMinor, 0);
  }
}
