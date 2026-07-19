import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  capitalWriteMode,
  financialDomainCatalog,
  isFinancialGateEnabled,
} from '@tradeops/config';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../identity/audit.service';
import {
  assertJournalBalanced,
  buildDisbursementJournal,
  buildFundingJournal,
  deriveBalances,
} from './capital-ledger';
import {
  calculateDistributionWaterfall,
  type WaterfallInputs,
  WATERFALL_VERSION,
} from './distribution-waterfall';

function asJson(value: unknown): object {
  return value as object;
}

/**
 * Commerce Capital Network — campaign funding architecture.
 * Defaults to sandbox. Does not solicit public investment or move custody funds
 * unless explicit feature gates are enabled after legal approval.
 */
@Injectable()
export class CapitalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  getNetworkStatus() {
    const catalog = financialDomainCatalog();
    const mode = capitalWriteMode();
    return {
      product: 'TradeOps Capital modules (deferred — not primary product)',
      primaryProduct: 'AI Commerce Operating System (SaaS intelligence + execution)',
      writeMode: mode,
      isLicensedInvestmentPortal: false,
      domains: catalog.domains,
      gates: catalog.gates,
      honesty: {
        ...catalog.honesty,
        operationalNote:
          mode === 'sandbox'
            ? 'Sandbox only. Primary product does not require capital modules. Merchants pay SaaS; shoppers pay merchant processors.'
            : mode === 'private_agreement'
              ? 'Private-agreement ledger mode only — no public solicitation.'
              : mode === 'network'
                ? 'Network mode env-enabled — requires counsel, custody partners, KYC before any live use.'
                : 'Capital write paths disabled. Use SaaS billing + channel payment intelligence for core product.',
        neverClaims: [
          'Primary product is not investment management',
          'Not a registered securities dealer by default',
          'Not a FINTRAC-registered crowdfunding portal by default',
          'Does not guarantee investment returns',
          'Does not take custody of shopper or investment capital in the core SaaS model',
        ],
      },
    };
  }

  async listCampaigns(organizationId: string) {
    const rows = await this.prisma.client.commerceCampaign.findMany({
      where: { organizationId },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      include: { budget: true },
    });
    return {
      writeMode: capitalWriteMode(),
      campaigns: rows.map((c) => this.publicCampaign(c)),
      honesty: {
        note:
          rows.some((c) => c.sandbox)
            ? 'One or more campaigns are sandbox-labeled. Not live investment offerings.'
            : 'Campaign list is organization-scoped.',
      },
    };
  }

  async getCampaign(organizationId: string, campaignId: string) {
    const c = await this.prisma.client.commerceCampaign.findFirst({
      where: { id: campaignId, organizationId },
      include: {
        budget: true,
        commitments: { include: { capitalProvider: true } },
        disbursements: { orderBy: { createdAt: 'desc' }, take: 50 },
        distributions: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!c) throw new NotFoundException('Campaign not found');

    const ledger = await this.prisma.client.capitalLedgerEntry.findMany({
      where: { organizationId, campaignId },
      orderBy: { createdAt: 'asc' },
      take: 500,
    });
    const balances = deriveBalances(ledger);

    return {
      writeMode: capitalWriteMode(),
      campaign: this.publicCampaign(c),
      budget: c.budget,
      commitments: c.commitments,
      disbursements: c.disbursements,
      distributions: c.distributions,
      ledgerBalances: balances,
      ledgerEntryCount: ledger.length,
      honesty: {
        sandbox: c.sandbox,
        legalReviewStatus: c.legalReviewStatus,
        note: c.sandbox
          ? 'SANDBOX campaign — not a public offering. No real capital movement.'
          : 'Non-sandbox campaign still subject to feature gates and legal review.',
      },
    };
  }

  /**
   * Create a draft sandbox campaign (default) or private_agreement when gate allows.
   * Public/profit-share/equity models blocked unless gates enabled.
   */
  async createCampaign(input: {
    organizationId: string;
    userId?: string | null;
    title: string;
    description?: string;
    capitalTargetMinor: number;
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
  }) {
    const mode = capitalWriteMode();
    if (mode === 'disabled') {
      throw new ForbiddenException(
        'Commerce Capital write mode disabled. Enable CAPITAL_SANDBOX_ENABLED (default) or complete legal gates.',
      );
    }

    if (input.capitalTargetMinor <= 0) {
      throw new BadRequestException('capitalTargetMinor must be positive');
    }
    if (!input.title?.trim()) throw new BadRequestException('title required');

    const requestedModel = (input.fundingModel ?? 'sandbox') as string;
    this.assertFundingModelAllowed(requestedModel, mode);

    const sandbox = mode === 'sandbox' || requestedModel === 'sandbox';
    const fundingModel = sandbox
      ? 'sandbox'
      : (requestedModel as
          | 'prepurchase'
          | 'commercial_financing'
          | 'revenue_share'
          | 'equity'
          | 'private_agreement'
          | 'sandbox');

    if (fundingModel === 'revenue_share' && !isFinancialGateEnabled('PROFIT_SHARING_ENABLED')) {
      throw new ForbiddenException('PROFIT_SHARING_ENABLED is false — revenue_share model blocked');
    }
    if (fundingModel === 'equity' && !isFinancialGateEnabled('EQUITY_OFFERINGS_ENABLED')) {
      throw new ForbiddenException('EQUITY_OFFERINGS_ENABLED is false — equity model blocked');
    }
    if (
      !sandbox &&
      fundingModel !== 'private_agreement' &&
      !isFinancialGateEnabled('PUBLIC_CAMPAIGNS_ENABLED') &&
      !isFinancialGateEnabled('CAPITAL_NETWORK_ENABLED')
    ) {
      throw new ForbiddenException(
        'Non-sandbox public-style campaigns require PUBLIC_CAMPAIGNS_ENABLED or CAPITAL_NETWORK_ENABLED',
      );
    }

    const inv = input.inventoryBudgetMinor ?? 0;
    const ads = input.advertisingBudgetMinor ?? 0;
    const ful = input.fulfillmentBudgetMinor ?? 0;
    const res = input.operatingReserveMinor ?? 0;
    const fees = input.platformFeesMinor ?? 0;
    const budgetSum = inv + ads + ful + res + fees;
    if (budgetSum > input.capitalTargetMinor) {
      throw new BadRequestException(
        `Budget lines (${budgetSum}) exceed capital target (${input.capitalTargetMinor})`,
      );
    }

    const campaign = await this.prisma.client.commerceCampaign.create({
      data: {
        organizationId: input.organizationId,
        merchantOrgId: input.organizationId,
        title: input.title.trim().slice(0, 300),
        description: (input.description ?? '').slice(0, 10_000),
        capitalTargetMinor: input.capitalTargetMinor,
        currency: (input.currency ?? 'CAD').toUpperCase(),
        fundingModel,
        status: 'draft',
        legalReviewStatus: sandbox ? 'sandbox_exempt_design' : 'required',
        productId: input.productId ?? null,
        supplierId: input.supplierId ?? null,
        economicsJson: asJson(input.economicsJson ?? {}),
        riskDisclosureJson: asJson({
          capitalAtRisk: true,
          noGuaranteeOfReturn: true,
          ...(input.riskDisclosureJson ?? {}),
        }),
        sandbox,
        metadataJson: asJson({
          createdInMode: mode,
          label: sandbox ? 'SANDBOX — NOT LIVE INVESTMENT' : 'LEGAL_REVIEW_REQUIRED',
        }),
        budget: {
          create: {
            organizationId: input.organizationId,
            inventoryBudgetMinor: inv,
            advertisingBudgetMinor: ads,
            fulfillmentBudgetMinor: ful,
            operatingReserveMinor: res,
            platformFeesMinor: fees,
            currency: (input.currency ?? 'CAD').toUpperCase(),
          },
        },
      },
      include: { budget: true },
    });

    await this.audit.write({
      action: 'capital.campaign.created',
      resourceType: 'commerce_campaign',
      resourceId: campaign.id,
      organizationId: input.organizationId,
      actorUserId: input.userId ?? null,
      metadata: { sandbox, fundingModel, capitalTargetMinor: input.capitalTargetMinor },
    });

    return {
      campaign: this.publicCampaign(campaign),
      budget: campaign.budget,
      writeMode: mode,
      note: sandbox
        ? 'Sandbox campaign draft created. Not open for investment. Not funded.'
        : 'Campaign draft created. Legal review required before any funding.',
    };
  }

  async createSandboxProvider(input: {
    organizationId: string;
    userId?: string | null;
    displayName: string;
    jurisdiction?: string;
  }) {
    if (capitalWriteMode() === 'disabled') {
      throw new ForbiddenException('Capital write mode disabled');
    }
    if (
      isFinancialGateEnabled('INVESTOR_ONBOARDING_ENABLED') === false &&
      capitalWriteMode() !== 'sandbox'
    ) {
      // private agreement may create counterparties for ledger
    }

    const provider = await this.prisma.client.capitalProvider.create({
      data: {
        organizationId: input.organizationId,
        displayName: input.displayName.trim().slice(0, 200),
        jurisdiction: (input.jurisdiction ?? 'CA').slice(0, 8),
        verificationStatus: capitalWriteMode() === 'sandbox' ? 'pending' : 'pending',
        metadataJson: asJson({
          sandbox: capitalWriteMode() === 'sandbox',
          note: 'Verification not complete — do not invent KYC results',
        }),
      },
    });

    await this.audit.write({
      action: 'capital.provider.created',
      resourceType: 'capital_provider',
      resourceId: provider.id,
      organizationId: input.organizationId,
      actorUserId: input.userId ?? null,
      metadata: { verificationStatus: provider.verificationStatus },
    });

    return {
      provider,
      note: 'Provider record created with pending verification. No fabricated KYC.',
    };
  }

  /**
   * Record a commitment. Funded status requires custody gate + provider payment ref.
   * Sandbox may simulate "initiated" only unless CAPITAL_CUSTODY_ENABLED.
   */
  async createCommitment(input: {
    organizationId: string;
    userId?: string | null;
    campaignId: string;
    capitalProviderId: string;
    committedAmountMinor: number;
    simulateFunded?: boolean;
  }) {
    if (capitalWriteMode() === 'disabled') {
      throw new ForbiddenException('Capital write mode disabled');
    }
    if (input.committedAmountMinor <= 0) {
      throw new BadRequestException('committedAmountMinor must be positive');
    }

    const campaign = await this.prisma.client.commerceCampaign.findFirst({
      where: { id: input.campaignId, organizationId: input.organizationId },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');

    const provider = await this.prisma.client.capitalProvider.findFirst({
      where: { id: input.capitalProviderId, organizationId: input.organizationId },
    });
    if (!provider) throw new NotFoundException('Capital provider not found');

    if (isFinancialGateEnabled('PUBLIC_CAMPAIGNS_ENABLED') === false && !campaign.sandbox) {
      if (
        campaign.fundingModel !== 'private_agreement' &&
        capitalWriteMode() !== 'private_agreement'
      ) {
        // allow sandbox only
        if (!campaign.sandbox) {
          throw new ForbiddenException('Public campaign commitments disabled');
        }
      }
    }

    let status: 'initiated' | 'payment_pending' | 'funded' = 'initiated';
    let fundedAmount = 0;
    let paymentRef: string | null = null;

    if (input.simulateFunded) {
      if (!isFinancialGateEnabled('CAPITAL_CUSTODY_ENABLED') && campaign.sandbox) {
        // Sandbox may mark a simulated funded commitment with explicit label — still not custody
        status = 'funded';
        fundedAmount = input.committedAmountMinor;
        paymentRef = `sandbox_fund_${Date.now()}`;
      } else if (isFinancialGateEnabled('CAPITAL_CUSTODY_ENABLED')) {
        throw new ForbiddenException(
          'Live custody funding requires payment-provider confirmation path — not implementable as simulateFunded alone',
        );
      } else {
        throw new ForbiddenException(
          'CAPITAL_CUSTODY_ENABLED is false — cannot mark commitment funded with real custody',
        );
      }
    }

    const commitment = await this.prisma.client.capitalCommitment.create({
      data: {
        organizationId: input.organizationId,
        campaignId: campaign.id,
        capitalProviderId: provider.id,
        committedAmountMinor: input.committedAmountMinor,
        fundedAmountMinor: fundedAmount,
        currency: campaign.currency,
        status,
        providerPaymentRef: paymentRef,
        metadataJson: asJson({
          sandbox: campaign.sandbox,
          simulated: Boolean(input.simulateFunded && campaign.sandbox),
        }),
      },
    });

    if (status === 'funded' && campaign.sandbox) {
      const journal = buildFundingJournal({
        amountMinor: fundedAmount,
        currency: campaign.currency,
        campaignId: campaign.id,
        commitmentId: commitment.id,
      });
      await this.persistJournal({
        organizationId: input.organizationId,
        campaignId: campaign.id,
        journal,
      });
    }

    await this.audit.write({
      action: 'capital.commitment.created',
      resourceType: 'capital_commitment',
      resourceId: commitment.id,
      organizationId: input.organizationId,
      actorUserId: input.userId ?? null,
      metadata: { status, amount: input.committedAmountMinor, sandbox: campaign.sandbox },
    });

    return {
      commitment,
      note:
        status === 'funded' && campaign.sandbox
          ? 'Sandbox simulated funding + ledger entries. NOT real money. NOT custody.'
          : 'Commitment initiated. Funded status requires verified provider payment.',
    };
  }

  async proposeDisbursement(input: {
    organizationId: string;
    userId?: string | null;
    campaignId: string;
    budgetLine: string;
    amountMinor: number;
    purpose: string;
    recipientType: string;
    recipientId?: string;
    idempotencyKey: string;
    evidenceJson?: Record<string, unknown>;
  }) {
    if (capitalWriteMode() === 'disabled') {
      throw new ForbiddenException('Capital write mode disabled');
    }
    if (input.amountMinor <= 0) throw new BadRequestException('amount must be positive');
    if (!input.idempotencyKey?.trim()) throw new BadRequestException('idempotencyKey required');

    const allowedLines = new Set([
      'inventory',
      'advertising',
      'fulfillment',
      'duties',
      'operating_reserve',
      'platform_fees',
      'merchant_expense',
    ]);
    if (!allowedLines.has(input.budgetLine)) {
      throw new BadRequestException(`Invalid budget line: ${input.budgetLine}`);
    }

    const campaign = await this.prisma.client.commerceCampaign.findFirst({
      where: { id: input.campaignId, organizationId: input.organizationId },
      include: { budget: true },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    if (!campaign.budget) throw new BadRequestException('Campaign has no budget');

    const lineMap: Record<string, number> = {
      inventory: campaign.budget.inventoryBudgetMinor,
      advertising: campaign.budget.advertisingBudgetMinor,
      fulfillment: campaign.budget.fulfillmentBudgetMinor,
      duties: campaign.budget.dutiesBudgetMinor,
      operating_reserve: campaign.budget.operatingReserveMinor,
      platform_fees: campaign.budget.platformFeesMinor,
      merchant_expense: campaign.budget.merchantExpenseMinor,
    };
    const lineCap = lineMap[input.budgetLine] ?? 0;

    const prior = await this.prisma.client.capitalDisbursement.aggregate({
      where: {
        organizationId: input.organizationId,
        campaignId: campaign.id,
        budgetLine: input.budgetLine,
        status: { notIn: ['failed', 'reversed'] },
      },
      _sum: { amountMinor: true },
    });
    const used = prior._sum.amountMinor ?? 0;
    if (used + input.amountMinor > lineCap) {
      throw new BadRequestException(
        `Budget overrun on ${input.budgetLine}: used ${used} + ${input.amountMinor} > cap ${lineCap}`,
      );
    }

    const existing = await this.prisma.client.capitalDisbursement.findUnique({
      where: {
        organizationId_idempotencyKey: {
          organizationId: input.organizationId,
          idempotencyKey: input.idempotencyKey,
        },
      },
    });
    if (existing) return { disbursement: existing, duplicate: true };

    const disbursement = await this.prisma.client.capitalDisbursement.create({
      data: {
        organizationId: input.organizationId,
        campaignId: campaign.id,
        recipientType: input.recipientType.slice(0, 32),
        recipientId: input.recipientId ?? null,
        budgetLine: input.budgetLine,
        amountMinor: input.amountMinor,
        currency: campaign.currency,
        purpose: input.purpose.slice(0, 500),
        status: 'approval_required',
        evidenceJson: asJson(input.evidenceJson ?? {}),
        idempotencyKey: input.idempotencyKey,
        metadataJson: asJson({ sandbox: campaign.sandbox }),
      },
    });

    await this.audit.write({
      action: 'capital.disbursement.proposed',
      resourceType: 'capital_disbursement',
      resourceId: disbursement.id,
      organizationId: input.organizationId,
      actorUserId: input.userId ?? null,
      metadata: {
        budgetLine: input.budgetLine,
        amountMinor: input.amountMinor,
        status: 'approval_required',
      },
    });

    return {
      disbursement,
      duplicate: false,
      note: 'Disbursement requires approval. Not paid. Prefer paying verified suppliers directly when custody is live.',
    };
  }

  /**
   * Approve disbursement in sandbox — still does not claim external payment
   * unless provider ref present and custody enabled.
   */
  async approveSandboxDisbursement(input: {
    organizationId: string;
    userId?: string | null;
    disbursementId: string;
  }) {
    if (capitalWriteMode() === 'disabled') {
      throw new ForbiddenException('Capital write mode disabled');
    }

    const d = await this.prisma.client.capitalDisbursement.findFirst({
      where: { id: input.disbursementId, organizationId: input.organizationId },
      include: { campaign: true },
    });
    if (!d) throw new NotFoundException('Disbursement not found');
    if (d.status !== 'approval_required' && d.status !== 'proposed') {
      throw new BadRequestException(`Cannot approve status ${d.status}`);
    }

    const markPaid = d.campaign.sandbox && capitalWriteMode() === 'sandbox';
    const updated = await this.prisma.client.capitalDisbursement.update({
      where: { id: d.id },
      data: {
        status: markPaid ? 'paid' : 'approved',
        providerPaymentRef: markPaid ? `sandbox_pay_${d.id.slice(0, 8)}` : null,
      },
    });

    if (markPaid) {
      const journal = buildDisbursementJournal({
        amountMinor: d.amountMinor,
        currency: d.currency,
        disbursementId: d.id,
        budgetLine: d.budgetLine,
      });
      await this.persistJournal({
        organizationId: input.organizationId,
        campaignId: d.campaignId,
        journal,
      });
    }

    await this.audit.write({
      action: 'capital.disbursement.approved',
      resourceType: 'capital_disbursement',
      resourceId: d.id,
      organizationId: input.organizationId,
      actorUserId: input.userId ?? null,
      metadata: { status: updated.status, sandbox: d.campaign.sandbox },
    });

    return {
      disbursement: updated,
      note: markPaid
        ? 'Sandbox disbursement marked paid with ledger entries. NOT a real bank transfer.'
        : 'Approved — execution still requires custody rails and provider confirmation.',
    };
  }

  /** Dry-run waterfall from explicit realized inputs — never promises returns */
  dryRunWaterfall(inputs: WaterfallInputs) {
    if (
      isFinancialGateEnabled('AUTOMATED_INVESTMENT_ADVICE_ENABLED')
    ) {
      // Still calculate; advice gate is about recommendations, not math
    }
    const result = calculateDistributionWaterfall(inputs);
    return {
      result,
      executionAllowed: isFinancialGateEnabled('DISTRIBUTIONS_ENABLED'),
      note: isFinancialGateEnabled('DISTRIBUTIONS_ENABLED')
        ? 'DISTRIBUTIONS_ENABLED is true — still requires approval workflow and provider rails to pay.'
        : 'Dry-run only. DISTRIBUTIONS_ENABLED is false — cannot execute distributions.',
    };
  }

  async calculateAndStoreDistribution(input: {
    organizationId: string;
    userId?: string | null;
    campaignId: string;
    waterfall: WaterfallInputs;
  }) {
    if (capitalWriteMode() === 'disabled') {
      throw new ForbiddenException('Capital write mode disabled');
    }

    const campaign = await this.prisma.client.commerceCampaign.findFirst({
      where: { id: input.campaignId, organizationId: input.organizationId },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');

    const result = calculateDistributionWaterfall(input.waterfall);

    const rows = await this.prisma.client.$transaction(async (tx) => {
      const created = [];
      if (result.principalReturnedMinor > 0 || result.capitalProfitMinor > 0) {
        created.push(
          await tx.campaignDistribution.create({
            data: {
              organizationId: input.organizationId,
              campaignId: campaign.id,
              recipientType: 'capital_provider',
              principalReturnedMinor: result.principalReturnedMinor,
              profitDistributedMinor: result.capitalProfitMinor,
              lossAllocatedMinor: result.residualLossMinor,
              feesDeductedMinor: 0,
              currency: result.currency,
              status: 'calculated',
              calculationVersion: WATERFALL_VERSION,
              inputsJson: asJson(result),
              metadataJson: asJson({ sandbox: campaign.sandbox }),
            },
          }),
        );
      }
      if (result.platformFeeMinor > 0) {
        created.push(
          await tx.campaignDistribution.create({
            data: {
              organizationId: input.organizationId,
              campaignId: campaign.id,
              recipientType: 'platform',
              principalReturnedMinor: 0,
              profitDistributedMinor: result.platformFeeMinor,
              lossAllocatedMinor: 0,
              feesDeductedMinor: 0,
              currency: result.currency,
              status: 'calculated',
              calculationVersion: WATERFALL_VERSION,
              inputsJson: asJson({ step: 'platform_fee', result }),
              metadataJson: asJson({ sandbox: campaign.sandbox }),
            },
          }),
        );
      }
      if (result.merchantResidualMinor > 0) {
        created.push(
          await tx.campaignDistribution.create({
            data: {
              organizationId: input.organizationId,
              campaignId: campaign.id,
              recipientType: 'merchant',
              principalReturnedMinor: 0,
              profitDistributedMinor: result.merchantResidualMinor,
              lossAllocatedMinor: 0,
              feesDeductedMinor: 0,
              currency: result.currency,
              status: 'calculated',
              calculationVersion: WATERFALL_VERSION,
              inputsJson: asJson({ step: 'merchant_residual', result }),
              metadataJson: asJson({ sandbox: campaign.sandbox }),
            },
          }),
        );
      }
      return created;
    });

    await this.audit.write({
      action: 'capital.distribution.calculated',
      resourceType: 'commerce_campaign',
      resourceId: campaign.id,
      organizationId: input.organizationId,
      actorUserId: input.userId ?? null,
      metadata: {
        version: WATERFALL_VERSION,
        principalReturnedMinor: result.principalReturnedMinor,
        residualLossMinor: result.residualLossMinor,
      },
    });

    return {
      result,
      distributions: rows,
      executionAllowed: isFinancialGateEnabled('DISTRIBUTIONS_ENABLED'),
      note: 'Distributions stored as calculated only. Paid status requires DISTRIBUTIONS_ENABLED + provider confirmation.',
    };
  }

  // ——— internals ———

  private assertFundingModelAllowed(model: string, mode: string) {
    const allowed = new Set([
      'sandbox',
      'prepurchase',
      'commercial_financing',
      'revenue_share',
      'equity',
      'private_agreement',
    ]);
    if (!allowed.has(model)) {
      throw new BadRequestException(`Unknown funding model: ${model}`);
    }
    if (mode === 'sandbox') {
      if (model === 'sandbox') return;
      if (
        model === 'private_agreement' &&
        isFinancialGateEnabled('PRIVATE_AGREEMENT_LEDGER_ENABLED')
      ) {
        return;
      }
      throw new ForbiddenException(
        `Funding model "${model}" is not available while capital write mode is sandbox. Use fundingModel=sandbox, or enable PRIVATE_AGREEMENT_LEDGER_ENABLED / CAPITAL_NETWORK_ENABLED after legal approval.`,
      );
    }
  }

  private async persistJournal(input: {
    organizationId: string;
    campaignId: string;
    journal: ReturnType<typeof buildFundingJournal>;
  }) {
    assertJournalBalanced(input.journal.lines);
    for (const line of input.journal.lines) {
      await this.prisma.client.capitalLedgerEntry.create({
        data: {
          organizationId: input.organizationId,
          campaignId: input.campaignId,
          journalId: input.journal.journalId,
          accountCode: line.accountCode,
          direction: line.direction,
          amountMinor: line.amountMinor,
          currency: input.journal.currency,
          memo: line.memo.slice(0, 500),
          idempotencyKey: line.idempotencyKey,
          referenceType: line.referenceType ?? null,
          referenceId: line.referenceId ?? null,
          metadataJson: asJson({}),
        },
      });
    }
  }

  private publicCampaign(c: {
    id: string;
    title: string;
    description: string;
    capitalTargetMinor: number;
    currency: string;
    fundingModel: string;
    status: string;
    riskRating: string;
    jurisdiction: string;
    legalReviewStatus: string;
    sandbox: boolean;
    productId: string | null;
    supplierId: string | null;
    economicsJson: unknown;
    riskDisclosureJson: unknown;
    createdAt: Date;
    updatedAt: Date;
    budget?: unknown;
  }) {
    return {
      id: c.id,
      title: c.title,
      description: c.description,
      capitalTargetMinor: c.capitalTargetMinor,
      currency: c.currency,
      fundingModel: c.fundingModel,
      status: c.status,
      riskRating: c.riskRating,
      jurisdiction: c.jurisdiction,
      legalReviewStatus: c.legalReviewStatus,
      sandbox: c.sandbox,
      productId: c.productId,
      supplierId: c.supplierId,
      economics: c.economicsJson,
      riskDisclosure: c.riskDisclosureJson,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    };
  }
}
