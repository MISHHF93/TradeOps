import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import type { OperationLoopMode } from '@tradeops/ai-runtime';
import { CurrentAuth, Public, RequirePermissions } from '../identity/decorators';
import type { AuthContext } from '../identity/types';
import { EventFabricService } from '../events/event-fabric.service';
import { AiOperatorService } from './ai-operator.service';
import { RagService } from './rag.service';
import type { RagSourceType } from '@tradeops/ai-runtime';

@Controller('ai')
export class AiController {
  constructor(
    private readonly operator: AiOperatorService,
    private readonly rag: RagService,
    private readonly events: EventFabricService,
  ) {}

  @Public()
  @Get('tools')
  tools() {
    return this.operator.getToolCatalog();
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
      auth.activeOrganizationId!,
      Math.min(Number(take ?? 20) || 20, 50),
    );
  }

  @Get('runs/:runId')
  @RequirePermissions('ai:read')
  getRun(@CurrentAuth() auth: AuthContext, @Param('runId') runId: string) {
    return this.operator.getRun(auth.activeOrganizationId!, runId);
  }

  /** Live Example Framework catalog + readiness */
  @Get('live-examples')
  @RequirePermissions('ai:read')
  liveExamples(@CurrentAuth() auth: AuthContext) {
    return this.operator.listLiveExamplesWithReadiness(auth.activeOrganizationId!);
  }

  @Post('live-examples/:exampleId/run')
  @RequirePermissions('ai:write', 'products:read')
  runLiveExample(
    @CurrentAuth() auth: AuthContext,
    @Param('exampleId') exampleId: string,
    @Body() body: { forceShadow?: boolean },
  ) {
    return this.operator.runLiveExample({
      organizationId: auth.activeOrganizationId!,
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
        organizationId: auth.activeOrganizationId!,
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
        organizationId: auth.activeOrganizationId!,
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
      organizationId: auth.activeOrganizationId!,
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
      organizationId: auth.activeOrganizationId!,
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
      auth.activeOrganizationId!,
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
    return this.rag.status(auth.activeOrganizationId!);
  }

  /**
   * Rebuild org sparse TF-IDF index from products, cases, runs, connectors, SOPs.
   * This is continuous retrieval training — not GPU fine-tuning of model weights.
   */
  @Post('rag/train')
  @RequirePermissions('ai:write')
  ragTrain(@CurrentAuth() auth: AuthContext) {
    return this.rag.train(auth.activeOrganizationId!, auth.userId);
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
    return this.rag.query(auth.activeOrganizationId!, {
      query,
      topK: body.topK,
      excludeFixtures: body.excludeFixtures,
      sourceTypes: body.sourceTypes,
      generate: body.generate === true,
      autoTrainIfMissing: body.autoTrainIfMissing !== false,
    });
  }

  @Post('harmonize')
  @RequirePermissions('products:read', 'ai:write')
  harmonize(@CurrentAuth() auth: AuthContext) {
    return this.operator.runHarmonization(auth.activeOrganizationId!);
  }

  @Get('events')
  @RequirePermissions('analytics:read', 'ai:read')
  listEvents(@CurrentAuth() auth: AuthContext, @Query('take') take?: string) {
    return this.events.listRecent(
      auth.activeOrganizationId!,
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
      organizationId: auth.activeOrganizationId!,
      providerKey,
      topic: body.topic ?? 'unknown',
      body: body.payload ?? body,
      signatureValid: body.signatureValid ?? null,
      isFixture: body.isFixture ?? providerKey.startsWith('fixture'),
      loopMode: body.loopMode ?? (body.isFixture ? 'fixture' : 'development'),
    });
  }
}
