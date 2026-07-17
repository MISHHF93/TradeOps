import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import type { OperationLoopMode } from '@tradeops/ai-runtime';
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
