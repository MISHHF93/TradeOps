/**
 * Operations Command Center — single aggregation surface for COS health.
 * Composes existing fabrics; does not invent parallel monitoring systems.
 */

import { Injectable } from '@nestjs/common';
import {
  aiPlatformPublicStatus,
  environmentManifestPublicStatus,
  getAiPlatformConfig,
  isAiRuntimeConfigured,
} from '@tradeops/config';
import { architecturePublicStatus, OPS_COMMAND_CENTER } from '@tradeops/domain';
import { getLiveProjectionEnv, agentCatalogPublic } from '@tradeops/ai-runtime';
import { EventFabricService } from '../events/event-fabric.service';
import { HealthService } from '../health/health.service';
import { ConnectorOpsService } from '../commerce/connector-ops.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OpsCommandService {
  constructor(
    private readonly health: HealthService,
    private readonly events: EventFabricService,
    private readonly connectorOps: ConnectorOpsService,
    private readonly prisma: PrismaService,
  ) {}

  async getCommandCenter(organizationId: string) {
    const [platformHealth, envHealth, recentEvents, connectorHealth, openTasks, pendingApprovals] =
      await Promise.all([
        this.health.getHealth(),
        Promise.resolve(this.health.getEnvironmentHealth()),
        this.events.listRecent(organizationId, 25),
        this.connectorOps.healthCenter(organizationId).catch(() => null),
        this.prisma.client.commerceCase
          .count({
            where: {
              organizationId,
              stageStatus: { in: ['blocked', 'waiting', 'in_progress'] },
            },
          })
          .catch(() => 0),
        this.prisma.client.approval
          .count({ where: { organizationId, status: 'pending' } })
          .catch(() => 0),
      ]);

    const live = getLiveProjectionEnv();
    const aiCfg = getAiPlatformConfig();
    const architecture = architecturePublicStatus();

    return {
      title: 'Operations Command Center',
      principles: OPS_COMMAND_CENTER.principles,
      links: OPS_COMMAND_CENTER.ui,
      architecture: {
        layers: architecture.layers,
        modules: architecture.modules.length,
        dataFabricEntities: architecture.dataFabricEntities,
        eventTypes: architecture.eventTypes,
      },
      platform: {
        status: platformHealth.status,
        service: platformHealth.service,
        uptimeSeconds: platformHealth.uptimeSeconds,
        dependencies: platformHealth.dependencies,
      },
      environment: envHealth,
      ai: {
        ...aiPlatformPublicStatus(),
        runtimeConfigured: isAiRuntimeConfigured(),
        agents: agentCatalogPublic(),
        searchEnabled: aiCfg.webSearchEnabled,
        cohereConfigured: aiCfg.cohereConfigured,
      },
      liveProjection: {
        enabled: live.enabled,
        transport: live.transport,
        maxItems: live.maxItems,
        timeoutMs: live.timeoutMs,
        ui: '/terminal',
        api: {
          start: 'POST /api/v1/live-search',
          events: 'GET /api/v1/live-search/:queryId/events',
        },
      },
      connectors: connectorHealth
        ? {
            summary: connectorHealth.summary,
            domainCount: connectorHealth.byDomain?.length ?? 0,
            honesty: connectorHealth.honesty,
          }
        : { summary: null, note: 'Connector health unavailable' },
      events: {
        recent: recentEvents.map((e) => ({
          id: e.id,
          eventType: e.eventType,
          providerKey: e.providerKey,
          isFixture: e.isFixture,
          createdAt: e.createdAt,
          loopMode: e.loopMode,
        })),
        count: recentEvents.length,
        stream: 'GET /api/v1/ops/events/stream',
      },
      workload: {
        openCases: openTasks,
        pendingApprovals,
      },
      queues: {
        redis:
          platformHealth.dependencies.find((d) => d.name === 'redis')?.status ?? 'unknown',
        note: 'BullMQ worker requires Redis; API continues when redis is down.',
      },
      checkedAt: new Date().toISOString(),
      note: 'Command center composes existing fabrics — no parallel monitoring stack.',
    };
  }
}
