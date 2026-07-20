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
  detectOperatorLiveCredentials,
  operatorRunDescription,
  registerBuiltinTools,
  resolveAIProvider,
  resolveProviderFromEnv,
  resolveLoopMode,
  runCohereAgentLoop,
  runOperatorCycle,
  summarizeExecutionPackage,
  synthesizeWithXai,
  type KnowledgeBaseEntry,
  type LiveExampleDefinition,
  type NavigatorPlatformSnapshot,
  type ObjectiveExecutionPackage,
  type OperationLoopMode,
  type OperatorProduct,
} from '@tradeops/ai-runtime';
import { loadEnv, resolveAiMode, shouldUseXai, xaiPublicStatus } from '@tradeops/config';
import {
  evaluatePredictions,
  realizedContributionProfitMinor,
} from '@tradeops/commerce-engine';

import { LIVE_HTTP_IMPLEMENTED, listLiveFeeds } from '@tradeops/connector-core';
import {
  isLikelyPublicImageUrl,
  probeCredentials,
  shopifyAddProductToCollection,
  shopifyAdminProductUrl,
  shopifyAttachProductImages,
  shopifyCreateProduct,
  shopifyFetchProducts,
  shopifyFindOrCreateCollection,
  shopifyGetProductStatus,
  shopifySetInventoryAvailable,
  shopifySetProductStatus,
  shopifyUpdateDefaultVariant,
} from '@tradeops/connector-live-http';
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
import { RagService } from './rag.service';
import { PredictionService } from './prediction.service';
import { IndustrialService } from '../commerce/industrial.service';
import { TenantOperationalContextService } from './tenant-operational-context.service';

/** Prisma JSON columns accept structured values at runtime; cast for strict InputJsonValue. */
function asJson(value: unknown): object {
  return value as object;
}

/** Parse "$8–15 wholesale" style bands into cost/target minor units. */
function parseResearchPriceBand(band?: string | null): {
  costMinor: number;
  targetMinor: number;
} {
  if (!band) return { costMinor: 1000, targetMinor: 2499 };
  const nums = [...band.matchAll(/(\d+(?:\.\d+)?)/g)].map((m) => Number(m[1]));
  if (nums.length >= 2 && Number.isFinite(nums[0]) && Number.isFinite(nums[1])) {
    const lo = Math.min(nums[0]!, nums[1]!);
    const hi = Math.max(nums[0]!, nums[1]!);
    return {
      costMinor: Math.round(lo * 100),
      targetMinor: Math.round(hi * 100 * 1.75),
    };
  }
  if (nums.length === 1 && Number.isFinite(nums[0])) {
    return {
      costMinor: Math.round(nums[0]! * 100),
      targetMinor: Math.round(nums[0]! * 220),
    };
  }
  return { costMinor: 1000, targetMinor: 2499 };
}

type ResearchRecLike = {
  rank: number;
  title: string;
  rationale: string;
  confidence: number;
  priceBand?: string | null;
  risk?: string | null;
  evidence?: { sourceUrl?: string | null };
};

/**
 * Cycle 11 — collect candidate public image URLs from a product row.
 * Prefer primaryImageUrl / gallery; never invent placeholders.
 */
function collectProductImageCandidates(product: {
  primaryImageUrl?: string | null;
  galleryImageUrlsJson?: unknown;
  mediaJson?: unknown;
  attributesJson?: unknown;
}): string[] {
  const out: string[] = [];
  const push = (u?: string | null) => {
    const s = String(u ?? '').trim();
    if (s && isLikelyPublicImageUrl(s) && !out.includes(s)) out.push(s);
  };
  push(product.primaryImageUrl);
  const gallery = product.galleryImageUrlsJson;
  if (Array.isArray(gallery)) {
    for (const g of gallery.slice(0, 8)) push(typeof g === 'string' ? g : null);
  }
  const media = product.mediaJson;
  if (Array.isArray(media)) {
    for (const m of media.slice(0, 8)) {
      if (m && typeof m === 'object') {
        const o = m as Record<string, unknown>;
        push(
          typeof o.url === 'string'
            ? o.url
            : typeof o.src === 'string'
              ? o.src
              : typeof o.originalSource === 'string'
                ? o.originalSource
                : null,
        );
      }
    }
  }
  const attrs =
    product.attributesJson &&
    typeof product.attributesJson === 'object' &&
    !Array.isArray(product.attributesJson)
      ? (product.attributesJson as Record<string, unknown>)
      : null;
  if (attrs) {
    push(typeof attrs.imageUrl === 'string' ? attrs.imageUrl : null);
    push(typeof attrs.primaryImageUrl === 'string' ? attrs.primaryImageUrl : null);
    // sourceUrl is often an article — only if it looks like an image
    push(typeof attrs.sourceUrl === 'string' ? attrs.sourceUrl : null);
    if (Array.isArray(attrs.imageUrls)) {
      for (const u of attrs.imageUrls.slice(0, 8)) {
        push(typeof u === 'string' ? u : null);
      }
    }
  }
  return out.slice(0, 5);
}

/** Cycle 12 — merge optional imageUrl / imageUrls + product candidates (max 5). */
function resolveImageGallery(input: {
  imageUrl?: string | null;
  imageUrls?: string[] | null;
  product: {
    primaryImageUrl?: string | null;
    galleryImageUrlsJson?: unknown;
    mediaJson?: unknown;
    attributesJson?: unknown;
  };
}): string[] {
  const out: string[] = [];
  const push = (u?: string | null) => {
    const s = String(u ?? '').trim();
    if (s && isLikelyPublicImageUrl(s) && !out.includes(s)) out.push(s);
  };
  push(input.imageUrl);
  if (Array.isArray(input.imageUrls)) {
    for (const u of input.imageUrls.slice(0, 8)) push(u);
  }
  for (const u of collectProductImageCandidates(input.product)) push(u);
  return out.slice(0, 5);
}

/**
 * Cycle 7 — merchant decision + listing brief from comparison rows.
 * Deterministic (no extra LLM call): rank-1 is top pick.
 */
function buildMerchantDecisionPack(webRecs: ResearchRecLike[]): {
  merchantDecision: {
    headline: string;
    summary: string;
    topPick: {
      rank: number;
      product: string;
      priceBand: string | null;
      why: string;
      risk: string | null;
      confidence: number;
    };
    runnersUp: Array<{
      rank: number;
      product: string;
      priceBand: string | null;
      why: string;
    }>;
    pass: Array<{ product: string; reason: string }>;
    nextSteps: string[];
  };
  listingBrief: {
    product: string;
    listingTitle: string;
    bullets: string[];
    wholesaleBand: string | null;
    suggestedRetail: string;
    risk: string | null;
    channelNote: string;
    status: 'ready_to_draft';
  };
} | null {
  if (!webRecs.length) return null;
  const sorted = [...webRecs].sort((a, b) => a.rank - b.rank);
  const top = sorted[0]!;
  const runners = sorted.slice(1, 3);
  const rest = sorted.slice(3);
  const { targetMinor } = parseResearchPriceBand(top.priceBand);
  const suggestedRetail = `$${(targetMinor / 100).toFixed(2)}`;
  const bullets = [
    (top.rationale || 'Strong research candidate from live web + AI').slice(0, 160),
    top.priceBand
      ? `Source/wholesale band: ${top.priceBand}`
      : 'Validate supplier unit cost before buying inventory',
    top.risk
      ? `Risk to watch: ${top.risk}`
      : 'Confirm shipping lead time and return policy before scaling',
    'Draft only — not published to any live storefront',
  ];
  return {
    merchantDecision: {
      headline: `Start with ${top.title}`,
      summary: `Top pick among ${sorted.length} research options. Save as Cases, draft a listing for #1, connect Shopify when you leave demo mode.`,
      topPick: {
        rank: top.rank,
        product: top.title,
        priceBand: top.priceBand ?? null,
        why: top.rationale,
        risk: top.risk ?? null,
        confidence: top.confidence,
      },
      runnersUp: runners.map((r) => ({
        rank: r.rank,
        product: r.title,
        priceBand: r.priceBand ?? null,
        why: (r.rationale || '').slice(0, 160),
      })),
      pass: rest.map((r) => ({
        product: r.title,
        reason: r.risk || 'Lower priority vs top pick',
      })),
      nextSteps: [
        'Save comparison as Cases',
        'Draft listing for top pick (not published)',
        'Connect Shopify when ready to go live',
      ],
    },
    listingBrief: {
      product: top.title,
      listingTitle: top.title.slice(0, 120),
      bullets,
      wholesaleBand: top.priceBand ?? null,
      suggestedRetail,
      risk: top.risk ?? null,
      channelNote:
        'Creates an internal draft listing only — not published. Publish needs approval + a live channel.',
      status: 'ready_to_draft',
    },
  };
}

/**
 * True only when the user clearly wants to rank/evaluate products already in *their* store.
 * Discovery / research objectives must NOT fall into closed fixture ranking.
 */
function isCatalogEvaluateObjective(objective: string): boolean {
  const t = objective.trim().toLowerCase();
  if (!t) return false;
  // Explicit catalog ownership
  if (
    /\b(my|our)\s+(catalog|products?|store|inventory|listings?)\b/.test(t) ||
    /\brank\s+(my|our)\b/.test(t) ||
    /\bevaluate\s+(my|our)\b/.test(t) ||
    /\bin\s+(my|our)\s+(catalog|store|inventory)\b/.test(t)
  ) {
    return true;
  }
  // Pure "rank catalog / score my products" without open-world discovery terms
  if (
    /\b(rank|score|evaluate)\b/.test(t) &&
    /\b(catalog|portfolio|inventory|store products)\b/.test(t) &&
    !/\b(find|discover|source|supplier|market|trend|internet|web|buy|import|new products?)\b/.test(
      t,
    )
  ) {
    return true;
  }
  return false;
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
    private readonly industrial: IndustrialService,
    private readonly operationalContext: TenantOperationalContextService,
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
      note: 'Tools are typed and permissioned. Free-form intelligence is xAI Grok when configured, always RAG-grounded. Consequential actions require approval.',
      xai: xaiPublicStatus(),
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
        platformStatus: 'GET /api/v1/ai/status',
        embeddingModel: 'rag-tfidf-v1+dense',
        llm: 'xAI Grok (XAI_API_KEY) — primary free-form provider',
        note: 'RAG train indexes org knowledge. xAI synthesizes answers over retrieval — not GPU fine-tuning.',
      },
    };
  }

  async platformAiStatus(organizationId: string) {
    const rag = this.rag.status(organizationId);
    const xai = xaiPublicStatus();
    return {
      ...xai,
      aiMode: resolveAiMode(),
      usesXai: shouldUseXai(),
      rag: {
        trained: rag.trained,
        embeddingMode: rag.embeddingMode,
        embeddingModel: rag.embeddingModel,
        stats: rag.stats,
      },
      honesty: {
        note: 'Primary LLM is xAI. Without XAI_API_KEY the platform runs tools + local RAG only.',
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
    xaiSynthesis?: {
      ok: boolean;
      text?: string;
      model?: string;
      error?: string;
      latencyMs?: number;
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
      // Do not auto-force shadow for fixture catalogs — still run full tools + briefing.
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
              rag: ragGround
                ? {
                    hitCount: ragGround.hits.length,
                    topTitles: (ragGround.hits ?? []).slice(0, 5).map((h) => h.title),
                    groundedContext: String(ragGround.groundedContext ?? '').slice(0, 2500),
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
                  topTitles: (ragGround.hits ?? []).slice(0, 5).map((h) => h.title),
                  groundedContext: String(ragGround.groundedContext ?? '').slice(0, 2500),
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

    // xAI synthesis over RAG + package (never bypasses approvals)
    let xaiSynthesis: {
      ok: boolean;
      text?: string;
      model?: string;
      error?: string;
      latencyMs?: number;
    } | null = null;

    if (shouldUseXai() && ragGround) {
      const mode = resolveAiMode();
      const shouldSynth =
        mode === 'xai_rag' ||
        mode === 'xai_rag_tools' ||
        (mode as string) === 'xai_rag';
      if (shouldSynth) {
        try {
          const recJson = JSON.stringify(
            (executionPackage.recommendations ?? []).slice(0, 8),
          );
          const synth = await synthesizeWithXai({
            objective: input.objective,
            groundedContext: ragGround.groundedContext,
            packageSummary: summarizeExecutionPackage(executionPackage),
            recommendationsJson: recJson,
          });
          xaiSynthesis = {
            ok: synth.ok,
            text: synth.text,
            model: synth.model,
            error: synth.error,
            latencyMs: synth.latencyMs,
          };
          if (runId && synth.ok && synth.text) {
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
                    xaiSynthesis,
                  }),
                  decisionNote: [
                    existing.decisionNote ?? '',
                    '',
                    '--- xAI synthesis ---',
                    synth.text.slice(0, 2000),
                  ]
                    .filter(Boolean)
                    .join('\n')
                    .slice(0, 4000),
                },
              });
            }
          }
        } catch (e) {
          xaiSynthesis = {
            ok: false,
            error: e instanceof Error ? e.message : String(e),
          };
        }
      }
    }

    return {
      runId,
      executionPackage,
      summary: summarizeExecutionPackage(executionPackage),
      cycleResult,
      rag: ragGround
        ? {
            trained: ragGround.trained,
            hitCount: ragGround.hits.length,
            citations: (ragGround.hits ?? []).slice(0, 8).map((h) => ({
              title: h.title,
              sourceType: h.sourceType,
              score: h.score,
              isFixture: h.isFixture,
            })),
            groundedContextPreview: String(ragGround.groundedContext ?? '').slice(0, 1200),
          }
        : null,
      xaiSynthesis,
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

    // Never auto-force shadow. Only shadow when the client explicitly opts in.
    // Fixture catalog still ranks + generates live briefings; honesty labels data class separately.
    const forceShadow = input.forceShadow === true;

    // Trusted server-generated correlation (never client-supplied tenant/auth).
    const { requestId, traceId } = newRequestIds();
    const correlationId = requestId;

    const effectiveMode: OperationLoopMode =
      input.loopMode ??
      resolveLoopMode({
        forceShadow: forceShadow === true,
        forceFixture,
        hasLiveCredentials,
        controlledLiveEnabled,
      });


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

    // User-facing objective only — never persist system/workspace preambles on OperatorRun.objective.
    // Preambles are AI context; they belong in planJson for audit, not Opportunities/Objectives UI.
    const userObjective = input.objective.trim();
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

    }

    const run = await this.prisma.client.operatorRun.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId ?? null,
        objective: userObjective,
        loopMode: effectiveMode,
        status: 'collecting',
        planJson: asJson({
          userObjective,
          ...(caseContext
            ? { commerceCaseId: caseContext.caseId, stage: caseContext.currentStage }
            : {}),
          allowedAiTools,
          workspaceBound: Boolean(workspacePreamble),
          phases: { A: 'pending', B: 'pending' },
          forceShadow: forceShadow === true,
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
          // AI-only context (never render as the human "Objective" / "Description")
          aiContext: {
            hasWorkspacePreamble: Boolean(workspacePreamble),
            hasRuntimePreamble: Boolean(runtimePreamble),
            hasCasePreamble: Boolean(caseContext?.contextPreamble),
            workspacePreambleChars: workspacePreamble.length,
            runtimePreambleChars: runtimePreamble.length,
            casePreambleChars: caseContext?.contextPreamble.length ?? 0,

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
          forceShadow: forceShadow === true,
          requestId,
          correlationId,
          traceId,
        },
      })
      .catch(() => undefined);

    try {
      const catalogEval = isCatalogEvaluateObjective(userObjective);
      // Live store products only by default — never feed fixture seed into discovery ranking
      let products = await this.loadOperatorProducts(input.organizationId, {
        excludeFixtures: true,
      });
      if (caseContext) {
        products = products.filter((p) => p.productId === caseContext!.productId);
      }
      // Catalog-evaluate with no live rows: allow fixtures only when user asked about *their* catalog
      if (catalogEval && products.length === 0) {
        products = await this.loadOperatorProducts(input.organizationId, {
          excludeFixtures: false,
        });
        if (caseContext) {
          products = products.filter((p) => p.productId === caseContext!.productId);
        }
      }

      // Default: Cohere ecommerce agent (web research + tools). Catalog ranker only when explicit + products.
      if (!catalogEval || products.length === 0) {
        return await this.runEcommerceAgentObjective({
          organizationId: input.organizationId,
          userId: input.userId,
          objective: userObjective,
          runId: run.id,
          effectiveMode,
          forceShadow: forceShadow === true,
          permissions: input.permissions,
          requestId,
          traceId,
          correlationId,
          hasLiveCredentials,
          controlledLiveEnabled,
          forceFixture,
          workspacePreamble,
          allowedAiTools,
          onProgress: input.onProgress,
        });
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
            reason: 'Catalog evaluate: org-scoped products (non-fixture preferred)',
            productCount: products.length,
          },
          {
            source: 'connector_installations',
            reason: 'Capability / health context for tools',
            count: connectors.length,
          },
          ...(tavilyConfigured
            ? [
                {
                  source: 'tavily',
                  reason: 'Public web research when discovery tools are invoked',
                },
              ]
            : []),
          ...(cohereConfigured
            ? [
                {
                  source: 'cohere',
                  reason: 'Primary generative ecommerce agent / briefing',
                },
              ]
            : []),
        ],
        notSelected: [
          ...(!shopifyConfigured
            ? [
                {
                  source: 'shopify',
                  reason: 'No live Shopify credentials',
                },
              ]
            : []),
          ...(!tavilyConfigured
            ? [
                {
                  source: 'tavily',
                  reason: 'TAVILY_API_KEY missing in process env',
                },
              ]
            : []),
        ],
        policy: {
          neverSilentFixtureFallback: true,
          agentFirstDefault: true,
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
            evaluateIndustrialProcurement: async ({
              organizationId,
              productId,
              quantity,
              requirementText,
            }: {
              organizationId: string;
              productId: string;
              quantity?: number;
              requirementText?: string;
            }) => {
              const { parseTechnicalRequirementsFromText } = await import(
                '@tradeops/commerce-engine'
              );
              const requirements = requirementText
                ? parseTechnicalRequirementsFromText(requirementText)
                : [];
              return this.industrial.evaluateProcurement(organizationId, {
                productId,
                quantity,
                requirements,
              });
            },
            searchIndustrialCompatibility: async ({
              organizationId,
              productId,
              requirementText,
              take,
            }: {
              organizationId: string;
              productId?: string;
              requirementText?: string;
              take?: number;
            }) =>
              this.industrial.findCompatible(organizationId, {
                productId,
                requirementText,
                take,
              }),
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

      // Cohere narration over ranked evidence (live LLM — not a canned script)
      const narrative = await this.narrateOperatorWithCohere({
        objective: userObjective,
        machineSummary: cycle.responseSummary,
        recommendations: cycle.recommendations,
        fixtureCatalog: products.some((p) => p.sourcePlatform.startsWith('fixture')),
      });
      const responseSummary = narrative.ok
        ? [
            narrative.text,
            '',
            '---',
            'Machine ranking summary (deterministic):',
            cycle.responseSummary,
          ].join('\n')
        : cycle.responseSummary;


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
      const prevPlan = (run.planJson ?? {}) as Record<string, unknown>;

      const planEnvelope = {
        ...prevPlan,
        ...cycle.plan,
        userObjective,
        timeline: cycle.timeline,
        sources: cycle.sources,
        responseSummary,
        briefingSource: cycle.briefingSource ?? null,
        aiNarrative: narrative.ok ? narrative.text : null,
        aiNarrativeError: narrative.ok ? null : narrative.error,
        aiNarrativeProvider: narrative.provider,
        aiNarrativeModel: narrative.model,

        candidateStats: cycle.candidateStats,
        filtersApplied: cycle.filtersApplied,
        objectiveType: cycle.objectiveType,
        riskClass: cycle.riskClass,
        approvalRequired: cycle.approvalRequired,
        liveExampleId: input.liveExampleId ?? null,
        finalAnswer: responseSummary,
        executionPackage: executionPackage ?? undefined,
        knowledgeBaseDelta: executionPackage?.knowledgeBaseDelta,
        navigatorSummary: executionPackage
          ? summarizeExecutionPackage(executionPackage)
          : undefined,
        // Loop metadata (not overwritten silently)
        forceShadow: forceShadow === true,
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
          // Keep objective as the user goal only (never re-attach preambles)
          objective: userObjective,
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
          responseSummary,
          phaseA: 'tools_executed',
          phaseB: 'synthesis_complete',
          casesSynced,
          requestId,
          correlationId,
          traceId,
          dataSourcePlan,
          aiNarrative: narrative.ok,

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
          aiNarrative: narrative.ok,

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
        responseSummary,
        briefingSource: cycle.briefingSource ?? null,
        aiNarrative: narrative.ok ? narrative.text : null,
        aiNarrativeProvider: narrative.provider,
        aiNarrativeModel: narrative.model,

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
          forceShadow: forceShadow === true,
          loopMode: effectiveMode,
          shadowByDefault: effectiveMode === 'shadow',
          dataMode,
          cohereNarration: narrative.ok,
          note:
            cycle.objectiveType === 'READ_ONLY_ANALYSIS'
              ? narrative.ok
                ? 'Live Cohere narration over ranked catalog evidence. Ranking is deterministic; prose is model-generated. Fixture catalog is not live Shopify. Commerce cases synced for process board. Full Execution Package attached.'
                : 'Read-only analysis: no approval records created. Publish still requires explicit approval. Commerce cases synced for process board. Full Execution Package attached.'
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
        text: responseSummary,
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
    const rows = await this.prisma.client.operatorRun.findMany({
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
    // Sanitize legacy rows that stored system/workspace preambles as objective
    return rows.map((row) => {
      const display = operatorRunDescription({
        objective: row.objective,
        decisionNote: row.decisionNote,
        planJson: row.planJson as {
          responseSummary?: string;
          navigatorSummary?: string;
          finalAnswer?: string;
          interpretation?: string;
          userObjective?: string;
          executionPackage?: { objective?: { goal?: string; desiredOutcome?: string } };
        },
      });
      return {
        ...row,
        objective: display.objective,
        description: display.description,
      };
    });
  }

  async getRun(organizationId: string, runId: string) {
    const row = await this.prisma.client.operatorRun.findFirst({
      where: { id: runId, organizationId },
      include: {
        recommendations: { orderBy: { rank: 'asc' } },
        shadowDecisions: true,
      },
    });
    if (!row) return null;
    const display = operatorRunDescription({
      objective: row.objective,
      decisionNote: row.decisionNote,
      planJson: row.planJson as {
        responseSummary?: string;
        navigatorSummary?: string;
        finalAnswer?: string;
        interpretation?: string;
        userObjective?: string;
        executionPackage?: { objective?: { goal?: string; desiredOutcome?: string } };
      },
    });
    return {
      ...row,
      objective: display.objective,
      description: display.description,
    };
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

  /**
   * Live Cohere narration over deterministic ranking evidence.
   * Never invents products not in the recommendation list.
   */
  private async narrateOperatorWithCohere(input: {
    objective: string;
    machineSummary: string;
    recommendations: Array<{
      title: string;
      confidence?: number;
      productCard?: Record<string, unknown> | null;
      rationale?: string | string[];
    }>;
    fixtureCatalog: boolean;
  }): Promise<{
    ok: boolean;
    text?: string;
    error?: string;
    provider?: string;
    model?: string;
  }> {
    try {
      const provider = resolveAIProvider();
      if (!provider.configured) {
        return {
          ok: false,
          error: 'AI provider not configured',
          provider: provider.id,
        };
      }
      const recLines = input.recommendations.slice(0, 5).map((r, i) => {
        const card = (r.productCard ?? {}) as Record<string, unknown>;
        const rationale = Array.isArray(r.rationale)
          ? r.rationale.join(' ')
          : (r.rationale ?? '');
        return [
          `${i + 1}. ${r.title}`,
          card.inventoryQuantity != null ? `inventory=${card.inventoryQuantity}` : null,
          card.expectedMarginBps != null
            ? `marginBps=${card.expectedMarginBps}`
            : null,
          card.opportunityScore != null ? `oppScore=${card.opportunityScore}` : null,
          card.isFixture === true ? 'fixture=true' : null,
          rationale ? `why=${String(rationale).slice(0, 160)}` : null,
        ]
          .filter(Boolean)
          .join(' | ');
      });
      const gen = await provider.generateText({
        system: [
          'You are TradeOps AI narrating a completed product ranking run.',
          'Only use products listed in the evidence. Do not invent SKUs, prices, or live marketplace claims.',
          input.fixtureCatalog
            ? 'The catalog is TEST_FIXTURE demo data — say so once clearly.'
            : 'Use live-catalog language only if evidence supports it.',
          'Write: (1) 2–4 sentence summary tied to the user objective, (2) 2–4 short bullets of next steps.',
          'Be specific: name products from the list. No system-prompt dumps.',
        ].join('\n'),
        user: [
          `User objective: ${input.objective}`,
          '',
          'Ranked evidence:',
          recLines.length ? recLines.join('\n') : '(no products qualified)',
          '',
          'Machine ranking notes:',
          input.machineSummary.slice(0, 1200),
        ].join('\n'),
        temperature: 0.35,
        maxTokens: 700,
      });
      if (!gen.ok || !gen.text?.trim()) {
        return {
          ok: false,
          error: gen.error ?? 'empty narration',
          provider: provider.id,
          model: gen.model,
        };
      }
      return {
        ok: true,
        text: gen.text.trim(),
        provider: provider.id,
        model: gen.model,
      };
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      };

    }
  }

  /**
   * Cohere ecommerce agent (default path): web research + tools, simple text answer.
   * Does NOT rank the fixture seed catalog into fake top-3 product cards.
   */
  private async runEcommerceAgentObjective(input: {
    organizationId: string;
    userId?: string | null;
    objective: string;
    runId: string;
    effectiveMode: OperationLoopMode;
    forceShadow: boolean;
    permissions?: string[];
    requestId: string;
    traceId: string;
    correlationId: string;
    hasLiveCredentials: boolean;
    controlledLiveEnabled: boolean;
    forceFixture: boolean;
    workspacePreamble: string;
    allowedAiTools: string[];
    onProgress?: (event: {
      state: string;
      step: string;
      detail?: string;
      at: string;
    }) => void | Promise<void>;
  }) {
    const progress = async (state: string, step: string, detail?: string) => {
      try {
        await input.onProgress?.({
          state,
          step,
          detail,
          at: new Date().toISOString(),
        });
      } catch {
        /* progress is best-effort */
      }
    };

    const tavilyConfigured = Boolean(process.env.TAVILY_API_KEY?.trim());
    await progress('planning', 'Planning', 'Understanding the merchant objective');
    let operationalContext: Record<string, unknown> = {};
    try {
      await progress('retrieving', 'Loading workspace', 'Tenant store snapshot (live only)');
      const snap = await this.operationalContext.buildSnapshot(input.organizationId);
      // Strip fixtures from every slice tools can read (products, inventory, suppliers).
      // Previously only products were filtered — inventory still leaked fixture SKUs into
      // commerce.search_products via pickOperationalSlice fallback.
      const isFixtureRow = (row: Record<string, unknown>): boolean => {
        if (row.isFixture === true) return true;
        const platform = String(
          row.sourcePlatform ?? row.source ?? row.providerKey ?? '',
        ).toLowerCase();
        return (
          platform.startsWith('fixture') ||
          platform.includes('demo') ||
          platform.includes('test_fixture')
        );
      };
      const products = Array.isArray(snap.products)
        ? (snap.products as Array<Record<string, unknown>>).filter((p) => !isFixtureRow(p))
        : [];
      const invRaw =
        snap.inventory && typeof snap.inventory === 'object'
          ? (snap.inventory as {
              items?: Array<Record<string, unknown>>;
              lowStock?: Array<Record<string, unknown>>;
              totalUnits?: number;
              productCount?: number;
            })
          : {};
      const invItems = Array.isArray(invRaw.items)
        ? invRaw.items.filter((i) => !isFixtureRow(i))
        : products.map((p) => ({
            productId: p.id,
            title: p.title,
            quantity: p.inventoryQuantity,
            sourcePlatform: p.sourcePlatform,
            isFixture: false,
            lowStock: Number(p.inventoryQuantity ?? 0) <= 5,
          }));
      const suppliers = Array.isArray(snap.suppliers)
        ? (snap.suppliers as Array<Record<string, unknown>>).filter((s) => !isFixtureRow(s))
        : [];
      const dataClass =
        products.length > 0 ? 'LIVE' : 'EMPTY';
      operationalContext = {
        ...snap,
        products,
        inventory: {
          items: invItems,
          lowStock: invItems.filter((i) => Boolean(i.lowStock)),
          totalUnits: invItems.reduce((sum, i) => sum + Number(i.quantity ?? 0), 0),
          productCount: products.length,
        },
        suppliers,
        // Prevent tool slice fallbacks from re-reading fixture-laden keys
        catalog: products,
        searchProducts: products,
        meta: {
          ...(typeof snap.meta === 'object' && snap.meta ? snap.meta : {}),
          dataClass,
          productCount: products.length,
          fixtureProductCount: 0,
          liveProductCount: products.length,
          agentMode: 'ecommerce_web_first',
          catalogNote:
            products.length === 0
              ? 'No live store products. Prefer public web research for discovery. Do not invent store inventory. Do not mention fixture/demo catalogs.'
              : 'Live store products present; may combine with web research. Never present fixtures as live inventory.',
        },
      };
    } catch (err) {
      this.logger.warn(
        `Agent snapshot failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      operationalContext = {
        products: [],
        inventory: { items: [], lowStock: [], totalUnits: 0, productCount: 0 },
        suppliers: [],
        catalog: [],
        searchProducts: [],
        meta: {
          organizationId: input.organizationId,
          dataClass: 'EMPTY',
          productCount: 0,
          fixtureProductCount: 0,
          liveProductCount: 0,
          agentMode: 'ecommerce_web_first',
          catalogNote: 'Store snapshot unavailable — use web research only. Do not invent inventory.',
        },
      };
    }

    // Keep the user message short and clean so web search / tool queries stay on-topic.
    // System + developer prompts already encode ecommerce agent rules.
    const agentMessage = input.objective.trim();
    // Extra operator rules for this path (append into operational context, not the search query)
    operationalContext = {
      ...operationalContext,
      agentRole: 'ecommerce_data_agent',
      agentRules: [
        'Use public web research for product discovery and market questions.',
        'Never recommend fixture/demo catalog SKUs (seed USB LED kits, yoga mats, water bottles, etc.).',
        'If the tenant has no live products (dataClass=EMPTY), do not mention fixture or demo catalogs at all.',
        'Do not invent store inventory, orders, or margins.',
        'Answer simply with: (1) short direct answer, (2) a numbered list of 3–5 concrete product options (product name — why it fits, price band/source if known), (3) risks, (4) next actions.',
        'Prefer specific product or category names merchants can sell — not blog titles, tool names, or review-site lists.',
        'Example product lines: "1. USB LED strip light kit — high search volume, ~$8–15 wholesale, Amazon bestsellers."',
        'If search returns irrelevant results, still list 3 product *types* grounded in evidence themes and mark confidence low.',
        'Never dump raw tool names or JSON as product recommendations.',
      ],
      workspacePreamble: input.workspacePreamble
        ? String(input.workspacePreamble).slice(0, 800)
        : undefined,
    };

    await progress(
      'researching',
      tavilyConfigured ? 'Researching' : 'Analyzing',
      tavilyConfigured
        ? 'Public web research + tools'
        : 'Tools only (web search not configured)',
    );

    const envelope = await runCohereAgentLoop({
      message: agentMessage,
      tenantId: input.organizationId,
      userId: input.userId ?? undefined,
      permissions: input.permissions ?? ['*'],
      disableSearch: false,
      operationalContext,
      requestedArtifactType: 'answer',
    });

    await progress('synthesizing', 'Synthesizing', 'Writing the merchant answer');

    let responseSummary =
      envelope.output?.text?.trim() ||
      envelope.errorCode ||
      'No agent response.';
    const evidence = Array.isArray(envelope.evidence) ? envelope.evidence : [];

    // Cycle 1: if discovery answer is too thin / missing numbered products, repair with a
    // dedicated product-list generation grounded in evidence (no fixture SKUs).
    const isDiscoveryObjective =
      /\b(product|sell|resell|dropship|opportunit|trend|usb|led|find|discover|market)\b/i.test(
        input.objective,
      );
    const hasNumberedProducts = /(?:^|\n)\s*(?:\d+[.)\]]|[-*•])\s+\S.{4,}/m.test(
      responseSummary,
    );
    const hasComparisonRows = /(?:^|\n)\s*\d+[.)\]]\s+.+\|.+\|/m.test(responseSummary);
    if (
      envelope.status === 'completed' &&
      isDiscoveryObjective &&
      (responseSummary.length < 180 || !hasNumberedProducts || !hasComparisonRows)
    ) {
      try {
        await progress('synthesizing', 'Expanding product list', 'Grounded product options');
        const provider = resolveAIProvider();
        const evidenceLines = evidence
          .slice(0, 10)
          .map(
            (e) =>
              `- ${String(e.title ?? '').slice(0, 120)} ${String(e.uri ?? '')} ${String(e.excerpt ?? '').slice(0, 160)}`,
          )
          .join('\n');
        const repair = await provider.generateText({
          system: [
            'You are TradeOps ecommerce research assistant.',
            'Write merchant-ready product options from web evidence only.',
            'Never invent store inventory. Never recommend fixture/demo SKUs.',
            'Required format (product comparison):',
            'One short answer sentence.',
            'Then exactly 4 lines in this shape (use pipe separators):',
            'N. Product name | $price-band | why it fits | main risk',
            'Example: 1. USB LED strip light kit | $8–15 wholesale | high volume Amazon | saturation',
            'Then Risks: and Next: short lines.',
            'Product names must be concrete sellable items/types, not blog titles.',
          ].join('\n'),
          user: [
            `Merchant objective: ${input.objective}`,
            '',
            'Draft answer (too short — expand):',
            responseSummary.slice(0, 500),
            '',
            'Web evidence:',
            evidenceLines || '(none — still propose 4 product *types* grounded in the objective, mark low confidence)',
          ].join('\n'),
          temperature: 0.35,
          maxTokens: 1400,
        });
        if (repair.ok && repair.text?.trim() && repair.text.trim().length > responseSummary.length) {
          responseSummary = repair.text.trim();
        }
      } catch (err) {
        this.logger.warn(
          `Discovery repair pass failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    const briefingSource =
      envelope.provenance?.aiProvider === 'cohere' || envelope.status === 'completed'
        ? 'cohere'
        : envelope.status === 'blocked'
          ? 'blocked'
          : 'tools_structured';

    await progress(
      envelope.status === 'completed' ? 'completed' : 'blocked',
      envelope.status === 'completed' ? 'Ready' : 'Blocked',
      briefingSource,
    );

    const toolTrace = (envelope.meta?.toolsInvoked as string[] | undefined)?.map((tool) => ({
      tool,
      input: {},
      at: new Date().toISOString(),
      actionClass: 'read_only' as const,
      durationMs: 0,
    })) ?? [];

    // Recommendations: prefer product-like lines from the agent answer; never tool dumps / fixtures.
    const webRecs = this.buildEcommerceAgentRecommendations(responseSummary, evidence);

    await this.prisma.client.operatorRun.update({
      where: { id: input.runId },
      data: {
        status: envelope.status === 'completed' ? 'completed' : 'blocked',
        decision: envelope.status === 'completed' ? 'accept' : 'block',
        decisionNote: responseSummary.slice(0, 4000),
        completedAt: new Date(),
        planJson: asJson({
          userObjective: input.objective,
          path: 'ecommerce_agent',
          agentFirst: true,
          responseSummary,
          briefingSource,
          finalAnswer: responseSummary,
          requestId: input.requestId,
          traceId: input.traceId,
          correlationId: input.correlationId,
          forceShadow: input.forceShadow,
          loopMode: input.effectiveMode,
          envelope,
          dataSourcePlan: {
            selected: [
              ...(tavilyConfigured
                ? [{ source: 'tavily', reason: 'Primary: public web research' }]
                : []),
              { source: 'cohere', reason: 'Ecommerce agent loop' },
              {
                source: 'product_store',
                reason: 'Live products only when present (fixtures excluded from discovery)',
              },
            ],
            policy: { agentFirstDefault: true, neverSilentFixtureFallback: true },
          },
          readiness: {
            hasLiveCredentials: input.hasLiveCredentials,
            controlledLiveEnabled: input.controlledLiveEnabled,
            forceFixture: input.forceFixture,
            cohere: Boolean(process.env.COHERE_API_KEY?.trim()),
            tavily: tavilyConfigured,
          },
        }),
        toolTraceJson: asJson(toolTrace),
      },
    });

    await this.events
      .publishDomain({
        organizationId: input.organizationId,
        eventType: 'AIObjectiveCompleted',
        entityId: input.runId,
        entityType: 'operator_run',
        dataMode: 'live',
        loopMode: input.effectiveMode,
        correlationId: input.correlationId,
        traceId: input.traceId,
        payload: {
          path: 'ecommerce_agent',
          requestId: input.requestId,
          status: envelope.status,
        },
      })
      .catch(() => undefined);

    const decisionPack = buildMerchantDecisionPack(webRecs);

    return {
      runId: input.runId,
      status: envelope.status === 'completed' ? 'completed' : 'blocked',
      loopMode: input.effectiveMode,
      objectiveType: 'READ_ONLY_ANALYSIS',
      riskClass: 'read_only',
      approvalRequired: false,
      decision: envelope.status === 'completed' ? 'accept' : 'block',
      decisionNote: responseSummary,
      responseSummary,
      briefingSource,
      plan: {
        interpretation: 'Ecommerce agent (web research + Cohere)',
        steps: ['Agent tools', 'Web research when needed', 'Synthesize answer'],
        toolsToCall: toolTrace.map((t) => t.tool),
        objectiveType: 'READ_ONLY_ANALYSIS',
      },
      timeline: [
        {
          at: new Date().toISOString(),
          step: 'Ecommerce agent',
          status: 'done',
          detail: `provider=${envelope.provenance?.aiProvider ?? 'cohere'}`,
        },
      ],
      sources: evidence
        .filter((e) => {
          const provider = String(e.provider ?? '').toLowerCase();
          const sourceType = String(e.sourceType ?? '').toLowerCase();
          // Prefer public research sources for the dock; hide raw tool snapshots
          if (provider === 'tenant_operational_snapshot') return false;
          if (sourceType === 'database' || sourceType === 'connector') return false;
          if (/fixture|demo/i.test(String(e.title ?? '') + String(e.excerpt ?? ''))) {
            return false;
          }
          return true;
        })
        .slice(0, 8)
        .map((e) => ({
          name: String(e.provider ?? e.sourceType ?? 'web'),
          status: 'connected',
          detail: String(e.uri ?? e.title ?? ''),
        })),
      candidateStats: {
        retrieved: 0,
        normalized: 0,
        rejectedMissingCost: 0,
        passedPolicy: 0,
        ranked: webRecs.length,
      },
      filtersApplied: {},
      critic: undefined,
      auditor: undefined,
      toolTrace,
      recommendations: webRecs,
      /** Structured comparison for dock / founder demos (Cycle 3) */
      productComparison: webRecs.map((r) => ({
        rank: r.rank,
        product: r.title,
        priceBand: r.priceBand ?? null,
        why: r.rationale,
        risk: r.risk ?? null,
        confidence: r.confidence,
        sourceUrl: r.evidence?.sourceUrl ?? null,
      })),
      /** Cycle 7 — decide top pick + listing brief (deterministic from comparison) */
      ...(decisionPack ?? {}),
      resultsPath: `/terminal/objectives/${input.runId}`,
      honesty: {
        note: 'Agent-first path: web research + Cohere. Fixture catalog is not ranked as product recommendations.',
        dataMode: 'live',
        forceShadow: input.forceShadow,
        path: 'ecommerce_agent',
      },
      envelope: {
        meta: {
          dataMode: envelope.dataMode,
          requestId: envelope.requestId ?? input.requestId,
          state: envelope.status,
        },
        text: responseSummary,
        artifactType:
          webRecs.length >= 2
            ? 'merchant_decision'
            : webRecs.length === 1
              ? 'listing_brief'
              : 'answer',
        artifact: {
          products: webRecs.map((r) => ({
            rank: r.rank,
            title: r.title,
            priceBand: r.priceBand,
            rationale: r.rationale,
            risk: r.risk,
          })),
          ...(decisionPack ?? {}),
        },
      },
    };
  }

  /**
   * Build dock recommendations for the agent-first path.
   * Prefer product-like lines from the answer; never tool dumps / fixtures / blog-list titles.
   */
  private buildEcommerceAgentRecommendations(
    answerText: string,
    evidence: Array<{
      title?: string;
      provider?: string;
      sourceType?: string;
      uri?: string;
      excerpt?: string;
      [key: string]: unknown;
    }>,
  ): Array<{
    rank: number;
    title: string;
    rationale: string;
    confidence: number;
    nextActions: string[];
    priceBand?: string;
    risk?: string;
    evidence: { isFixtureSource: boolean; sourceUrl?: string };
  }> {
    const out: Array<{
      rank: number;
      title: string;
      rationale: string;
      confidence: number;
      nextActions: string[];
      priceBand?: string;
      risk?: string;
      evidence: { isFixtureSource: boolean; sourceUrl?: string };
    }> = [];

    const looksLikeToolName = (title: string) =>
      /^[\w-]+\.[\w.-]+$/.test(title) ||
      /^(commerce|procurement|payments|logistics|analytics|research|search)\./i.test(
        title,
      );

    const looksLikeFixture = (text: string) =>
      /fixture|demo catalog|test_fixture|sourcePlatform"\s*:\s*"fixture/i.test(text);

    const looksLikeJsonDump = (text: string) =>
      /^\s*[\[{]/.test(text.trim()) ||
      /"productId"\s*:|"items"\s*:\s*\[/.test(text);

    /** Blog / listicle titles are research leads, not product cards */
    const looksLikeArticleTitle = (title: string) =>
      /\b(how to|guide to|best of|sites you can trust|process for finding|harder than ever|products to sell online in \d{4}|high-demand and trending|best-selling amazon finds|review sites|read more)\b/i.test(
        title,
      ) ||
      title.length > 95 ||
      /\?$/.test(title);

    const looksLikeMetaHeader = (title: string) =>
      /^(answer|summary|next steps?|risks?|sources?|based on|public web|tenant|direct answer|product options?|recommendations?|market demand|high volume|seasonal|competition|saturation)\b/i.test(
        title,
      );

    const pushRec = (
      title: string,
      rationale: string,
      confidence: number,
      opts?: { sourceUrl?: string; priceBand?: string; risk?: string },
    ) => {
      const t = title.replace(/\*+/g, '').trim();
      if (!t || t.length < 4 || t.length > 160) return;
      if (looksLikeToolName(t) || looksLikeFixture(t + rationale)) return;
      if (looksLikeArticleTitle(t) || looksLikeMetaHeader(t)) return;
      if (out.some((r) => r.title.toLowerCase() === t.toLowerCase())) return;
      out.push({
        rank: out.length + 1,
        title: t.slice(0, 200),
        rationale: rationale.slice(0, 400),
        confidence,
        nextActions: ['research_further'],
        priceBand: opts?.priceBand?.slice(0, 40),
        risk: opts?.risk?.slice(0, 120),
        evidence: { isFixtureSource: false, sourceUrl: opts?.sourceUrl },
      });
    };

    // 1) Comparison lines: "N. Name | $band | why | risk"
    const lines = answerText
      .split(/\n+/)
      .map((l) => l.replace(/^[\s>*#]+/, '').trim())
      .filter(Boolean);
    let section: 'products' | 'other' = 'products';
    for (const line of lines) {
      if (out.length >= 5) break;
      const cleaned = line.replace(/\*+/g, '').trim();
      if (/^(risks?|next(?:\s*actions?)?|sources?)\s*:?\s*$/i.test(cleaned)) {
        section = 'other';
        continue;
      }
      if (section !== 'products') continue;

      const body = cleaned.replace(/^(?:\d+[.)\]]\s*|[-*•]\s+)/, '').trim();
      // Skip pure risk bullets mistaken for products
      if (
        /^(competition|saturation|low profit|margin|risk|warning|price wars|dependency|limited differentiation)\b/i.test(
          body,
        )
      ) {
        continue;
      }

      // Prefer strict comparison rows: Name | $price | why | risk
      const pipe = cleaned.match(
        /^(?:\d+[.)\]]\s*|[-*•]\s+)(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)(?:\s*\|\s*(.+))?$/,
      );
      if (pipe) {
        const title = String(pipe[1] ?? '').trim();
        const col2 = String(pipe[2] ?? '').trim();
        const col3 = String(pipe[3] ?? '').trim();
        const col4 = String(pipe[4] ?? '').trim() || undefined;
        const col2IsPrice = /\$|\b\d+\s*[-–—]\s*\d+|wholesale|retail|usd/i.test(col2);
        // Without a price column, do not treat as product comparison row
        if (!col2IsPrice) continue;
        if (/\b(competition|saturation|price wars|dependency)\b/i.test(title)) continue;
        pushRec(title, col3 || cleaned, 0.76, {
          priceBand: col2,
          risk: col4,
        });
        continue;
      }
      const m = cleaned.match(
        /^(?:\d+[.)\]]\s*|[-*•]\s+)(.{4,80}?)(?:\s*[-–—:]\s+(.+))?$/,
      );
      if (!m) continue;
      const title = String(m[1] ?? '').trim();
      const rationale = String(m[2] ?? cleaned).trim();
      if (/\b(competition|saturation|low profit|price wars|dependency)\b/i.test(title)) {
        continue;
      }
      // Non-pipe lines only count if they look like products (LED/USB/kit/etc.) or have a $ band
      const producty =
        /\b(led|usb|kit|lamp|light|speaker|charger|bottle|mat|camera|sensor|pump|mirror|lantern|strip)\b/i.test(
          title,
        );
      const priceMatch = rationale.match(
        /\$\s?[\d.,]+\s*[-–—to]+\s*\$?\s*[\d.,]+|\$\s?[\d.,]+|\b\d+\s*[-–—]\s*\d+\s*(?:usd)?\b/i,
      );
      if (!producty && !priceMatch) continue;
      pushRec(title, rationale, 0.68, {
        priceBand: priceMatch?.[0],
      });
    }

    // 2) Inline "include A, B, and C" style (light heuristic)
    if (out.length < 3) {
      const inline = answerText.match(
        /(?:products?(?:\s+include|\s+like)?|options?(?:\s+include)?|consider)\s*:?\s*([^\n.]{20,220})/i,
      );
      if (inline?.[1]) {
        const parts = inline[1]
          .split(/,|;\s+|\band\b/i)
          .map((p) => p.trim())
          .filter((p) => p.length >= 6 && p.length <= 80);
        for (const p of parts) {
          if (out.length >= 5) break;
          pushRec(p, 'Extracted from agent answer', 0.55);
        }
      }
    }

    if (out.length >= 3) return out;

    // 3) Evidence fallback: prefer product-like snippets, not blog titles
    for (const e of evidence) {
      if (out.length >= 5) break;
      const title = String(e.title ?? '').trim();
      const provider = String(e.provider ?? '').toLowerCase();
      const sourceType = String(e.sourceType ?? '').toLowerCase();
      const excerpt = String(e.excerpt ?? '').trim();
      const uri = e.uri ? String(e.uri) : undefined;
      if (provider === 'tenant_operational_snapshot') continue;
      if (sourceType === 'database' || sourceType === 'connector') continue;
      if (looksLikeFixture(title + excerpt) || looksLikeJsonDump(excerpt)) continue;
      const isPublic =
        provider.includes('tavily') ||
        provider.includes('openai') ||
        provider.includes('xai') ||
        sourceType === 'web' ||
        sourceType === 'social' ||
        Boolean(uri);
      if (!isPublic) continue;

      // Prefer a short product phrase from the excerpt when the title is a listicle
      let productTitle = title;
      let rationale = excerpt || uri || provider;
      if (looksLikeArticleTitle(title) || looksLikeToolName(title)) {
        const fromExcerpt =
          excerpt.match(
            /\b([A-Z][A-Za-z0-9][\w\s\-]{4,50}(?:LED|USB|Kit|Mat|Bottle|Light|Speaker|Charger|Case|Bag|Watch|Camera|Pump|Sensor)[\w\s\-]{0,30})/,
          ) ??
          excerpt.match(/"([^"]{8,60})"/) ??
          excerpt.match(/\b(\d+[\w\s\-]{4,40})\b/);
        if (!fromExcerpt?.[1]) continue;
        productTitle = fromExcerpt[1].trim();
        rationale = `${title.slice(0, 80)}${uri ? ` · ${uri}` : ''}`;
      }

      pushRec(productTitle, rationale, 0.52, { sourceUrl: uri });
    }

    return out;
  }

  /**
   * Cycle 4: turn AI research productComparison rows into real Product + CommerceCase
   * rows (sourcePlatform=ai-research — never fixture). Idempotent per title slug.
   */
  async persistResearchCandidates(input: {
    organizationId: string;
    userId?: string | null;
    runId?: string | null;
    products: Array<{
      product?: string;
      title?: string;
      priceBand?: string | null;
      why?: string | null;
      rationale?: string | null;
      risk?: string | null;
      rank?: number;
      confidence?: number;
      sourceUrl?: string | null;
    }>;
  }): Promise<{
    created: number;
    reused: number;
    cases: Array<{ caseId: string; productId: string; title: string; href: string }>;
  }> {
    const orgId = input.organizationId;
    const rows = (input.products ?? [])
      .map((p) => ({
        title: String(p.product ?? p.title ?? '').trim().slice(0, 200),
        priceBand: p.priceBand ? String(p.priceBand).slice(0, 40) : null,
        why: String(p.why ?? p.rationale ?? '').trim().slice(0, 800),
        risk: p.risk ? String(p.risk).slice(0, 400) : null,
        rank: typeof p.rank === 'number' ? p.rank : undefined,
        confidence: typeof p.confidence === 'number' ? p.confidence : 0.6,
        sourceUrl: p.sourceUrl ? String(p.sourceUrl).slice(0, 500) : null,
      }))
      .filter((p) => p.title.length >= 4)
      .slice(0, 8);

    const cases: Array<{ caseId: string; productId: string; title: string; href: string }> =
      [];
    let created = 0;
    let reused = 0;

    for (const row of rows) {
      const slug = row.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 80);
      const externalId = `research-${slug}`.slice(0, 120);
      const { costMinor, targetMinor } = parseResearchPriceBand(row.priceBand);
      const description = [
        row.why || 'AI research candidate',
        row.priceBand ? `Price band: ${row.priceBand}` : null,
        row.risk ? `Risk: ${row.risk}` : null,
        row.sourceUrl ? `Source: ${row.sourceUrl}` : null,
        input.runId ? `From operator run ${input.runId}` : null,
      ]
        .filter(Boolean)
        .join('\n');

      let product = await this.prisma.client.product.findFirst({
        where: {
          organizationId: orgId,
          sourcePlatform: 'ai-research',
          externalId,
        },
      });

      if (!product) {
        product = await this.prisma.client.product.create({
          data: {
            organizationId: orgId,
            title: row.title,
            description,
            category: 'ai-research',
            sourcePlatform: 'ai-research',
            externalId,
            currency: 'USD',
            supplierCostMinor: costMinor,
            shippingCostMinor: Math.round(costMinor * 0.12),
            targetPriceMinor: targetMinor,
            marketplaceFeeMinor: Math.round(targetMinor * 0.15),
            paymentFeeMinor: Math.round(targetMinor * 0.03),
            inventoryQuantity: 0,
            rating: 0,
            reviewCount: 0,
            dataConfidence: Math.max(0.3, Math.min(0.85, row.confidence)),
            sourceProvenance: 'ai_operator_research',
            attributesJson: {
              research: true,
              priceBand: row.priceBand,
              risk: row.risk,
              rank: row.rank,
              sourceUrl: row.sourceUrl,
              runId: input.runId ?? null,
            },
          },
        });
        created += 1;
      } else {
        reused += 1;
        await this.prisma.client.product.update({
          where: { id: product.id },
          data: {
            description,
            supplierCostMinor: costMinor,
            targetPriceMinor: targetMinor,
            dataConfidence: Math.max(0.3, Math.min(0.85, row.confidence)),
            attributesJson: {
              research: true,
              priceBand: row.priceBand,
              risk: row.risk,
              rank: row.rank,
              sourceUrl: row.sourceUrl,
              runId: input.runId ?? null,
            },
          },
        });
      }

      let commerceCase = await this.prisma.client.commerceCase.findFirst({
        where: { organizationId: orgId, productId: product.id },
      });
      if (!commerceCase) {
        commerceCase = await this.prisma.client.commerceCase.create({
          data: {
            organizationId: orgId,
            productId: product.id,
            currentStage: 'discover',
            stageStatus: 'ready',
            recommendation: 'research_further',
            opportunityScore: Math.round((row.confidence || 0.6) * 100),
            confidence: row.confidence,
            expectedProfitMinor: Math.max(0, targetMinor - costMinor - Math.round(costMinor * 0.12)),
            nextActionCode: 'evaluate',
            nextActionLabel: 'Evaluate research candidate',
            ownerUserId: input.userId ?? undefined,
            metadataJson: {
              origin: 'ai_research',
              priceBand: row.priceBand,
              risk: row.risk,
              runId: input.runId ?? null,
            },
          },
        });
      }

      cases.push({
        caseId: commerceCase.id,
        productId: product.id,
        title: product.title,
        href: `/terminal/process/${commerceCase.id}`,
      });
    }

    return { created, reused, cases };
  }

  /**
   * Cycle 7: persist top research product as Product + Case + internal Listing draft
   * (status=draft, not published). Channel is internal-draft — never a live storefront.
   */
  async draftListingFromResearch(input: {
    organizationId: string;
    userId?: string | null;
    runId?: string | null;
    product?: {
      product?: string;
      title?: string;
      priceBand?: string | null;
      why?: string | null;
      rationale?: string | null;
      risk?: string | null;
      rank?: number;
      confidence?: number;
      sourceUrl?: string | null;
    };
    products?: Array<{
      product?: string;
      title?: string;
      priceBand?: string | null;
      why?: string | null;
      rationale?: string | null;
      risk?: string | null;
      rank?: number;
      confidence?: number;
      sourceUrl?: string | null;
    }>;
  }): Promise<{
    created: boolean;
    productId: string;
    caseId: string;
    listingId: string;
    listingStatus: string;
    sku: string;
    priceMinor: number;
    currency: string;
    href: string;
    productHref: string;
    listingBrief: {
      product: string;
      listingTitle: string;
      bullets: string[];
      wholesaleBand: string | null;
      suggestedRetail: string;
      risk: string | null;
      channelNote: string;
      status: string;
    };
    note: string;
  }> {
    const pool = [
      ...(input.product ? [input.product] : []),
      ...(Array.isArray(input.products) ? input.products : []),
    ];
    if (pool.length === 0) {
      throw Object.assign(new Error('product_required'), {
        status: 400,
        code: 'product_required',
      });
    }
    const ranked = [...pool].sort(
      (a, b) => (a.rank ?? 99) - (b.rank ?? 99),
    );
    const top = ranked[0]!;
    const title = String(top.product ?? top.title ?? '').trim();
    if (title.length < 4) {
      throw Object.assign(new Error('product_title_required'), {
        status: 400,
        code: 'product_title_required',
      });
    }

    const pack = buildMerchantDecisionPack([
      {
        rank: typeof top.rank === 'number' ? top.rank : 1,
        title,
        rationale: String(top.why ?? top.rationale ?? '').slice(0, 800),
        confidence: typeof top.confidence === 'number' ? top.confidence : 0.65,
        priceBand: top.priceBand ?? null,
        risk: top.risk ?? null,
      },
    ]);

    const persisted = await this.persistResearchCandidates({
      organizationId: input.organizationId,
      userId: input.userId,
      runId: input.runId,
      products: [top],
    });
    const row = persisted.cases[0];
    if (!row) {
      throw Object.assign(new Error('persist_failed'), {
        status: 500,
        code: 'persist_failed',
      });
    }

    const product = await this.prisma.client.product.findUnique({
      where: { id: row.productId },
    });
    if (!product) {
      throw Object.assign(new Error('product_missing'), {
        status: 500,
        code: 'product_missing',
      });
    }

    let channel = await this.prisma.client.salesChannel.findFirst({
      where: {
        organizationId: input.organizationId,
        providerKey: 'internal-draft',
      },
    });
    if (!channel) {
      channel = await this.prisma.client.salesChannel.create({
        data: {
          organizationId: input.organizationId,
          name: 'Internal listing drafts',
          providerKey: 'internal-draft',
          isFixture: false,
        },
      });
    }

    const { targetMinor } = parseResearchPriceBand(
      top.priceBand ? String(top.priceBand) : null,
    );
    const priceMinor = product.targetPriceMinor || targetMinor;
    const sku =
      product.externalId?.slice(0, 120) ||
      `research-${product.id.replace(/-/g, '').slice(0, 12)}`;

    let listing = await this.prisma.client.listing.findFirst({
      where: {
        organizationId: input.organizationId,
        productId: product.id,
        salesChannelId: channel.id,
        status: { in: ['draft', 'pending_approval'] },
      },
    });
    let created = false;
    if (listing) {
      listing = await this.prisma.client.listing.update({
        where: { id: listing.id },
        data: {
          status: 'draft',
          priceMinor,
          currency: product.currency || 'USD',
          sku,
        },
      });
    } else {
      listing = await this.prisma.client.listing.create({
        data: {
          organizationId: input.organizationId,
          productId: product.id,
          salesChannelId: channel.id,
          status: 'draft',
          priceMinor,
          currency: product.currency || 'USD',
          sku,
        },
      });
      created = true;
    }

    await this.prisma.client.commerceCase.update({
      where: { id: row.caseId },
      data: {
        listingDraftId: listing.id,
        nextActionCode: 'review_listing_draft',
        nextActionLabel: 'Review listing draft',
        recommendation: 'list_draft',
        metadataJson: asJson({
          origin: 'ai_research',
          listingDraftId: listing.id,
          runId: input.runId ?? null,
          priceBand: top.priceBand ?? null,
          risk: top.risk ?? null,
        }),
      },
    });

    await this.audit.write({
      action: 'listing.draft_created',
      resourceType: 'listing',
      resourceId: listing.id,
      organizationId: input.organizationId,
      actorUserId: input.userId ?? null,
      metadata: {
        origin: 'ai_research',
        productId: product.id,
        runId: input.runId ?? null,
        channel: 'internal-draft',
        published: false,
      },
    });

    const brief = pack?.listingBrief ?? {
      product: title,
      listingTitle: title.slice(0, 120),
      bullets: [
        String(top.why ?? top.rationale ?? 'AI research candidate').slice(0, 160),
        top.priceBand ? `Source band: ${top.priceBand}` : 'Validate cost before inventory',
        top.risk ? `Risk: ${top.risk}` : 'Confirm logistics before scale',
        'Draft only — not published',
      ],
      wholesaleBand: top.priceBand ? String(top.priceBand) : null,
      suggestedRetail: `$${(priceMinor / 100).toFixed(2)}`,
      risk: top.risk ? String(top.risk) : null,
      channelNote:
        'Internal draft only — not published. Publish needs approval + live channel.',
      status: 'draft',
    };

    return {
      created,
      productId: product.id,
      caseId: row.caseId,
      listingId: listing.id,
      listingStatus: listing.status,
      sku: listing.sku,
      priceMinor: listing.priceMinor,
      currency: listing.currency,
      href: `/terminal/process/${row.caseId}`,
      productHref: `/terminal/products/${product.id}`,
      listingBrief: { ...brief, status: 'draft' },
      note: created
        ? 'Created internal listing draft (not published).'
        : 'Updated existing internal listing draft (not published).',
    };
  }

  /**
   * Cycle 8: research listing draft → Shopify go-live readiness pack.
   * Queues publish_listing approval, probes Shopify env (read-only), never productCreate.
   */
  async prepareShopifyGoLive(input: {
    organizationId: string;
    userId?: string | null;
    runId?: string | null;
    listingId?: string | null;
    caseId?: string | null;
    product?: {
      product?: string;
      title?: string;
      priceBand?: string | null;
      why?: string | null;
      rationale?: string | null;
      risk?: string | null;
      rank?: number;
      confidence?: number;
      sourceUrl?: string | null;
    };
    products?: Array<{
      product?: string;
      title?: string;
      priceBand?: string | null;
      why?: string | null;
      rationale?: string | null;
      risk?: string | null;
      rank?: number;
      confidence?: number;
      sourceUrl?: string | null;
    }>;
  }): Promise<{
    goLivePack: {
      headline: string;
      summary: string;
      checklist: Array<{
        id: string;
        ok: boolean;
        label: string;
        detail?: string;
        missing?: string[];
      }>;
      publishPayloadPreview: {
        title: string;
        descriptionHtml: string;
        price: string;
        currency: string;
        sku: string;
        channel: string;
        status: 'preview_only';
      };
      approval: {
        id: string;
        status: string;
        kind: string;
        listingId: string;
        href: string;
        deduped: boolean;
      } | null;
      listing: {
        id: string;
        status: string;
        productId: string;
        caseId: string | null;
        href: string;
      };
      shopify: {
        envConfigured: boolean;
        missingKeys: string[];
        probeOk: boolean | null;
        probeDetail: string | null;
        liveProductCount: number | null;
      };
      nextSteps: string[];
      connectorsHref: string;
      approvalsHref: string;
      honesty: {
        publishedToShopify: false;
        note: string;
      };
    };
  }> {
    let listingId = input.listingId?.trim() || null;
    let caseId = input.caseId?.trim() || null;
    let draftedNote: string | null = null;

    if (!listingId && caseId) {
      const c = await this.prisma.client.commerceCase.findFirst({
        where: { id: caseId, organizationId: input.organizationId },
      });
      if (c?.listingDraftId) listingId = c.listingDraftId;
    }

    if (
      !listingId &&
      (input.product || (Array.isArray(input.products) && input.products.length > 0))
    ) {
      const draft = await this.draftListingFromResearch({
        organizationId: input.organizationId,
        userId: input.userId,
        runId: input.runId,
        product: input.product,
        products: input.products,
      });
      listingId = draft.listingId;
      caseId = draft.caseId;
      draftedNote = draft.note;
    }

    if (!listingId) {
      throw Object.assign(new Error('listing_required'), {
        status: 400,
        code: 'listing_required',
      });
    }

    const listing = await this.prisma.client.listing.findFirst({
      where: { id: listingId, organizationId: input.organizationId },
      include: { product: true, salesChannel: true },
    });
    if (!listing) {
      throw Object.assign(new Error('listing_not_found'), {
        status: 404,
        code: 'listing_not_found',
      });
    }

    if (!caseId) {
      const c = await this.prisma.client.commerceCase.findFirst({
        where: {
          organizationId: input.organizationId,
          productId: listing.productId,
        },
      });
      caseId = c?.id ?? null;
    }

    const cred = probeCredentials('shopify-graphql-admin');
    let probeOk: boolean | null = null;
    let probeDetail: string | null = null;
    let liveProductCount: number | null = null;
    if (cred.ready) {
      const live = await shopifyFetchProducts();
      probeOk = live.ok;
      probeDetail = live.ok
        ? `Shopify reachable · ${live.data?.length ?? 0} products sampled · ${live.latencyMs ?? '?'}ms`
        : (live.error ?? 'Shopify probe failed');
      liveProductCount = live.ok ? (live.data?.length ?? 0) : null;
    } else {
      probeOk = false;
      probeDetail = `Missing env: ${cred.missingKeys.join(', ')}`;
    }

    // Queue publish approval (never silent external publish)
    let approval = await this.prisma.client.approval.findFirst({
      where: {
        organizationId: input.organizationId,
        listingId: listing.id,
        kind: 'publish_listing',
        status: { in: ['pending', 'approved'] },
      },
    });
    let deduped = false;
    if (approval) {
      deduped = true;
      if (listing.status === 'draft') {
        await this.prisma.client.listing.update({
          where: { id: listing.id },
          data: { status: 'pending_approval' },
        });
        listing.status = 'pending_approval';
      }
    } else {
      await this.prisma.client.listing.update({
        where: { id: listing.id },
        data: { status: 'pending_approval' },
      });
      listing.status = 'pending_approval';
      approval = await this.prisma.client.approval.create({
        data: {
          organizationId: input.organizationId,
          kind: 'publish_listing',
          status: 'pending',
          listingId: listing.id,
          requestedByUserId: input.userId ?? null,
          note: 'Cycle 8 Shopify go-live pack — human approval required; no auto productCreate',
        },
      });
      await this.audit.write({
        action: 'listing.publish_requested',
        resourceType: 'approval',
        resourceId: approval.id,
        organizationId: input.organizationId,
        actorUserId: input.userId ?? null,
        metadata: {
          origin: 'shopify_golive_pack',
          runId: input.runId ?? null,
          channel: listing.salesChannel.providerKey,
        },
      });
    }

    if (caseId) {
      await this.prisma.client.commerceCase.update({
        where: { id: caseId },
        data: {
          listingDraftId: listing.id,
          nextActionCode: 'approve_shopify_golive',
          nextActionLabel: cred.ready
            ? 'Approve publish · Shopify env ready'
            : 'Connect Shopify env · then approve',
          recommendation: 'shopify_golive',
          metadataJson: asJson({
            origin: 'ai_research',
            listingDraftId: listing.id,
            approvalId: approval.id,
            shopifyEnv: cred.ready,
            runId: input.runId ?? null,
          }),
        },
      });
    }

    const title = listing.product.title;
    const descriptionHtml = (listing.product.description || title)
      .split('\n')
      .map((line) => `<p>${line.replace(/</g, '&lt;').slice(0, 400)}</p>`)
      .join('')
      .slice(0, 4000);
    const price = `$${(listing.priceMinor / 100).toFixed(2)}`;

    const checklist: Array<{
      id: string;
      ok: boolean;
      label: string;
      detail?: string;
      missing?: string[];
    }> = [
      {
        id: 'draft',
        ok: true,
        label: 'Listing draft exists',
        detail: draftedNote ?? `SKU ${listing.sku} · ${listing.status}`,
      },
      {
        id: 'approval',
        ok: approval.status === 'pending' || approval.status === 'approved',
        label: 'Publish approval queued',
        detail: `${approval.status}${deduped ? ' (existing)' : ''} · not auto-published`,
      },
      {
        id: 'shopify_env',
        ok: cred.ready,
        label: 'Shopify credentials in env',
        detail: cred.ready
          ? 'SHOPIFY_SHOP_DOMAIN + SHOPIFY_ACCESS_TOKEN present (values never shown)'
          : 'Add keys to root .env and restart API',
        missing: cred.ready ? undefined : cred.missingKeys,
      },
      {
        id: 'shopify_probe',
        ok: Boolean(probeOk),
        label: 'Shopify Admin GraphQL probe (read-only)',
        detail: probeDetail ?? undefined,
      },
      {
        id: 'live_push',
        ok: false,
        label: 'Live productCreate',
        detail:
          'Not executed this cycle — approval + credentials first; push is explicit later',
      },
    ];

    const readyCount = checklist.filter((c) => c.ok).length;
    const headline = cred.ready
      ? probeOk
        ? `Shopify ready · approve to go live (${title})`
        : `Shopify env set · probe failed · fix token/domain`
      : `Connect Shopify env · draft ready for ${title}`;

    const nextSteps: string[] = [];
    if (!cred.ready) {
      nextSteps.push(
        'Set SHOPIFY_SHOP_DOMAIN + SHOPIFY_ACCESS_TOKEN in root .env, restart API',
      );
      nextSteps.push('Open Connections → Shopify go-live → Probe shopify-graphql-admin');
    } else if (!probeOk) {
      nextSteps.push('Fix Shopify domain/token until probe succeeds');
    }
    nextSteps.push('Open Approvals → review publish request (human gate)');
    nextSteps.push(
      'After approval, listing marks active locally; live Shopify productCreate is still an explicit next step',
    );

    return {
      goLivePack: {
        headline,
        summary: `${readyCount}/${checklist.length} readiness checks green. Draft + approval path prepared; Shopify productCreate is never silent.`,
        checklist,
        publishPayloadPreview: {
          title: title.slice(0, 200),
          descriptionHtml,
          price,
          currency: listing.currency || 'USD',
          sku: listing.sku,
          channel: 'shopify-graphql-admin',
          status: 'preview_only',
        },
        approval: {
          id: approval.id,
          status: approval.status,
          kind: approval.kind,
          listingId: listing.id,
          href: '/terminal/approvals',
          deduped,
        },
        listing: {
          id: listing.id,
          status: listing.status,
          productId: listing.productId,
          caseId,
          href: caseId
            ? `/terminal/process/${caseId}`
            : `/terminal/products/${listing.productId}`,
        },
        shopify: {
          envConfigured: cred.ready,
          missingKeys: cred.missingKeys,
          probeOk,
          probeDetail,
          liveProductCount,
        },
        nextSteps,
        connectorsHref: '/terminal/connectors#shopify-path',
        approvalsHref: '/terminal/approvals',
        honesty: {
          publishedToShopify: false,
          note:
            'Cycle 8 prepares go-live only. No Shopify productCreate or public listing. Secrets never returned.',
        },
      },
    };
  }

  /**
   * Cycle 9: explicit Shopify productCreate after publish approval.
   * Requires confirmPush=true. Optional approveIfPending. Never silent push.
   */
  async pushListingToShopify(input: {
    organizationId: string;
    userId?: string | null;
    listingId?: string | null;
    approvalId?: string | null;
    /** Must be true to attempt live productCreate (or record dry-run). */
    confirmPush: boolean;
    /** If approval still pending, approve it first (human-confirmed in UI). */
    approveIfPending?: boolean;
    /** When true, never call Shopify — return payload preview only. */
    dryRun?: boolean;
    /** Optional public https image URL for productCreateMedia (Cycle 11). */
    imageUrl?: string | null;
    /** Cycle 12 — gallery of public image URLs (max 5). Merged with imageUrl + product media. */
    imageUrls?: string[] | null;
  }): Promise<{
    status:
      | 'pushed'
      | 'dry_run'
      | 'blocked_confirm'
      | 'blocked_credentials'
      | 'blocked_approval'
      | 'blocked_probe'
      | 'already_pushed'
      | 'shopify_error';
    publishedToShopify: boolean;
    shopifyProductId: string | null;
    shopifyHandle: string | null;
    listing: {
      id: string;
      status: string;
      externalId: string | null;
      productId: string;
      href: string;
    };
    approval: { id: string; status: string } | null;
    payloadPreview: {
      title: string;
      descriptionHtml: string;
      status: 'DRAFT';
      vendor: string;
      productType: string;
      tags: string[];
      price: string;
      sku: string;
    };
    shopify: {
      envConfigured: boolean;
      missingKeys: string[];
      probeOk: boolean | null;
      probeDetail: string | null;
    };
    nextSteps: string[];
    connectorsHref: string;
    honesty: { note: string };
    error?: string;
    /** Cycle 10 — merchant launch report (price/SKU/admin link) */
    shopifyAdminUrl?: string | null;
    variant?: { id: string; price: string; sku: string | null } | null;
    media?: {
      attempted: boolean;
      attached: boolean;
      /** First planned/attached source (compat) */
      sourceUrl: string | null;
      mediaId: string | null;
      /** Cycle 12 gallery */
      plannedCount: number;
      attachedCount: number;
      sources: string[];
      mediaIds: string[];
      error?: string;
    } | null;
    launchReport?: {
      headline: string;
      checklist: Array<{
        id: string;
        ok: boolean;
        label: string;
        detail?: string;
      }>;
      shopifyAdminUrl: string | null;
      priceSynced: boolean | null;
      skuSynced: boolean | null;
      mediaAttached?: boolean | null;
      mediaAttachedCount?: number | null;
      mediaPlannedCount?: number | null;
    };
  }> {
    if (!input.confirmPush) {
      return {
        status: 'blocked_confirm',
        publishedToShopify: false,
        shopifyProductId: null,
        shopifyHandle: null,
        listing: {
          id: '',
          status: '',
          externalId: null,
          productId: '',
          href: '/terminal/approvals',
        },
        approval: null,
        payloadPreview: {
          title: '',
          descriptionHtml: '',
          status: 'DRAFT',
          vendor: 'TradeOps',
          productType: 'ai-research',
          tags: [],
          price: '',
          sku: '',
        },
        shopify: {
          envConfigured: false,
          missingKeys: ['SHOPIFY_SHOP_DOMAIN', 'SHOPIFY_ACCESS_TOKEN'],
          probeOk: null,
          probeDetail: null,
        },
        nextSteps: ['Call again with confirmPush: true after founder review'],
        connectorsHref: '/terminal/connectors#shopify-path',
        honesty: {
          note: 'Push refused — confirmPush must be true. No Shopify call was made.',
        },
        error: 'confirm_required',
        shopifyAdminUrl: null,
        variant: null,
        launchReport: {
          headline: 'Confirm required before launch',
          checklist: [
            {
              id: 'confirm',
              ok: false,
              label: 'confirmPush',
              detail: 'Must be true',
            },
          ],
          shopifyAdminUrl: null,
          priceSynced: null,
          skuSynced: null,
        },
      };
    }

    let listingId = input.listingId?.trim() || null;
    let approval =
      input.approvalId?.trim()
        ? await this.prisma.client.approval.findFirst({
            where: {
              id: input.approvalId.trim(),
              organizationId: input.organizationId,
              kind: 'publish_listing',
            },
            include: { listing: { include: { product: true, salesChannel: true } } },
          })
        : null;

    if (approval?.listingId) {
      listingId = approval.listingId;
    }

    if (!listingId) {
      throw Object.assign(new Error('listing_required'), {
        status: 400,
        code: 'listing_required',
      });
    }

    const listing = await this.prisma.client.listing.findFirst({
      where: { id: listingId, organizationId: input.organizationId },
      include: { product: true, salesChannel: true },
    });
    if (!listing) {
      throw Object.assign(new Error('listing_not_found'), {
        status: 404,
        code: 'listing_not_found',
      });
    }

    if (!approval) {
      approval = await this.prisma.client.approval.findFirst({
        where: {
          organizationId: input.organizationId,
          listingId: listing.id,
          kind: 'publish_listing',
        },
        orderBy: { createdAt: 'desc' },
        include: { listing: { include: { product: true, salesChannel: true } } },
      });
    }

    const descriptionHtml = (listing.product.description || listing.product.title)
      .split('\n')
      .map((line) => `<p>${line.replace(/</g, '&lt;').slice(0, 400)}</p>`)
      .join('')
      .slice(0, 4000);
    const price = `$${(listing.priceMinor / 100).toFixed(2)}`;
    const payloadPreview = {
      title: listing.product.title.slice(0, 200),
      descriptionHtml,
      status: 'DRAFT' as const,
      vendor: 'TradeOps',
      productType: listing.product.category || 'ai-research',
      tags: ['tradeops', 'ai-research'],
      price,
      sku: listing.sku,
    };

    const caseRow = await this.prisma.client.commerceCase.findFirst({
      where: {
        organizationId: input.organizationId,
        productId: listing.productId,
      },
    });
    const listingHref = caseRow
      ? `/terminal/process/${caseRow.id}`
      : `/terminal/products/${listing.productId}`;

    // Already pushed to Shopify (GID)
    if (
      listing.externalId?.startsWith('gid://shopify/Product/') ||
      (listing.salesChannel.providerKey === 'shopify-graphql-admin' &&
        listing.status === 'active' &&
        listing.externalId &&
        !listing.externalId.startsWith('research-'))
    ) {
      const existingAdmin = listing.externalId
        ? shopifyAdminProductUrl(listing.externalId)
        : null;
      return {
        status: 'already_pushed',
        publishedToShopify: true,
        shopifyProductId: listing.externalId,
        shopifyHandle: null,
        listing: {
          id: listing.id,
          status: listing.status,
          externalId: listing.externalId,
          productId: listing.productId,
          href: listingHref,
        },
        approval: approval
          ? { id: approval.id, status: approval.status }
          : null,
        payloadPreview,
        shopify: {
          envConfigured: true,
          missingKeys: [],
          probeOk: true,
          probeDetail: 'Already has Shopify product id',
        },
        nextSteps: existingAdmin
          ? [`Open Shopify Admin: ${existingAdmin}`]
          : ['Open Shopify admin to edit the draft product'],
        connectorsHref: '/terminal/connectors#shopify-path',
        honesty: {
          note: 'Listing already linked to a Shopify product. No duplicate productCreate.',
        },
        shopifyAdminUrl: existingAdmin,
        variant: null,
        launchReport: {
          headline: `Already on Shopify · ${payloadPreview.title}`,
          checklist: [
            {
              id: 'product',
              ok: true,
              label: 'Shopify product linked',
              detail: listing.externalId ?? undefined,
            },
            {
              id: 'admin_link',
              ok: Boolean(existingAdmin),
              label: 'Shopify Admin deep link',
              detail: existingAdmin ?? 'unavailable',
            },
          ],
          shopifyAdminUrl: existingAdmin,
          priceSynced: null,
          skuSynced: null,
        },
      };
    }

    // Approval gate
    if (!approval) {
      return {
        status: 'blocked_approval',
        publishedToShopify: false,
        shopifyProductId: null,
        shopifyHandle: null,
        listing: {
          id: listing.id,
          status: listing.status,
          externalId: listing.externalId,
          productId: listing.productId,
          href: listingHref,
        },
        approval: null,
        payloadPreview,
        shopify: {
          envConfigured: false,
          missingKeys: [],
          probeOk: null,
          probeDetail: null,
        },
        nextSteps: [
          'Run Prepare Shopify go-live first to queue publish_listing approval',
        ],
        connectorsHref: '/terminal/connectors#shopify-path',
        honesty: {
          note: 'No publish approval found. ProductCreate blocked.',
        },
        error: 'approval_required',
      };
    }

    if (approval.status === 'pending' && input.approveIfPending) {
      await this.prisma.client.approval.update({
        where: { id: approval.id },
        data: { status: 'approved', decidedAt: new Date() },
      });
      approval = { ...approval, status: 'approved' };
      await this.audit.write({
        action: 'approval.approved',
        resourceType: 'approval',
        resourceId: approval.id,
        organizationId: input.organizationId,
        actorUserId: input.userId ?? null,
        metadata: { origin: 'shopify_push', approveIfPending: true },
      });
    }

    if (approval.status !== 'approved') {
      return {
        status: 'blocked_approval',
        publishedToShopify: false,
        shopifyProductId: null,
        shopifyHandle: null,
        listing: {
          id: listing.id,
          status: listing.status,
          externalId: listing.externalId,
          productId: listing.productId,
          href: listingHref,
        },
        approval: { id: approval.id, status: approval.status },
        payloadPreview,
        shopify: {
          envConfigured: false,
          missingKeys: [],
          probeOk: null,
          probeDetail: null,
        },
        nextSteps: [
          'Open Approvals and approve the publish request, or pass approveIfPending: true',
        ],
        connectorsHref: '/terminal/connectors#shopify-path',
        honesty: {
          note: `Approval status=${approval.status}. ProductCreate blocked until approved.`,
        },
        error: 'approval_not_approved',
      };
    }

    const cred = probeCredentials('shopify-graphql-admin');
    let probeOk: boolean | null = null;
    let probeDetail: string | null = null;
    if (cred.ready) {
      const live = await shopifyFetchProducts();
      probeOk = live.ok;
      probeDetail = live.ok
        ? `Shopify reachable · ${live.latencyMs ?? '?'}ms`
        : (live.error ?? 'probe failed');
    } else {
      probeOk = false;
      probeDetail = `Missing env: ${cred.missingKeys.join(', ')}`;
    }

    const shopifyMeta = {
      envConfigured: cred.ready,
      missingKeys: cred.missingKeys,
      probeOk,
      probeDetail,
    };

    if (input.dryRun || !cred.ready) {
      // Local activate after approved (TradeOps-only) when not dry-run-only
      if (!input.dryRun && listing.status !== 'active') {
        await this.prisma.client.listing.update({
          where: { id: listing.id },
          data: { status: 'active' },
        });
        listing.status = 'active';
      }
      const plannedPrice = payloadPreview.price.replace(/[^0-9.]/g, '');
      const gallery = resolveImageGallery({
        imageUrl: input.imageUrl,
        imageUrls: input.imageUrls,
        product: listing.product,
      });
      const plannedImage = gallery[0] ?? null;
      const plannedCount = gallery.length;
      return {
        status: input.dryRun ? 'dry_run' : 'blocked_credentials',
        publishedToShopify: false,
        shopifyProductId: null,
        shopifyHandle: null,
        listing: {
          id: listing.id,
          status: listing.status,
          externalId: listing.externalId,
          productId: listing.productId,
          href: listingHref,
        },
        approval: { id: approval.id, status: approval.status },
        payloadPreview,
        shopify: shopifyMeta,
        nextSteps: input.dryRun
          ? [
              'Re-run with dryRun: false when ready to push live',
              `Planned variant price ${payloadPreview.price} · SKU ${payloadPreview.sku}`,
              plannedCount > 0
                ? `Planned gallery: ${plannedCount} image${plannedCount === 1 ? '' : 's'}`
                : 'No public product image — add one in Shopify Admin after push',
            ]
          : [
              'Set SHOPIFY_SHOP_DOMAIN + SHOPIFY_ACCESS_TOKEN, restart API, Probe, then push again',
            ],
        connectorsHref: '/terminal/connectors#shopify-path',
        honesty: {
          note: input.dryRun
            ? 'Dry run only — productCreate + variant + gallery media not called. Launch plan returned.'
            : 'Shopify credentials missing — listing may be active in TradeOps only. No productCreate.',
        },
        error: input.dryRun ? undefined : 'credentials_missing',
        shopifyAdminUrl: null,
        variant: null,
        media: {
          attempted: false,
          attached: false,
          sourceUrl: plannedImage,
          mediaId: null,
          plannedCount,
          attachedCount: 0,
          sources: gallery,
          mediaIds: [],
          error: plannedCount > 0 ? undefined : 'no_public_image',
        },
        launchReport: {
          headline: input.dryRun
            ? `Launch plan · ${payloadPreview.title}`
            : `Blocked · connect Shopify for ${payloadPreview.title}`,
          checklist: [
            {
              id: 'product',
              ok: false,
              label: 'Shopify product (DRAFT)',
              detail: input.dryRun ? 'Would create' : 'Blocked — no credentials',
            },
            {
              id: 'price',
              ok: false,
              label: 'Default variant price',
              detail: `Planned ${payloadPreview.price} (${plannedPrice || '—'})`,
            },
            {
              id: 'sku',
              ok: false,
              label: 'SKU',
              detail: `Planned ${payloadPreview.sku}`,
            },
            {
              id: 'media',
              ok: false,
              label: 'Gallery images (productCreateMedia)',
              detail:
                plannedCount > 0
                  ? `Planned ${plannedCount} image${plannedCount === 1 ? '' : 's'} · ${plannedImage?.slice(0, 64) ?? ''}`
                  : 'No public image URL on research product — attach in Admin',
            },
            {
              id: 'admin_link',
              ok: false,
              label: 'Shopify Admin deep link',
              detail: 'Available after live push',
            },
          ],
          shopifyAdminUrl: null,
          priceSynced: false,
          skuSynced: false,
          mediaAttached: false,
          mediaAttachedCount: 0,
          mediaPlannedCount: plannedCount,
        },
      };
    }

    if (!probeOk) {
      return {
        status: 'blocked_probe',
        publishedToShopify: false,
        shopifyProductId: null,
        shopifyHandle: null,
        listing: {
          id: listing.id,
          status: listing.status,
          externalId: listing.externalId,
          productId: listing.productId,
          href: listingHref,
        },
        approval: { id: approval.id, status: approval.status },
        payloadPreview,
        shopify: shopifyMeta,
        nextSteps: ['Fix Shopify domain/token until Admin GraphQL probe succeeds'],
        connectorsHref: '/terminal/connectors#shopify-path',
        honesty: {
          note: 'Probe failed — productCreate not attempted.',
        },
        error: 'probe_failed',
      };
    }

    // Live productCreate + Cycle 10 variant price/SKU
    const created = await shopifyCreateProduct({
      title: payloadPreview.title,
      descriptionHtml: payloadPreview.descriptionHtml,
      status: 'DRAFT',
      vendor: payloadPreview.vendor,
      productType: payloadPreview.productType,
      tags: payloadPreview.tags,
    });

    if (!created.ok || !created.data?.externalId) {
      return {
        status: 'shopify_error',
        publishedToShopify: false,
        shopifyProductId: null,
        shopifyHandle: null,
        listing: {
          id: listing.id,
          status: listing.status,
          externalId: listing.externalId,
          productId: listing.productId,
          href: listingHref,
        },
        approval: { id: approval.id, status: approval.status },
        payloadPreview,
        shopify: shopifyMeta,
        nextSteps: ['Inspect Shopify Admin API error; fix scopes or payload, retry'],
        connectorsHref: '/terminal/connectors#shopify-path',
        honesty: {
          note: 'productCreate failed — listing unchanged on Shopify.',
        },
        error: created.error ?? 'productCreate_failed',
        shopifyAdminUrl: null,
        variant: null,
        launchReport: {
          headline: 'productCreate failed',
          checklist: [
            {
              id: 'product',
              ok: false,
              label: 'Shopify product',
              detail: created.error ?? 'failed',
            },
          ],
          shopifyAdminUrl: null,
          priceSynced: false,
          skuSynced: false,
        },
      };
    }

    const priceDecimal = payloadPreview.price.replace(/[^0-9.]/g, '') || '0';
    const variantUpdate = await shopifyUpdateDefaultVariant({
      productId: created.data.externalId,
      price: priceDecimal,
      sku: payloadPreview.sku,
    });
    const priceSynced = Boolean(variantUpdate.ok && variantUpdate.data?.price);
    const skuSynced = Boolean(
      variantUpdate.ok &&
        (variantUpdate.data?.sku || payloadPreview.sku) &&
        !variantUpdate.error,
    );
    const adminUrl = shopifyAdminProductUrl(created.data.externalId);

    // Cycle 12 — attach gallery (up to 5 public images) if provided or on product
    const gallery = resolveImageGallery({
      imageUrl: input.imageUrl,
      imageUrls: input.imageUrls,
      product: listing.product,
    });
    const plannedImage = gallery[0] ?? null;
    const plannedCount = gallery.length;
    let mediaAttached = false;
    let mediaId: string | null = null;
    let mediaIds: string[] = [];
    let mediaError: string | undefined;
    let mediaAttempted = false;
    let attachedCount = 0;
    if (plannedCount > 0) {
      mediaAttempted = true;
      const mediaRes = await shopifyAttachProductImages({
        productId: created.data.externalId,
        sources: gallery.map((originalSource, i) => ({
          originalSource,
          alt:
            i === 0
              ? payloadPreview.title
              : `${payloadPreview.title} (${i + 1})`,
        })),
      });
      if (mediaRes.ok && mediaRes.data) {
        mediaIds = mediaRes.data.attached
          .map((a) => a.mediaId)
          .filter((id): id is string => Boolean(id));
        attachedCount = mediaRes.data.attached.length;
        mediaAttached = attachedCount > 0;
        mediaId = mediaIds[0] ?? null;
        if (mediaRes.data.errors.length) {
          mediaError = mediaRes.data.errors.join('; ').slice(0, 300);
        }
      } else {
        mediaError = mediaRes.error ?? 'media_attach_failed';
      }
    } else {
      mediaError = 'no_public_image';
    }

    // Ensure shopify sales channel exists for linkage honesty
    let shopifyChannel = await this.prisma.client.salesChannel.findFirst({
      where: {
        organizationId: input.organizationId,
        providerKey: 'shopify-graphql-admin',
      },
    });
    if (!shopifyChannel) {
      shopifyChannel = await this.prisma.client.salesChannel.create({
        data: {
          organizationId: input.organizationId,
          name: 'Shopify Admin',
          providerKey: 'shopify-graphql-admin',
          isFixture: false,
        },
      });
    }

    const updatedListing = await this.prisma.client.listing.update({
      where: { id: listing.id },
      data: {
        status: 'active',
        externalId: created.data.externalId.slice(0, 128),
        salesChannelId: shopifyChannel.id,
      },
    });

    const prevAttrs =
      listing.product.attributesJson &&
      typeof listing.product.attributesJson === 'object' &&
      !Array.isArray(listing.product.attributesJson)
        ? (listing.product.attributesJson as Record<string, unknown>)
        : {};
    await this.prisma.client.product.update({
      where: { id: listing.productId },
      data: {
        attributesJson: asJson({
          ...prevAttrs,
          shopifyProductId: created.data.externalId,
          shopifyHandle: created.data.handle,
          shopifyStatus: created.data.status,
          shopifyPushedAt: new Date().toISOString(),
          shopifyVariantId: variantUpdate.data?.variantId ?? null,
          shopifyPrice: variantUpdate.data?.price ?? priceDecimal,
          shopifySku: variantUpdate.data?.sku ?? payloadPreview.sku,
          shopifyAdminUrl: adminUrl,
          shopifyMediaId: mediaId,
          shopifyMediaIds: mediaIds,
          shopifyMediaSource: plannedImage,
          shopifyMediaSources: gallery,
          shopifyMediaAttached: mediaAttached,
          shopifyMediaAttachedCount: attachedCount,
          shopifyMediaPlannedCount: plannedCount,
          variantSyncError: variantUpdate.ok
            ? null
            : (variantUpdate.error ?? 'variant_update_failed'),
          mediaSyncError: mediaAttached ? null : mediaError ?? null,
        }),
      },
    });

    if (caseRow) {
      await this.prisma.client.commerceCase.update({
        where: { id: caseRow.id },
        data: {
          publishedListingId: updatedListing.id,
          nextActionCode: mediaAttached
            ? 'review_shopify_draft'
            : 'add_shopify_media',
          nextActionLabel: mediaAttached
            ? adminUrl
              ? 'Open Shopify Admin draft'
              : 'Review Shopify draft product'
            : 'Add product image in Shopify Admin',
          recommendation: 'shopify_launched',
          metadataJson: asJson({
            origin: 'ai_research',
            shopifyProductId: created.data.externalId,
            shopifyHandle: created.data.handle,
            shopifyAdminUrl: adminUrl,
            priceSynced,
            skuSynced,
            mediaAttached,
            mediaAttachedCount: attachedCount,
            mediaPlannedCount: plannedCount,
            mediaError: mediaError ?? null,
          }),
        },
      });
    }

    await this.audit.write({
      action: 'listing.shopify_product_created',
      resourceType: 'listing',
      resourceId: listing.id,
      organizationId: input.organizationId,
      actorUserId: input.userId ?? null,
      metadata: {
        shopifyProductId: created.data.externalId,
        handle: created.data.handle,
        status: created.data.status,
        latencyMs: created.latencyMs,
        priceSynced,
        skuSynced,
        mediaAttached,
        mediaId,
        mediaIds,
        mediaAttachedCount: attachedCount,
        mediaPlannedCount: plannedCount,
        mediaError: mediaError ?? null,
        variantId: variantUpdate.data?.variantId ?? null,
        variantError: variantUpdate.ok ? null : variantUpdate.error,
      },
    });

    const launchChecklist = [
      {
        id: 'product',
        ok: true,
        label: 'Shopify product (DRAFT)',
        detail: created.data.externalId,
      },
      {
        id: 'price',
        ok: priceSynced,
        label: 'Default variant price',
        detail: priceSynced
          ? `$${variantUpdate.data?.price ?? priceDecimal}`
          : (variantUpdate.error ?? 'not set'),
      },
      {
        id: 'sku',
        ok: skuSynced,
        label: 'SKU',
        detail: skuSynced
          ? String(variantUpdate.data?.sku ?? payloadPreview.sku)
          : (variantUpdate.error ?? 'not set'),
      },
      {
        id: 'media',
        ok: mediaAttached,
        label: 'Gallery images (productCreateMedia)',
        detail: mediaAttached
          ? `Attached ${attachedCount}/${plannedCount}`
          : mediaError === 'no_public_image'
            ? 'No public image URL — add in Shopify Admin'
            : (mediaError ?? 'not attached'),
      },
      {
        id: 'admin_link',
        ok: Boolean(adminUrl),
        label: 'Shopify Admin deep link',
        detail: adminUrl ?? 'unavailable',
      },
    ];

    return {
      status: 'pushed',
      publishedToShopify: true,
      shopifyProductId: created.data.externalId,
      shopifyHandle: created.data.handle,
      listing: {
        id: updatedListing.id,
        status: updatedListing.status,
        externalId: updatedListing.externalId,
        productId: updatedListing.productId,
        href: listingHref,
      },
      approval: { id: approval.id, status: approval.status },
      payloadPreview,
      shopify: shopifyMeta,
      nextSteps: [
        adminUrl
          ? `Open Shopify Admin: ${adminUrl}`
          : 'Open Shopify admin — product is DRAFT',
        priceSynced
          ? `Price synced at $${variantUpdate.data?.price ?? priceDecimal}`
          : 'Set price manually in Shopify if variant sync failed',
        mediaAttached
          ? `Gallery: ${attachedCount}/${plannedCount} images accepted (may still be processing)`
          : 'Add product images in Shopify Admin (research products often lack public media)',
        'Product remains DRAFT — publish on Shopify when storefront-ready',
      ],
      connectorsHref: '/terminal/connectors#shopify-path',
      honesty: {
        note: mediaAttached
          ? `productCreate + variant + gallery (${attachedCount} images) as Shopify DRAFT. Secrets never returned.`
          : priceSynced
            ? 'productCreate + variant price/SKU as DRAFT; media not attached — see launchReport.'
            : 'productCreate succeeded; variant/media incomplete — see launchReport.',
      },
      shopifyAdminUrl: adminUrl,
      variant: variantUpdate.data
        ? {
            id: variantUpdate.data.variantId,
            price: variantUpdate.data.price,
            sku: variantUpdate.data.sku,
          }
        : null,
      media: {
        attempted: mediaAttempted,
        attached: mediaAttached,
        sourceUrl: plannedImage,
        mediaId,
        plannedCount,
        attachedCount,
        sources: gallery,
        mediaIds,
        error: mediaError,
      },
      launchReport: {
        headline: `Launched draft · ${payloadPreview.title}`,
        checklist: launchChecklist,
        shopifyAdminUrl: adminUrl,
        priceSynced,
        skuSynced,
        mediaAttached,
        mediaAttachedCount: attachedCount,
        mediaPlannedCount: plannedCount,
      },
    };
  }

  /**
   * Cycle 13: explicit storefront ACTIVE publish for an already-pushed Shopify product.
   * Requires confirmPublish=true AND confirmPhrase='PUBLISH_ACTIVE'. Never silent.
   */
  async publishShopifyProductActive(input: {
    organizationId: string;
    userId?: string | null;
    listingId?: string | null;
    shopifyProductId?: string | null;
    confirmPublish: boolean;
    /** Must equal PUBLISH_ACTIVE for live ACTIVE status change. */
    confirmPhrase?: string | null;
    dryRun?: boolean;
  }): Promise<{
    status:
      | 'published_active'
      | 'dry_run'
      | 'blocked_confirm'
      | 'blocked_phrase'
      | 'blocked_credentials'
      | 'blocked_probe'
      | 'blocked_not_pushed'
      | 'already_active'
      | 'shopify_error';
    storefrontActive: boolean;
    shopifyProductId: string | null;
    shopifyStatus: string | null;
    shopifyHandle: string | null;
    shopifyAdminUrl: string | null;
    listing: {
      id: string;
      status: string;
      productId: string;
      href: string;
    } | null;
    publishReport: {
      headline: string;
      checklist: Array<{
        id: string;
        ok: boolean;
        label: string;
        detail?: string;
      }>;
    };
    nextSteps: string[];
    honesty: { note: string };
    error?: string;
  }> {
    const phraseOk = String(input.confirmPhrase ?? '').trim() === 'PUBLISH_ACTIVE';
    if (!input.confirmPublish) {
      return {
        status: 'blocked_confirm',
        storefrontActive: false,
        shopifyProductId: null,
        shopifyStatus: null,
        shopifyHandle: null,
        shopifyAdminUrl: null,
        listing: null,
        publishReport: {
          headline: 'Confirm required before storefront publish',
          checklist: [
            {
              id: 'confirm',
              ok: false,
              label: 'confirmPublish',
              detail: 'Must be true',
            },
          ],
        },
        nextSteps: ['Call again with confirmPublish: true and confirmPhrase: PUBLISH_ACTIVE'],
        honesty: {
          note: 'ACTIVE publish refused — confirmPublish must be true. No Shopify call.',
        },
        error: 'confirm_required',
      };
    }

    let listing = input.listingId?.trim()
      ? await this.prisma.client.listing.findFirst({
          where: {
            id: input.listingId.trim(),
            organizationId: input.organizationId,
          },
          include: { product: true, salesChannel: true },
        })
      : null;

    let shopifyProductId =
      input.shopifyProductId?.trim() ||
      (listing?.externalId?.startsWith('gid://shopify/Product/')
        ? listing.externalId
        : null);

    if (!listing && shopifyProductId) {
      listing = await this.prisma.client.listing.findFirst({
        where: {
          organizationId: input.organizationId,
          externalId: shopifyProductId,
        },
        include: { product: true, salesChannel: true },
      });
    }

    if (!shopifyProductId) {
      return {
        status: 'blocked_not_pushed',
        storefrontActive: false,
        shopifyProductId: null,
        shopifyStatus: null,
        shopifyHandle: null,
        shopifyAdminUrl: null,
        listing: listing
          ? {
              id: listing.id,
              status: listing.status,
              productId: listing.productId,
              href: `/terminal/products/${listing.productId}`,
            }
          : null,
        publishReport: {
          headline: 'No Shopify product linked',
          checklist: [
            {
              id: 'draft_push',
              ok: false,
              label: 'Shopify DRAFT product',
              detail: 'Run Approve & push first',
            },
          ],
        },
        nextSteps: [
          'Prepare Shopify go-live → Approve & push (creates DRAFT) → then publish ACTIVE',
        ],
        honesty: {
          note: 'Cannot publish ACTIVE without a linked Shopify product id.',
        },
        error: 'not_pushed',
      };
    }

    const caseRow = listing
      ? await this.prisma.client.commerceCase.findFirst({
          where: {
            organizationId: input.organizationId,
            productId: listing.productId,
          },
        })
      : null;
    const listingHref = caseRow
      ? `/terminal/process/${caseRow.id}`
      : listing
        ? `/terminal/products/${listing.productId}`
        : '/terminal/approvals';
    const adminUrl = shopifyAdminProductUrl(shopifyProductId);
    const title = listing?.product?.title ?? 'Shopify product';

    if (input.dryRun || !phraseOk) {
      const cred = probeCredentials('shopify-graphql-admin');
      return {
        status: input.dryRun ? 'dry_run' : 'blocked_phrase',
        storefrontActive: false,
        shopifyProductId,
        shopifyStatus: 'DRAFT',
        shopifyHandle: null,
        shopifyAdminUrl: adminUrl,
        listing: listing
          ? {
              id: listing.id,
              status: listing.status,
              productId: listing.productId,
              href: listingHref,
            }
          : null,
        publishReport: {
          headline: input.dryRun
            ? `Publish plan · ACTIVE storefront · ${title}`
            : 'confirmPhrase must be PUBLISH_ACTIVE',
          checklist: [
            {
              id: 'draft_push',
              ok: true,
              label: 'Shopify product linked',
              detail: shopifyProductId,
            },
            {
              id: 'phrase',
              ok: phraseOk,
              label: 'confirmPhrase = PUBLISH_ACTIVE',
              detail: phraseOk ? 'ok' : 'required for live ACTIVE',
            },
            {
              id: 'credentials',
              ok: cred.ready,
              label: 'Shopify credentials',
              detail: cred.ready
                ? 'env present'
                : `missing ${cred.missingKeys.join(', ')}`,
            },
            {
              id: 'storefront',
              ok: false,
              label: 'Storefront ACTIVE',
              detail: input.dryRun
                ? 'Would set product status ACTIVE'
                : 'Not set — phrase gate',
            },
          ],
        },
        nextSteps: input.dryRun
          ? [
              'Re-run with dryRun: false, confirmPublish: true, confirmPhrase: PUBLISH_ACTIVE',
            ]
          : ['Pass confirmPhrase: "PUBLISH_ACTIVE" to enable live storefront publish'],
        honesty: {
          note: input.dryRun
            ? 'Dry run only — productUpdate status=ACTIVE not called.'
            : 'Phrase gate blocked ACTIVE publish. Product remains DRAFT if already pushed.',
        },
        error: input.dryRun ? undefined : 'phrase_required',
      };
    }

    const cred = probeCredentials('shopify-graphql-admin');
    if (!cred.ready) {
      return {
        status: 'blocked_credentials',
        storefrontActive: false,
        shopifyProductId,
        shopifyStatus: null,
        shopifyHandle: null,
        shopifyAdminUrl: adminUrl,
        listing: listing
          ? {
              id: listing.id,
              status: listing.status,
              productId: listing.productId,
              href: listingHref,
            }
          : null,
        publishReport: {
          headline: `Blocked · connect Shopify for ${title}`,
          checklist: [
            {
              id: 'credentials',
              ok: false,
              label: 'Shopify credentials',
              detail: `missing ${cred.missingKeys.join(', ')}`,
            },
            {
              id: 'storefront',
              ok: false,
              label: 'Storefront ACTIVE',
              detail: 'Not set',
            },
          ],
        },
        nextSteps: [
          'Set SHOPIFY_SHOP_DOMAIN + SHOPIFY_ACCESS_TOKEN, restart API, Probe, retry',
        ],
        honesty: {
          note: 'Credentials missing — ACTIVE publish not attempted.',
        },
        error: 'credentials_missing',
      };
    }

    const probe = await shopifyFetchProducts();
    if (!probe.ok) {
      return {
        status: 'blocked_probe',
        storefrontActive: false,
        shopifyProductId,
        shopifyStatus: null,
        shopifyHandle: null,
        shopifyAdminUrl: adminUrl,
        listing: listing
          ? {
              id: listing.id,
              status: listing.status,
              productId: listing.productId,
              href: listingHref,
            }
          : null,
        publishReport: {
          headline: 'Shopify probe failed',
          checklist: [
            {
              id: 'probe',
              ok: false,
              label: 'Admin GraphQL probe',
              detail: probe.error ?? 'failed',
            },
          ],
        },
        nextSteps: ['Fix domain/token until probe succeeds'],
        honesty: { note: 'Probe failed — ACTIVE publish not attempted.' },
        error: 'probe_failed',
      };
    }

    const current = await shopifyGetProductStatus(shopifyProductId);
    if (current.ok && current.data?.status === 'ACTIVE') {
      return {
        status: 'already_active',
        storefrontActive: true,
        shopifyProductId,
        shopifyStatus: 'ACTIVE',
        shopifyHandle: current.data.handle,
        shopifyAdminUrl: adminUrl,
        listing: listing
          ? {
              id: listing.id,
              status: listing.status,
              productId: listing.productId,
              href: listingHref,
            }
          : null,
        publishReport: {
          headline: `Already ACTIVE · ${current.data.title ?? title}`,
          checklist: [
            {
              id: 'storefront',
              ok: true,
              label: 'Storefront ACTIVE',
              detail: shopifyProductId,
            },
          ],
        },
        nextSteps: adminUrl
          ? [`Open Shopify Admin: ${adminUrl}`]
          : ['Product already active on Shopify'],
        honesty: {
          note: 'Product already ACTIVE — no duplicate productUpdate.',
        },
      };
    }

    const updated = await shopifySetProductStatus({
      productId: shopifyProductId,
      status: 'ACTIVE',
    });
    if (!updated.ok || !updated.data) {
      return {
        status: 'shopify_error',
        storefrontActive: false,
        shopifyProductId,
        shopifyStatus: current.data?.status ?? null,
        shopifyHandle: current.data?.handle ?? null,
        shopifyAdminUrl: adminUrl,
        listing: listing
          ? {
              id: listing.id,
              status: listing.status,
              productId: listing.productId,
              href: listingHref,
            }
          : null,
        publishReport: {
          headline: 'productUpdate ACTIVE failed',
          checklist: [
            {
              id: 'storefront',
              ok: false,
              label: 'Storefront ACTIVE',
              detail: updated.error ?? 'failed',
            },
          ],
        },
        nextSteps: ['Inspect Shopify Admin API error; retry'],
        honesty: {
          note: 'productUpdate failed — product status unchanged.',
        },
        error: updated.error ?? 'productUpdate_failed',
      };
    }

    if (listing) {
      await this.prisma.client.listing.update({
        where: { id: listing.id },
        data: { status: 'active' },
      });
      const prevAttrs =
        listing.product.attributesJson &&
        typeof listing.product.attributesJson === 'object' &&
        !Array.isArray(listing.product.attributesJson)
          ? (listing.product.attributesJson as Record<string, unknown>)
          : {};
      await this.prisma.client.product.update({
        where: { id: listing.productId },
        data: {
          attributesJson: asJson({
            ...prevAttrs,
            shopifyProductId,
            shopifyStatus: 'ACTIVE',
            shopifyHandle: updated.data.handle,
            shopifyAdminUrl: adminUrl,
            shopifyPublishedActiveAt: new Date().toISOString(),
          }),
        },
      });
      if (caseRow) {
        await this.prisma.client.commerceCase.update({
          where: { id: caseRow.id },
          data: {
            publishedListingId: listing.id,
            nextActionCode: 'monitor_storefront',
            nextActionLabel: 'Monitor live storefront listing',
            recommendation: 'shopify_active',
            metadataJson: asJson({
              origin: 'ai_research',
              shopifyProductId,
              shopifyStatus: 'ACTIVE',
              shopifyAdminUrl: adminUrl,
            }),
          },
        });
      }
    }

    await this.audit.write({
      action: 'listing.shopify_published_active',
      resourceType: 'listing',
      resourceId: listing?.id ?? shopifyProductId,
      organizationId: input.organizationId,
      actorUserId: input.userId ?? null,
      metadata: {
        shopifyProductId,
        status: updated.data.status,
        handle: updated.data.handle,
        latencyMs: updated.latencyMs,
      },
    });

    return {
      status: 'published_active',
      storefrontActive: true,
      shopifyProductId,
      shopifyStatus: updated.data.status,
      shopifyHandle: updated.data.handle,
      shopifyAdminUrl: adminUrl,
      listing: listing
        ? {
            id: listing.id,
            status: 'active',
            productId: listing.productId,
            href: listingHref,
          }
        : null,
      publishReport: {
        headline: `Storefront ACTIVE · ${updated.data.title ?? title}`,
        checklist: [
          {
            id: 'draft_push',
            ok: true,
            label: 'Shopify product',
            detail: shopifyProductId,
          },
          {
            id: 'phrase',
            ok: true,
            label: 'confirmPhrase PUBLISH_ACTIVE',
            detail: 'ok',
          },
          {
            id: 'storefront',
            ok: updated.data.status === 'ACTIVE',
            label: 'Storefront ACTIVE',
            detail: updated.data.status,
          },
          {
            id: 'admin_link',
            ok: Boolean(adminUrl),
            label: 'Shopify Admin',
            detail: adminUrl ?? undefined,
          },
        ],
      },
      nextSteps: [
        adminUrl ? `Open Shopify Admin: ${adminUrl}` : 'Open Shopify Admin',
        'Verify price, media, and inventory before marketing the listing',
      ],
      honesty: {
        note: 'productUpdate set status=ACTIVE after explicit confirm. Secrets never returned.',
      },
    };
  }

  /**
   * Cycle 14: post-ACTIVE ops — inventory quantity + optional collection.
   * Requires confirmOps=true. Never silent. Works on linked Shopify product GID.
   */
  async applyShopifyPostActiveOps(input: {
    organizationId: string;
    userId?: string | null;
    listingId?: string | null;
    shopifyProductId?: string | null;
    confirmOps: boolean;
    dryRun?: boolean;
    /** Available inventory units (default 10 when provided as null and inventory enabled) */
    inventoryQuantity?: number | null;
    /** Collection title to find-or-create and add product into */
    collectionTitle?: string | null;
  }): Promise<{
    status:
      | 'applied'
      | 'partial'
      | 'dry_run'
      | 'blocked_confirm'
      | 'blocked_credentials'
      | 'blocked_probe'
      | 'blocked_not_pushed'
      | 'blocked_noop'
      | 'shopify_error';
    shopifyProductId: string | null;
    shopifyAdminUrl: string | null;
    inventory: {
      attempted: boolean;
      ok: boolean;
      quantity: number | null;
      locationName: string | null;
      error?: string;
    };
    collection: {
      attempted: boolean;
      ok: boolean;
      title: string | null;
      collectionId: string | null;
      created: boolean | null;
      error?: string;
    };
    opsReport: {
      headline: string;
      checklist: Array<{
        id: string;
        ok: boolean;
        label: string;
        detail?: string;
      }>;
    };
    listing: {
      id: string;
      status: string;
      productId: string;
      href: string;
    } | null;
    nextSteps: string[];
    honesty: { note: string };
    error?: string;
  }> {
    if (!input.confirmOps) {
      return {
        status: 'blocked_confirm',
        shopifyProductId: null,
        shopifyAdminUrl: null,
        inventory: {
          attempted: false,
          ok: false,
          quantity: null,
          locationName: null,
        },
        collection: {
          attempted: false,
          ok: false,
          title: null,
          collectionId: null,
          created: null,
        },
        opsReport: {
          headline: 'Confirm required before inventory/collection ops',
          checklist: [
            {
              id: 'confirm',
              ok: false,
              label: 'confirmOps',
              detail: 'Must be true',
            },
          ],
        },
        listing: null,
        nextSteps: ['Call again with confirmOps: true'],
        honesty: {
          note: 'Post-ACTIVE ops refused — confirmOps must be true. No Shopify call.',
        },
        error: 'confirm_required',
      };
    }

    const wantInventory =
      input.inventoryQuantity !== undefined && input.inventoryQuantity !== null;
    const collectionTitle = input.collectionTitle?.trim() || null;
    const wantCollection = Boolean(collectionTitle);
    if (!wantInventory && !wantCollection) {
      return {
        status: 'blocked_noop',
        shopifyProductId: null,
        shopifyAdminUrl: null,
        inventory: {
          attempted: false,
          ok: false,
          quantity: null,
          locationName: null,
        },
        collection: {
          attempted: false,
          ok: false,
          title: null,
          collectionId: null,
          created: null,
        },
        opsReport: {
          headline: 'Nothing to apply',
          checklist: [
            {
              id: 'ops',
              ok: false,
              label: 'inventoryQuantity or collectionTitle',
              detail: 'Provide at least one',
            },
          ],
        },
        listing: null,
        nextSteps: [
          'Pass inventoryQuantity and/or collectionTitle with confirmOps: true',
        ],
        honesty: { note: 'No ops requested.' },
        error: 'noop',
      };
    }

    let listing = input.listingId?.trim()
      ? await this.prisma.client.listing.findFirst({
          where: {
            id: input.listingId.trim(),
            organizationId: input.organizationId,
          },
          include: { product: true },
        })
      : null;

    let shopifyProductId =
      input.shopifyProductId?.trim() ||
      (listing?.externalId?.startsWith('gid://shopify/Product/')
        ? listing.externalId
        : null);

    if (!listing && shopifyProductId) {
      listing = await this.prisma.client.listing.findFirst({
        where: {
          organizationId: input.organizationId,
          externalId: shopifyProductId,
        },
        include: { product: true },
      });
    }

    if (!shopifyProductId) {
      return {
        status: 'blocked_not_pushed',
        shopifyProductId: null,
        shopifyAdminUrl: null,
        inventory: {
          attempted: false,
          ok: false,
          quantity: wantInventory ? Number(input.inventoryQuantity) : null,
          locationName: null,
        },
        collection: {
          attempted: false,
          ok: false,
          title: collectionTitle,
          collectionId: null,
          created: null,
        },
        opsReport: {
          headline: 'No Shopify product linked',
          checklist: [
            {
              id: 'product',
              ok: false,
              label: 'Shopify product GID',
              detail: 'Push DRAFT first',
            },
          ],
        },
        listing: listing
          ? {
              id: listing.id,
              status: listing.status,
              productId: listing.productId,
              href: `/terminal/products/${listing.productId}`,
            }
          : null,
        nextSteps: ['Approve & push to Shopify (DRAFT) before inventory/collection ops'],
        honesty: {
          note: 'Cannot set inventory/collection without a linked Shopify product.',
        },
        error: 'not_pushed',
      };
    }

    const adminUrl = shopifyAdminProductUrl(shopifyProductId);
    const caseRow = listing
      ? await this.prisma.client.commerceCase.findFirst({
          where: {
            organizationId: input.organizationId,
            productId: listing.productId,
          },
        })
      : null;
    const listingHref = caseRow
      ? `/terminal/process/${caseRow.id}`
      : listing
        ? `/terminal/products/${listing.productId}`
        : '/terminal/connectors#shopify-path';
    const productTitle = listing?.product?.title ?? 'Shopify product';
    const plannedQty = wantInventory
      ? Math.max(0, Math.floor(Number(input.inventoryQuantity)))
      : null;

    if (input.dryRun) {
      return {
        status: 'dry_run',
        shopifyProductId,
        shopifyAdminUrl: adminUrl,
        inventory: {
          attempted: false,
          ok: false,
          quantity: plannedQty,
          locationName: null,
        },
        collection: {
          attempted: false,
          ok: false,
          title: collectionTitle,
          collectionId: null,
          created: null,
        },
        opsReport: {
          headline: `Ops plan · ${productTitle}`,
          checklist: [
            {
              id: 'product',
              ok: true,
              label: 'Shopify product',
              detail: shopifyProductId,
            },
            {
              id: 'inventory',
              ok: false,
              label: 'Inventory available',
              detail: wantInventory
                ? `Would set available qty ${plannedQty}`
                : 'Skipped',
            },
            {
              id: 'collection',
              ok: false,
              label: 'Collection',
              detail: wantCollection
                ? `Would find/create "${collectionTitle}" and add product`
                : 'Skipped',
            },
          ],
        },
        listing: listing
          ? {
              id: listing.id,
              status: listing.status,
              productId: listing.productId,
              href: listingHref,
            }
          : null,
        nextSteps: [
          'Re-run with dryRun: false and confirmOps: true to apply',
        ],
        honesty: {
          note: 'Dry run only — inventorySetQuantities / collectionAddProducts not called.',
        },
      };
    }

    const cred = probeCredentials('shopify-graphql-admin');
    if (!cred.ready) {
      return {
        status: 'blocked_credentials',
        shopifyProductId,
        shopifyAdminUrl: adminUrl,
        inventory: {
          attempted: false,
          ok: false,
          quantity: plannedQty,
          locationName: null,
          error: 'credentials_missing',
        },
        collection: {
          attempted: false,
          ok: false,
          title: collectionTitle,
          collectionId: null,
          created: null,
          error: 'credentials_missing',
        },
        opsReport: {
          headline: 'Blocked · Shopify credentials missing',
          checklist: [
            {
              id: 'credentials',
              ok: false,
              label: 'Shopify env',
              detail: cred.missingKeys.join(', '),
            },
          ],
        },
        listing: listing
          ? {
              id: listing.id,
              status: listing.status,
              productId: listing.productId,
              href: listingHref,
            }
          : null,
        nextSteps: [
          'Set SHOPIFY_SHOP_DOMAIN + SHOPIFY_ACCESS_TOKEN, restart API, retry',
        ],
        honesty: { note: 'Credentials missing — no inventory/collection calls.' },
        error: 'credentials_missing',
      };
    }

    const probe = await shopifyFetchProducts();
    if (!probe.ok) {
      return {
        status: 'blocked_probe',
        shopifyProductId,
        shopifyAdminUrl: adminUrl,
        inventory: {
          attempted: false,
          ok: false,
          quantity: plannedQty,
          locationName: null,
          error: probe.error,
        },
        collection: {
          attempted: false,
          ok: false,
          title: collectionTitle,
          collectionId: null,
          created: null,
          error: probe.error,
        },
        opsReport: {
          headline: 'Shopify probe failed',
          checklist: [
            {
              id: 'probe',
              ok: false,
              label: 'Admin GraphQL probe',
              detail: probe.error ?? 'failed',
            },
          ],
        },
        listing: listing
          ? {
              id: listing.id,
              status: listing.status,
              productId: listing.productId,
              href: listingHref,
            }
          : null,
        nextSteps: ['Fix domain/token until probe succeeds'],
        honesty: { note: 'Probe failed — ops not attempted.' },
        error: 'probe_failed',
      };
    }

    let invOk = !wantInventory;
    let invError: string | undefined;
    let invLocation: string | null = null;
    let invQty: number | null = plannedQty;
    if (wantInventory) {
      const inv = await shopifySetInventoryAvailable({
        productId: shopifyProductId,
        quantity: plannedQty ?? 0,
      });
      invOk = inv.ok;
      if (inv.ok && inv.data) {
        invQty = inv.data.quantity;
        invLocation = inv.data.locationName;
      } else {
        invError = inv.error ?? 'inventory_failed';
      }
    }

    let colOk = !wantCollection;
    let colError: string | undefined;
    let colId: string | null = null;
    let colCreated: boolean | null = null;
    if (wantCollection && collectionTitle) {
      const found = await shopifyFindOrCreateCollection({ title: collectionTitle });
      if (!found.ok || !found.data) {
        colOk = false;
        colError = found.error ?? 'collection_failed';
      } else {
        colId = found.data.collectionId;
        colCreated = found.data.created;
        const add = await shopifyAddProductToCollection({
          collectionId: found.data.collectionId,
          productId: shopifyProductId,
        });
        colOk = add.ok;
        if (!add.ok) colError = add.error ?? 'collection_add_failed';
      }
    }

    if (listing) {
      const prevAttrs =
        listing.product.attributesJson &&
        typeof listing.product.attributesJson === 'object' &&
        !Array.isArray(listing.product.attributesJson)
          ? (listing.product.attributesJson as Record<string, unknown>)
          : {};
      await this.prisma.client.product.update({
        where: { id: listing.productId },
        data: {
          ...(wantInventory && invOk && invQty !== null
            ? { inventoryQuantity: invQty }
            : {}),
          attributesJson: asJson({
            ...prevAttrs,
            shopifyProductId,
            shopifyInventoryQty: invOk ? invQty : prevAttrs.shopifyInventoryQty,
            shopifyInventoryLocation: invLocation,
            shopifyCollectionId: colOk ? colId : prevAttrs.shopifyCollectionId,
            shopifyCollectionTitle: colOk
              ? collectionTitle
              : prevAttrs.shopifyCollectionTitle,
            shopifyOpsAt: new Date().toISOString(),
          }),
        },
      });
      if (caseRow) {
        await this.prisma.client.commerceCase.update({
          where: { id: caseRow.id },
          data: {
            nextActionCode: invOk && colOk ? 'monitor_storefront' : 'fix_shopify_ops',
            nextActionLabel:
              invOk && colOk
                ? 'Monitor storefront inventory & collection'
                : 'Fix inventory/collection ops',
            metadataJson: asJson({
              origin: 'ai_research',
              shopifyProductId,
              inventoryOk: invOk,
              inventoryQty: invQty,
              collectionOk: colOk,
              collectionId: colId,
              collectionTitle,
            }),
          },
        });
      }
    }

    await this.audit.write({
      action: 'listing.shopify_post_active_ops',
      resourceType: 'listing',
      resourceId: listing?.id ?? shopifyProductId,
      organizationId: input.organizationId,
      actorUserId: input.userId ?? null,
      metadata: {
        shopifyProductId,
        inventoryOk: invOk,
        inventoryQty: invQty,
        collectionOk: colOk,
        collectionId: colId,
        collectionTitle,
      },
    });

    let finalStatus: 'applied' | 'partial' | 'shopify_error' = 'shopify_error';
    if (wantInventory && wantCollection) {
      finalStatus = invOk && colOk ? 'applied' : invOk || colOk ? 'partial' : 'shopify_error';
    } else if (wantInventory) {
      finalStatus = invOk ? 'applied' : 'shopify_error';
    } else if (wantCollection) {
      finalStatus = colOk ? 'applied' : 'shopify_error';
    }

    return {
      status: finalStatus,
      shopifyProductId,
      shopifyAdminUrl: adminUrl,
      inventory: {
        attempted: wantInventory,
        ok: invOk,
        quantity: invQty,
        locationName: invLocation,
        error: invError,
      },
      collection: {
        attempted: wantCollection,
        ok: colOk,
        title: collectionTitle,
        collectionId: colId,
        created: colCreated,
        error: colError,
      },
      opsReport: {
        headline:
          finalStatus === 'applied'
            ? `Ops applied · ${productTitle}`
            : finalStatus === 'partial'
              ? `Ops partial · ${productTitle}`
              : `Ops failed · ${productTitle}`,
        checklist: [
          {
            id: 'product',
            ok: true,
            label: 'Shopify product',
            detail: shopifyProductId,
          },
          {
            id: 'inventory',
            ok: invOk,
            label: 'Inventory available',
            detail: wantInventory
              ? invOk
                ? `qty ${invQty}${invLocation ? ` @ ${invLocation}` : ''}`
                : (invError ?? 'failed')
              : 'Skipped',
          },
          {
            id: 'collection',
            ok: colOk,
            label: 'Collection',
            detail: wantCollection
              ? colOk
                ? `${collectionTitle}${colCreated ? ' (created)' : ''}`
                : (colError ?? 'failed')
              : 'Skipped',
          },
        ],
      },
      listing: listing
        ? {
            id: listing.id,
            status: listing.status,
            productId: listing.productId,
            href: listingHref,
          }
        : null,
      nextSteps: [
        adminUrl ? `Open Shopify Admin: ${adminUrl}` : 'Open Shopify Admin',
        invOk ? `Inventory set to ${invQty}` : wantInventory ? 'Fix inventory permissions/location' : 'Inventory skipped',
        colOk
          ? `In collection "${collectionTitle}"`
          : wantCollection
            ? 'Fix collection create/add permissions'
            : 'Collection skipped',
      ],
      honesty: {
        note:
          finalStatus === 'applied'
            ? 'Inventory/collection ops applied after confirmOps. Secrets never returned.'
            : 'Some or all post-ACTIVE ops failed — see opsReport. Secrets never returned.',
      },
      error: finalStatus === 'shopify_error' ? invError || colError : undefined,
    };
  }

  private async loadOperatorProducts(
    organizationId: string,
    opts?: { excludeFixtures?: boolean },
  ): Promise<OperatorProduct[]> {
    const products = await this.prisma.client.product.findMany({
      where: {
        organizationId,
        ...(opts?.excludeFixtures
          ? { sourcePlatform: { not: { startsWith: 'fixture' } } }
          : {}),
      },
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
