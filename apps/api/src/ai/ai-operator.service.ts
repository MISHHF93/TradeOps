import { Inject, Injectable, Logger, OnModuleInit, forwardRef } from '@nestjs/common';
import {
  buildExecutionPackage,
  describeLoopModes,
  evaluateExampleReadiness,
  getLiveExample,
  listLiveExamples,
  listToolsPublic,
  bootstrapCohereProvider,
  bootstrapWebSearchProvider,
  describeAiProviders,
  diagnoseCohereConfig,
  resolveProviderFromEnv,
  registerBuiltinTools,
  renderPrompt,
  detectOperatorLiveCredentials,
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
import { loadEnv } from '@tradeops/config';
import {
  evaluatePredictions,
  realizedContributionProfitMinor,
} from '@tradeops/commerce-engine';
import { LIVE_HTTP_IMPLEMENTED, listLiveFeeds } from '@tradeops/connector-core';
import { dataModeFromPlatform, newRequestIds, wrapEnvelope } from '@tradeops/contracts';
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
  ) {}

  onModuleInit(): void {
    // Ensure root/.env + apps/api .env* are applied before Cohere adapter reads keys
    // (main.ts also calls loadEnv; this is idempotent and re-mirrors COHERE_* into process.env).
    loadEnv();
    registerBuiltinTools();
    // Cohere is the sole generative provider for operator Phase B. XAI is not bootstrapped.
    bootstrapCohereProvider(process.env);
    bootstrapWebSearchProvider();
    const active = resolveProviderFromEnv(process.env);
    const cohereDiag = diagnoseCohereConfig(process.env);
    const providers = describeAiProviders()
      .filter((p) => p.id !== 'none')
      .map((p) => `${p.id}${p.configured ? (p.active ? ':active' : ':ready') : ':missing'}${p.role.includes('ignored') ? ':ignored' : ''}`)
      .join(', ');
    this.logger.log(
      `AI operator tools registered: ${listToolsPublic().length}. Loop modes: ${describeLoopModes()
        .map((m) => m.mode)
        .join(', ')}. Generative (Cohere-only): ${active} (${providers}). Web search: Tavily-only.`,
    );
    // Startup diagnostics — codes only, never log key material
    if (!cohereDiag.configured) {
      this.logger.warn(
        `Phase B diagnostics: code=COHERE_KEY_MISSING model=${cohereDiag.model} — tools still run; generative briefing blocked honestly.`,
      );
    } else {
      this.logger.log(
        `Phase B diagnostics: code=COHERE_OK_CONFIGURED model=${cohereDiag.model} keyLength=${cohereDiag.keyLength} (key not logged). Deep probe: GET /api/v1/ai/health?deep=true`,
      );
    }
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
      const envMap: Record<string, string[]> = {
        'shopify-graphql-admin': ['SHOPIFY_SHOP_DOMAIN', 'SHOPIFY_ACCESS_TOKEN'],
        'stripe-api': ['STRIPE_SECRET_KEY'],
        'easypost-api': ['EASYPOST_API_KEY'],
        'tavily-search': ['TAVILY_API_KEY'],
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
  }> {
    await this.saas.assertAiEvaluationAllowed(input.organizationId);

    const snapshot = await this.buildNavigatorSnapshot(input.organizationId);
    const priorKnowledge = await this.loadPriorKnowledge(input.organizationId);

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
        forceShadow: input.forceShadow === true,
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
      connectors: connectors.map((c) => ({
        providerKey: c.providerKey,
        status: c.status,
        dataClass: c.isFixture ? 'TEST_FIXTURE' : 'CONNECTED',
        label: c.isFixture
          ? 'TEST FIXTURE — NOT LIVE DATA'
          : `Connector ${c.providerKey}: ${c.status}`,
      })),
      honesty: {
        note: 'Readiness is capability-based. Fixture connectors never count as live marketplace data.',
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
      // Live examples: default shadow when caller did not opt out (controller sets true by default).
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
    /** Live progress for SSE / sidebar */
    onProgress?: (event: {
      state: string;
      step: string;
      detail?: string;
      at: string;
    }) => void | Promise<void>;
  }) {
    // Readiness: any real vendor/AI/search credential counts (not Google-only).
    const hasLiveCredentials = detectOperatorLiveCredentials(process.env);
    const controlledLiveEnabled =
      process.env.TRADEOPS_CONTROLLED_LIVE === '1' ||
      process.env.TRADEOPS_CONTROLLED_LIVE === 'true';
    const forceFixture =
      process.env.TRADEOPS_FORCE_FIXTURE === '1' ||
      process.env.TRADEOPS_FORCE_FIXTURE === 'true';

    // forceShadow is opt-in only. Missing/false → resolveLoopMode (usually development).
    const effectiveMode: OperationLoopMode =
      input.loopMode ??
      resolveLoopMode({
        forceShadow: input.forceShadow === true,
        forceFixture,
        hasLiveCredentials,
        controlledLiveEnabled,
      });

    // Trusted server-generated correlation (never client-supplied tenant/auth).
    const { requestId, traceId } = newRequestIds();
    const correlationId = requestId;

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
      // Prompt registry owns case framing (source-controlled, versioned)
      const framed = renderPrompt('operator.case_context', {
        caseId: ctx.caseId,
        productTitle: ctx.productTitle,
        stage: ctx.currentStage,
        stageStatus: ctx.stageStatus,
        nextAction: String(ctx.nextActionLabel ?? ''),
        preamble: ctx.contextPreamble,
      });
      const caseBlock = framed.ok ? framed.text : ctx.contextPreamble;
      objective = `${caseBlock}\n\nOperator objective:\n${input.objective}`;
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
          phases: { A: 'pending', B: 'pending' },
          forceShadow: input.forceShadow === true,
          requestId,
          traceId,
          correlationId,
          readiness: {
            hasLiveCredentials,
            controlledLiveEnabled,
            forceFixture,
            cohere: Boolean(
              process.env.COHERE_API_KEY?.trim() || process.env.CO_API_KEY?.trim(),
            ),
            xai: Boolean(process.env.XAI_API_KEY?.trim()),
            generativeProvider: resolveProviderFromEnv(),
            tavily: Boolean(process.env.TAVILY_API_KEY?.trim()),
          },
        }),
        toolTraceJson: [],
      },
    });

    await this.events
      .publishDomain({
        organizationId: input.organizationId,
        eventType: 'AIObjectiveStarted',
        entityId: run.id,
        entityType: 'operator_run',
        // Start event: product dataMode is decided after load. Mode-level only here.
        dataMode:
          effectiveMode === 'fixture'
            ? 'fixture'
            : effectiveMode === 'controlled_live' || effectiveMode === 'automated_live'
              ? 'live'
              : 'simulation',
        loopMode: effectiveMode,
        correlationId,
        traceId,
        payload: {
          objective: input.objective.slice(0, 500),
          loopMode: effectiveMode,
          forceShadow: input.forceShadow === true,
          requestId,
          correlationId,
          traceId,
        },
      })
      .catch(() => undefined);

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

      // Data Loop Router rationale — only select sources justified by objective + readiness.
      const tavilyConfigured = Boolean(process.env.TAVILY_API_KEY?.trim());
      const cohereConfigured = Boolean(
        process.env.COHERE_API_KEY?.trim() || process.env.CO_API_KEY?.trim(),
      );
      const shopifyConfigured = Boolean(
        process.env.SHOPIFY_ACCESS_TOKEN?.trim() && process.env.SHOPIFY_SHOP_DOMAIN?.trim(),
      );
      const dataSourcePlan = {
        selected: [
          {
            source: 'product_store',
            reason: 'Primary ranking evidence: org-scoped canonical products already in DB',
            productCount: products.length,
          },
          {
            source: 'connector_installations',
            reason: 'Capability / health context for tools (not silent fixture swap)',
            count: connectors.length,
          },
          ...(tavilyConfigured
            ? [
                {
                  source: 'tavily',
                  reason: 'Optional public web research for read-only objectives (evidence only)',
                },
              ]
            : []),
          ...(cohereConfigured
            ? [
                {
                  source: 'cohere',
                  reason: 'Phase B synthesis over tool evidence when configured',
                },
              ]
            : []),
        ],
        notSelected: [
          ...(!shopifyConfigured
            ? [
                {
                  source: 'shopify',
                  reason: 'No live Shopify credentials — not auto-substituted with fixtures',
                },
              ]
            : [
                {
                  source: 'shopify_catalog_sync',
                  reason:
                    'Live catalog sync is a separate ops path; operator ranks current store snapshot',
                },
              ]),
          ...(!tavilyConfigured
            ? [
                {
                  source: 'tavily',
                  reason: 'TAVILY_API_KEY missing — research tool blocks honestly, no demo hits',
                },
              ]
            : []),
          ...(!cohereConfigured && !process.env.XAI_API_KEY?.trim()
            ? [
                {
                  source: 'generative',
                  reason:
                    'No COHERE_API_KEY or XAI_API_KEY — Phase B uses deterministic tool summary only',
                },
              ]
            : !cohereConfigured && process.env.XAI_API_KEY?.trim()
              ? [
                  {
                    source: 'xai',
                    reason: 'XAI_API_KEY present — Phase B narrative via xAI (Cohere preferred if keyed)',
                  },
                ]
              : [
                  {
                    source: 'cohere',
                    reason: 'Phase B synthesis over tool evidence (Cohere)',
                  },
                ]),
          {
            source: 'stripe_easypost_ga4',
            reason: 'Not required for product evaluation objectives',
          },
        ],
        policy: {
          neverSilentFixtureFallback: true,
          liveFailureModes: ['partial', 'blocked', 'failed'],
        },
      };

      const progressBuf: Array<{
        state: string;
        step: string;
        detail?: string;
        at: string;
      }> = [];
      // Always buffer progress for response + planJson, and fan-out to SSE when provided.
      const onProgress = async (ev: {
        state: string;
        step: string;
        detail?: string;
        at: string;
      }) => {
        progressBuf.push(ev);
        if (input.onProgress) {
          await input.onProgress(ev);
        }
      };

      const cycle = await runOperatorCycle({
        objective: input.objective,
        products,
        loopMode: effectiveMode,
        connectorSources,
        onProgress,
        synthesizeWithLlm: true,
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
            draftListing: async ({
              organizationId,
              productId,
              userId,
            }: {
              organizationId: string;
              productId: string;
              userId?: string | null;
            }) => {
              // Real listing draft (draft status only — never publish without approval).
              return this.createListingDraftOnly({
                organizationId,
                productId,
                userId,
                correlationId,
              });
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

        // Close evaluate → portfolio loop: upsert Opportunity scores from tool ranking.
        if (rec.productId) {
          await this.upsertOpportunityFromRecommendation({
            organizationId: input.organizationId,
            productId: rec.productId,
            rec,
            runId: run.id,
          });
        }

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

        if (rec.productId) {
          const isFx = products.some(
            (p) => p.productId === rec.productId && p.sourcePlatform.startsWith('fixture'),
          );
          await this.events
            .publishDomain({
              organizationId: input.organizationId,
              eventType: 'ProductEvaluated',
              entityId: rec.productId,
              entityType: 'product',
              dataMode: isFx ? 'fixture' : 'simulation',
              loopMode: effectiveMode,
              correlationId,
              traceId,
              isFixture: isFx,
              payload: {
                runId: run.id,
                rank: rec.rank,
                title: rec.title,
                confidence: rec.confidence,
                requestId,
              },
            })
            .catch(() => undefined);
        }
      }

      // Close evaluate → process board: materialize/update CommerceCase spine from records.
      let casesSynced = 0;
      try {
        const sync = await this.commerceCases.syncOrganization(input.organizationId);
        casesSynced =
          typeof sync === 'object' && sync && 'upserted' in sync
            ? Number((sync as { upserted?: number }).upserted ?? 0)
            : 0;
      } catch (caseErr) {
        this.logger.warn(
          `CommerceCase sync after operator run failed: ${
            caseErr instanceof Error ? caseErr.message : String(caseErr)
          }`,
        );
      }

      // Entity resolution / dedupe (existing harmonization — not a parallel system).
      let harmonization: { linked?: number; candidates?: number; note?: string } | null = null;
      try {
        const h = await this.harmonization.resolveOrganizationProducts(input.organizationId);
        harmonization = {
          linked: Number(h.autoLinked ?? 0),
          candidates: Number(h.matchCount ?? 0),
          note: `Identity resolution: ${h.productCount} products, ${h.autoLinked} auto-linked, ${h.proposedOnly} proposed-only`,
        };
      } catch (harmErr) {
        this.logger.warn(
          `Harmonization after operator run: ${
            harmErr instanceof Error ? harmErr.message : String(harmErr)
          }`,
        );
        harmonization = {
          note: 'Harmonization skipped or failed — products remain usable for ranking',
        };
      }

      // Learning loop: write PredictionOutcome when fulfilled order actuals exist; always report.
      const learning = await this.recordLearningFromRecommendations({
        organizationId: input.organizationId,
        runId: run.id,
        recommendations: cycle.recommendations,
        correlationId,
      });

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

      const fixturePresent = products.some((p) => p.sourcePlatform.startsWith('fixture'));
      const dataMode = fixturePresent
        ? dataModeFromPlatform('fixture-supplier', effectiveMode)
        : dataModeFromPlatform('live', effectiveMode);

      // Persist full A→Z plan envelope (keep readiness from create; add cycle outputs)
      const planEnvelope = {
        ...cycle.plan,
        timeline: cycle.timeline,
        sources: cycle.sources,
        responseSummary: cycle.responseSummary,
        briefingSource: cycle.briefingSource ?? null,
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
        // Loop metadata (not overwritten silently)
        forceShadow: input.forceShadow === true,
        loopMode: effectiveMode,
        dataMode,
        liveProgress: progressBuf,
        requestId,
        traceId,
        correlationId,
        dataSourcePlan,
        casesSynced,
        harmonization,
        learning,
        readiness: {
          hasLiveCredentials,
          controlledLiveEnabled,
          forceFixture,
          cohere: Boolean(
            process.env.COHERE_API_KEY?.trim() || process.env.CO_API_KEY?.trim(),
          ),
          tavily: Boolean(process.env.TAVILY_API_KEY?.trim()),
        },
        dataLoop: {
          A_classify: cycle.objectiveType,
          B_retrieve: cycle.candidateStats?.retrieved ?? 0,
          C_tools: cycle.toolTrace?.length ?? 0,
          D_rank: cycle.recommendations?.length ?? 0,
          E_persist: true,
          F_cases: casesSynced,
          G_harmonize: Boolean(harmonization),
          H_learning: learning.outcomesWritten,
          I_synthesize: Boolean(cycle.responseSummary),
        },
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

      await this.events.publishDomain({
        organizationId: input.organizationId,
        eventType: 'AIObjectiveCompleted',
        entityId: run.id,
        entityType: 'operator_run',
        providerKey: 'tradeops-ai',
        externalEventId: run.id,
        loopMode: effectiveMode,
        isFixture: fixturePresent,
        dataMode,
        correlationId,
        traceId,
        payload: {
          objective: input.objective,
          decision: cycle.decision,
          objectiveType: cycle.objectiveType,
          recommendationCount: cycle.recommendations.length,
          loopMode: effectiveMode,
          responseSummary: cycle.responseSummary,
          phaseA: 'tools_executed',
          phaseB: 'synthesis_complete',
          casesSynced,
          requestId,
          correlationId,
          traceId,
          dataSourcePlan,
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
          requestId,
          correlationId,
          traceId,
          casesSynced,
        },
      });

      // Meter only successful evaluations (platform failures are not billed)
      await this.saas.incrementUsage(input.organizationId, 'ai_evaluations', 1);

      const runtimeState =
        runStatus === 'awaiting_approval'
          ? ('awaiting_approval' as const)
          : runStatus === 'blocked'
            ? ('blocked' as const)
            : ('completed' as const);

      const body = {
        runId: run.id,
        requestId,
        traceId,
        correlationId,
        status: runStatus,
        loopMode: effectiveMode,
        objectiveType: cycle.objectiveType,
        riskClass: cycle.riskClass,
        approvalRequired: cycle.approvalRequired,
        decision: cycle.decision,
        decisionNote: cycle.decisionNote,
        responseSummary: cycle.responseSummary,
        briefingSource: cycle.briefingSource ?? null,
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
        casesSynced,
        dataSourcePlan,
        harmonization,
        learning,
        /** Ranked opportunities board (primary results surface) */
        resultsPath: `/terminal/opportunities?runId=${run.id}`,
        /** Full execution record (timeline, package, tools) */
        objectivePath: `/terminal/objectives/${run.id}`,
        /** Process board after case sync */
        processPath: '/terminal/process',
        executionPackage: executionPackage ?? undefined,
        navigatorSummary: executionPackage
          ? summarizeExecutionPackage(executionPackage)
          : undefined,
        phases: {
          A: 'classify_plan_tools_evidence',
          B: 'synthesize_validate_response',
          C: 'commerce_case_sync',
          D: 'harmonize_and_learn',
        },
        dataLoop: planEnvelope.dataLoop,
        honesty: {
          fixtureProductsPresent: fixturePresent,
          liveCredentialsPresent: hasLiveCredentials,
          forceShadow: input.forceShadow === true,
          loopMode: effectiveMode,
          shadowByDefault: false,
          dataMode,
          note:
            cycle.objectiveType === 'READ_ONLY_ANALYSIS'
              ? 'Read-only analysis: no approval records created. Publish still requires explicit approval. Commerce cases synced for process board. Full Execution Package attached.'
              : effectiveMode === 'shadow'
                ? 'Shadow mode records what the AI would do. No live marketplace publish without credentials + approval. Execution Package tracks plan → verification.'
                : `Loop mode ${effectiveMode}: tool path is live against org store; fixture products remain labeled. Consequential publish still requires approval.`,
        },
      };

      // Canonical envelope: text + data + evidence + actions + dataMode (never demo invent)
      const envelope = wrapEnvelope({
        tenantId: input.organizationId,
        data: body,
        state: runtimeState,
        dataMode,
        text: cycle.responseSummary,
        requestId,
        traceId,
        correlationId,
        confidence:
          cycle.recommendations[0]?.confidence != null
            ? cycle.recommendations[0]!.confidence
            : undefined,
        evidence: products.slice(0, 5).map((p) => ({
          source: p.sourcePlatform,
          providerKey: p.sourcePlatform,
          dataMode: dataModeFromPlatform(p.sourcePlatform, effectiveMode),
          collectedAt: p.dataFreshnessAt,
          confidence: p.dataConfidence,
          evidenceId: p.productId,
          title: p.title,
        })),
        actions: [
          {
            id: 'view_results',
            label: 'View ranked results',
            href: `/terminal/opportunities?runId=${run.id}`,
          },
          {
            id: 'process_board',
            label: 'Open process board',
            href: '/terminal/process',
          },
          ...(cycle.approvalRequired
            ? [
                {
                  id: 'approvals',
                  label: 'Open approvals',
                  href: '/terminal/approvals',
                  requiresApproval: true,
                },
              ]
            : []),
        ],
        warnings: fixturePresent
          ? ['Fixture-labeled products present — not live marketplace data']
          : [],
      });

      return {
        ...body,
        envelope,
        liveProgress: progressBuf,
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
      await this.events
        .publishDomain({
          organizationId: input.organizationId,
          eventType: 'ToolExecutionFailed',
          entityId: run.id,
          entityType: 'operator_run',
          dataMode: 'blocked',
          payload: { message: message.slice(0, 300) },
        })
        .catch(() => undefined);
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

  /**
   * Persist ranked operator scores onto Opportunity rows so Discover / portfolio
   * reflect the same A→Z evaluation as the sidebar (not a disconnected score path).
   */
  private async upsertOpportunityFromRecommendation(input: {
    organizationId: string;
    productId: string;
    runId: string;
    rec: {
      title: string;
      rationale: string;
      confidence: number;
      policyRiskScore: number;
      productCard?: Record<string, unknown>;
      calculation?: Record<string, unknown> | null;
      evidence?: Record<string, unknown> | null;
    };
  }): Promise<void> {
    const card = (input.rec.productCard ?? {}) as Record<string, unknown>;
    const calc = (input.rec.calculation ?? {}) as Record<string, unknown>;
    const score = Math.round(
      Number(card.opportunityScore ?? input.rec.confidence * 100) || 0,
    );
    const expectedProfitMinor = Math.round(
      Number(calc.contributionProfitMinor ?? card.contributionProfitMinor ?? 0) || 0,
    );
    const expectedMarginBps = Math.round(
      Number(calc.netMarginBps ?? card.expectedMarginBps ?? 0) || 0,
    );
    const policyRiskScore = Math.round(
      Number(card.policyRiskScore ?? input.rec.policyRiskScore ?? 0) || 0,
    );
    const demandScore = Math.round(Number(card.demandScore ?? 50) || 50);
    const reviewHealth = Math.round(Number(card.reviewHealth ?? 50) || 50);
    const supplierReliability = Math.round(Number(card.supplierReliability ?? 70) || 70);
    const forecastConfidence = Math.min(
      1,
      Math.max(0, Number(card.forecastConfidence ?? input.rec.confidence) || 0.5),
    );

    // Map rough score → CommerceSignalType for portfolio continuity
    const currentSignal =
      policyRiskScore >= 80
        ? ('BLOCKED' as const)
        : score >= 70
          ? ('BUY' as const)
          : score >= 50
            ? ('HOLD' as const)
            : ('REDUCE' as const);

    try {
      await this.prisma.client.opportunity.upsert({
        where: {
          organizationId_productId: {
            organizationId: input.organizationId,
            productId: input.productId,
          },
        },
        create: {
          organizationId: input.organizationId,
          productId: input.productId,
          score,
          formulaVersion: 'operator-cycle-v1',
          componentsJson: asJson({
            source: 'ai_operator',
            runId: input.runId,
            card,
            calculation: calc,
          }),
          explanation: input.rec.rationale.slice(0, 2000),
          expectedProfitMinor,
          expectedMarginBps,
          demandScore,
          trendScore: 55,
          competitionScore: Math.round(Number(card.competitionScore ?? 45) || 45),
          supplierReliability,
          shippingReliability: 65,
          reviewHealth,
          returnRiskScore: Math.round(Number(card.returnRiskScore ?? 20) || 20),
          policyRiskScore,
          forecastConfidence,
          currentSignal,
          scoredAt: new Date(),
        },
        update: {
          score,
          formulaVersion: 'operator-cycle-v1',
          componentsJson: asJson({
            source: 'ai_operator',
            runId: input.runId,
            card,
            calculation: calc,
          }),
          explanation: input.rec.rationale.slice(0, 2000),
          expectedProfitMinor,
          expectedMarginBps,
          demandScore,
          competitionScore: Math.round(Number(card.competitionScore ?? 45) || 45),
          supplierReliability,
          reviewHealth,
          policyRiskScore,
          forecastConfidence,
          currentSignal,
          scoredAt: new Date(),
        },
      });
    } catch (err) {
      this.logger.warn(
        `Opportunity upsert failed for product ${input.productId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
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

  /**
   * Outcome measurement → learning update.
   * Writes PredictionOutcome only when fulfilled-order actuals exist for a product.
   * Never invents actuals; reports pending when sales history is missing.
   */
  private async recordLearningFromRecommendations(input: {
    organizationId: string;
    runId: string;
    correlationId: string;
    recommendations: Array<{
      productId?: string;
      title: string;
      confidence: number;
      productCard?: Record<string, unknown>;
      calculation?: Record<string, unknown> | null;
    }>;
  }): Promise<{
    outcomesWritten: number;
    pendingActuals: number;
    evaluation: ReturnType<typeof evaluatePredictions>;
    note: string;
  }> {
    let outcomesWritten = 0;
    let pendingActuals = 0;
    const samples: Array<{
      predictedUnits: number;
      actualUnits: number;
      predictedProfitMinor: number;
      actualProfitMinor: number;
      signalCorrect?: boolean;
    }> = [];

    for (const rec of input.recommendations) {
      if (!rec.productId) continue;
      const card = (rec.productCard ?? {}) as Record<string, unknown>;
      const calc = (rec.calculation ?? {}) as Record<string, unknown>;
      const predictedProfitMinor = Math.round(
        Number(calc.contributionProfitMinor ?? card.contributionProfitMinor ?? 0) || 0,
      );
      // Baseline unit forecast: conservative 1-unit trial until sales history exists
      const predictedUnits = 1;

      const product = await this.prisma.client.product.findFirst({
        where: { id: rec.productId, organizationId: input.organizationId },
      });
      if (!product) {
        pendingActuals += 1;
        continue;
      }

      const lines = await this.prisma.client.customerOrderLine.findMany({
        where: {
          productId: rec.productId,
          order: {
            organizationId: input.organizationId,
            status: { in: ['paid', 'fulfilled'] },
          },
        },
        include: { order: true },
        take: 50,
      });

      if (lines.length === 0) {
        pendingActuals += 1;
        continue;
      }

      let actualUnits = 0;
      let actualProfitMinor = 0;
      for (const line of lines) {
        actualUnits += line.quantity;
        const unitPrice = line.unitPriceMinor ?? product.targetPriceMinor;
        actualProfitMinor += realizedContributionProfitMinor({
          unitPriceMinor: unitPrice,
          quantity: line.quantity,
          marketplaceFeeMinorPerUnit: product.marketplaceFeeMinor,
          paymentFeeMinorPerUnit: product.paymentFeeMinor,
          supplierCostMinorPerUnit: product.supplierCostMinor,
          shippingCostMinorPerUnit: product.shippingCostMinor,
          adAllocationMinorPerUnit: product.adAllocationMinor,
          returnReserveMinorPerUnit: product.returnReserveMinor,
        });
      }

      const unitAbsoluteError = Math.abs(actualUnits - predictedUnits);
      const profitAbsoluteError = Math.abs(actualProfitMinor - predictedProfitMinor);
      const signalAtPrediction =
        predictedProfitMinor > 0 ? 'BUY' : predictedProfitMinor < 0 ? 'AVOID' : 'HOLD';
      const signalCorrect =
        (predictedProfitMinor >= 0 && actualProfitMinor >= 0) ||
        (predictedProfitMinor < 0 && actualProfitMinor < 0);

      await this.prisma.client.predictionOutcome.create({
        data: {
          organizationId: input.organizationId,
          productId: rec.productId,
          modelVersion: 'operator-cycle-v1',
          source: 'ai_operator',
          predictedUnits,
          actualUnits,
          predictedProfitMinor,
          actualProfitMinor,
          signalAtPrediction,
          signalCorrect,
          unitAbsoluteError,
          profitAbsoluteError,
          notes: `run=${input.runId} correlation=${input.correlationId}`.slice(0, 500),
          evaluatedAt: new Date(),
        },
      });
      outcomesWritten += 1;
      samples.push({
        predictedUnits,
        actualUnits,
        predictedProfitMinor,
        actualProfitMinor,
        signalCorrect,
      });

      await this.events
        .publishDomain({
          organizationId: input.organizationId,
          eventType: 'PredictionEvaluated',
          entityId: rec.productId,
          entityType: 'product',
          dataMode: product.sourcePlatform.startsWith('fixture') ? 'fixture' : 'simulation',
          correlationId: input.correlationId,
          payload: {
            runId: input.runId,
            predictedProfitMinor,
            actualProfitMinor,
            actualUnits,
          },
        })
        .catch(() => undefined);
    }

    // Also fold historical outcomes for org-level learning report
    const prior = await this.prisma.client.predictionOutcome.findMany({
      where: { organizationId: input.organizationId },
      orderBy: { evaluatedAt: 'desc' },
      take: 50,
    });
    const histSamples = prior.map((o) => ({
      predictedUnits: o.predictedUnits,
      actualUnits: o.actualUnits,
      predictedProfitMinor: o.predictedProfitMinor,
      actualProfitMinor: o.actualProfitMinor,
      signalCorrect: o.signalCorrect ?? undefined,
    }));
    const evaluation = evaluatePredictions(
      histSamples.length > 0 ? histSamples : samples,
      'operator-cycle-v1',
    );

    return {
      outcomesWritten,
      pendingActuals,
      evaluation,
      note:
        outcomesWritten > 0
          ? `Wrote ${outcomesWritten} prediction outcome(s) from fulfilled order lines; ${pendingActuals} pending actuals.`
          : `No fulfilled order actuals for ranked products (${pendingActuals} pending). Forecasts remain in OperatorRecommendation/Opportunity until sales complete.`,
    };
  }

  /** Create or reuse a draft listing — never auto-publish. */
  private async createListingDraftOnly(input: {
    organizationId: string;
    productId: string;
    userId?: string | null;
    correlationId?: string;
  }) {
    const channel = await this.prisma.client.salesChannel.findFirst({
      where: { organizationId: input.organizationId },
      orderBy: { createdAt: 'asc' },
    });
    if (!channel) {
      return {
        status: 'blocked' as const,
        organizationId: input.organizationId,
        productId: input.productId,
        note: 'No sales channel configured — cannot create listing draft.',
        correlationId: input.correlationId,
      };
    }
    const product = await this.prisma.client.product.findFirst({
      where: { id: input.productId, organizationId: input.organizationId },
    });
    if (!product) {
      return {
        status: 'blocked' as const,
        organizationId: input.organizationId,
        productId: input.productId,
        note: 'Product not found in tenant scope.',
        correlationId: input.correlationId,
      };
    }
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
          status: 'draft',
          priceMinor: product.targetPriceMinor,
          currency: product.currency,
          sku: product.externalId,
        },
      });
      await this.events
        .publishDomain({
          organizationId: input.organizationId,
          eventType: 'ListingPrepared',
          entityId: listing.id,
          entityType: 'listing',
          dataMode: product.sourcePlatform.startsWith('fixture') ? 'fixture' : 'simulation',
          correlationId: input.correlationId,
          payload: {
            productId: product.id,
            status: 'draft',
            channel: channel.providerKey,
          },
        })
        .catch(() => undefined);
    }
    return {
      status: 'draft' as const,
      listingId: listing.id,
      organizationId: input.organizationId,
      productId: product.id,
      userId: input.userId ?? null,
      note: 'Listing draft created (not published). Publish requires separate approval.',
      correlationId: input.correlationId,
    };
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
