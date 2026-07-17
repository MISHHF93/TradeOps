import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentAuth, RequirePermissions } from '../identity/decorators';
import type { AuthContext } from '../identity/types';
import { ArtifactService } from './artifact.service';
import { CommerceCaseService } from './commerce-case.service';
import { CommerceRuntimeService } from './commerce-runtime.service';
import { CommerceService } from './commerce.service';
import { ConnectorOpsService } from './connector-ops.service';
import { EcosystemService } from './ecosystem.service';
import { LiveConnectorService } from './live-connector.service';
import { WorkspaceService } from './workspace.service';
import { LIVE_DATA_INVENTORY, simulationBanner } from '@tradeops/commerce-engine';
import type { BusinessCapability } from '@tradeops/connector-core';

@Controller()
export class CommerceController {
  constructor(
    private readonly commerce: CommerceService,
    private readonly artifacts: ArtifactService,
    private readonly cases: CommerceCaseService,
    private readonly ecosystem: EcosystemService,
    private readonly workspace: WorkspaceService,
    private readonly runtime: CommerceRuntimeService,
    private readonly ops: ConnectorOpsService,
    private readonly liveConnectors: LiveConnectorService,
  ) {}

  /** Real-Time Commerce Operations Center — connector health + registry */
  @Get('ops/connectors/health')
  @RequirePermissions('connectors:read')
  opsConnectorHealth(@CurrentAuth() auth: AuthContext) {
    this.requireOrg(auth);
    return this.ops.healthCenter(auth.activeOrganizationId!);
  }

  @Get('ops/connectors/registry')
  @RequirePermissions('connectors:read')
  opsConnectorRegistry(@CurrentAuth() auth: AuthContext) {
    this.requireOrg(auth);
    return this.ops.registry(auth.activeOrganizationId!);
  }

  @Get('ops/capabilities/resolve')
  @RequirePermissions('connectors:read')
  opsResolveCapability(
    @CurrentAuth() auth: AuthContext,
    @Query('capability') capability?: string,
  ) {
    this.requireOrg(auth);
    if (!capability?.trim()) {
      throw new BadRequestException('query capability is required');
    }
    return this.ops.resolveBusinessCapability(
      auth.activeOrganizationId!,
      capability.trim(),
    );
  }

  @Post('ops/connectors/:providerKey/probe')
  @RequirePermissions('connectors:read')
  opsProbe(
    @CurrentAuth() auth: AuthContext,
    @Param('providerKey') providerKey: string,
  ) {
    this.requireOrg(auth);
    return this.ops.probe(auth.activeOrganizationId!, providerKey);
  }

  @Post('ops/connectors/reconcile-all')
  @RequirePermissions('connectors:read')
  opsReconcileAll(@CurrentAuth() auth: AuthContext) {
    this.requireOrg(auth);
    return this.ops.reconcileAll(auth.activeOrganizationId!);
  }

  /** Production connector catalog — credential status, never secrets. */
  @Get('ops/connectors/production')
  @RequirePermissions('connectors:read')
  opsProductionCatalog(@CurrentAuth() auth: AuthContext) {
    this.requireOrg(auth);
    return {
      catalog: this.liveConnectors.catalog(),
      descriptors: this.liveConnectors.listDescriptors(),
    };
  }

  /** Bootstrap org installs from production registry (env-gated status). */
  @Post('ops/connectors/ensure-registry')
  @RequirePermissions('connectors:read')
  opsEnsureRegistry(@CurrentAuth() auth: AuthContext) {
    this.requireOrg(auth);
    return this.liveConnectors.ensureRegistryInstalls(auth.activeOrganizationId!);
  }

  /**
   * Credential-gated live HTTP sync → canonical models + bus events.
   * Never fabricates data when credentials are missing.
   */
  @Post('ops/connectors/live-sync')
  @RequirePermissions('connectors:read')
  opsLiveSync(
    @CurrentAuth() auth: AuthContext,
    @Body()
    body?: { providerKeys?: string[]; searchQuery?: string },
  ) {
    this.requireOrg(auth);
    return this.ops.syncLive(auth.activeOrganizationId!, {
      providerKeys: body?.providerKeys,
      searchQuery: body?.searchQuery,
    });
  }

  /** AI Capability Registry resolve (business capability → provider). */
  @Get('ops/capabilities/live-resolve')
  @RequirePermissions('connectors:read')
  opsLiveCapabilityResolve(
    @CurrentAuth() auth: AuthContext,
    @Query('capability') capability?: string,
  ) {
    this.requireOrg(auth);
    if (!capability?.trim()) {
      throw new BadRequestException('query capability is required');
    }
    return this.liveConnectors.resolveCapability(
      auth.activeOrganizationId!,
      capability.trim(),
    );
  }

  /**
   * Webhook ingress (fixture + signed live). Queues receipt for durable processing.
   * Body: { topic, payload?, organizationId? } — org defaults to active session.
   */
  @Post('ops/webhooks/:providerKey')
  @RequirePermissions('connectors:read')
  async opsWebhookIngest(
    @CurrentAuth() auth: AuthContext,
    @Param('providerKey') providerKey: string,
    @Body()
    body: {
      topic?: string;
      payload?: Record<string, unknown>;
      isFixture?: boolean;
      signatureValid?: boolean;
    },
  ) {
    this.requireOrg(auth);
    if (!body.topic?.trim()) throw new BadRequestException('topic is required');
    return this.ops.ingestWebhook({
      organizationId: auth.activeOrganizationId!,
      providerKey,
      topic: body.topic.trim(),
      body: body.payload ?? (body as unknown as Record<string, unknown>),
      signatureValid: body.signatureValid ?? null,
      isFixture: body.isFixture ?? providerKey.startsWith('fixture'),
    });
  }

  @Post('ops/webhooks/process')
  @RequirePermissions('connectors:read')
  opsWebhookProcess(
    @CurrentAuth() auth: AuthContext,
    @Body() body: { limit?: number },
  ) {
    this.requireOrg(auth);
    return this.ops.processWebhookBatch(
      auth.activeOrganizationId!,
      body?.limit ?? 20,
    );
  }

  @Get('ops/webhooks/dlq')
  @RequirePermissions('connectors:read')
  opsWebhookDlq(@CurrentAuth() auth: AuthContext) {
    this.requireOrg(auth);
    return this.ops.listDeadLetters(auth.activeOrganizationId!);
  }

  /**
   * Commerce Runtime — "What process is currently executing?"
   * Single orchestration surface for cases, transforms, capabilities, events.
   */
  @Get('commerce/runtime')
  @RequirePermissions('products:read', 'org:read')
  commerceRuntime(@CurrentAuth() auth: AuthContext) {
    this.requireOrg(auth);
    return this.runtime.getOrgRuntime({
      organizationId: auth.activeOrganizationId!,
      userId: auth.userId,
      founderDirect: process.env.TRADEOPS_ACCESS_MODE === 'founder_direct',
    });
  }

  @Get('commerce/runtime/cases/:caseId')
  @RequirePermissions('products:read')
  commerceRuntimeCase(
    @CurrentAuth() auth: AuthContext,
    @Param('caseId', ParseUUIDPipe) caseId: string,
  ) {
    this.requireOrg(auth);
    return this.runtime.getCaseRuntime({
      organizationId: auth.activeOrganizationId!,
      userId: auth.userId,
      caseId,
      founderDirect: process.env.TRADEOPS_ACCESS_MODE === 'founder_direct',
    });
  }

  @Post('commerce/runtime/execute')
  @RequirePermissions('products:write')
  commerceRuntimeExecute(
    @CurrentAuth() auth: AuthContext,
    @Body()
    body: {
      caseId?: string;
      transformation?: string;
      source?: 'user' | 'ai' | 'automation' | 'connector' | 'system';
    },
  ) {
    this.requireOrg(auth);
    if (!body.caseId?.trim()) throw new BadRequestException('caseId is required');
    if (!body.transformation?.trim()) {
      throw new BadRequestException('transformation is required');
    }
    return this.runtime.execute({
      organizationId: auth.activeOrganizationId!,
      userId: auth.userId,
      caseId: body.caseId.trim(),
      transformation: body.transformation.trim(),
      source: body.source ?? 'user',
      founderDirect: process.env.TRADEOPS_ACCESS_MODE === 'founder_direct',
    });
  }

  @Get('commerce/runtime/events')
  @RequirePermissions('products:read')
  commerceRuntimeEvents(@CurrentAuth() auth: AuthContext) {
    this.requireOrg(auth);
    return this.runtime.listEvents(auth.activeOrganizationId!);
  }

  @Get('commerce/runtime/capabilities')
  @RequirePermissions('connectors:read')
  commerceRuntimeCapabilities(@CurrentAuth() auth: AuthContext) {
    this.requireOrg(auth);
    return this.runtime.listCapabilities(auth.activeOrganizationId!);
  }

  /**
   * Workspace Resolver — persona, procedures, dynamic nav, AI context.
   * Role → persona → objective → sidebar.
   */
  @Get('workspace')
  @RequirePermissions('org:read')
  resolveWorkspace(@CurrentAuth() auth: AuthContext) {
    this.requireOrg(auth);
    return this.workspace.resolve({
      organizationId: auth.activeOrganizationId!,
      userId: auth.userId,
      founderDirect: process.env.TRADEOPS_ACCESS_MODE === 'founder_direct',
    });
  }

  @Get('workspace/personas')
  @RequirePermissions('org:read')
  listPersonas() {
    return { personas: this.workspace.listPersonas() };
  }

  @Get('workspace/inventory')
  @RequirePermissions('org:read')
  workspaceInventory() {
    return this.workspace.inventory();
  }

  /**
   * AI-first navigation — natural language → persona-aware route.
   * Primary discovery layer when the capability is not in Focus nav.
   */
  @Get('workspace/navigate')
  @RequirePermissions('org:read')
  async workspaceNavigate(
    @CurrentAuth() auth: AuthContext,
    @Query('q') q?: string,
  ) {
    this.requireOrg(auth);
    return this.workspace.navigate(auth.activeOrganizationId!, auth.userId, q ?? '');
  }

  /**
   * Operational intelligence brief — ranked insights, attention score, focus objective.
   */
  @Get('workspace/intelligence')
  @RequirePermissions('org:read')
  workspaceIntelligence(@CurrentAuth() auth: AuthContext) {
    this.requireOrg(auth);
    return this.workspace.intelligence({
      organizationId: auth.activeOrganizationId!,
      userId: auth.userId,
      founderDirect: process.env.TRADEOPS_ACCESS_MODE === 'founder_direct',
    });
  }

  @Post('workspace/persona')
  @RequirePermissions('org:read')
  setWorkspacePersona(
    @CurrentAuth() auth: AuthContext,
    @Body() body: { persona?: string },
  ) {
    this.requireOrg(auth);
    if (!body.persona?.trim()) throw new BadRequestException('persona is required');
    return this.workspace.setPersona(
      auth.activeOrganizationId!,
      auth.userId,
      body.persona.trim(),
    );
  }

  /** Commerce Process board — canonical lifecycle spine */
  @Get('commerce/process')
  @RequirePermissions('products:read')
  commerceProcess(@CurrentAuth() auth: AuthContext) {
    this.requireOrg(auth);
    return this.cases.listProcess(auth.activeOrganizationId!);
  }

  @Post('commerce/process/sync')
  @RequirePermissions('products:write')
  syncCommerceCases(@CurrentAuth() auth: AuthContext) {
    this.requireOrg(auth);
    return this.cases.syncOrganization(auth.activeOrganizationId!);
  }

  @Get('commerce/process/terminal-summary')
  @RequirePermissions('products:read')
  processTerminalSummary(@CurrentAuth() auth: AuthContext) {
    this.requireOrg(auth);
    return this.cases.terminalSummary(auth.activeOrganizationId!);
  }

  @Get('commerce/cases/by-product/:productId')
  @RequirePermissions('products:read')
  commerceCaseByProduct(
    @CurrentAuth() auth: AuthContext,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    this.requireOrg(auth);
    return this.cases.getCaseByProduct(auth.activeOrganizationId!, productId);
  }

  @Get('commerce/cases/:caseId')
  @RequirePermissions('products:read')
  commerceCase(
    @CurrentAuth() auth: AuthContext,
    @Param('caseId', ParseUUIDPipe) caseId: string,
  ) {
    this.requireOrg(auth);
    return this.cases.getCase(auth.activeOrganizationId!, caseId);
  }

  @Post('commerce/cases/:caseId/advance')
  @RequirePermissions('products:write')
  advanceCase(
    @CurrentAuth() auth: AuthContext,
    @Param('caseId', ParseUUIDPipe) caseId: string,
    @Body() body: { toStage?: string },
  ) {
    this.requireOrg(auth);
    if (!body.toStage?.trim()) throw new BadRequestException('toStage is required');
    return this.cases.advance(
      auth.activeOrganizationId!,
      caseId,
      body.toStage.trim(),
      auth.userId,
    );
  }

  @Get('commerce/tasks')
  @RequirePermissions('products:read')
  commerceTasks(@CurrentAuth() auth: AuthContext) {
    this.requireOrg(auth);
    return this.cases.listTasks(auth.activeOrganizationId!);
  }

  @Get('commerce/cases/:caseId/ai-context')
  @RequirePermissions('products:read', 'ai:read')
  caseAiContext(
    @CurrentAuth() auth: AuthContext,
    @Param('caseId', ParseUUIDPipe) caseId: string,
  ) {
    this.requireOrg(auth);
    return this.cases.getCaseAiContext(auth.activeOrganizationId!, caseId);
  }

  /**
   * Commerce State Engine — full state vector (current/target/friction/next transform).
   */
  @Get('commerce/state')
  @RequirePermissions('products:read')
  commerceStateBoard(@CurrentAuth() auth: AuthContext) {
    this.requireOrg(auth);
    return this.cases.resolveOrgStates(auth.activeOrganizationId!);
  }

  @Get('commerce/cases/:caseId/state')
  @RequirePermissions('products:read')
  commerceCaseState(
    @CurrentAuth() auth: AuthContext,
    @Param('caseId', ParseUUIDPipe) caseId: string,
  ) {
    this.requireOrg(auth);
    return this.cases.resolveState(auth.activeOrganizationId!, caseId);
  }

  @Post('commerce/cases/:caseId/transform')
  @RequirePermissions('products:write')
  applyCommerceTransform(
    @CurrentAuth() auth: AuthContext,
    @Param('caseId', ParseUUIDPipe) caseId: string,
    @Body() body: { transformation?: string },
  ) {
    this.requireOrg(auth);
    if (!body.transformation?.trim()) {
      throw new BadRequestException('transformation is required');
    }
    // All transforms enter Commerce Runtime (events + gates + state)
    return this.runtime.execute({
      organizationId: auth.activeOrganizationId!,
      userId: auth.userId,
      caseId,
      transformation: body.transformation.trim(),
      source: 'user',
      founderDirect: process.env.TRADEOPS_ACCESS_MODE === 'founder_direct',
    });
  }

  @Get('connectors')
  @RequirePermissions('connectors:read')
  listConnectors(@CurrentAuth() auth: AuthContext) {
    this.requireOrg(auth);
    return this.commerce.listConnectors(auth.activeOrganizationId!);
  }

  /**
   * Live Data Inventory — every major metric origin (live / derived / fixture / unavailable).
   */
  @Get('ops/live-data-inventory')
  @RequirePermissions('org:read')
  liveDataInventory() {
    const sim = simulationBanner();
    return {
      inventory: LIVE_DATA_INVENTORY,
      simulationMode: sim.active,
      workspaceMode: sim,
      honesty: {
        note: 'Production workspaces must not invent KPIs. Unavailable metrics show empty states. Fixtures labeled TEST FIXTURE. Live connectors report health via /ops/connectors/health.',
      },
    };
  }

  /** Business-capability board for AI + UI (not raw vendor APIs) */
  @Get('ecosystem/capabilities')
  @RequirePermissions('connectors:read')
  ecosystemCapabilities(@CurrentAuth() auth: AuthContext) {
    this.requireOrg(auth);
    return this.ecosystem.capabilityBoard(auth.activeOrganizationId!);
  }

  @Post('ecosystem/capabilities/select')
  @RequirePermissions('connectors:read', 'ai:read')
  async selectCapabilities(
    @CurrentAuth() auth: AuthContext,
    @Body() body: { required?: string[] },
  ) {
    this.requireOrg(auth);
    const board = await this.ecosystem.capabilityBoard(auth.activeOrganizationId!);
    const required = (body.required ?? []) as BusinessCapability[];
    return this.ecosystem.selectConnectors(board.advertisements, required);
  }

  /** Partner value for ecosystem participants (honest metrics) */
  @Get('ecosystem/partners')
  @RequirePermissions('analytics:read')
  partnerSuccess(@CurrentAuth() auth: AuthContext) {
    this.requireOrg(auth);
    return this.ecosystem.partnerSuccessCenter(auth.activeOrganizationId!);
  }

  /** Knowledge graph projection over canonical models */
  @Get('ecosystem/knowledge-graph')
  @RequirePermissions('analytics:read')
  knowledgeGraph(@CurrentAuth() auth: AuthContext) {
    this.requireOrg(auth);
    return this.ecosystem.knowledgeGraph(auth.activeOrganizationId!);
  }

  /** Actionable operational intelligence (what / why / next / who / AI / value) */
  @Get('ecosystem/intelligence')
  @RequirePermissions('analytics:read')
  operationalIntelligence(@CurrentAuth() auth: AuthContext) {
    this.requireOrg(auth);
    return this.ecosystem.operationalIntelligence(auth.activeOrganizationId!);
  }

  @Post('commerce/import/fixture-supplier')
  @RequirePermissions('products:write')
  importFixture(@CurrentAuth() auth: AuthContext) {
    this.requireOrg(auth);
    return this.commerce.importFromFixtureSupplier(auth.activeOrganizationId!, auth.userId);
  }

  @Get('terminal/scanner')
  @RequirePermissions('products:read')
  scanner(@CurrentAuth() auth: AuthContext) {
    this.requireOrg(auth);
    return this.commerce.scanner(auth.activeOrganizationId!);
  }

  @Get('terminal/signals')
  @RequirePermissions('analytics:read')
  signals(@CurrentAuth() auth: AuthContext) {
    this.requireOrg(auth);
    return this.commerce.signalFeed(auth.activeOrganizationId!);
  }

  @Get('terminal/portfolio')
  @RequirePermissions('analytics:read')
  portfolio(@CurrentAuth() auth: AuthContext) {
    this.requireOrg(auth);
    return this.commerce.portfolio(auth.activeOrganizationId!);
  }

  @Get('products/:productId')
  @RequirePermissions('products:read')
  product(
    @CurrentAuth() auth: AuthContext,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    this.requireOrg(auth);
    return this.commerce.productDetail(auth.activeOrganizationId!, productId);
  }

  /** Product Media & Artifact Engine */
  @Get('products/:productId/artifacts')
  @RequirePermissions('products:read')
  listArtifacts(
    @CurrentAuth() auth: AuthContext,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    this.requireOrg(auth);
    return this.artifacts.listForProduct(auth.activeOrganizationId!, productId);
  }

  @Post('products/:productId/artifacts/bootstrap')
  @RequirePermissions('products:write')
  bootstrapArtifacts(
    @CurrentAuth() auth: AuthContext,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    this.requireOrg(auth);
    return this.artifacts.bootstrapFromProductSources(
      auth.activeOrganizationId!,
      productId,
      auth.userId,
    );
  }

  @Post('products/:productId/artifacts/ingest-url')
  @RequirePermissions('products:write')
  ingestArtifactUrl(
    @CurrentAuth() auth: AuthContext,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body()
    body: {
      url?: string;
      purpose?: string;
      artifactType?: string;
      title?: string;
    },
  ) {
    this.requireOrg(auth);
    if (!body.url?.trim()) throw new BadRequestException('url is required');
    return this.artifacts.ingestRemoteUrl({
      organizationId: auth.activeOrganizationId!,
      productId,
      userId: auth.userId,
      url: body.url.trim(),
      purpose: body.purpose,
      artifactType: body.artifactType,
      title: body.title,
    });
  }

  @Post('products/:productId/artifacts/:artifactId/set-primary')
  @RequirePermissions('products:write')
  setPrimaryArtifact(
    @CurrentAuth() auth: AuthContext,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Param('artifactId', ParseUUIDPipe) artifactId: string,
  ) {
    this.requireOrg(auth);
    return this.artifacts.setPrimary(auth.activeOrganizationId!, productId, artifactId);
  }

  @Post('products/:productId/artifacts/:artifactId/analyze')
  @RequirePermissions('products:read')
  analyzeArtifact(
    @CurrentAuth() auth: AuthContext,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Param('artifactId', ParseUUIDPipe) artifactId: string,
  ) {
    this.requireOrg(auth);
    return this.artifacts.analyzeArtifact(
      auth.activeOrganizationId!,
      productId,
      artifactId,
    );
  }

  /** AI product category classification (rules + optional xAI) — proposal only */
  @Post('products/:productId/classify')
  @RequirePermissions('products:read', 'ai:read')
  classifyProduct(
    @CurrentAuth() auth: AuthContext,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() body: { useXai?: boolean },
  ) {
    this.requireOrg(auth);
    return this.artifacts.classifyProduct(auth.activeOrganizationId!, productId, {
      useXai: body?.useXai !== false,
    });
  }

  @Get('products/:productId/artifacts/listing-media-plan')
  @RequirePermissions('products:read')
  listingMediaPlan(
    @CurrentAuth() auth: AuthContext,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    this.requireOrg(auth);
    return this.artifacts.listingMediaPlan(
      auth.activeOrganizationId!,
      productId,
      'fixture_marketplace',
    );
  }

  @Get('products/:productId/artifacts/:artifactId/content')
  @RequirePermissions('products:read')
  async artifactContent(
    @CurrentAuth() auth: AuthContext,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Param('artifactId', ParseUUIDPipe) artifactId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.requireOrg(auth);
    // productId used for auth path clarity; storage is tenant+artifact scoped
    void productId;
    const file = await this.artifacts.readObjectStream(
      auth.activeOrganizationId!,
      artifactId,
    );
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${file.filename.replace(/"/g, '')}"`,
    );
    res.setHeader('Cache-Control', 'private, max-age=300');
    return new StreamableFile(file.body as Buffer);
  }

  @Post('products/:productId/rescore')
  @RequirePermissions('products:write')
  rescore(
    @CurrentAuth() auth: AuthContext,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    this.requireOrg(auth);
    return this.commerce.rescoreProduct(auth.activeOrganizationId!, productId);
  }

  @Post('products/:productId/listing-draft')
  @RequirePermissions('products:write')
  listingDraft(
    @CurrentAuth() auth: AuthContext,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    this.requireOrg(auth);
    return this.commerce.createListingDraft(auth.activeOrganizationId!, auth.userId, productId);
  }

  @Post('products/:productId/simulate')
  @RequirePermissions('ai:write')
  simulate(
    @CurrentAuth() auth: AuthContext,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    this.requireOrg(auth);
    return this.commerce.runSimulation(auth.activeOrganizationId!, auth.userId, productId);
  }

  @Get('approvals')
  @RequirePermissions('orders:read')
  approvals(@CurrentAuth() auth: AuthContext) {
    this.requireOrg(auth);
    return this.commerce.listApprovals(auth.activeOrganizationId!);
  }

  @Post('approvals/:approvalId/decide')
  @RequirePermissions('orders:write')
  decide(
    @CurrentAuth() auth: AuthContext,
    @Param('approvalId', ParseUUIDPipe) approvalId: string,
    @Body() body: { decision?: string },
  ) {
    this.requireOrg(auth);
    const decision = body.decision === 'rejected' ? 'rejected' : 'approved';
    return this.commerce.decideApproval(
      auth.activeOrganizationId!,
      auth.userId,
      approvalId,
      decision,
    );
  }

  @Post('orders/ingest/fixture')
  @RequirePermissions('orders:write')
  ingestOrders(@CurrentAuth() auth: AuthContext) {
    this.requireOrg(auth);
    return this.commerce.ingestFixtureOrders(auth.activeOrganizationId!, auth.userId);
  }

  @Get('orders')
  @RequirePermissions('orders:read')
  orders(@CurrentAuth() auth: AuthContext) {
    this.requireOrg(auth);
    return this.commerce.listOrders(auth.activeOrganizationId!);
  }

  @Get('terminal/pipeline')
  @RequirePermissions('analytics:read')
  pipeline(@CurrentAuth() auth: AuthContext) {
    this.requireOrg(auth);
    return this.commerce.getPipelineStatus(auth.activeOrganizationId!);
  }

  @Post('orders/:orderId/complete-fulfillment')
  @RequirePermissions('orders:write')
  completeFulfillment(
    @CurrentAuth() auth: AuthContext,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    this.requireOrg(auth);
    return this.commerce.completeFulfillment(
      auth.activeOrganizationId!,
      auth.userId,
      orderId,
    );
  }

  @Post('terminal/evaluate')
  @RequirePermissions('ai:write')
  evaluate(@CurrentAuth() auth: AuthContext) {
    this.requireOrg(auth);
    return this.commerce.evaluateAndImprove(auth.activeOrganizationId!, auth.userId);
  }

  /**
   * Local vertical-slice one-shot: sim → listing → approve → orders → fulfill → evaluate.
   */
  @Post('terminal/demo-loop')
  @RequirePermissions('products:write', 'orders:write', 'ai:write')
  demoLoop(@CurrentAuth() auth: AuthContext) {
    this.requireOrg(auth);
    return this.commerce.runDemoLoop(auth.activeOrganizationId!, auth.userId);
  }

  @Get('terminal/prediction-outcomes')
  @RequirePermissions('analytics:read')
  outcomes(@CurrentAuth() auth: AuthContext) {
    this.requireOrg(auth);
    return this.commerce.listPredictionOutcomes(auth.activeOrganizationId!);
  }

  @Get('watchlist')
  @RequirePermissions('products:read')
  watchlist(@CurrentAuth() auth: AuthContext) {
    this.requireOrg(auth);
    return this.commerce.listWatchlist(auth.activeOrganizationId!);
  }

  @Post('watchlist/:productId')
  @RequirePermissions('products:write')
  addWatchlist(
    @CurrentAuth() auth: AuthContext,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() body: { note?: string },
  ) {
    this.requireOrg(auth);
    return this.commerce.addToWatchlist(
      auth.activeOrganizationId!,
      auth.userId,
      productId,
      body?.note,
    );
  }

  @Delete('watchlist/:productId')
  @RequirePermissions('products:write')
  removeWatchlist(
    @CurrentAuth() auth: AuthContext,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    this.requireOrg(auth);
    return this.commerce.removeFromWatchlist(
      auth.activeOrganizationId!,
      productId,
      auth.userId,
    );
  }

  private requireOrg(auth: AuthContext): asserts auth is AuthContext & {
    activeOrganizationId: string;
    tenant: NonNullable<AuthContext['tenant']>;
    membershipId: string;
  } {
    if (!auth.activeOrganizationId || !auth.tenant || !auth.membershipId) {
      throw new BadRequestException('Active organization membership required');
    }
  }
}
