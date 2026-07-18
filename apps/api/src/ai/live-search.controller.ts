import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Res,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Response } from 'express';
import { getLiveProjectionEnv } from '@tradeops/ai-runtime';
import { CurrentAuth, RequirePermissions } from '../identity/decorators';
import { requireOrgId } from '../identity/require-tenant';
import type { AuthContext } from '../identity/types';
import { LiveSearchService } from './live-search.service';

/**
 * Live product projection — POST query, SSE event stream.
 * Secrets never leave the server; UI only receives normalized items.
 */
@Controller('live-search')
export class LiveSearchController {
  constructor(private readonly live: LiveSearchService) {}

  @Post()
  @RequirePermissions('ai:read', 'products:read')
  async start(
    @CurrentAuth() auth: AuthContext,
    @Body() body: { query?: string; q?: string },
  ) {
    const orgId = requireOrgId(auth);
    const query = (body.query ?? body.q ?? '').trim();
    return this.live.startQuery(orgId, query);
  }

  @Get(':queryId/results')
  @RequirePermissions('ai:read', 'products:read')
  results(@CurrentAuth() auth: AuthContext, @Param('queryId') queryId: string) {
    return this.live.results(queryId, requireOrgId(auth));
  }

  @Post(':queryId/cancel')
  @RequirePermissions('ai:read', 'products:read')
  cancel(@CurrentAuth() auth: AuthContext, @Param('queryId') queryId: string) {
    return this.live.cancel(queryId, requireOrgId(auth));
  }

  /**
   * Server-Sent Events stream of LiveProjectionEvent JSON objects.
   * Client: new EventSource('/api/v1/live-search/:id/events') with cookies.
   */
  @Get(':queryId/events')
  @RequirePermissions('ai:read', 'products:read')
  streamEvents(
    @CurrentAuth() auth: AuthContext,
    @Param('queryId') queryId: string,
    @Res() res: Response,
  ): void {
    const cfg = getLiveProjectionEnv();
    if (!cfg.enabled) {
      throw new ServiceUnavailableException('Live projection disabled');
    }
    const orgId = requireOrgId(auth);
    // Validate job exists before opening stream
    this.live.getJob(queryId, orgId);

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof (res as Response & { flushHeaders?: () => void }).flushHeaders === 'function') {
      (res as Response & { flushHeaders: () => void }).flushHeaders();
    }

    const write = (ev: unknown) => {
      res.write(`data: ${JSON.stringify(ev)}\n\n`);
    };

    write({ type: 'sse.open', queryId, transport: 'sse' });

    const unsub = this.live.subscribe(queryId, orgId, (ev) => {
      write(ev);
      if (ev.type === 'query.completed' || ev.type === 'query.failed') {
        res.write('event: close\ndata: {}\n\n');
        res.end();
      }
    });

    // Heartbeat keeps proxies from closing idle streams
    const heartbeat = setInterval(() => {
      try {
        res.write(`: ping ${Date.now()}\n\n`);
      } catch {
        clearInterval(heartbeat);
      }
    }, 15_000);

    const cleanup = () => {
      clearInterval(heartbeat);
      unsub();
    };

    res.on('close', cleanup);
    reqOnClose(res, cleanup);
  }
}

function reqOnClose(res: Response, fn: () => void) {
  const req = res.req;
  if (req) {
    req.on('close', fn);
  }
}
