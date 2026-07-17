import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import {
  TRANSFORMATION_CAPABILITIES,
  buildRuntimeSnapshot,
  planRuntimeExecution,
  summarizeOrgExecution,
  type CapabilityProvider,
  type CommerceRuntimeSnapshot,
  type RuntimeProcess,
} from '@tradeops/commerce-engine';
import { EventFabricService } from '../events/event-fabric.service';
import { PrismaService } from '../prisma/prisma.service';
import { CommerceCaseService } from './commerce-case.service';
import { EcosystemService } from './ecosystem.service';
import { WorkspaceService } from './workspace.service';

/**
 * Commerce Runtime — single execution surface for TradeOps.
 *
 * User, AI, automation, and connector-driven actions should enter here.
 * Orchestrates: case state, transformations, events, capabilities, persona context.
 */
@Injectable()
export class CommerceRuntimeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cases: CommerceCaseService,
    private readonly workspace: WorkspaceService,
    private readonly ecosystem: EcosystemService,
    private readonly events: EventFabricService,
  ) {}

  /**
   * Org-level runtime: "What process is currently executing?"
   */
  async getOrgRuntime(input: {
    organizationId: string;
    userId: string;
    founderDirect?: boolean;
  }) {
    const [ws, board, stateBoard, pendingApprovals, openAiRuns, connectors] =
      await Promise.all([
        this.workspace.resolve({
          organizationId: input.organizationId,
          userId: input.userId,
          founderDirect: input.founderDirect,
        }),
        this.cases.listProcess(input.organizationId),
        this.cases.resolveOrgStates(input.organizationId, {
          persona: undefined,
        }),
        this.prisma.client.approval.count({
          where: { organizationId: input.organizationId, status: 'pending' },
        }),
        this.prisma.client.operatorRun.count({
          where: {
            organizationId: input.organizationId,
            status: {
              in: [
                'planning',
                'collecting',
                'recommending',
                'executing',
                'awaiting_approval',
              ],
            },
          },
        }),
        this.loadCapabilities(input.organizationId),
      ]);

    const top = stateBoard.cases[0];
    const summary = summarizeOrgExecution({
      organizationId: input.organizationId,
      openCases: board.summary.totalOpen,
      blockedCases: board.summary.blocked,
      pendingApprovals,
      avgFriction: stateBoard.summary.avgFriction,
      topCase: top
        ? {
            caseId: top.caseId,
            title: top.productTitle,
            stage: top.currentState,
            next: top.recommendedTransformation?.code ?? null,
          }
        : null,
      persona: ws.persona,
    });

    let focused: CommerceRuntimeSnapshot | null = null;
    if (top) {
      focused = await this.getCaseRuntime({
        organizationId: input.organizationId,
        userId: input.userId,
        caseId: top.caseId,
        founderDirect: input.founderDirect,
      });
    } else {
      focused = buildRuntimeSnapshot({
        organizationId: input.organizationId,
        persona: ws.persona,
        founderDirect: input.founderDirect,
        caseState: null,
        connectors,
        pendingApprovals,
        openAiRuns,
      });
    }

    return {
      answer: summary.answer,
      metrics: summary.metrics,
      activeProcess: focused.activeProcess ?? summary.activeProcess,
      concurrentProcesses: focused.concurrentProcesses,
      persona: ws.persona,
      personaLabel: ws.personaLabel,
      homeHref: ws.homeHref,
      recommendation: focused.recommendation,
      friction: focused.friction,
      executionReadiness: focused.executionReadiness,
      availableCapabilities: connectors,
      missingCapabilities: focused.missingCapabilities,
      priorityCases: stateBoard.cases.slice(0, 8).map((c) => ({
        caseId: c.caseId,
        productTitle: c.productTitle,
        currentState: c.currentState,
        friction: c.operationalFriction,
        readiness: c.executionReadiness,
        next: c.recommendedTransformation?.code ?? null,
        nextLabel: c.recommendedTransformation?.label ?? null,
        href: `/terminal/process/${c.caseId}`,
      })),
      processBoardHref: '/terminal/process',
      tasksHref: '/terminal/tasks',
      aiPreamble: focused.aiPreamble,
      transformationCatalog: focused.transformationCatalog,
      dependencyNotes: focused.dependencyNotes,
      knowledgeGraph: await this.safeKnowledgeGraph(input.organizationId),
      computedAt: new Date().toISOString(),
      honesty: {
        note: 'All business execution should enter Commerce Runtime. Fixture connectors never count as live marketplaces.',
      },
    };
  }

  async getCaseRuntime(input: {
    organizationId: string;
    userId: string;
    caseId: string;
    founderDirect?: boolean;
  }): Promise<CommerceRuntimeSnapshot> {
    const [caseState, ws, connectors, pendingApprovals] = await Promise.all([
      this.cases.resolveState(input.organizationId, input.caseId, {
        persona: undefined,
      }),
      this.workspace.resolve({
        organizationId: input.organizationId,
        userId: input.userId,
        founderDirect: input.founderDirect,
      }),
      this.loadCapabilities(input.organizationId),
      this.prisma.client.approval.count({
        where: { organizationId: input.organizationId, status: 'pending' },
      }),
    ]);

    // Re-resolve with persona for ranking boost
    const withPersona = await this.cases.resolveState(input.organizationId, input.caseId, {
      persona: ws.persona,
    });

    return buildRuntimeSnapshot({
      organizationId: input.organizationId,
      persona: ws.persona,
      founderDirect: input.founderDirect,
      caseState: withPersona,
      connectors,
      pendingApprovals,
    });
  }

  /**
   * Execute a transformation — the only write path for case progress.
   */
  async execute(input: {
    organizationId: string;
    userId: string;
    caseId: string;
    transformation: string;
    source?: 'user' | 'ai' | 'automation' | 'connector' | 'system';
    founderDirect?: boolean;
  }) {
    const before = await this.cases.resolveState(input.organizationId, input.caseId);
    const plan = planRuntimeExecution({
      transformation: input.transformation,
      caseState: before,
    });
    if (!plan.ok) {
      await this.events.ingest({
        organizationId: input.organizationId,
        eventType: 'TransformationRejected',
        providerKey: 'commerce-runtime',
        externalEventId: `reject-${input.caseId}-${Date.now()}`,
        isFixture: false,
        payload: {
          caseId: input.caseId,
          transformation: input.transformation,
          reason: plan.reason,
          source: input.source ?? 'user',
        },
      });
      throw new BadRequestException(plan.reason ?? 'Transformation rejected by runtime');
    }

    const result = await this.cases.applyTransformation(
      input.organizationId,
      input.caseId,
      plan.transformation,
      input.userId,
    );

    await this.events.ingest({
      organizationId: input.organizationId,
      eventType: plan.eventType,
      providerKey: 'commerce-runtime',
      externalEventId: `tx-${input.caseId}-${plan.transformation}-${Date.now()}`,
      isFixture: false,
      payload: {
        caseId: input.caseId,
        productId: before.productId,
        transformation: plan.transformation,
        fromState: before.currentState,
        toState: result.state.currentState,
        frictionBefore: before.operationalFriction,
        frictionAfter: result.state.operationalFriction,
        frictionDelta: result.frictionDelta,
        advanced: result.advanced,
        source: input.source ?? 'user',
        requiredCapabilities: plan.requiredCapabilities,
      },
    });

    if (
      result.state.operationalFriction < before.operationalFriction
    ) {
      await this.events.ingest({
        organizationId: input.organizationId,
        eventType: 'FrictionReduced',
        providerKey: 'commerce-runtime',
        externalEventId: `friction-${input.caseId}-${Date.now()}`,
        payload: {
          caseId: input.caseId,
          before: before.operationalFriction,
          after: result.state.operationalFriction,
          delta: result.frictionDelta,
        },
      });
    }

    const snapshot = await this.getCaseRuntime({
      organizationId: input.organizationId,
      userId: input.userId,
      caseId: input.caseId,
      founderDirect: input.founderDirect,
    });

    return {
      ok: true,
      applied: plan.transformation,
      eventType: plan.eventType,
      advanced: result.advanced,
      frictionDelta: result.frictionDelta,
      state: result.state,
      runtime: snapshot,
      process: snapshot.activeProcess,
    };
  }

  async listEvents(organizationId: string, take = 50) {
    const events = await this.prisma.client.commerceEvent.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(100, Math.max(1, take)),
    });
    return {
      events: events.map((e) => ({
        id: e.id,
        eventType: e.eventType,
        providerKey: e.providerKey,
        isFixture: e.isFixture,
        loopMode: e.loopMode,
        payload: e.payloadJson,
        createdAt: e.createdAt.toISOString(),
      })),
      honesty: {
        note: 'Event stream is the historical record for runtime transformations and connector ingest.',
      },
    };
  }

  async listCapabilities(organizationId: string) {
    const caps = await this.loadCapabilities(organizationId);
    return {
      providers: caps,
      transformCapabilityMap: TRANSFORMATION_CAPABILITIES,
      note: 'AI and Runtime reason over capabilities, not vendor REST paths.',
    };
  }

  /** AI entry: snapshot + preamble for a case or org */
  async getAiContext(input: {
    organizationId: string;
    userId: string;
    caseId?: string | null;
    founderDirect?: boolean;
  }) {
    if (input.caseId) {
      const snap = await this.getCaseRuntime({
        organizationId: input.organizationId,
        userId: input.userId,
        caseId: input.caseId,
        founderDirect: input.founderDirect,
      });
      return {
        runtime: snap,
        contextPreamble: snap.aiPreamble,
        recommendation: snap.recommendation,
        activeProcess: snap.activeProcess,
      };
    }
    const org = await this.getOrgRuntime(input);
    return {
      runtime: org,
      contextPreamble: org.aiPreamble,
      recommendation: org.recommendation,
      activeProcess: org.activeProcess,
    };
  }

  private async loadCapabilities(organizationId: string): Promise<CapabilityProvider[]> {
    try {
      const board = await this.ecosystem.capabilityBoard(organizationId);
      if (Array.isArray(board.advertisements) && board.advertisements.length) {
        return board.advertisements.map((a) => ({
          providerKey: a.providerKey,
          displayName: a.displayName,
          isFixture: a.isFixture,
          status: String(a.status),
          capabilities: (a.businessCapabilities ?? []).map(String),
        }));
      }
    } catch {
      /* fall through */
    }

    const rows = await this.prisma.client.connectorInstallation.findMany({
      where: { organizationId },
      take: 40,
    });
    return rows.map((c) => ({
      providerKey: c.providerKey,
      displayName: c.providerKey,
      isFixture: c.providerKey.startsWith('fixture'),
      status: String(c.status),
      capabilities: c.providerKey.startsWith('fixture')
        ? ['discover_products', 'compare_suppliers', 'prepare_listing', 'read_orders']
        : [],
    }));
  }

  private async safeKnowledgeGraph(organizationId: string) {
    try {
      return await this.ecosystem.knowledgeGraph(organizationId);
    } catch {
      return {
        nodes: [],
        edges: [],
        note: 'Knowledge graph projection unavailable',
      };
    }
  }
}
