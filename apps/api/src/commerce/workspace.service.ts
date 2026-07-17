import { ForbiddenException, Injectable } from '@nestjs/common';
import {
  OPERATING_PERSONAS,
  PERSONA_DEFINITIONS,
  listWorkspaceInventory,
  resolveWorkspace,
  type OperatingPersona,
  type ResolvedWorkspace,
} from '@tradeops/commerce-engine';
import { PrismaService } from '../prisma/prisma.service';
import { CommerceCaseService } from './commerce-case.service';

/**
 * Workspace Resolver — loads org state and assembles persona workspace.
 * Same backend services for all personas; presentation/nav/AI context change.
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

  listPersonas() {
    return OPERATING_PERSONAS.map((id) => ({
      id,
      label: PERSONA_DEFINITIONS[id].label,
      mission: PERSONA_DEFINITIONS[id].mission,
      homeHref: PERSONA_DEFINITIONS[id].homeHref,
    }));
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

    const [pendingApprovals, connectors, taskBoard, processBoard] = await Promise.all([
      this.prisma.client.approval.count({
        where: { organizationId: input.organizationId, status: 'pending' },
      }),
      this.prisma.client.connectorInstallation.findMany({
        where: { organizationId: input.organizationId },
        take: 40,
      }),
      this.cases.listTasks(input.organizationId),
      this.cases.listProcess(input.organizationId),
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
      availableConnectors: connectors.map((c) => ({
        providerKey: c.providerKey,
        status: String(c.status),
        isFixture: String(c.providerKey).startsWith('fixture'),
      })),
      activeCases: openCases.slice(0, 12).map((c) => ({
        caseId: c.id,
        productId: c.productId,
        productTitle: c.productTitle,
        currentStage: c.currentStage,
        stageStatus: c.stageStatus,
        nextActionLabel: c.nextActionLabel,
      })),
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
