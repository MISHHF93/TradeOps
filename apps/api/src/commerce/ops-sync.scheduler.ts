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

  /** Credential-gated live HTTP — only runs when env secrets exist. */
  private async liveSyncAllOrgs() {
    if (!this.live) return;
    if (process.env.TRADEOPS_LIVE_SYNC_DISABLED === '1') return;

    const orgs = await this.prisma.client.organization.findMany({
      select: { id: true },
      take: 10,
      orderBy: { updatedAt: 'desc' },
    });
    for (const org of orgs) {
      const result = await this.live.syncLive(org.id);
      const ok = result.results.filter((r) => r.ok).length;
      if (ok > 0) {
        opsLog('live http sync', {
          organizationId: org.id,
          eventType: `ok=${ok}`,
        });
      }
    }
  }
}
