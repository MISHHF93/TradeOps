import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { opsLog } from '../observability/telemetry';
import { ConnectorOpsService } from './connector-ops.service';
import { LiveConnectorService } from './live-connector.service';

/**
 * Automatic refresh loop:
 * - Drain webhook queue (webhook-first path)
 * - Periodically probe installed connectors (scheduled sync)
 * - Live HTTP sync for credentialed production adapters
 *
 * Production-safe: no fabricated metrics; fixtures only update fixture installs.
 * Disable with TRADEOPS_OPS_SYNC_DISABLED=1
 */
@Injectable()
export class OpsSyncScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OpsSyncScheduler.name);
  private webhookTimer: ReturnType<typeof setInterval> | null = null;
  private probeTimer: ReturnType<typeof setInterval> | null = null;
  private liveSyncTimer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ops: ConnectorOpsService,
    @Optional() private readonly live?: LiveConnectorService,
  ) {}

  onModuleInit(): void {
    if (process.env.TRADEOPS_OPS_SYNC_DISABLED === '1') {
      this.logger.log('Ops sync scheduler disabled (TRADEOPS_OPS_SYNC_DISABLED=1)');
      return;
    }

    const webhookMs = Number(process.env.TRADEOPS_WEBHOOK_DRAIN_MS ?? 15_000);
    const probeMs = Number(process.env.TRADEOPS_CONNECTOR_PROBE_MS ?? 300_000);
    const liveSyncMs = Number(process.env.TRADEOPS_LIVE_SYNC_MS ?? 900_000);

    this.webhookTimer = setInterval(() => {
      void this.safeRun('webhook-drain', () => this.drainAllOrgsWebhooks());
    }, Math.max(5_000, webhookMs));

    this.probeTimer = setInterval(() => {
      void this.safeRun('connector-probe', () => this.probeAllOrgs());
    }, Math.max(60_000, probeMs));

    this.liveSyncTimer = setInterval(() => {
      void this.safeRun('live-http-sync', () => this.liveSyncAllOrgs());
    }, Math.max(120_000, liveSyncMs));

    // Kick once shortly after boot
    setTimeout(() => {
      void this.safeRun('webhook-drain-boot', () => this.drainAllOrgsWebhooks());
    }, 8_000);

    setTimeout(() => {
      void this.safeRun('live-http-sync-boot', () => this.liveSyncAllOrgs());
    }, 25_000);

    this.logger.log(
      `Ops sync armed: webhook drain every ${Math.max(5_000, webhookMs)}ms, connector probe every ${Math.max(60_000, probeMs)}ms, live HTTP every ${Math.max(120_000, liveSyncMs)}ms`,
    );
  }

  onModuleDestroy(): void {
    if (this.webhookTimer) clearInterval(this.webhookTimer);
    if (this.probeTimer) clearInterval(this.probeTimer);
    if (this.liveSyncTimer) clearInterval(this.liveSyncTimer);
  }

  private async safeRun(name: string, fn: () => Promise<void>) {
    if (this.running) return;
    this.running = true;
    try {
      await fn();
    } catch (e) {
      this.logger.warn(
        `${name} failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      this.running = false;
    }
  }

  private async drainAllOrgsWebhooks() {
    let pending: Array<{ organizationId: string }> = [];
    try {
      pending = await this.prisma.client.webhookReceipt.findMany({
        where: {
          processingStatus: { in: ['received', 'failed'] },
        },
        select: { organizationId: true },
        distinct: ['organizationId'],
        take: 50,
      });
    } catch (e) {
      // Migration 20260717200000 not applied yet — skip quietly
      this.logger.debug(
        `webhook drain skipped: ${e instanceof Error ? e.message : String(e)}`,
      );
      return;
    }

    for (const row of pending) {
      const result = await this.ops.processWebhookBatch(row.organizationId, 25);
      if (result.processed > 0) {
        opsLog('webhook drain', {
          organizationId: row.organizationId,
          eventType: `processed=${result.processed}`,
        });
      }
    }
  }

  private async probeAllOrgs() {
    const orgs = await this.prisma.client.organization.findMany({
      select: { id: true },
      take: 30,
      orderBy: { updatedAt: 'desc' },
    });
    for (const org of orgs) {
      await this.ops.reconcileAll(org.id);
    }
  }

  /**
   * Credential-gated live HTTP — only orgs with non-fixture installs that are
   * live-ready or recently connected. Per-provider cooldown from lastLiveSyncAt
   * respects rateLimitRpm / TRADEOPS_LIVE_SYNC_PROVIDER_COOLDOWN_MS.
   */
  private async liveSyncAllOrgs() {
    if (!this.live) return;
    if (process.env.TRADEOPS_LIVE_SYNC_DISABLED === '1') return;

    const cooldownMs = Number(
      process.env.TRADEOPS_LIVE_SYNC_PROVIDER_COOLDOWN_MS ?? 300_000,
    );
    const now = Date.now();

    // Prefer orgs that already have production connector installs
    let orgIds: string[] = [];
    try {
      const installs = await this.prisma.client.connectorInstallation.findMany({
        where: {
          isFixture: false,
          status: { in: ['connected', 'credentials_required', 'unhealthy'] },
        },
        select: { organizationId: true },
        distinct: ['organizationId'],
        take: 25,
        orderBy: { updatedAt: 'desc' },
      });
      orgIds = installs.map((i) => i.organizationId);
    } catch {
      orgIds = [];
    }

    if (orgIds.length === 0) {
      const orgs = await this.prisma.client.organization.findMany({
        select: { id: true },
        take: 5,
        orderBy: { updatedAt: 'desc' },
      });
      orgIds = orgs.map((o) => o.id);
    }

    for (const organizationId of orgIds.slice(0, 10)) {
      // Collect providers that are not in cooldown
      let providerKeys: string[] | undefined;
      try {
        const installs = await this.prisma.client.connectorInstallation.findMany({
          where: { organizationId, isFixture: false },
          select: { providerKey: true, metadataJson: true, status: true },
        });
        const due = installs.filter((inst) => {
          const meta =
            inst.metadataJson && typeof inst.metadataJson === 'object'
              ? (inst.metadataJson as Record<string, unknown>)
              : {};
          const last = meta.lastLiveSyncAt;
          if (typeof last === 'string') {
            const age = now - new Date(last).getTime();
            if (Number.isFinite(age) && age < Math.max(60_000, cooldownMs)) {
              return false;
            }
          }
          return true;
        });
        providerKeys = due.map((d) => d.providerKey);
        if (providerKeys.length === 0) {
          continue;
        }
      } catch {
        providerKeys = undefined;
      }

      const result = await this.live.syncLive(organizationId, {
        providerKeys,
      });
      const ok = result.results.filter((r) => r.ok).length;
      const skipped = result.results.filter((r) => r.skipped).length;
      if (ok > 0 || skipped > 0) {
        opsLog('live http sync', {
          organizationId,
          eventType: `ok=${ok},skipped=${skipped}`,
        });
      }
    }
  }
}
