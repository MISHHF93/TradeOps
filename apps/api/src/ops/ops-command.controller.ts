import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentAuth, RequirePermissions } from '../identity/decorators';
import { requireOrgId } from '../identity/require-tenant';
import type { AuthContext } from '../identity/types';
import { EventFabricService } from '../events/event-fabric.service';
import { OpsCommandService } from './ops-command.service';

/**
 * Operations Command Center + Event Fabric read APIs.
 * Single place for COS operational visibility.
 */
@Controller('ops')
export class OpsCommandController {
  constructor(
    private readonly command: OpsCommandService,
    private readonly events: EventFabricService,
  ) {}

  /** Full ops command center snapshot (no secrets). */
  @Get('command-center')
  @RequirePermissions('connectors:read')
  commandCenter(@CurrentAuth() auth: AuthContext) {
    return this.command.getCommandCenter(requireOrgId(auth));
  }

  /** Durable event list (tenant-scoped, newest first). */
  @Get('events')
  @RequirePermissions('connectors:read')
  async listEvents(
    @CurrentAuth() auth: AuthContext,
    @Query('take') take?: string,
  ) {
    const n = Math.min(Math.max(Number(take) || 50, 1), 200);
    const rows = await this.events.listRecent(requireOrgId(auth), n);
    return {
      events: rows.map((e) => ({
        id: e.id,
        eventType: e.eventType,
        providerKey: e.providerKey,
        externalEventId: e.externalEventId,
        loopMode: e.loopMode,
        isFixture: e.isFixture,
        createdAt: e.createdAt,
        processedAt: e.processedAt,
      })),
      take: n,
    };
  }

  /**
   * Lightweight SSE tail of recent durable events (snapshot + poll).
   * True push fan-out from all writers can follow; this unifies the OC stream contract.
   */
  @Get('events/stream')
  @RequirePermissions('connectors:read')
  async streamEvents(
    @CurrentAuth() auth: AuthContext,
    @Res() res: Response,
  ): Promise<void> {
    const organizationId = requireOrgId(auth);
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const write = (data: unknown) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    write({ type: 'ops.stream.open', organizationId, transport: 'sse' });

    let lastSeen = '';
    const tick = async () => {
      try {
        const rows = await this.events.listRecent(organizationId, 15);
        for (const e of [...rows].reverse()) {
          if (e.id === lastSeen) continue;
          // only emit newer than lastSeen using createdAt order
          write({
            type: 'ops.event',
            id: e.id,
            eventType: e.eventType,
            providerKey: e.providerKey,
            isFixture: e.isFixture,
            createdAt: e.createdAt,
            loopMode: e.loopMode,
            source: e.providerKey ?? 'platform',
            dataMode: e.isFixture ? 'fixture' : 'live',
            timestamp: e.createdAt,
          });
        }
        if (rows[0]) lastSeen = rows[0].id;
      } catch {
        write({ type: 'ops.stream.error', message: 'event poll failed' });
      }
    };

    await tick();
    const interval = setInterval(() => {
      void tick();
    }, 4000);

    const heartbeat = setInterval(() => {
      try {
        res.write(`: ping ${Date.now()}\n\n`);
      } catch {
        clearInterval(interval);
        clearInterval(heartbeat);
      }
    }, 15000);

    const cleanup = () => {
      clearInterval(interval);
      clearInterval(heartbeat);
    };
    res.on('close', cleanup);
    res.req?.on('close', cleanup);
  }
}
