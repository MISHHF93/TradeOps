import { Injectable, Logger } from '@nestjs/common';
import type { OperationLoopMode } from '@tradeops/ai-runtime';
import { PrismaService } from '../prisma/prisma.service';

function asJson(value: unknown): object {
  return value as object;
}

/**
 * Live event fabric — persist webhooks/polls/internal events with honest loop mode labels.
 */
@Injectable()
export class EventFabricService {
  private readonly logger = new Logger(EventFabricService.name);

  constructor(private readonly prisma: PrismaService) {}

  async ingest(input: {
    organizationId: string;
    eventType: string;
    providerKey?: string | null;
    externalEventId?: string | null;
    loopMode?: OperationLoopMode;
    isFixture?: boolean;
    payload: Record<string, unknown>;
  }) {
    try {
      if (input.providerKey && input.externalEventId) {
        const existing = await this.prisma.client.commerceEvent.findFirst({
          where: {
            organizationId: input.organizationId,
            providerKey: input.providerKey,
            externalEventId: input.externalEventId,
          },
        });
        if (existing) {
          return { created: false, event: existing };
        }
      }

      const event = await this.prisma.client.commerceEvent.create({
        data: {
          organizationId: input.organizationId,
          eventType: input.eventType,
          providerKey: input.providerKey ?? null,
          externalEventId: input.externalEventId ?? null,
          loopMode: input.loopMode ?? 'development',
          isFixture: Boolean(input.isFixture),
          payloadJson: asJson(input.payload),
          processedAt: new Date(),
        },
      });
      return { created: true, event };
    } catch (error) {
      this.logger.warn(
        `Event ingest failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  async recordWebhook(input: {
    organizationId: string;
    providerKey: string;
    topic: string;
    body: Record<string, unknown>;
    headers?: Record<string, unknown>;
    signatureValid?: boolean | null;
    loopMode?: OperationLoopMode;
    isFixture?: boolean;
  }) {
    const ingested = await this.ingest({
      organizationId: input.organizationId,
      eventType: `webhook.${input.providerKey}.${input.topic}`,
      providerKey: input.providerKey,
      externalEventId:
        typeof input.body.id === 'string'
          ? input.body.id
          : typeof input.body.event_id === 'string'
            ? input.body.event_id
            : null,
      loopMode: input.loopMode ?? 'development',
      isFixture: input.isFixture,
      payload: input.body,
    });

    const receipt = await this.prisma.client.webhookReceipt.create({
      data: {
        organizationId: input.organizationId,
        providerKey: input.providerKey,
        topic: input.topic,
        signatureValid: input.signatureValid ?? null,
        headersJson: asJson(input.headers ?? {}),
        bodyJson: asJson(input.body),
        commerceEventId: ingested.event.id,
      },
    });

    return { receipt, commerceEvent: ingested.event, created: ingested.created };
  }

  async listRecent(organizationId: string, take = 50) {
    return this.prisma.client.commerceEvent.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  async recordConnectorHealth(input: {
    organizationId: string;
    providerKey: string;
    status: string;
    message?: string;
    latencyMs?: number;
    isFixture?: boolean;
    details?: Record<string, unknown>;
  }) {
    return this.prisma.client.connectorHealthEvent.create({
      data: {
        organizationId: input.organizationId,
        providerKey: input.providerKey,
        status: input.status,
        message: input.message ?? null,
        latencyMs: input.latencyMs ?? null,
        isFixture: Boolean(input.isFixture),
        detailsJson: asJson(input.details ?? {}),
      },
    });
  }
}
