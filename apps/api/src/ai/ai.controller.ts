import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import {
  describeAiProviders,
  describeWebSearchProviders,
  diagnoseCohereConfig,
  isCohereSoleActivePolicy,
  listArtifactKinds,
  listPrompts,
  listSchemas,
  listToolsPublic,
  probeCohereDeepHealth,
  type OperationLoopMode,
} from '@tradeops/ai-runtime';
import { CurrentAuth, Public, RequirePermissions } from '../identity/decorators';
import type { AuthContext } from '../identity/types';
import { EventFabricService } from '../events/event-fabric.service';
import { AiOperatorService } from './ai-operator.service';

@Controller('ai')
export class AiController {
  constructor(
    private readonly operator: AiOperatorService,
    private readonly events: EventFabricService,
  ) {}

  @Public()
  @Get('tools')
  tools() {
    return this.operator.getToolCatalog();
  }

  /**
   * Cohere / Phase B health.
   * `?deep=true` performs a minimal Chat V2 probe (no key returned).
   */
  @Public()
  @Get('health')
  async aiHealth(@Query('deep') deep?: string) {
    const shallow = diagnoseCohereConfig();
    const base = {
      service: 'tradeops-ai',
      configured: shallow.configured,
      authenticated: false,
      modelAvailable: false,
      structuredOutputHealthy: false,
      lastChecked: new Date().toISOString(),
      errorCode: shallow.errorCode,
      model: shallow.model,
      // key never exposed — only presence
      keyPresent: shallow.configured,
    };
    if (deep !== 'true' && deep !== '1') {
      return base;
    }
    const deepResult = await probeCohereDeepHealth();
    return {
      service: 'tradeops-ai',
      configured: deepResult.configured,
      authenticated: deepResult.authenticated,
      modelAvailable: deepResult.modelAvailable,
      structuredOutputHealthy: deepResult.structuredOutputHealthy,
      lastChecked: deepResult.lastChecked,
      errorCode: deepResult.errorCode,
      model: deepResult.model,
      latencyMs: deepResult.latencyMs,
      keyPresent: deepResult.configured,
    };
  }

  /**
   * COS AI Runtime catalog — prompts, schemas, artifacts, providers (source-owned).
   */
  @Public()
  @Get('runtime')
  aiRuntimeCatalog() {
    return {
      tools: listToolsPublic(),
      prompts: listPrompts().map((p) => ({
        id: p.id,
        version: p.version,
        purpose: p.purpose,
        variables: p.variables,
      })),
      schemas: listSchemas().map((s) => ({
        id: s.id,
        version: s.version,
        description: s.description,
      })),
      artifacts: listArtifactKinds(),
      providers: describeAiProviders(),
      webSearch: describeWebSearchProviders(),
      policy: {
        cohereSoleActiveAi: isCohereSoleActivePolicy(),
        soleWebSearchProvider: 'tavily',
        noSilentProviderFallback: true,
        researchCapabilities: [
          'research.search_public_web',
          'research.extract_url',
          'research.search_official_documentation',
        ],
      },
      principle:
        'One AI Runtime — Cohere is the sole active AI provider (Chat/Embed/Rerank). Public web search is Tavily only. Failures block honestly; never demo-fallback to another model.',
    };
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
      // Live examples default to shadow unless caller opts into non-shadow.
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
       * Sidebar should pass false for lower latency + liveProgress.
       */
      navigate?: boolean;
    },
  ) {
    if (body.exampleId?.trim()) {
      return this.operator.runLiveExample({
        organizationId: auth.activeOrganizationId!,
        userId: auth.userId,
        exampleId: body.exampleId.trim(),
        // Catalog examples stay shadow by default for safety.
        forceShadow: body.forceShadow !== false,
        permissions: [...(auth.permissions ?? [])],
      });
    }
    const objective =
      body.objective?.trim() ||
      'Find products worth evaluating.';

    // Full navigator only when explicitly requested (navigate: true)
    if (body.navigate === true) {
      return this.operator.resolveObjective({
        organizationId: auth.activeOrganizationId!,
        userId: auth.userId,
        objective,
        loopMode: body.loopMode,
        // Opt-in only — missing forceShadow must NOT coerce shadow.
        forceShadow: body.forceShadow === true,
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
          envelope: cycle?.envelope,
          liveProgress: cycle?.liveProgress,
        };
      });
    }

    // Default: fast operator cycle (sidebar / AI panel)
    return this.operator.runObjective({
      organizationId: auth.activeOrganizationId!,
      userId: auth.userId,
      objective,
      loopMode: body.loopMode,
      // Opt-in only — sidebar must not force shadow by omission.
      forceShadow: body.forceShadow === true,
      permissions: [...(auth.permissions ?? [])],
      commerceCaseId: body.commerceCaseId?.trim(),
    });
  }

  /**
   * SSE stream of operator progress + final result.
   * Events: state (progress), result (final JSON), error.
   */
  @Post('operator/run/stream')
  @RequirePermissions('ai:write', 'products:read')
  async runOperatorStream(
    @CurrentAuth() auth: AuthContext,
    @Body()
    body: {
      objective?: string;
      loopMode?: OperationLoopMode;
      forceShadow?: boolean;
      commerceCaseId?: string;
    },
    @Res() res: Response,
  ) {
    const objective = body.objective?.trim() || 'Find products worth evaluating.';
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const send = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    send('state', {
      state: 'queued',
      step: 'Operator run queued',
      at: new Date().toISOString(),
    });

    try {
      const result = await this.operator.runObjective({
        organizationId: auth.activeOrganizationId!,
        userId: auth.userId,
        objective,
        loopMode: body.loopMode,
        forceShadow: body.forceShadow === true,
        permissions: [...(auth.permissions ?? [])],
        commerceCaseId: body.commerceCaseId?.trim(),
        onProgress: async (ev) => {
          send('state', ev);
        },
      });
      send('result', result);
      send('state', {
        state: 'completed',
        step: 'Done',
        at: new Date().toISOString(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const code =
        typeof error === 'object' &&
        error &&
        'response' in error &&
        typeof (error as { response?: { code?: string } }).response?.code === 'string'
          ? (error as { response: { code: string } }).response.code
          : undefined;
      send('error', {
        message,
        code: code ?? (message.includes('database') ? 'database_unavailable' : 'operator_failed'),
      });
    } finally {
      res.end();
    }
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
      forceShadow: body.forceShadow === true,
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
