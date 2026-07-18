import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import type { OperationLoopMode } from '@tradeops/ai-runtime';
import {
  agentCatalogPublic,
  gatewayCatalogPublic,
  resolveAIProvider,
  listPromptsPublic,
  listSchemasPublic,
  aiProviderPublicStatus,
  planAgentsForObjective,
} from '@tradeops/ai-runtime';
import { aiPlatformPublicStatus, environmentManifestPublicStatus } from '@tradeops/config';
import { CurrentAuth, Public, RequirePermissions } from '../identity/decorators';
import { requireOrgId } from '../identity/require-tenant';
import type { AuthContext } from '../identity/types';
import { EventFabricService } from '../events/event-fabric.service';
import { AiChatService } from './ai-chat.service';
import { AiOperatorService } from './ai-operator.service';
import { RagService } from './rag.service';
import { PredictionService } from './prediction.service';
import type { RagSourceType } from '@tradeops/ai-runtime';

@Controller('ai')
export class AiController {
  constructor(
    private readonly chatService: AiChatService,
    private readonly operator: AiOperatorService,
    private readonly rag: RagService,
    private readonly prediction: PredictionService,
    private readonly events: EventFabricService,
  ) {}

  @Public()
  @Get('tools')
  tools() {
    return this.operator.getToolCatalog();
  }

  /** Platform AI status — xAI config (no secrets) + RAG train state */
  @Get('status')
  @RequirePermissions('ai:read')
  async aiStatus(@CurrentAuth() auth: AuthContext) {
    const base = await this.operator.platformAiStatus(requireOrgId(auth));
    return {
      ...base,
      unifiedStack: aiPlatformPublicStatus(),
    };
  }

  /**
   * Unified AI Gateway catalog — one AI, capabilities + response contract.
   * Frontend should not need vendor REST knowledge.
   * Public so Integration Hub / AI page can load catalog without secrets.
   */
  @Public()
  @Get('gateway')
  gatewayCatalog() {
    return {
      ...gatewayCatalogPublic(),
      agents: agentCatalogPublic(),
    };
  }

  /**
   * Agent orchestration plan — which specialist roles participate for an objective.
   * Single Cohere runtime; roles shape tools/prompt emphasis.
   */
  @Post('agents/plan')
  @RequirePermissions('ai:read')
  planAgents(
    @Body() body: { objective?: string; persona?: string },
  ) {
    return planAgentsForObjective(body.objective ?? '', {
      persona: body.persona,
    });
  }

  @Public()
  @Get('agents')
  listAgents() {
    return agentCatalogPublic();
  }

  /**
   * Canonical path alias — always Cohere agent loop (no legacy demo gateway fallback).
   * Prefer POST /ai/chat; this remains for older clients.
   */
  @Post('gateway/run')
  @RequirePermissions('ai:write', 'ai:read')
  async gatewayRun(
    @CurrentAuth() auth: AuthContext,
    @Body()
    body: {
      objective?: string;
      message?: string;
      conversationId?: string;
      disableSearch?: boolean;
      operationalContext?: Record<string, unknown>;
      knowledgeDocuments?: Array<{
        id: string;
        title: string;
        body: string;
        sourceType?: string;
        provider?: string;
        url?: string;
      }>;
    },
  ) {
    const tenantId = requireOrgId(auth);
    const objective =
      body.message?.trim() ||
      body.objective?.trim() ||
      '';
    if (!objective) {
      return {
        status: 'blocked',
        dataMode: 'unavailable',
        errorCode: 'MESSAGE_REQUIRED',
        requiredAction: 'Provide message or objective.',
        output: { text: 'Message is required.', artifactType: 'answer', artifact: {} },
        warnings: ['message_required'],
        confidence: 0,
      };
    }
    return this.chatService.chat({
      organizationId: tenantId,
      userId: auth.userId,
      message: objective,
      conversationId: body.conversationId,
      operationalContext: body.operationalContext,
      knowledgeDocuments: body.knowledgeDocuments,
      disableSearch: body.disableSearch,
      permissions: [...(auth.permissions ?? [])],
    });
  }

  /**
   * Canonical Cohere AI chat runtime + durable conversation history.
   * Server resolves tenant; client never sends API keys, models, or trusted tenant IDs.
   */
  @Post('chat')
  @RequirePermissions('ai:write', 'ai:read')
  async chat(
    @CurrentAuth() auth: AuthContext,
    @Body()
    body: {
      message?: string;
      conversationId?: string;
      workspaceId?: string;
      requestedArtifactType?: string;
      disableSearch?: boolean;
      operationalContext?: Record<string, unknown>;
      knowledgeDocuments?: Array<{
        id: string;
        title: string;
        body: string;
        sourceType?: string;
        provider?: string;
        url?: string;
      }>;
    },
  ) {
    const message = body.message?.trim();
    if (!message) {
      return {
        status: 'blocked',
        dataMode: 'unavailable',
        errorCode: 'MESSAGE_REQUIRED',
        requiredAction: 'Provide a non-empty message.',
        output: { text: 'Message is required.', artifactType: 'answer', artifact: {} },
        warnings: ['message_required'],
        confidence: 0,
        evidence: [],
        actions: [],
      };
    }
    return this.chatService.chat({
      organizationId: requireOrgId(auth),
      userId: auth.userId,
      message,
      conversationId: body.conversationId,
      workspaceId: body.workspaceId,
      requestedArtifactType: body.requestedArtifactType,
      disableSearch: body.disableSearch,
      operationalContext: body.operationalContext,
      knowledgeDocuments: body.knowledgeDocuments,
      permissions: [...(auth.permissions ?? [])],
    });
  }

  /** List durable AI conversations for the active tenant. */
  @Get('conversations')
  @RequirePermissions('ai:read')
  listConversations(@CurrentAuth() auth: AuthContext) {
    return this.chatService.listConversations(requireOrgId(auth));
  }

  /** Load a conversation thread (user + assistant turns). */
  @Get('conversations/:conversationId')
  @RequirePermissions('ai:read')
  getConversation(
    @CurrentAuth() auth: AuthContext,
    @Param('conversationId') conversationId: string,
  ) {
    return this.chatService.getConversation(requireOrgId(auth), conversationId);
  }

  /**
   * Safe AI runtime health (no secrets). Verifies provider config + live embed probe when possible.
   * GET /api/v1/ai/health
   */
  @Get('health')
  @RequirePermissions('ai:read')
  async aiHealth() {
    const { getSimulationPolicy } = await import('@tradeops/ai-runtime');
    const policy = getSimulationPolicy();
    const provider = resolveAIProvider();
    const health = await provider.healthCheck();
    const platform = aiPlatformPublicStatus();
    const overall =
      !policy.aiRuntimeEnabled
        ? 'disabled'
        : policy.productionSimulationRejected
          ? 'unhealthy'
          : !provider.configured
            ? 'blocked'
            : health.ok
              ? 'healthy'
              : 'unhealthy';

    return {
      status: overall,
      runtime: {
        enabled: policy.aiRuntimeEnabled,
        provider: provider.id,
        configured: provider.configured,
        model: health.model ?? platform.cohereChatModel ?? 'unknown',
        structuredOutput: platform.responseContract?.mode ?? 'json_schema',
        toolCalling: 'enabled',
        simulationMode: policy.simulationEnabled,
        responseCacheEnabled: policy.responseCacheEnabled,
        providerProbe: health.ok ? 'healthy' : provider.configured ? 'unhealthy' : 'missing',
        latencyMs: health.latencyMs,
        error: health.error ?? null,
      },
      dependencies: {
        search: platform.search?.enabled
          ? platform.search?.tavilySearch || platform.search?.openaiWeb
            ? 'configured'
            : 'enabled_but_no_key'
          : 'disabled',
        retrieval: platform.cohereConfigured ? 'cohere' : 'local_or_unavailable',
        cohere: platform.cohereConfigured ? (health.ok ? 'healthy' : 'unhealthy') : 'missing_key',
      },
      lastCheckedAt: health.checkedAt ?? new Date().toISOString(),
      note: 'No secrets returned. Set COHERE_API_KEY for live runtime. Simulation never auto-enables after provider failure.',
    };
  }

  /** Provider + prompt health (no secrets). */
  @Get('runtime')
  @RequirePermissions('ai:read')
  async runtimeStatus() {
    const provider = resolveAIProvider();
    const health = await provider.healthCheck();
    const {
      getSimulationPolicy,
      productionAiConfigPublic,
      assertProductionAiAssetsPresent,
    } = await import('@tradeops/ai-runtime');
    try {
      assertProductionAiAssetsPresent();
    } catch {
      /* reported in productionConfig.integrity */
    }
    return {
      platform: aiPlatformPublicStatus(),
      provider: aiProviderPublicStatus(),
      health,
      simulation: getSimulationPolicy(),
      prompts: listPromptsPublic(),
      schemas: listSchemasPublic(),
      environment: environmentManifestPublicStatus(),
      /** Full code-owned Cohere production configuration inventory */
      productionConfig: productionAiConfigPublic(),
    };
  }

  /**
   * Complete production AI configuration from source code (no secrets).
   * Proves TradeOps owns prompts, schemas, tools, policies — not Playground.
   */
  @Get('production-config')
  @RequirePermissions('ai:read')
  async productionConfig() {
    const { productionAiConfigPublic, assertProductionAiAssetsPresent } =
      await import('@tradeops/ai-runtime');
    assertProductionAiAssetsPresent();
    return productionAiConfigPublic();
  }

  @Post('xai/probe')
  @RequirePermissions('ai:read')
  async xaiProbe() {
    const { probeXai } = await import('@tradeops/ai-runtime');
    const probe = await probeXai();
    const { xaiPublicStatus } = await import('@tradeops/config');
    return { ...xaiPublicStatus(), probe };
  }

  @Public()
  @Get('loop-modes')
  loopModes() {
    return this.operator.getToolCatalog().loopModes;
  }

  @Get('runs')
  @RequirePermissions('ai:read')
  listRuns(@CurrentAuth() auth: AuthContext, @Query('take') take?: string) {
    return this.operator.listRuns(
      requireOrgId(auth),
      Math.min(Number(take ?? 20) || 20, 50),
    );
  }

  @Get('runs/:runId')
  @RequirePermissions('ai:read')
  getRun(@CurrentAuth() auth: AuthContext, @Param('runId') runId: string) {
    return this.operator.getRun(requireOrgId(auth), runId);
  }

  /** Live Example Framework catalog + readiness */
  @Get('live-examples')
  @RequirePermissions('ai:read')
  liveExamples(@CurrentAuth() auth: AuthContext) {
    return this.operator.listLiveExamplesWithReadiness(requireOrgId(auth));
  }

  @Post('live-examples/:exampleId/run')
  @RequirePermissions('ai:write', 'products:read')
  runLiveExample(
    @CurrentAuth() auth: AuthContext,
    @Param('exampleId') exampleId: string,
    @Body() body: { forceShadow?: boolean },
  ) {
    return this.operator.runLiveExample({
      organizationId: requireOrgId(auth),
      userId: auth.userId,
      exampleId,
      forceShadow: body?.forceShadow !== false,
      permissions: [...(auth.permissions ?? [])],
    });
  }

  @Post('operator/run')
  @RequirePermissions('ai:write', 'products:read')
  runOperator(
    @CurrentAuth() auth: AuthContext,
    @Body()
    body: {
      objective?: string;
      loopMode?: OperationLoopMode;
      forceShadow?: boolean;
      exampleId?: string;
      /** Optional commerce case binding for stage-aware operation */
      commerceCaseId?: string;
      /**
       * When true, use full Objective Resolution Engine (Execution Package).
       * Default true — every interaction starts with an objective package.
       */
      navigate?: boolean;
    },
  ) {
    if (body.exampleId?.trim()) {
      return this.operator.runLiveExample({
        organizationId: requireOrgId(auth),
        userId: auth.userId,
        exampleId: body.exampleId.trim(),
        forceShadow: body.forceShadow !== false,
        permissions: [...(auth.permissions ?? [])],
      });
    }
    const objective =
      body.objective?.trim() ||
      'Find products worth evaluating.';

    // Default: Objective Resolution Engine (execution navigator)
    // Flatten so existing AI console still receives cycle fields + package.
    if (body.navigate !== false) {
      return this.operator.resolveObjective({
        organizationId: requireOrgId(auth),
        userId: auth.userId,
        objective,
        loopMode: body.loopMode,
        forceShadow: body.forceShadow !== false,
        permissions: [...(auth.permissions ?? [])],
        commerceCaseId: body.commerceCaseId?.trim(),
        runCycle: true,
      }).then((resolved) => {
        const cycle = resolved.cycleResult;
        return {
          runId: resolved.runId,
          status: cycle?.status ?? resolved.executionPackage.executionStatus.overall,
          loopMode: cycle?.loopMode ?? resolved.executionPackage.currentState.loopMode,
          objectiveType:
            cycle?.objectiveType ?? resolved.executionPackage.objective.objectiveType,
          riskClass: cycle?.riskClass ?? resolved.executionPackage.objective.riskClass,
          approvalRequired:
            cycle?.approvalRequired ??
            resolved.executionPackage.objective.approvalRequired,
          decision: cycle?.decision ?? 'accept',
          decisionNote:
            cycle?.decisionNote ?? resolved.executionPackage.verification.notes,
          responseSummary: cycle?.responseSummary ?? resolved.summary,
          plan: cycle?.plan ?? {
            steps: resolved.executionPackage.executionPlan.tasks.map((t) => t.title),
            toolsToCall: [],
            interpretation: resolved.executionPackage.objective.goal,
          },
          timeline: cycle?.timeline ?? [],
          sources: cycle?.sources ?? [],
          candidateStats: cycle?.candidateStats,
          filtersApplied: cycle?.filtersApplied,
          critic: cycle?.critic,
          auditor: cycle?.auditor,
          toolTrace: cycle?.toolTrace,
          recommendations:
            cycle?.recommendations ??
            resolved.executionPackage.productRecommendations,
          resultsPath: cycle?.resultsPath ?? `/terminal/objectives/${resolved.runId}`,
          honesty: cycle?.honesty ?? resolved.executionPackage.honesty,
          executionPackage: resolved.executionPackage,
          navigatorSummary: resolved.summary,
          knowledgeBaseDelta: resolved.executionPackage.knowledgeBaseDelta,
        };
      });
    }

    return this.operator.runObjective({
      organizationId: requireOrgId(auth),
      userId: auth.userId,
      objective,
      loopMode: body.loopMode,
      forceShadow: body.forceShadow !== false,
      permissions: [...(auth.permissions ?? [])],
      commerceCaseId: body.commerceCaseId?.trim(),
    });
  }

  /**
   * AI Execution Navigator — resolve an objective into a 10-section Execution Package.
   * Does not require chat; starts from business objective.
   */
  @Post('navigator/resolve')
  @RequirePermissions('ai:write', 'products:read')
  resolveNavigator(
    @CurrentAuth() auth: AuthContext,
    @Body()
    body: {
      objective?: string;
      loopMode?: OperationLoopMode;
      forceShadow?: boolean;
      commerceCaseId?: string;
      /** Skip product operator cycle (state + plan only) */
      runCycle?: boolean;
    },
  ) {
    const objective = body.objective?.trim();
    if (!objective) {
      return {
        error: 'objective is required',
        note: 'Start with a business objective, not a free-form chat question.',
      };
    }
    return this.operator.resolveObjective({
      organizationId: requireOrgId(auth),
      userId: auth.userId,
      objective,
      loopMode: body.loopMode,
      forceShadow: body.forceShadow !== false,
      permissions: [...(auth.permissions ?? [])],
      commerceCaseId: body.commerceCaseId?.trim(),
      runCycle: body.runCycle !== false,
    });
  }

  /** Prior knowledge distilled from completed objectives */
  @Get('navigator/knowledge')
  @RequirePermissions('ai:read')
  async navigatorKnowledge(
    @CurrentAuth() auth: AuthContext,
    @Query('take') take?: string,
  ) {
    const entries = await this.operator.loadPriorKnowledge(
      requireOrgId(auth),
      Math.min(Number(take ?? 20) || 20, 50),
    );
    return {
      count: entries.length,
      entries,
      honesty: {
        note: 'Knowledge is derived from prior OperatorRun execution packages — not external training data.',
      },
    };
  }

  // ─── RAG Engine (org-specific retrieval "training") ───────────────────────

  @Get('rag/status')
  @RequirePermissions('ai:read')
  ragStatus(@CurrentAuth() auth: AuthContext) {
    return this.rag.status(requireOrgId(auth));
  }

  /**
   * Rebuild org retrieval index (products, artifacts, cases, runs, connectors, SOPs).
   * Continuous retrieval training — not GPU fine-tuning of model weights.
   */
  @Post('rag/train')
  @RequirePermissions('ai:write')
  ragTrain(@CurrentAuth() auth: AuthContext) {
    return this.rag.train(requireOrgId(auth), auth.userId);
  }

  /** Export ProductArtifact metadata to repo-root artifacts-corpus.csv */
  @Post('rag/export-csv')
  @RequirePermissions('ai:read')
  ragExportCsv(@CurrentAuth() auth: AuthContext) {
    return this.rag.exportArtifactCsv(requireOrgId(auth));
  }

  /**
   * Query the org RAG index. Optional grounded LLM answer when XAI_API_KEY is set
   * and body.generate=true.
   */
  @Post('rag/query')
  @RequirePermissions('ai:read')
  ragQuery(
    @CurrentAuth() auth: AuthContext,
    @Body()
    body: {
      query?: string;
      topK?: number;
      excludeFixtures?: boolean;
      sourceTypes?: RagSourceType[];
      generate?: boolean;
      autoTrainIfMissing?: boolean;
    },
  ) {
    const query = body.query?.trim();
    if (!query) {
      return {
        error: 'query is required',
        note: 'Ask a retrieval question against your trained org index.',
      };
    }
    return this.rag.query(requireOrgId(auth), {
      query,
      topK: body.topK,
      excludeFixtures: body.excludeFixtures,
      sourceTypes: body.sourceTypes,
      // undefined → server defaultGenerate when xAI mode active
      generate: body.generate,
      autoTrainIfMissing: body.autoTrainIfMissing !== false,
    });
  }

  // ─── Prediction Engine ────────────────────────────────────────────────────

  @Get('prediction/status')
  @RequirePermissions('ai:read')
  predictionStatus(@CurrentAuth() auth: AuthContext) {
    return this.prediction.status(requireOrgId(auth));
  }

  @Post('prediction/train')
  @RequirePermissions('ai:write')
  predictionTrain(@CurrentAuth() auth: AuthContext) {
    return this.prediction.train(requireOrgId(auth));
  }

  @Post('prediction/run')
  @RequirePermissions('ai:write', 'products:read')
  predictionRun(
    @CurrentAuth() auth: AuthContext,
    @Body()
    body: {
      productId?: string;
      horizonDays?: 7 | 14 | 30;
      limit?: number;
    },
  ) {
    return this.prediction.run(requireOrgId(auth), body);
  }

  @Post('prediction/evaluate')
  @RequirePermissions('ai:read')
  predictionEvaluate(@CurrentAuth() auth: AuthContext) {
    return this.prediction.evaluate(requireOrgId(auth));
  }

  @Post('prediction/export-csv')
  @RequirePermissions('ai:write', 'products:read')
  predictionExportCsv(@CurrentAuth() auth: AuthContext) {
    return this.prediction.exportCsv(requireOrgId(auth));
  }

  /**
   * Full intelligence rebuild: artifact CSV → RAG train → prediction train → prediction run.
   */
  @Post('intelligence/rebuild')
  @RequirePermissions('ai:write', 'products:read')
  async intelligenceRebuild(@CurrentAuth() auth: AuthContext) {
    const orgId = requireOrgId(auth);
    const steps: Array<Record<string, unknown>> = [];

    try {
      const csv = await this.rag.exportArtifactCsv(orgId);
      steps.push({ step: 'export_artifact_csv', ok: true, ...csv });
    } catch (e) {
      steps.push({
        step: 'export_artifact_csv',
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }

    try {
      const train = await this.rag.train(orgId, auth.userId);
      steps.push({
        step: 'rag_train',
        ok: true,
        stats: train.stats,
        embeddingNote: train.embeddingNote,
        csvPath: train.csvPath,
      });
    } catch (e) {
      steps.push({
        step: 'rag_train',
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }

    try {
      const predTrain = await this.prediction.train(orgId);
      steps.push({
        step: 'prediction_train',
        ok: true,
        sampleSize: predTrain.sampleSize,
        modelVersion: predTrain.weights.modelVersion,
      });
    } catch (e) {
      steps.push({
        step: 'prediction_train',
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }

    try {
      const predRun = await this.prediction.run(orgId, { limit: 25 });
      steps.push({
        step: 'prediction_run',
        ok: true,
        count: predRun.count,
        modelVersion: predRun.modelVersion,
      });
    } catch (e) {
      steps.push({
        step: 'prediction_run',
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }

    const okCount = steps.filter((s) => s.ok).length;
    return {
      organizationId: orgId,
      steps,
      summary: `${okCount}/${steps.length} steps ok`,
      honesty: {
        note: 'Rebuild trains retrieval + transparent prediction corrections. Not GPU fine-tuning. Fixtures remain labeled.',
      },
    };
  }

  @Post('harmonize')
  @RequirePermissions('products:read', 'ai:write')
  harmonize(@CurrentAuth() auth: AuthContext) {
    return this.operator.runHarmonization(requireOrgId(auth));
  }

  @Get('events')
  @RequirePermissions('analytics:read', 'ai:read')
  listEvents(@CurrentAuth() auth: AuthContext, @Query('take') take?: string) {
    return this.events.listRecent(
      requireOrgId(auth),
      Math.min(Number(take ?? 50) || 50, 100),
    );
  }

  /**
   * Development webhook intake — stores receipt + commerce event.
   * Signature verification is provider-specific; missing signature ≠ live verified.
   */
  @Post('webhooks/:providerKey')
  @RequirePermissions('connectors:write', 'developer:write')
  async webhook(
    @CurrentAuth() auth: AuthContext,
    @Param('providerKey') providerKey: string,
    @Body()
    body: {
      topic?: string;
      payload?: Record<string, unknown>;
      signatureValid?: boolean;
      isFixture?: boolean;
      loopMode?: OperationLoopMode;
    },
  ) {
    return this.events.recordWebhook({
      organizationId: requireOrgId(auth),
      providerKey,
      topic: body.topic ?? 'unknown',
      body: body.payload ?? body,
      signatureValid: body.signatureValid ?? null,
      isFixture: body.isFixture ?? providerKey.startsWith('fixture'),
      loopMode: body.loopMode ?? (body.isFixture ? 'fixture' : 'development'),
    });
  }
}
