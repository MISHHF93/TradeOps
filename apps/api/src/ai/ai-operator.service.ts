import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  describeLoopModes,
  listToolsPublic,
  registerBuiltinTools,
  resolveLoopMode,
  runOperatorCycle,
  type OperationLoopMode,
  type OperatorProduct,
} from '@tradeops/ai-runtime';
import { listLiveFeeds } from '@tradeops/connector-core';
import { AuditService } from '../identity/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventFabricService } from '../events/event-fabric.service';
import { HarmonizationService } from '../harmonization/harmonization.service';

/** Prisma JSON columns accept structured values at runtime; cast for strict InputJsonValue. */
function asJson(value: unknown): object {
  return value as object;
}

@Injectable()
export class AiOperatorService implements OnModuleInit {
  private readonly logger = new Logger(AiOperatorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: EventFabricService,
    private readonly harmonization: HarmonizationService,
  ) {}

  onModuleInit(): void {
    registerBuiltinTools();
    this.logger.log(
      `AI operator tools registered: ${listToolsPublic().length}. Loop modes: ${describeLoopModes()
        .map((m) => m.mode)
        .join(', ')}`,
    );
  }

  getToolCatalog() {
    return {
      tools: listToolsPublic(),
      loopModes: describeLoopModes(),
      feeds: listLiveFeeds().map((f) => ({
        providerKey: f.providerKey,
        displayName: f.displayName,
        isFixture: f.isFixture,
        authMode: f.authMode,
        capabilities: f.capabilities,
      })),
      note: 'Tools are typed and permissioned. Consequential actions require approval. Fixture data is never labeled live.',
    };
  }

  async runObjective(input: {
    organizationId: string;
    userId?: string | null;
    objective: string;
    loopMode?: OperationLoopMode;
    forceShadow?: boolean;
    permissions?: string[];
  }) {
    const hasLiveGoogle = Boolean(
      process.env.GOOGLE_MERCHANT_ACCESS_TOKEN?.trim() &&
        process.env.GOOGLE_MERCHANT_ID?.trim(),
    );
    const loopMode =
      input.loopMode ??
      resolveLoopMode({
        forceShadow: input.forceShadow ?? true,
        hasLiveCredentials: hasLiveGoogle,
      });

    // Default shadow for operator until controlled live is explicit
    const effectiveMode: OperationLoopMode =
      input.loopMode ?? (input.forceShadow === false && hasLiveGoogle ? 'development' : 'shadow');

    const run = await this.prisma.client.operatorRun.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId ?? null,
        objective: input.objective,
        loopMode: effectiveMode,
        status: 'collecting',
        planJson: {},
        toolTraceJson: [],
      },
    });

    try {
      const products = await this.loadOperatorProducts(input.organizationId);

      const cycle = await runOperatorCycle({
        objective: input.objective,
        products,
        loopMode: effectiveMode,
        ctx: {
          organizationId: input.organizationId,
          userId: input.userId,
          loopMode: effectiveMode,
          permissions: input.permissions ?? ['*'],
          deps: {
            searchProducts: async ({
              organizationId,
              limit,
            }: {
              organizationId: string;
              limit?: number;
            }) => {
              const rows = await this.prisma.client.product.findMany({
                where: { organizationId },
                take: limit ?? 50,
                orderBy: { updatedAt: 'desc' },
              });
              return rows.map((p) => ({
                productId: p.id,
                title: p.title,
                sourcePlatform: p.sourcePlatform,
                isFixture: p.sourcePlatform.startsWith('fixture'),
              }));
            },
            draftListing: async ({
              organizationId,
              productId,
              userId,
            }: {
              organizationId: string;
              productId: string;
              userId?: string | null;
            }) => {
              // Draft only — create pending approval path via commerce listing draft is host concern
              return {
                status: 'draft_queued_for_approval',
                organizationId,
                productId,
                userId: userId ?? null,
                note: 'Draft action only. No external marketplace publish.',
              };
            },
            evaluateOutcomes: async ({ organizationId }: { organizationId: string }) => {
              const outcomes = await this.prisma.client.predictionOutcome.findMany({
                where: { organizationId },
                take: 50,
                orderBy: { createdAt: 'desc' },
              });
              return { count: outcomes.length, outcomes: outcomes.slice(0, 10) };
            },
          },
        },
      });

      const recRows = [];
      for (const rec of cycle.recommendations) {
        const row = await this.prisma.client.operatorRecommendation.create({
          data: {
            organizationId: input.organizationId,
            operatorRunId: run.id,
            productId: rec.productId ?? null,
            rank: rec.rank,
            actionClass: rec.actionClass,
            title: rec.title,
            rationale: rec.rationale,
            evidenceJson: asJson(rec.evidence),
            assumptionsJson: asJson(rec.assumptions),
            missingDataJson: asJson(rec.missingData),
            calculationJson: asJson(rec.calculation),
            forecastJson: asJson(rec.forecast),
            confidence: rec.confidence,
            policyRiskScore: rec.policyRiskScore,
            approvalRequired: rec.approvalRequired,
            expectedOutcomeJson: asJson(rec.expectedOutcome),
            criticNotes: cycle.critic.notes,
            auditorNotes: cycle.auditor.notes,
            decision: cycle.decision,
          },
        });
        recRows.push(row);

        // Shadow decision for evaluation loop
        if (effectiveMode === 'shadow' || rec.approvalRequired) {
          await this.prisma.client.shadowDecision.create({
            data: {
              organizationId: input.organizationId,
              productId: rec.productId ?? null,
              operatorRunId: run.id,
              actionClass: rec.actionClass,
              proposedAction: rec.proposedAction,
              evidenceJson: asJson(rec.evidence),
              expectedOutcomeJson: asJson(rec.expectedOutcome),
              wouldHaveExecuted: true,
            },
          });
        }

        // Queue human approval for draft listing when product known
        if (rec.productId && rec.approvalRequired && rec.proposedAction === 'draftListing') {
          await this.queueListingApproval({
            organizationId: input.organizationId,
            productId: rec.productId,
            userId: input.userId,
            note: `AI operator: ${rec.title}`,
          });
        }
      }

      await this.prisma.client.operatorRun.update({
        where: { id: run.id },
        data: {
          status:
            cycle.decision === 'block'
              ? 'blocked'
              : cycle.decision === 'escalate' || cycle.recommendations.some((r) => r.approvalRequired)
                ? 'awaiting_approval'
                : 'completed',
          planJson: asJson(cycle.plan),
          toolTraceJson: asJson(cycle.toolTrace),
          criticJson: asJson(cycle.critic),
          auditorJson: asJson(cycle.auditor),
          decision: cycle.decision,
          decisionNote: cycle.decisionNote,
          completedAt: new Date(),
        },
      });

      await this.events.ingest({
        organizationId: input.organizationId,
        eventType: 'ai.operator_run.completed',
        providerKey: 'tradeops-ai',
        externalEventId: run.id,
        loopMode: effectiveMode,
        isFixture: products.some((p) => p.sourcePlatform.startsWith('fixture')),
        payload: {
          objective: input.objective,
          decision: cycle.decision,
          recommendationCount: cycle.recommendations.length,
          loopMode: effectiveMode,
        },
      });

      await this.audit.write({
        action: 'ai.operator_run',
        resourceType: 'operator_run',
        resourceId: run.id,
        organizationId: input.organizationId,
        actorUserId: input.userId ?? null,
        metadata: {
          decision: cycle.decision,
          loopMode: effectiveMode,
          recommendationCount: cycle.recommendations.length,
          criticSeverity: cycle.critic.severity,
        },
      });

      return {
        runId: run.id,
        loopMode: effectiveMode,
        decision: cycle.decision,
        decisionNote: cycle.decisionNote,
        plan: cycle.plan,
        critic: cycle.critic,
        auditor: cycle.auditor,
        toolTrace: cycle.toolTrace,
        recommendations: cycle.recommendations,
        storedRecommendationIds: recRows.map((r) => r.id),
        honesty: {
          fixtureProductsPresent: products.some((p) => p.sourcePlatform.startsWith('fixture')),
          liveCredentialsPresent: hasLiveGoogle,
          shadowByDefault: effectiveMode === 'shadow',
          note: 'Shadow mode records what the AI would do. No live marketplace publish without credentials + approval.',
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.prisma.client.operatorRun.update({
        where: { id: run.id },
        data: {
          status: 'failed',
          errorMessage: message.slice(0, 500),
          completedAt: new Date(),
        },
      });
      throw error;
    }
  }

  async listRuns(organizationId: string, take = 20) {
    return this.prisma.client.operatorRun.findMany({
      where: { organizationId },
      orderBy: { startedAt: 'desc' },
      take,
      include: {
        recommendations: {
          orderBy: { rank: 'asc' },
          take: 10,
        },
      },
    });
  }

  async getRun(organizationId: string, runId: string) {
    return this.prisma.client.operatorRun.findFirst({
      where: { id: runId, organizationId },
      include: {
        recommendations: { orderBy: { rank: 'asc' } },
        shadowDecisions: true,
      },
    });
  }

  async runHarmonization(organizationId: string) {
    return this.harmonization.resolveOrganizationProducts(organizationId);
  }

  private async loadOperatorProducts(organizationId: string): Promise<OperatorProduct[]> {
    const products = await this.prisma.client.product.findMany({
      where: { organizationId },
      take: 100,
      orderBy: { updatedAt: 'desc' },
    });
    const opps = await this.prisma.client.opportunity.findMany({
      where: { organizationId, productId: { in: products.map((p) => p.id) } },
    });
    const oppByProduct = new Map(opps.map((o) => [o.productId, o]));

    return products.map((p) => {
      const opp = oppByProduct.get(p.id);
      return {
        productId: p.id,
        title: p.title,
        description: p.description,
        category: p.category,
        sourcePlatform: p.sourcePlatform,
        supplierCostMinor: p.supplierCostMinor,
        shippingCostMinor: p.shippingCostMinor,
        targetPriceMinor: p.targetPriceMinor,
        marketplaceFeeMinor: p.marketplaceFeeMinor,
        paymentFeeMinor: p.paymentFeeMinor,
        adAllocationMinor: p.adAllocationMinor,
        returnReserveMinor: p.returnReserveMinor,
        currency: p.currency,
        inventoryQuantity: p.inventoryQuantity,
        rating: p.rating,
        reviewCount: p.reviewCount,
        dataConfidence: p.dataConfidence,
        dataFreshnessAt: p.dataFreshnessAt.toISOString(),
        opportunityScore: opp?.score,
        expectedMarginBps: opp?.expectedMarginBps,
        policyRiskScore: opp?.policyRiskScore,
        currentSignal: opp?.currentSignal,
      };
    });
  }

  private async queueListingApproval(input: {
    organizationId: string;
    productId: string;
    userId?: string | null;
    note: string;
  }) {
    const channel = await this.prisma.client.salesChannel.findFirst({
      where: { organizationId: input.organizationId },
      orderBy: { createdAt: 'asc' },
    });
    if (!channel) return null;

    const product = await this.prisma.client.product.findFirst({
      where: { id: input.productId, organizationId: input.organizationId },
    });
    if (!product) return null;

    let listing = await this.prisma.client.listing.findFirst({
      where: {
        organizationId: input.organizationId,
        productId: product.id,
        salesChannelId: channel.id,
        status: { in: ['draft', 'pending_approval'] },
      },
    });

    if (!listing) {
      listing = await this.prisma.client.listing.create({
        data: {
          organizationId: input.organizationId,
          productId: product.id,
          salesChannelId: channel.id,
          status: 'pending_approval',
          priceMinor: product.targetPriceMinor,
          currency: product.currency,
          sku: product.externalId,
        },
      });
    } else if (listing.status === 'draft') {
      listing = await this.prisma.client.listing.update({
        where: { id: listing.id },
        data: { status: 'pending_approval' },
      });
    }

    const existingApproval = await this.prisma.client.approval.findFirst({
      where: {
        organizationId: input.organizationId,
        listingId: listing.id,
        status: 'pending',
        kind: 'publish_listing',
      },
    });
    if (existingApproval) return existingApproval;

    return this.prisma.client.approval.create({
      data: {
        organizationId: input.organizationId,
        kind: 'publish_listing',
        status: 'pending',
        listingId: listing.id,
        requestedByUserId: input.userId ?? null,
        note: input.note.slice(0, 500),
      },
    });
  }
}
