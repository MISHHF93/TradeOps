import { Inject, Injectable, Logger, OnModuleInit, forwardRef } from '@nestjs/common';
import {
  buildExecutionPackage,
  describeLoopModes,
  evaluateExampleReadiness,
  getLiveExample,
  listLiveExamples,
  listToolsPublic,
  registerBuiltinTools,
  resolveLoopMode,
  runOperatorCycle,
  summarizeExecutionPackage,
  type KnowledgeBaseEntry,
  type LiveExampleDefinition,
  type NavigatorPlatformSnapshot,
  type ObjectiveExecutionPackage,
  type OperationLoopMode,
  type OperatorProduct,
} from '@tradeops/ai-runtime';
import { LIVE_HTTP_IMPLEMENTED, listLiveFeeds } from '@tradeops/connector-core';
import { BillingService } from '../billing/billing.service';
import { CommercePaymentService } from '../billing/commerce-payment.service';
import { CommerceService } from '../commerce/commerce.service';
import { CommerceCaseService } from '../commerce/commerce-case.service';
import { CommerceRuntimeService } from '../commerce/commerce-runtime.service';
import { EcosystemService } from '../commerce/ecosystem.service';
import { WorkspaceService } from '../commerce/workspace.service';
import { AuditService } from '../identity/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventFabricService } from '../events/event-fabric.service';
import { HarmonizationService } from '../harmonization/harmonization.service';
import { SaasService } from '../saas/saas.service';
import { RagService } from './rag.service';
import { PredictionService } from './prediction.service';

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
    private readonly commerce: CommerceService,
    private readonly commerceCases: CommerceCaseService,
    private readonly ecosystem: EcosystemService,
    private readonly workspace: WorkspaceService,
    private readonly runtime: CommerceRuntimeService,
    private readonly billing: BillingService,
    private readonly commercePayments: CommercePaymentService,
    @Inject(forwardRef(() => SaasService)) private readonly saas: SaasService,
    private readonly rag: RagService,
    private readonly prediction: PredictionService,
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
      note: 'Tools are typed and permissioned. Consequential actions require approval. Fixture data is never labeled live. AI is an Objective Resolution Engine — start with objectives, not chat.',
      navigator: {
        packageVersion: '1.0',
        sections: [
          'objective',
          'currentState',
          'liveEvidence',
          'recommendations',
          'executionPlan',
          'timeline',
          'dependencies',
          'risks',
          'executionStatus',
          'verification',
        ],
      },
      rag: {
        train: 'POST /api/v1/ai/rag/train',
        query: 'POST /api/v1/ai/rag/query',
        status: 'GET /api/v1/ai/rag/status',
        embeddingModel: 'rag-tfidf-v1',
        optionalLlm: 'XAI_API_KEY → SpaceXAI/xAI grok grounded answers',
        note: 'RAG train indexes org knowledge. This is continuous retrieval training — not GPU weight fine-tuning.',
      },
    };
  }

  /**
   * Platform snapshot for the Execution Navigator (no fabricated live claims).
   */
  async buildNavigatorSnapshot(
    organizationId: string,
  ): Promise<NavigatorPlatformSnapshot> {
    const products = await this.prisma.client.product.findMany({
      where: { organizationId },
      select: { id: true, sourcePlatform: true },
      take: 200,
    });
    const fixtureProductCount = products.filter((p) =>
      p.sourcePlatform.startsWith('fixture'),
    ).length;
    const connectors = await this.prisma.client.connectorInstallation.findMany({
      where: { organizationId },
      take: 80,
    });
    const openCases = await this.prisma.client.commerceCase.count({
      where: {
        organizationId,
        stageStatus: { notIn: ['completed', 'failed'] },
      },
    });
    const recentRuns = await this.prisma.client.operatorRun.count({
      where: { organizationId },
    });

    const hasLiveHttpReady = [...LIVE_HTTP_IMPLEMENTED].filter((id) => {
      // Credential presence from env (same rule as live-http package)
      const envMap: Record<string, string[]> = {
        'shopify-graphql-admin': ['SHOPIFY_SHOP_DOMAIN', 'SHOPIFY_ACCESS_TOKEN'],
        'stripe-api': ['STRIPE_SECRET_KEY'],
        'open-exchange-rates': ['OPENEXCHANGERATES_APP_ID'],
        'woocommerce-rest': [
          'WOOCOMMERCE_URL',
          'WOOCOMMERCE_CONSUMER_KEY',
          'WOOCOMMERCE_CONSUMER_SECRET',
        ],
        'easypost-api': ['EASYPOST_API_KEY'],
        serpapi: ['SERPAPI_API_KEY'],
      };
      const keys = envMap[id] ?? [];
      return keys.length > 0 && keys.every((k) => Boolean(process.env[k]?.trim()));
    });

    return {
      productCount: products.length,
      fixtureProductCount,
      liveProductCount: products.length - fixtureProductCount,
      connectors: connectors.map((c) => ({
        providerKey: c.providerKey,
        status: String(c.status),
        isFixture: c.isFixture || c.providerKey.startsWith('fixture'),
      })),
      openCommerceCases: openCases,
      recentOperatorRuns: recentRuns,
      simulationMode:
        process.env.TRADEOPS_SIMULATION_MODE === '1' ||
        process.env.TRADEOPS_SIMULATION_MODE === 'true',
      hasLiveHttpReady,
    };
  }

  /**
   * Load prior knowledge from recent completed objective packages.
   */
  async loadPriorKnowledge(
    organizationId: string,
    take = 20,
  ): Promise<KnowledgeBaseEntry[]> {
    const runs = await this.prisma.client.operatorRun.findMany({
      where: {
        organizationId,
        status: { in: ['completed', 'awaiting_approval'] },
      },
      orderBy: { completedAt: 'desc' },
      take,
      select: { id: true, planJson: true },
    });
    const entries: KnowledgeBaseEntry[] = [];
    for (const run of runs) {
      const plan = (run.planJson ?? {}) as {
        executionPackage?: { knowledgeBaseDelta?: KnowledgeBaseEntry[] };
        knowledgeBaseDelta?: KnowledgeBaseEntry[];
      };
      const delta =
        plan.executionPackage?.knowledgeBaseDelta ?? plan.knowledgeBaseDelta ?? [];
      for (const e of delta) {
        entries.push({ ...e, runId: e.runId ?? run.id });
      }
    }
    return entries.slice(0, 40);
  }

  /**
   * Objective Resolution Engine — produces the full 10-section Execution Package.
   * Optionally runs the product operator cycle when the objective is commerce evaluation.
   */
  async resolveObjective(input: {
    organizationId: string;
    userId?: string | null;
    objective: string;
    loopMode?: OperationLoopMode;
    forceShadow?: boolean;
    permissions?: string[];
    commerceCaseId?: string;
    /** When true (default for analysis objectives), also run operator cycle */
    runCycle?: boolean;
  }): Promise<{
    runId: string | null;
    executionPackage: ObjectiveExecutionPackage;
    summary: string;
    cycleResult?: Awaited<ReturnType<AiOperatorService['runObjective']>>;
    rag?: {
      trained: boolean;
      hitCount: number;
      citations: Array<{
        title: string;
        sourceType: string;
        score: number;
        isFixture: boolean;
      }>;
      groundedContextPreview: string;
    } | null;
  }> {
    await this.saas.assertAiEvaluationAllowed(input.organizationId);

    const snapshot = await this.buildNavigatorSnapshot(input.organizationId);
    const priorKnowledge = await this.loadPriorKnowledge(input.organizationId);

    // Ground objective on org RAG index (auto-train if missing)
    let ragGround: Awaited<ReturnType<RagService['groundObjective']>> | null =
      null;
    try {
      ragGround = await this.rag.groundObjective(
        input.organizationId,
        input.objective,
      );
    } catch (e) {
      this.logger.warn(
        `RAG ground skipped: ${e instanceof Error ? e.message : String(e)}`,
      );
    }

    const wantsCycle =
      input.runCycle !== false &&
      /\b(find|search|evaluat|recommend|scan|opportunit|product|margin|listing|publish|procure|purchase)\b/i.test(
        input.objective,
      );

    let cycleResult:
      | Awaited<ReturnType<AiOperatorService['runObjective']>>
      | undefined;
    let runId: string | null = null;

    if (wantsCycle) {
      cycleResult = await this.runObjective({
        organizationId: input.organizationId,
        userId: input.userId,
        objective: input.objective,
        loopMode: input.loopMode,
        forceShadow: input.forceShadow !== false,
        permissions: input.permissions,
        commerceCaseId: input.commerceCaseId,
      });
      runId = cycleResult.runId ?? null;
    }

    // Rebuild package with cycle data + attach to run if present
    const cycleForPackage = cycleResult
      ? {
          plan: cycleResult.plan,
          toolTrace: cycleResult.toolTrace ?? [],
          recommendations: cycleResult.recommendations ?? [],
          critic: cycleResult.critic,
          auditor: cycleResult.auditor,
          decision: cycleResult.decision,
          decisionNote: cycleResult.decisionNote,
          loopMode: cycleResult.loopMode as OperationLoopMode,
          objectiveType: cycleResult.objectiveType,
          riskClass: cycleResult.riskClass,
          approvalRequired: cycleResult.approvalRequired,
          timeline: cycleResult.timeline ?? [],
          sources: cycleResult.sources ?? [],
          responseSummary: cycleResult.responseSummary ?? '',
          candidateStats: cycleResult.candidateStats ?? {
            retrieved: 0,
            normalized: 0,
            rejectedMissingCost: 0,
            passedPolicy: 0,
            ranked: 0,
          },
          filtersApplied: cycleResult.filtersApplied ?? {},
        }
      : null;

    const executionPackage = buildExecutionPackage({
      objective: input.objective,
      loopMode: (cycleResult?.loopMode as OperationLoopMode) ?? input.loopMode ?? 'shadow',
      snapshot,
      cycle: cycleForPackage as import('@tradeops/ai-runtime').OperatorCycleResult | null,
      priorKnowledge,
      runId,
    });

    if (runId) {
      const existing = await this.prisma.client.operatorRun.findFirst({
        where: { id: runId, organizationId: input.organizationId },
      });
      if (existing) {
        const prev = (existing.planJson ?? {}) as Record<string, unknown>;
        await this.prisma.client.operatorRun.update({
          where: { id: runId },
          data: {
            planJson: asJson({
              ...prev,
              executionPackage,
              knowledgeBaseDelta: executionPackage.knowledgeBaseDelta,
              navigatorSummary: summarizeExecutionPackage(executionPackage),
              rag: ragGround
                ? {
                    hitCount: ragGround.hits.length,
                    topTitles: ragGround.hits.slice(0, 5).map((h) => h.title),
                    groundedContext: ragGround.groundedContext.slice(0, 2500),
                  }
                : null,
            }),
          },
        });
      }
    } else {
      // Persist navigation-only run for knowledge continuity
      const navRun = await this.prisma.client.operatorRun.create({
        data: {
          organizationId: input.organizationId,
          userId: input.userId ?? null,
          objective: input.objective,
          loopMode: input.loopMode ?? 'shadow',
          status:
            executionPackage.executionStatus.overall === 'completed'
              ? 'completed'
              : executionPackage.executionStatus.overall === 'failed'
                ? 'failed'
                : executionPackage.executionStatus.overall === 'blocked'
                  ? 'blocked'
                  : 'completed',
          planJson: asJson({
            executionPackage,
            knowledgeBaseDelta: executionPackage.knowledgeBaseDelta,
            navigatorSummary: summarizeExecutionPackage(executionPackage),
            objectiveType: executionPackage.objective.objectiveType,
            finalAnswer: summarizeExecutionPackage(executionPackage),
            responseSummary: summarizeExecutionPackage(executionPackage),
            rag: ragGround
              ? {
                  hitCount: ragGround.hits.length,
                  topTitles: ragGround.hits.slice(0, 5).map((h) => h.title),
                  groundedContext: ragGround.groundedContext.slice(0, 2500),
                }
              : null,
          }),
          toolTraceJson: [],
          decision: 'accept',
          decisionNote: 'Execution Navigator resolution (no product cycle)',
          completedAt: new Date(),
        },
      });
      runId = navRun.id;
      executionPackage.runId = runId;
    }

    await this.events.ingest({
      organizationId: input.organizationId,
      eventType: 'ai.objective.resolved',
      providerKey: 'tradeops-ai-navigator',
      externalEventId: `nav-${runId}-${Date.now()}`,
      loopMode: executionPackage.currentState.loopMode,
      isFixture: snapshot.fixtureProductCount > 0 && snapshot.liveProductCount === 0,
      payload: {
        runId,
        objectiveType: executionPackage.objective.objectiveType,
        status: executionPackage.executionStatus.overall,
        verification: executionPackage.verification.overall,
        knowledgeEntries: executionPackage.knowledgeBaseDelta.length,
        topOption: executionPackage.recommendations.find((r) => r.recommended)?.id,
      },
    });

    return {
      runId,
      executionPackage,
      summary: summarizeExecutionPackage(executionPackage),
      cycleResult,
      rag: ragGround
        ? {
            trained: ragGround.trained,
            hitCount: ragGround.hits.length,
            citations: ragGround.hits.slice(0, 8).map((h) => ({
              title: h.title,
              sourceType: h.sourceType,
              score: h.score,
              isFixture: h.isFixture,
            })),
            groundedContextPreview: ragGround.groundedContext.slice(0, 1200),
          }
        : null,
    };
  }

  /**
   * Live Example Framework catalog + per-org readiness (honest fixture vs live).
   */
  async listLiveExamplesWithReadiness(organizationId: string) {
    const installations = await this.prisma.client.connectorInstallation.findMany({
      where: { organizationId },
      take: 50,
    });
    const productCount = await this.prisma.client.product.count({
      where: { organizationId },
    });
    const connectors = installations.map((c) => ({
      providerKey: c.providerKey,
      status: String(c.status),
      isFixture: c.providerKey.startsWith('fixture'),
      capabilities: undefined as string[] | undefined,
    }));

    return {
      examples: listLiveExamples().map((ex) => {
        const readiness = evaluateExampleReadiness(ex, { connectors, productCount });
        return { ...ex, ...readiness };
      }),
      productCount,
      connectors: connectors.map((c) => {
        const status = String(c.status).toLowerCase();
        const isFixture = c.isFixture;
        // Honesty: never label credentials_required / unhealthy as CONNECTED
        let dataClass:
          | 'TEST_FIXTURE'
          | 'CONNECTED'
          | 'CREDENTIALS_REQUIRED'
          | 'UNHEALTHY'
          | 'REGISTERED';
        if (isFixture) {
          dataClass = 'TEST_FIXTURE';
        } else if (status === 'connected') {
          dataClass = 'CONNECTED';
        } else if (status.includes('credential') || status === 'credentials_required') {
          dataClass = 'CREDENTIALS_REQUIRED';
        } else if (status === 'unhealthy' || status === 'error') {
          dataClass = 'UNHEALTHY';
        } else {
          dataClass = 'REGISTERED';
        }
        return {
          providerKey: c.providerKey,
          status: c.status,
          dataClass,
          label: isFixture
            ? 'TEST FIXTURE — NOT LIVE DATA'
            : dataClass === 'CONNECTED'
              ? `Live connector ${c.providerKey}: connected (env credentials present — not a success claim)`
              : `Connector ${c.providerKey}: ${c.status}`,
        };
      }),
      honesty: {
        note: 'Readiness is capability-based. Fixture connectors never count as live marketplace data. CONNECTED means install status only — not a successful vendor sync.',
      },
    };
  }

  async runLiveExample(input: {
    organizationId: string;
    userId?: string | null;
    exampleId: string;
    forceShadow?: boolean;
    permissions?: string[];
  }) {
    const example = getLiveExample(input.exampleId);
    if (!example) {
      throw new Error(`Unknown live example: ${input.exampleId}`);
    }
    if (!example.runnable) {
      return {
        blocked: true as const,
        exampleId: example.id,
        readiness: 'not_implemented' as const,
        message: `Live example "${example.name}" is defined but automated execution is not fully wired.`,
        example,
      };
    }

    const catalog = await this.listLiveExamplesWithReadiness(input.organizationId);
    const ready = catalog.examples.find((e) => e.id === example.id);

    // Specialized multi-step examples (still real DB + services, not mock UI)
    if (example.id === 'supplier-comparison-listing-draft') {
      return this.runSupplierComparisonListingDraftExample({
        organizationId: input.organizationId,
        userId: input.userId,
        example,
        readiness: ready?.readiness ?? 'partially_ready',
        readinessReason: ready?.reason,
        forceShadow: input.forceShadow !== false,
        permissions: input.permissions,
      });
    }

    if (example.id === 'approved-listing-publication') {
      return this.runApprovedListingPublicationExample({
        organizationId: input.organizationId,
        userId: input.userId,
        example,
        readiness: ready?.readiness ?? 'partially_ready',
        readinessReason: ready?.reason,
      });
    }

    if (example.id === 'customer-order-supplier-fulfillment') {
      return this.runOrderFulfillmentExample({
        organizationId: input.organizationId,
        userId: input.userId,
        example,
        readiness: ready?.readiness ?? 'partially_ready',
        readinessReason: ready?.reason,
      });
    }

    const result = await this.runObjective({
      organizationId: input.organizationId,
      userId: input.userId,
      objective: example.objective,
      forceShadow: input.forceShadow !== false,
      permissions: input.permissions,
      liveExampleId: example.id,
    });

    return {
      blocked: false as const,
      exampleId: example.id,
      example,
      readiness: ready?.readiness ?? 'partially_ready',
      readinessReason: ready?.reason,
      ...result,
    };
  }

  /**
   * Example 2: strongest product → supplier offers → channel pick → listing draft (no publish).
   */
  private async runSupplierComparisonListingDraftExample(input: {
    organizationId: string;
    userId?: string | null;
    example: LiveExampleDefinition;
    readiness: string;
    readinessReason?: string;
    forceShadow?: boolean;
    permissions?: string[];
  }) {
    // First ensure we have ranked evaluation context
    const scan = await this.runObjective({
      organizationId: input.organizationId,
      userId: input.userId,
      objective:
        'Find three products under $20 supplier cost that could sell in Canada with at least a 25% expected margin.',
      forceShadow: input.forceShadow !== false,
      permissions: input.permissions,
      liveExampleId: input.example.id,
    });

    const top = scan.recommendations?.[0] as
      | { productId?: string; title?: string; productCard?: Record<string, unknown> }
      | undefined;
    let productId = top?.productId;
    if (!productId) {
      const best = await this.prisma.client.opportunity.findFirst({
        where: { organizationId: input.organizationId },
        orderBy: { score: 'desc' },
      });
      productId = best?.productId;
    }
    if (!productId) {
      return {
        blocked: false as const,
        exampleId: input.example.id,
        example: input.example,
        readiness: input.readiness,
        readinessReason: input.readinessReason,
        ...scan,
        responseSummary:
          scan.responseSummary +
          '\n\nCould not create listing draft: no qualifying product in store. Import supplier data first.',
      };
    }

    const product = await this.prisma.client.product.findFirst({
      where: { id: productId, organizationId: input.organizationId },
    });
    if (!product) {
      return {
        blocked: false as const,
        exampleId: input.example.id,
        example: input.example,
        readiness: input.readiness,
        ...scan,
        responseSummary: 'Product disappeared before draft creation.',
      };
    }

    const offers = await this.prisma.client.supplierOffer.findMany({
      where: { organizationId: input.organizationId, productId: product.id },
      include: { supplier: true },
      take: 20,
    });
    const channels = await this.prisma.client.salesChannel.findMany({
      where: { organizationId: input.organizationId },
      take: 10,
    });

    const offerCompare = (offers.length
      ? offers.map((o) => ({
          costMinor: o.costMinor,
          shippingMinor: o.shippingCostMinor,
          supplierName: o.supplier?.name ?? o.sourcePlatform,
        }))
      : [
          {
            costMinor: product.supplierCostMinor,
            shippingMinor: product.shippingCostMinor,
            supplierName: product.sourcePlatform,
          },
        ]
    ).map((o) => {
      const cost = o.costMinor + o.shippingMinor;
      const marginBps = product.targetPriceMinor
        ? Math.round(
            ((product.targetPriceMinor -
              cost -
              product.marketplaceFeeMinor -
              product.paymentFeeMinor) /
              product.targetPriceMinor) *
              10_000,
          )
        : 0;
      return {
        supplier: o.supplierName,
        costMinor: o.costMinor,
        shippingMinor: o.shippingMinor,
        landedMinor: cost,
        expectedMarginBps: marginBps,
        isFixture: product.sourcePlatform.startsWith('fixture'),
      };
    });
    offerCompare.sort((a, b) => b.expectedMarginBps - a.expectedMarginBps);
    const bestOffer = offerCompare[0];

    const channel = channels.find((c) => c.providerKey === 'fixture-marketplace') ?? channels[0];
    let listing = null as null | { id: string; status: string; sku: string };
    let draftNote = 'No sales channel configured — draft not created.';
    if (channel) {
      const existing = await this.prisma.client.listing.findFirst({
        where: {
          organizationId: input.organizationId,
          productId: product.id,
          salesChannelId: channel.id,
          status: { in: ['draft', 'pending_approval'] },
        },
      });
      if (existing) {
        listing = await this.prisma.client.listing.update({
          where: { id: existing.id },
          data: { status: 'draft', priceMinor: product.targetPriceMinor },
        });
        draftNote = 'Updated existing listing draft (not published).';
      } else {
        listing = await this.prisma.client.listing.create({
          data: {
            organizationId: input.organizationId,
            productId: product.id,
            salesChannelId: channel.id,
            status: 'draft',
            priceMinor: product.targetPriceMinor,
            currency: product.currency,
            sku: product.externalId,
          },
        });
        draftNote = 'Created listing draft (not published). Publish requires separate approval.';
      }
      await this.audit.write({
        action: 'listing.draft_created',
        resourceType: 'listing',
        resourceId: listing.id,
        organizationId: input.organizationId,
        actorUserId: input.userId ?? null,
        metadata: {
          liveExampleId: input.example.id,
          channel: channel.providerKey,
          productId: product.id,
        },
      });
    }

    const responseSummary = [
      scan.responseSummary,
      '',
      '--- Supplier comparison & listing draft ---',
      `Selected product: ${product.title} (${product.id.slice(0, 8)})`,
      `Supplier options compared: ${offerCompare.length}`,
      bestOffer
        ? `Recommended supplier: ${bestOffer.supplier} · landed $${(bestOffer.landedMinor / 100).toFixed(2)} · est. margin ${(bestOffer.expectedMarginBps / 100).toFixed(1)}%`
        : 'No supplier offer rows — used product cost baseline.',
      channel
        ? `Recommended channel: ${channel.providerKey} (${channel.name})`
        : 'No sales channel.',
      draftNote,
      listing ? `Listing ${listing.id.slice(0, 8)} status=${listing.status}` : '',
      product.sourcePlatform.startsWith('fixture')
        ? 'TEST FIXTURE — NOT LIVE DATA (draft is real DB row, marketplace is fixture).'
        : '',
    ]
      .filter(Boolean)
      .join('\n');

    // Patch latest run decision note with draft outcome
    if (scan.runId) {
      await this.prisma.client.operatorRun.update({
        where: { id: scan.runId },
        data: {
          decisionNote: responseSummary.slice(0, 4000),
          planJson: asJson({
            ...(typeof scan.plan === 'object' && scan.plan ? scan.plan : {}),
            finalAnswer: responseSummary,
            liveExampleId: input.example.id,
            supplierComparison: offerCompare,
            listingDraft: listing,
            recommendedChannel: channel?.providerKey ?? null,
          }),
        },
      });
    }

    return {
      blocked: false as const,
      exampleId: input.example.id,
      example: input.example,
      readiness: input.readiness,
      readinessReason: input.readinessReason,
      ...scan,
      responseSummary,
      decisionNote: responseSummary,
      supplierComparison: offerCompare,
      listingDraft: listing,
      recommendedChannel: channel
        ? { providerKey: channel.providerKey, id: channel.id }
        : null,
      resultsPath: scan.resultsPath ?? `/terminal/objectives/${scan.runId}`,
      nextSteps: [
        'Open listing draft on product twin',
        'Request publish approval when ready (not created by this example)',
      ],
    };
  }

  /**
   * Example 3: ensure publish approval exists for a draft listing (does not auto-publish).
   */
  private async runApprovedListingPublicationExample(input: {
    organizationId: string;
    userId?: string | null;
    example: LiveExampleDefinition;
    readiness: string;
    readinessReason?: string;
  }) {
    const draft = await this.prisma.client.listing.findFirst({
      where: {
        organizationId: input.organizationId,
        status: { in: ['draft', 'pending_approval'] },
      },
      orderBy: { updatedAt: 'desc' },
      include: { product: true, salesChannel: true },
    });

    if (!draft) {
      return {
        blocked: true as const,
        exampleId: input.example.id,
        example: input.example,
        readiness: 'credentials_required' as const,
        message:
          'Live execution blocked for publication path: no listing draft found. Run "Supplier Comparison and Listing Draft" first.',
        requiredAction: 'Run live example supplier-comparison-listing-draft',
      };
    }

    await this.prisma.client.listing.update({
      where: { id: draft.id },
      data: { status: 'pending_approval' },
    });

    let approval = await this.prisma.client.approval.findFirst({
      where: {
        organizationId: input.organizationId,
        listingId: draft.id,
        kind: 'publish_listing',
        status: { in: ['pending', 'approved'] },
      },
    });
    let deduped = false;
    if (approval) {
      deduped = true;
    } else {
      approval = await this.prisma.client.approval.create({
        data: {
          organizationId: input.organizationId,
          kind: 'publish_listing',
          status: 'pending',
          listingId: draft.id,
          requestedByUserId: input.userId ?? null,
          note: `Publish listing ${draft.sku} to ${draft.salesChannel.providerKey} — requires founder approval before external call`,
        },
      });
    }

    await this.audit.write({
      action: 'listing.publish_requested',
      resourceType: 'approval',
      resourceId: approval.id,
      organizationId: input.organizationId,
      actorUserId: input.userId ?? null,
      metadata: { liveExampleId: input.example.id, deduped },
    });

    const isFixtureChannel = draft.salesChannel.providerKey.startsWith('fixture');
    const responseSummary = [
      'Listing publication path prepared (not silently published).',
      `Listing: ${draft.sku} · product ${draft.product.title}`,
      `Channel: ${draft.salesChannel.providerKey}`,
      `Approval: ${approval.id.slice(0, 8)} status=${approval.status}${deduped ? ' (deduped existing)' : ''}`,
      isFixtureChannel
        ? 'Channel is TEST FIXTURE — approve will call fixture marketplace publish, not a live merchant API.'
        : 'Live OAuth/credentials required for non-fixture channels before external success.',
      '',
      'Next: open /terminal/approvals → Approve → system executes publish and marks listing active.',
    ].join('\n');

    return {
      blocked: false as const,
      exampleId: input.example.id,
      example: input.example,
      readiness: input.readiness,
      readinessReason: input.readinessReason,
      objectiveType: 'PUBLISH_LISTING',
      approvalRequired: true,
      decision: 'escalate',
      responseSummary,
      decisionNote: responseSummary,
      approval: {
        id: approval.id,
        status: approval.status,
        kind: approval.kind,
        listingId: draft.id,
      },
      resultsPath: '/terminal/approvals',
      honesty: {
        note: isFixtureChannel
          ? 'TEST FIXTURE marketplace publish path'
          : 'Credential-gated live publish',
      },
    };
  }

  /**
   * Example 4: ensure a paid order + PO draft + approval exist (fixture order path if empty).
   */
  private async runOrderFulfillmentExample(input: {
    organizationId: string;
    userId?: string | null;
    example: LiveExampleDefinition;
    readiness: string;
    readinessReason?: string;
  }) {
    let order = await this.prisma.client.customerOrder.findFirst({
      where: { organizationId: input.organizationId, status: 'paid' },
      orderBy: { createdAt: 'desc' },
      include: {
        lines: true,
        fulfillments: true,
        purchaseOrders: true,
      },
    });

    let seeded = false;
    let fixtureOrderIngest = false;
    if (!order) {
      // Honest TEST FIXTURE seed so the fulfillment example is executable in founder dev
      await this.commerce.ingestFixtureOrders(
        input.organizationId,
        input.userId ?? 'system',
      );
      fixtureOrderIngest = true;
      seeded = true;
      order = await this.prisma.client.customerOrder.findFirst({
        where: { organizationId: input.organizationId, status: 'paid' },
        orderBy: { createdAt: 'desc' },
        include: {
          lines: true,
          fulfillments: true,
          purchaseOrders: true,
        },
      });
    }

    if (!order) {
      return {
        blocked: true as const,
        exampleId: input.example.id,
        example: input.example,
        readiness: 'partially_ready' as const,
        message:
          'Live execution blocked: no paid customer orders after fixture ingest. Import supplier products first, then rerun.',
        requiredAction: 'Import fixture supplier products, then rerun this example',
        resultsPath: '/terminal/orders',
      };
    }

    let po = order.purchaseOrders?.[0];
    if (!po) {
      const productId =
        order.lines.find((l) => l.productId)?.productId ??
        (
          await this.prisma.client.product.findFirst({
            where: { organizationId: input.organizationId },
          })
        )?.id;
      if (productId) {
        const product = await this.prisma.client.product.findFirst({
          where: { id: productId, organizationId: input.organizationId },
        });
        if (product) {
          po = await this.prisma.client.supplierPurchaseOrder.create({
            data: {
              organizationId: input.organizationId,
              productId: product.id,
              customerOrderId: order.id,
              status: 'pending',
              costMinor: product.supplierCostMinor,
              shippingMinor: product.shippingCostMinor,
              currency: product.currency,
              quantity: order.lines[0]?.quantity ?? 1,
              isDraft: true,
            },
          });
          seeded = true;
        }
      }
    }

    let approval = null as null | { id: string; status: string };
    if (po) {
      const existing = await this.prisma.client.approval.findFirst({
        where: {
          organizationId: input.organizationId,
          supplierPurchaseOrderId: po.id,
          kind: 'supplier_purchase_order',
          status: { in: ['pending', 'approved'] },
        },
      });
      if (existing) {
        approval = existing;
      } else {
        approval = await this.prisma.client.approval.create({
          data: {
            organizationId: input.organizationId,
            kind: 'supplier_purchase_order',
            status: 'pending',
            supplierPurchaseOrderId: po.id,
            requestedByUserId: input.userId ?? null,
            note: 'Approve supplier purchase order before external supplier submission',
          },
        });
        seeded = true;
      }
    }

    const responseSummary = [
      'Customer order → supplier fulfillment path.',
      fixtureOrderIngest
        ? 'TEST FIXTURE — seeded paid order via fixture marketplace ingest (NOT live marketplace traffic).'
        : 'Using existing paid order in store.',
      `Order ${order.id.slice(0, 8)} status=${order.status} totalMinor=${order.totalMinor}`,
      po
        ? `PO ${po.id.slice(0, 8)} draft=${po.isDraft} status=${po.status}`
        : 'No PO linked — product mapping missing.',
      approval
        ? `Approval ${approval.id.slice(0, 8)} status=${approval.status} (required before supplier submit)`
        : 'No PO approval created.',
      seeded ? 'Created missing PO/approval rows for this order (idempotent).' : 'Used existing order/PO/approval.',
      '',
      'Next: /terminal/approvals → Approve PO → fulfillment advances; tracking is fixture/carrier until live supplier API.',
    ].join('\n');

    return {
      blocked: false as const,
      exampleId: input.example.id,
      example: input.example,
      readiness: input.readiness,
      readinessReason: input.readinessReason,
      objectiveType: 'SUPPLIER_PO',
      approvalRequired: true,
      decision: 'escalate',
      responseSummary,
      decisionNote: responseSummary,
      order: { id: order.id, status: order.status },
      purchaseOrder: po ? { id: po.id, isDraft: po.isDraft, status: po.status } : null,
      approval,
      resultsPath: '/terminal/approvals',
    };
  }

  async runObjective(input: {
    organizationId: string;
    userId?: string | null;
    objective: string;
    loopMode?: OperationLoopMode;
    forceShadow?: boolean;
    permissions?: string[];
    liveExampleId?: string;
    /** Bind operator to a commerce case — stage-aware recommendations only */
    commerceCaseId?: string;
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

    // Server-side entitlement enforcement (never UI-only)
    await this.saas.assertAiEvaluationAllowed(input.organizationId);

    // Commerce Runtime + persona — AI is Runtime Optimizer, not a chatbot
    let workspacePreamble = '';
    let allowedAiTools: string[] = [];
    let runtimePreamble = '';
    if (input.userId) {
      try {
        const ws = await this.workspace.resolve({
          organizationId: input.organizationId,
          userId: input.userId,
          founderDirect: process.env.TRADEOPS_ACCESS_MODE === 'founder_direct',
        });
        workspacePreamble = ws.aiContextPreamble;
        allowedAiTools = ws.allowedAiTools;
      } catch {
        // Workspace optional if membership missing
      }
      try {
        const rt = await this.runtime.getAiContext({
          organizationId: input.organizationId,
          userId: input.userId,
          caseId: input.commerceCaseId?.trim() || null,
          founderDirect: process.env.TRADEOPS_ACCESS_MODE === 'founder_direct',
        });
        runtimePreamble = rt.contextPreamble;
      } catch {
        // Runtime optional on cold start
      }
    }

    let objective = input.objective;
    let caseContext: {
      caseId: string;
      productId: string;
      currentStage: string;
      stageStatus: string;
      contextPreamble: string;
    } | null = null;
    if (input.commerceCaseId?.trim()) {
      const ctx = await this.commerceCases.getCaseAiContext(
        input.organizationId,
        input.commerceCaseId.trim(),
      );
      caseContext = {
        caseId: ctx.caseId,
        productId: ctx.productId,
        currentStage: ctx.currentStage,
        stageStatus: ctx.stageStatus,
        contextPreamble: ctx.contextPreamble,
      };
      objective = `${ctx.contextPreamble}\n\nOperator objective:\n${input.objective}`;
    }
    if (runtimePreamble) {
      objective = `${runtimePreamble}\n\n${objective}`;
    } else if (workspacePreamble) {
      objective = `${workspacePreamble}\n\n${objective}`;
    }

    const run = await this.prisma.client.operatorRun.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId ?? null,
        objective,
        loopMode: effectiveMode,
        status: 'collecting',
        planJson: asJson({
          ...(caseContext
            ? { commerceCaseId: caseContext.caseId, stage: caseContext.currentStage }
            : {}),
          allowedAiTools,
          workspaceBound: Boolean(workspacePreamble),
        }),
        toolTraceJson: [],
      },
    });

    try {
      let products = await this.loadOperatorProducts(input.organizationId);
      if (caseContext) {
        products = products.filter((p) => p.productId === caseContext!.productId);
        if (products.length === 0) {
          // Still allow cycle with empty product set if filter too tight
          products = await this.loadOperatorProducts(input.organizationId);
        }
      }
      const connectors = await this.prisma.client.connectorInstallation.findMany({
        where: { organizationId: input.organizationId },
        take: 20,
      });
      const connectorSources = [
        ...connectors.map((c) => ({
          name: c.providerKey,
          status: String(c.status),
          detail: c.providerKey.startsWith('fixture') ? 'Fixture-labeled' : undefined,
        })),
        {
          name: 'Product store',
          status: products.length > 0 ? 'connected' : 'empty',
          detail: `${products.length} products`,
        },
      ];

      const cycle = await runOperatorCycle({
        objective: input.objective,
        products,
        loopMode: effectiveMode,
        connectorSources,
        ctx: {
          organizationId: input.organizationId,
          userId: input.userId,
          loopMode: effectiveMode,
          permissions: input.permissions ?? ['*'],
          deps: {
            ecosystemCapabilityBoard: async ({ organizationId }: { organizationId: string }) =>
              this.ecosystem.capabilityBoard(organizationId),
            selectConnectorsForCapabilities: async ({
              organizationId,
              required,
            }: {
              organizationId: string;
              required: string[];
            }) => {
              const board = await this.ecosystem.capabilityBoard(organizationId);
              return this.ecosystem.selectConnectors(
                board.advertisements,
                required as import('@tradeops/connector-core').BusinessCapability[],
              );
            },
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
              return {
                count: rows.length,
                products: rows.map((p) => ({
                  productId: p.id,
                  title: p.title,
                  sourcePlatform: p.sourcePlatform,
                  isFixture: p.sourcePlatform.startsWith('fixture'),
                })),
              };
            },
            trainRagIndex: async ({ organizationId }: { organizationId: string }) =>
              this.rag.train(organizationId, input.userId),
            queryRagKnowledge: async ({
              organizationId,
              query,
              topK,
              excludeFixtures,
              generate,
            }: {
              organizationId: string;
              query: string;
              topK?: number;
              excludeFixtures?: boolean;
              generate?: boolean;
            }) =>
              this.rag.query(organizationId, {
                query,
                topK,
                excludeFixtures,
                generate,
                autoTrainIfMissing: true,
              }),
            runPredictionEngine: async ({
              organizationId,
              productId,
              horizonDays,
              limit,
            }: {
              organizationId: string;
              productId?: string;
              horizonDays?: number;
              limit?: number;
            }) => {
              const h: 7 | 14 | 30 =
                horizonDays === 7 || horizonDays === 30 ? horizonDays : 14;
              return this.prediction.run(organizationId, {
                productId,
                horizonDays: h,
                limit,
              });
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
              // Draft only — no publish approval here
              return {
                status: 'draft_only',
                organizationId,
                productId,
                userId: userId ?? null,
                note: 'Draft action only. No external marketplace publish. Publish requires separate approval.',
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
            getBillingStatus: async ({ organizationId }: { organizationId: string }) =>
              this.billing.getSubscriptionStatus(organizationId),
            createBillingCheckout: async (args: {
              organizationId: string;
              userId?: string | null;
              planId: string;
              interval?: 'month' | 'year';
            }) => this.billing.createCheckoutSession(args),
            openBillingPortal: async (args: {
              organizationId: string;
              userId?: string | null;
            }) => this.billing.createPortalSession(args),
            inspectOrderPayment: async (args: {
              organizationId: string;
              paymentId?: string;
              orderId?: string;
            }) => {
              if (args.paymentId) {
                return this.commercePayments.getPaymentDetail(args.organizationId, args.paymentId);
              }
              const list = await this.commercePayments.listPayments(args.organizationId);
              if (args.orderId) {
                return {
                  ...list,
                  payments: list.payments.filter((p) => p.customerOrderId === args.orderId),
                };
              }
              return list;
            },
            inspectPayout: async ({ organizationId }: { organizationId: string }) => {
              const [payouts, reconciliations] = await Promise.all([
                this.commercePayments.listPayouts(organizationId),
                this.commercePayments.listReconciliations(organizationId),
              ]);
              return { payouts, reconciliations };
            },
            reconcilePayout: async (args: {
              organizationId: string;
              userId?: string | null;
            }) => this.commercePayments.createPayoutAndReconcile(args),
            explainPaymentVariance: async (args: {
              organizationId: string;
              reconciliationId?: string;
            }) => {
              const { reconciliations } = await this.commercePayments.listReconciliations(
                args.organizationId,
              );
              const row = args.reconciliationId
                ? reconciliations.find((r) => r.id === args.reconciliationId)
                : reconciliations[0];
              if (!row) {
                return { note: 'No reconciliations yet. Run fixture reconcile or ingest a payout.' };
              }
              return {
                reconciliationId: row.id,
                status: row.status,
                expectedNetMinor: row.expectedNetMinor,
                actualNetMinor: row.actualNetMinor,
                varianceMinor: row.varianceMinor,
                unmatchedAmountMinor: row.unmatchedAmountMinor,
                summary: row.summaryJson,
                explanation:
                  row.varianceMinor === 0
                    ? 'Expected net matches payout net — reconciliation matched.'
                    : `Variance of ${row.varianceMinor} minor units: actual net (${row.actualNetMinor}) vs expected (${row.expectedNetMinor}). Inspect settlement fees, refunds, and unmatched lines.`,
              };
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
            evidenceJson: asJson({
              ...rec.evidence,
              productCard: rec.productCard,
              nextActions: rec.nextActions,
            }),
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

        // Shadow ledger for what AI would do on consequential actions only
        if (
          effectiveMode === 'shadow' &&
          rec.actionClass !== 'read_only' &&
          rec.proposedAction !== 'evaluateProduct'
        ) {
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

        // ONLY queue publish_listing approval for consequential publish intents
        if (
          rec.productId &&
          rec.approvalRequired &&
          (rec.proposedAction === 'publishListing' ||
            cycle.objectiveType === 'PUBLISH_LISTING')
        ) {
          await this.queueListingApproval({
            organizationId: input.organizationId,
            productId: rec.productId,
            userId: input.userId,
            note: `AI operator publish: ${rec.title}`,
          });
        }
      }

      // Execution Navigator package (objective → verified outcome)
      let executionPackage: ObjectiveExecutionPackage | null = null;
      try {
        const snapshot = await this.buildNavigatorSnapshot(input.organizationId);
        const priorKnowledge = await this.loadPriorKnowledge(input.organizationId);
        executionPackage = buildExecutionPackage({
          objective: input.objective,
          loopMode: effectiveMode,
          snapshot,
          cycle,
          priorKnowledge,
          runId: run.id,
        });
      } catch (navErr) {
        this.logger.warn(
          `Execution package build failed: ${navErr instanceof Error ? navErr.message : String(navErr)}`,
        );
      }

      // Persist timeline + response as plan envelope (ObjectiveExecution equivalent)
      const planEnvelope = {
        ...cycle.plan,
        timeline: cycle.timeline,
        sources: cycle.sources,
        responseSummary: cycle.responseSummary,
        candidateStats: cycle.candidateStats,
        filtersApplied: cycle.filtersApplied,
        objectiveType: cycle.objectiveType,
        riskClass: cycle.riskClass,
        approvalRequired: cycle.approvalRequired,
        liveExampleId: input.liveExampleId ?? null,
        finalAnswer: cycle.responseSummary,
        executionPackage: executionPackage ?? undefined,
        knowledgeBaseDelta: executionPackage?.knowledgeBaseDelta,
        navigatorSummary: executionPackage
          ? summarizeExecutionPackage(executionPackage)
          : undefined,
      };

      const runStatus =
        cycle.decision === 'block' && cycle.objectiveType !== 'READ_ONLY_ANALYSIS'
          ? 'blocked'
          : cycle.decision === 'escalate' ||
              (cycle.approvalRequired &&
                cycle.recommendations.some((r) => r.approvalRequired))
            ? 'awaiting_approval'
            : 'completed';

      await this.prisma.client.operatorRun.update({
        where: { id: run.id },
        data: {
          status: runStatus,
          planJson: asJson(planEnvelope),
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
          objectiveType: cycle.objectiveType,
          recommendationCount: cycle.recommendations.length,
          loopMode: effectiveMode,
          responseSummary: cycle.responseSummary,
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
          objectiveType: cycle.objectiveType,
          loopMode: effectiveMode,
          recommendationCount: cycle.recommendations.length,
          criticSeverity: cycle.critic.severity,
          approvalRequired: cycle.approvalRequired,
        },
      });

      // Meter only successful evaluations (platform failures are not billed)
      await this.saas.incrementUsage(input.organizationId, 'ai_evaluations', 1);

      return {
        runId: run.id,
        status: runStatus,
        loopMode: effectiveMode,
        objectiveType: cycle.objectiveType,
        riskClass: cycle.riskClass,
        approvalRequired: cycle.approvalRequired,
        decision: cycle.decision,
        decisionNote: cycle.decisionNote,
        responseSummary: cycle.responseSummary,
        plan: cycle.plan,
        timeline: cycle.timeline,
        sources: cycle.sources,
        candidateStats: cycle.candidateStats,
        filtersApplied: cycle.filtersApplied,
        critic: cycle.critic,
        auditor: cycle.auditor,
        toolTrace: cycle.toolTrace,
        recommendations: cycle.recommendations,
        storedRecommendationIds: recRows.map((r) => r.id),
        resultsPath: `/terminal/opportunities?runId=${run.id}`,
        executionPackage: executionPackage ?? undefined,
        navigatorSummary: executionPackage
          ? summarizeExecutionPackage(executionPackage)
          : undefined,
        honesty: {
          fixtureProductsPresent: products.some((p) => p.sourcePlatform.startsWith('fixture')),
          liveCredentialsPresent: hasLiveGoogle,
          shadowByDefault: effectiveMode === 'shadow',
          note:
            cycle.objectiveType === 'READ_ONLY_ANALYSIS'
              ? 'Read-only analysis: no approval records created. Publish still requires explicit approval. Full Execution Package attached for objective navigation.'
              : 'Shadow mode records what the AI would do. No live marketplace publish without credentials + approval. Execution Package tracks plan → verification.',
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

    // Idempotent: one pending/approved publish approval per listing
    const existingApproval = await this.prisma.client.approval.findFirst({
      where: {
        organizationId: input.organizationId,
        listingId: listing.id,
        kind: 'publish_listing',
        status: { in: ['pending', 'approved'] },
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
