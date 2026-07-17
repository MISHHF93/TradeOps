import { Injectable, Optional } from '@nestjs/common';
import {
  buildConnectorHealthCenter,
  buildConnectorRegistryRecords,
  buildIdempotencyKey,
  listLiveFeeds,
  listProductionRuntime,
  LIVE_HTTP_IMPLEMENTED,
  normalizeExternalPayload,
  resolveCapability,
  type BusinessCapability,
  type CapabilityAdvertisement,
  OPS_BUSINESS_EVENTS,
  OPERATIONAL_DOMAINS,
  businessCapabilitiesFromTechnical,
} from '@tradeops/connector-core';
import { EventFabricService } from '../events/event-fabric.service';
import { PrismaService } from '../prisma/prisma.service';
import { recordOpsMetric } from '../observability/telemetry';
import { EcosystemService } from './ecosystem.service';
import type { LiveConnectorService } from './live-connector.service';

const MAX_WEBHOOK_ATTEMPTS = 5;

/**
 * Real-Time Commerce Operations Center — connector registry + health + capability resolve.
 * AI requests capabilities; registry selects vendor implementations.
 */
@Injectable()
export class ConnectorOpsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ecosystem: EcosystemService,
    private readonly events: EventFabricService,
    @Optional() private readonly live?: LiveConnectorService,
  ) {}

  async healthCenter(organizationId: string) {
    const installs = await this.prisma.client.connectorInstallation.findMany({
      where: { organizationId },
    });
    // Overlay env credential status for production connectors not yet installed
    const runtime = listProductionRuntime();
    const installInputs = [
      ...installs.map((i) => ({
        providerKey: i.providerKey,
        status: String(i.status),
        lastHealthAt: i.lastHealthAt,
        lastError: i.lastError,
        isFixture: i.isFixture,
        installationId: i.id,
        capabilitiesJson: i.capabilities,
      })),
      // Synthetic credential status for production keys without install row
      ...runtime
        .filter((r) => !installs.some((i) => i.providerKey === r.id))
        .map((r) => ({
          providerKey: r.id,
          status: r.status,
          lastHealthAt: null as Date | null,
          lastError: r.liveReady
            ? null
            : `Missing: ${r.missingKeys.join(', ')}`,
          isFixture: false as const,
          installationId: undefined as string | undefined,
          capabilitiesJson: r.technicalCapabilities,
        })),
    ];
    const records = buildConnectorRegistryRecords(listLiveFeeds(), installInputs);

    // Enrich domain from production catalog when available
    const domainByKey = new Map(runtime.map((r) => [r.id, r.domain]));
    for (const rec of records) {
      const d = domainByKey.get(rec.providerKey);
      if (d) {
        (rec as { domain: string }).domain = d;
      }
      // Annotate HTTP adapter readiness in notes
      if (LIVE_HTTP_IMPLEMENTED.has(rec.providerKey) && !rec.isFixture) {
        rec.notes = `${rec.notes} | live-http: implemented`;
      }
    }

    const center = buildConnectorHealthCenter(records);
    const dlq = await this.prisma.client.webhookReceipt.count({
      where: { organizationId, processingStatus: 'dead_letter' },
    });
    const pendingWebhooks = await this.prisma.client.webhookReceipt.count({
      where: {
        organizationId,
        processingStatus: { in: ['received', 'failed', 'processing'] },
      },
    });

    // Recent connector-related events for the bus view
    const recentEvents = await this.prisma.client.commerceEvent.findMany({
      where: {
        organizationId,
        OR: [
          { providerKey: { not: null } },
          { eventType: { contains: 'Connector' } },
          { eventType: { startsWith: 'webhook.' } },
          { eventType: { in: [...OPS_BUSINESS_EVENTS] } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });

    const { describeTelemetryConfig } = await import('../observability/telemetry');

    const productionCatalog = this.live?.catalog() ?? {
      connectors: runtime,
      summary: {
        total: runtime.length,
        liveReady: runtime.filter((r) => r.liveReady).length,
        credentialsRequired: runtime.filter((r) => !r.liveReady).length,
        httpImplemented: runtime.filter((r) => LIVE_HTTP_IMPLEMENTED.has(r.id))
          .length,
      },
      honesty: {
        note: 'Production catalog from connector-core; LiveConnectorService optional.',
      },
    };

    return {
      ...center,
      domains: OPERATIONAL_DOMAINS,
      productionCatalog: {
        summary: productionCatalog.summary,
        honesty: productionCatalog.honesty,
        liveReadyIds: productionCatalog.connectors
          .filter((c) => c.liveReady)
          .map((c) => c.id),
      },
      queue: {
        pendingWebhooks,
        deadLetter: dlq,
      },
      eventBus: {
        standardEvents: OPS_BUSINESS_EVENTS,
        recent: recentEvents.map((e) => ({
          id: e.id,
          eventType: e.eventType,
          providerKey: e.providerKey,
          isFixture: e.isFixture,
          createdAt: e.createdAt.toISOString(),
        })),
        note: 'Webhook-first where supported; Postgres-backed queue with retries + DLQ. Reconciliation probes fill gaps. Live HTTP sync for credentialed providers.',
      },
      tracing: describeTelemetryConfig(),
      pipeline: {
        stages: [
          'External API',
          'OAuth / Credentials',
          'Webhook Listener',
          'Polling Scheduler',
          'Queue',
          'Retry Manager',
          'Normalizer',
          'Canonical Models',
          'Knowledge Graph',
          'Commerce Runtime',
          'AI Runtime',
          'Frontend',
        ],
        note: 'Frontend never calls vendor APIs directly.',
      },
    };
  }

  async registry(organizationId: string) {
    const center = await this.healthCenter(organizationId);
    return {
      connectors: center.connectors,
      domains: center.domains,
      summary: center.summary,
      honesty: center.honesty,
    };
  }

  async resolveBusinessCapability(
    organizationId: string,
    capability: string,
  ) {
    const board = await this.ecosystem.capabilityBoard(organizationId);
    const ads = board.advertisements as CapabilityAdvertisement[];
    const cap = capability as BusinessCapability;
    const resolved = resolveCapability(ads, cap, { preferLive: true });

    // If no ads match, fall back to full registry technical→business map
    if (!resolved.selected) {
      const records = buildConnectorRegistryRecords(listLiveFeeds(), []);
      const synthetic: CapabilityAdvertisement[] = records.map((r) => ({
        providerKey: r.providerKey,
        displayName: r.displayName,
        family: r.connectorType,
        isFixture: r.isFixture,
        status: r.healthStatus,
        health: r.online ? 'ok' : 'down',
        businessCapabilities: r.supportedCapabilities,
        technicalCapabilities: r.technicalCapabilities,
        supportedOperations: r.technicalCapabilities,
        authMode: r.authenticationMethod,
        apiVersion: r.apiVersion,
        docsUrl: r.docsUrl,
        notes: r.notes,
      }));
      return {
        ...resolveCapability(synthetic, cap, { preferLive: true }),
        source: 'global_registry',
        honesty: {
          note: 'No org-connected provider matched; registry shows intended vendors. Live call still requires install + auth.',
        },
      };
    }

    recordOpsMetric('capability_resolve');
    return {
      ...resolved,
      source: 'org_capability_board',
      honesty: {
        note: 'AI should request business capabilities only — never vendor REST paths.',
      },
    };
  }

  /**
   * Emit a standardized ops bus event (normalization entry point).
   */
  async emitBusEvent(input: {
    organizationId: string;
    eventType: string;
    providerKey?: string | null;
    payload: Record<string, unknown>;
    isFixture?: boolean;
    externalEventId?: string | null;
  }) {
    return this.events.ingest({
      organizationId: input.organizationId,
      eventType: input.eventType,
      providerKey: input.providerKey ?? 'ops-center',
      externalEventId: input.externalEventId ?? `ops-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      isFixture: input.isFixture,
      payload: {
        ...input.payload,
        normalized: true,
        bus: 'commerce_ops',
      },
    });
  }

  /**
   * Heartbeat health probe for an installed connector (updates lastHealthAt).
   */
  async probe(organizationId: string, providerKey: string) {
    const inst = await this.prisma.client.connectorInstallation.findUnique({
      where: {
        organizationId_providerKey: { organizationId, providerKey },
      },
    });
    if (!inst) {
      return {
        ok: false,
        providerKey,
        note: 'Not installed for this org — register in Connector Hub or use fixture bootstrap.',
      };
    }

    const healthy =
      inst.isFixture ||
      inst.status === 'connected' ||
      String(inst.status).includes('sync');

    const updated = await this.prisma.client.connectorInstallation.update({
      where: { id: inst.id },
      data: {
        lastHealthAt: new Date(),
        lastError: healthy ? null : inst.lastError ?? 'probe: not connected',
      },
    });

    await this.emitBusEvent({
      organizationId,
      eventType: healthy ? 'SyncCompleted' : 'SyncFailed',
      providerKey,
      isFixture: inst.isFixture,
      payload: {
        status: updated.status,
        lastHealthAt: updated.lastHealthAt?.toISOString(),
      },
    });

    recordOpsMetric('connector_probe');
    return {
      ok: healthy,
      providerKey,
      status: updated.status,
      lastHealthAt: updated.lastHealthAt?.toISOString(),
      isFixture: inst.isFixture,
      capabilities: businessCapabilitiesFromTechnical(
        Array.isArray(inst.capabilities) ? (inst.capabilities as string[]) : [],
      ),
    };
  }

  /**
   * Webhook-first ingress: durable receipt (received) → process batch normalizes + bus event.
   */
  async ingestWebhook(input: {
    organizationId: string;
    providerKey: string;
    topic: string;
    body: Record<string, unknown>;
    headers?: Record<string, unknown>;
    signatureValid?: boolean | null;
    isFixture?: boolean;
  }) {
    const isFixture =
      Boolean(input.isFixture) || input.providerKey.startsWith('fixture');
    const idempotencyKey = buildIdempotencyKey(
      input.organizationId,
      input.providerKey,
      input.topic,
      input.body,
    );

    const existing = await this.prisma.client.webhookReceipt.findFirst({
      where: { organizationId: input.organizationId, idempotencyKey },
    });
    if (existing) {
      recordOpsMetric('webhooks_received');
      return {
        created: false,
        duplicate: true,
        receiptId: existing.id,
        processingStatus: existing.processingStatus,
      };
    }

    const receipt = await this.prisma.client.webhookReceipt.create({
      data: {
        organizationId: input.organizationId,
        providerKey: input.providerKey,
        topic: input.topic,
        signatureValid: input.signatureValid ?? null,
        headersJson: (input.headers ?? {}) as object,
        bodyJson: input.body as object,
        processingStatus: 'received',
        attemptCount: 0,
        idempotencyKey,
      },
    });

    // Touch connector last webhook time in metadata when installed
    await this.touchConnectorMeta(input.organizationId, input.providerKey, {
      lastWebhookAt: new Date().toISOString(),
      isFixture,
    });

    recordOpsMetric('webhooks_received');
    return {
      created: true,
      duplicate: false,
      receiptId: receipt.id,
      processingStatus: receipt.processingStatus,
      note: 'Queued. Call POST /ops/webhooks/process to drain (or wait for worker).',
    };
  }

  /** Process due webhook receipts (Postgres queue drain). */
  async processWebhookBatch(organizationId: string, limit = 20) {
    const now = new Date();
    const due = await this.prisma.client.webhookReceipt.findMany({
      where: {
        organizationId,
        OR: [
          { processingStatus: 'received' },
          {
            processingStatus: 'failed',
            nextRetryAt: { lte: now },
          },
        ],
      },
      orderBy: { receivedAt: 'asc' },
      take: Math.min(50, Math.max(1, limit)),
    });

    const results: Array<Record<string, unknown>> = [];
    for (const receipt of due) {
      results.push(await this.processOneReceipt(receipt.id, organizationId));
    }
    return { processed: results.length, results };
  }

  async listDeadLetters(organizationId: string, take = 50) {
    const rows = await this.prisma.client.webhookReceipt.findMany({
      where: { organizationId, processingStatus: 'dead_letter' },
      orderBy: { receivedAt: 'desc' },
      take: Math.min(100, Math.max(1, take)),
    });
    return {
      count: rows.length,
      items: rows.map((r) => ({
        id: r.id,
        providerKey: r.providerKey,
        topic: r.topic,
        attemptCount: r.attemptCount,
        lastError: r.lastError,
        receivedAt: r.receivedAt.toISOString(),
        busEventType: r.busEventType,
      })),
    };
  }

  async reconcileAll(organizationId: string) {
    // Ensure production registry rows exist with honest credential status
    if (this.live) {
      await this.live.ensureRegistryInstalls(organizationId);
    }
    const installs = await this.prisma.client.connectorInstallation.findMany({
      where: { organizationId },
    });
    const probes = [];
    for (const i of installs) {
      probes.push(await this.probe(organizationId, i.providerKey));
    }
    return { probed: probes.length, probes };
  }

  /** Trigger credential-gated live HTTP sync (production path). */
  async syncLive(
    organizationId: string,
    options?: { providerKeys?: string[]; searchQuery?: string },
  ) {
    if (!this.live) {
      return {
        ok: false,
        error: 'LiveConnectorService not registered',
      };
    }
    return this.live.syncLive(organizationId, options);
  }

  private async processOneReceipt(receiptId: string, organizationId: string) {
    const receipt = await this.prisma.client.webhookReceipt.findFirst({
      where: { id: receiptId, organizationId },
    });
    if (!receipt) return { receiptId, ok: false, error: 'not_found' };

    await this.prisma.client.webhookReceipt.update({
      where: { id: receiptId },
      data: {
        processingStatus: 'processing',
        attemptCount: { increment: 1 },
      },
    });

    try {
      const body = (receipt.bodyJson ?? {}) as Record<string, unknown>;
      const isFixture = receipt.providerKey.startsWith('fixture');
      const normalized = normalizeExternalPayload({
        providerKey: receipt.providerKey,
        topic: receipt.topic,
        raw: body,
        isFixture,
      });

      const bus = await this.emitBusEvent({
        organizationId,
        eventType: String(normalized.eventType),
        providerKey: receipt.providerKey,
        isFixture: normalized.isFixture,
        externalEventId: receipt.idempotencyKey,
        payload: {
          topic: receipt.topic,
          canonical: normalized.canonical,
          confidence: normalized.confidence,
          receiptId: receipt.id,
        },
      });

      await this.prisma.client.webhookReceipt.update({
        where: { id: receiptId },
        data: {
          processingStatus: 'processed',
          processedAt: new Date(),
          lastError: null,
          nextRetryAt: null,
          normalizedJson: normalized as object,
          busEventType: String(normalized.eventType),
          commerceEventId: bus.event?.id ?? receipt.commerceEventId,
        },
      });

      return {
        receiptId,
        ok: true,
        eventType: normalized.eventType,
        commerceEventId: bus.event?.id,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const attempts = receipt.attemptCount + 1;
      const dead = attempts >= MAX_WEBHOOK_ATTEMPTS;
      const backoffMs = Math.min(60_000, 1000 * 2 ** Math.min(attempts, 6));
      await this.prisma.client.webhookReceipt.update({
        where: { id: receiptId },
        data: {
          processingStatus: dead ? 'dead_letter' : 'failed',
          lastError: msg.slice(0, 1000),
          nextRetryAt: dead ? null : new Date(Date.now() + backoffMs),
        },
      });
      recordOpsMetric('webhooks_failed');
      return { receiptId, ok: false, error: msg, deadLetter: dead };
    }
  }

  private async touchConnectorMeta(
    organizationId: string,
    providerKey: string,
    patch: Record<string, unknown>,
  ) {
    const inst = await this.prisma.client.connectorInstallation.findUnique({
      where: { organizationId_providerKey: { organizationId, providerKey } },
    });
    if (!inst) return;
    const prev =
      inst.metadataJson && typeof inst.metadataJson === 'object'
        ? (inst.metadataJson as Record<string, unknown>)
        : {};
    await this.prisma.client.connectorInstallation.update({
      where: { id: inst.id },
      data: {
        lastHealthAt: new Date(),
        metadataJson: { ...prev, ...patch } as object,
      },
    });
  }
}
