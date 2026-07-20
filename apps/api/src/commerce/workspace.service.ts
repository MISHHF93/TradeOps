import { ForbiddenException, Injectable } from '@nestjs/common';
import {
  OPERATING_PERSONAS,
  PERSONA_DEFINITIONS,
  listWorkspaceInventory,
  resolveAiNavigation,
  resolveOperatingPersona,
  resolveWorkspace,
  type OperatingPersona,
  type ResolvedWorkspace,
} from '@tradeops/commerce-engine';
import { PrismaService } from '../prisma/prisma.service';
import { CommerceCaseService } from './commerce-case.service';

/**
 * Intelligent Workspace Resolver —
 * Login → persona → live signals → intelligence engine → nav + AI + surface.
 */
@Injectable()
export class WorkspaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cases: CommerceCaseService,
  ) {}

  inventory() {
    return listWorkspaceInventory();
  }

  /**
   * AI-first navigation: natural language → workspace route.
   */
  async navigate(organizationId: string, userId: string, query: string) {
    const membership = await this.prisma.client.membership.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
    });
    const persona = resolveOperatingPersona(membership?.workspacePersona, {
      systemRole: membership?.role,
      founderDirect: process.env.TRADEOPS_ACCESS_MODE === 'founder_direct',
    });
    return resolveAiNavigation(query, persona);
  }

  listPersonas() {
    return OPERATING_PERSONAS.map((id) => ({
      id,
      label: PERSONA_DEFINITIONS[id].label,
      mission: PERSONA_DEFINITIONS[id].mission,
      homeHref: PERSONA_DEFINITIONS[id].homeHref,
    }));
  }

  /**
   * Full intelligence brief for proactive UI / AI (same signals as resolve).
   */
  async intelligence(input: {
    organizationId: string;
    userId: string;
    founderDirect?: boolean;
  }) {
    const ws = await this.resolve(input);
    return {
      persona: ws.persona,
      homeHref: ws.homeHref,
      intelligence: ws.intelligence,
      surface: ws.surface,
      currentObjective: ws.currentObjective,
      recommendedNextAction: ws.recommendedNextAction,
      aiContextPreamble: ws.aiContextPreamble,
    };
  }

  async resolve(input: {
    organizationId: string;
    userId: string;
    founderDirect?: boolean;
  }): Promise<ResolvedWorkspace> {
    const org = await this.prisma.client.organization.findUnique({
      where: { id: input.organizationId },
    });
    const user = await this.prisma.client.user.findUnique({
      where: { id: input.userId },
    });
    const membership = await this.prisma.client.membership.findUnique({
      where: {
        organizationId_userId: {
          organizationId: input.organizationId,
          userId: input.userId,
        },
      },
    });

    const [
      pendingApprovals,
      connectors,
      taskBoard,
      processBoard,
      products,
      openOrders,
      topOpps,
      recentRuns,
      failedRuns,
      signals,
    ] = await Promise.all([
      this.prisma.client.approval.count({
        where: { organizationId: input.organizationId, status: 'pending' },
      }),
      this.prisma.client.connectorInstallation.findMany({
        where: { organizationId: input.organizationId },
        take: 40,
      }),
      this.cases.listTasks(input.organizationId),
      this.cases.listProcess(input.organizationId),
      this.prisma.client.product.findMany({
        where: { organizationId: input.organizationId },
        select: { id: true, sourcePlatform: true },
        take: 200,
      }),
      this.prisma.client.customerOrder.count({
        where: {
          organizationId: input.organizationId,
          status: { in: ['pending', 'paid'] },
        },
      }).catch(() => 0),
      this.prisma.client.opportunity.findMany({
        where: { organizationId: input.organizationId },
        orderBy: { score: 'desc' },
        take: 20,
        select: { score: true },
      }),
      this.prisma.client.operatorRun.count({
        where: { organizationId: input.organizationId },
      }),
      this.prisma.client.operatorRun.count({
        where: { organizationId: input.organizationId, status: 'failed' },
      }),
      this.prisma.client.commerceSignal
        .groupBy({
          by: ['signal'],
          where: { organizationId: input.organizationId },
          _count: true,
        })
        .catch(() => [] as Array<{ signal: string; _count: number }>),
    ]);

    const tasks = taskBoard.tasks ?? [];
    const blockers = taskBoard.blockers ?? [];
    const openCases = processBoard.cases ?? [];

    const connectorIssues = connectors.filter(
      (c) =>
        !String(c.providerKey).startsWith('fixture') &&
        (c.status === 'not_configured' ||
          c.status === 'credentials_required' ||
          String(c.status).includes('expir') ||
          c.status === 'unhealthy'),
    ).length;

    const liveConnectorCount = connectors.filter(
      (c) =>
        !String(c.providerKey).startsWith('fixture') &&
        (c.status === 'connected' || String(c.status).includes('sync')),
    ).length;

    const fixtureProductCount = products.filter((p) =>
      p.sourcePlatform.startsWith('fixture'),
    ).length;
    const liveProductCount = products.length - fixtureProductCount;

    const stalledCaseCount = openCases.filter((c) =>
      /block|wait|fail/i.test(String(c.stageStatus)),
    ).length;

    const highOpportunityCount = topOpps.filter((o) => Number(o.score) >= 60).length;
    const topOpportunityScore =
      topOpps.length > 0 ? Math.round(Number(topOpps[0]!.score)) : null;

    let signalBuyCount = 0;
    let signalBlockedCount = 0;
    if (Array.isArray(signals)) {
      for (const row of signals) {
        const s = String(row.signal).toUpperCase();
        const n = typeof row._count === 'number' ? row._count : 0;
        if (s.includes('BUY') || s.includes('WATCH')) signalBuyCount += n;
        if (s.includes('BLOCK')) signalBlockedCount += n;
      }
    }

    const packOn = (k: string) => {
      const v = process.env[k]?.trim().toLowerCase();
      return v === '1' || v === 'true' || v === 'yes' || v === 'on';
    };

    return resolveWorkspace({
      organizationId: input.organizationId,
      organizationName: org?.name,
      userId: input.userId,
      userEmail: user?.email,
      storedPersona: membership?.workspacePersona ?? null,
      systemRole: membership?.role ?? null,
      founderDirect: input.founderDirect,
      pendingApprovals,
      openTasks: tasks.length,
      openBlockers: blockers.length,
      activeCaseCount: openCases.length,
      connectorIssues,
      packs: {
        industrial: packOn('TRADEOPS_ENABLE_INDUSTRIAL'),
        engLabs: packOn('TRADEOPS_ENABLE_ENG_LABS'),
      },
      availableConnectors: connectors.map((c) => ({
        providerKey: c.providerKey,
        status: String(c.status),
        isFixture: String(c.providerKey).startsWith('fixture'),
      })),
      activeCases: openCases.slice(0, 12).map((c) => ({
        caseId: c.id,
        productId: c.productId,
        productTitle: c.productTitle,
        primaryImageUrl: c.primaryImageUrl ?? null,
        currentStage: c.currentStage,
        stageStatus: c.stageStatus,
        nextActionLabel: c.nextActionLabel,
        nextHref: c.nextHref ?? `/terminal/process/${c.id}`,
        opportunityScore: c.opportunityScore ?? null,
        expectedProfitMinor: c.expectedProfitMinor ?? null,
        currency: c.currency,
        blockerMessage: c.blockerMessage ?? null,
      })),
      intelligence: {
        productCount: products.length,
        fixtureProductCount,
        liveProductCount,
        openOrderCount: typeof openOrders === 'number' ? openOrders : 0,
        stalledCaseCount,
        highOpportunityCount,
        topOpportunityScore,
        liveConnectorCount,
        recentObjectiveCount: recentRuns,
        failedRunCount: failedRuns,
        signalBuyCount,
        signalBlockedCount,
        simulationMode:
          process.env.TRADEOPS_SIMULATION_MODE === '1' ||
          process.env.TRADEOPS_SIMULATION_MODE === 'true',
      },
    });
  }

  async setPersona(
    organizationId: string,
    userId: string,
    persona: string,
  ): Promise<{ workspacePersona: string; operatingPersona: OperatingPersona; homeHref: string }> {
    const membership = await this.prisma.client.membership.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
    });
    if (!membership) throw new ForbiddenException('Not a member');

    const stored = normalizePersona(persona);
    await this.prisma.client.membership.update({
      where: { id: membership.id },
      data: { workspacePersona: stored as never },
    });

    const operating = resolveWorkspace({
      organizationId,
      storedPersona: stored,
      systemRole: membership.role,
    });

    return {
      workspacePersona: stored,
      operatingPersona: operating.persona,
      homeHref: operating.homeHref,
    };
  }
}

function normalizePersona(persona: string): string {
  const p = persona.toLowerCase().trim();
  const allowed = new Set([
    'founder',
    'operator',
    'analyst',
    'procurement',
    'finance',
    'executive',
    'agency',
    'auditor',
    'researcher',
    'developer',
    'administrator',
  ]);
  return allowed.has(p) ? p : 'operator';
}
