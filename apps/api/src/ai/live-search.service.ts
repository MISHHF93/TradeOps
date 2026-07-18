/**
 * Live search / product projection jobs — SSE event bus (in-memory).
 * Sources: internal catalog + optional public web search. Keys never leave server.
 */

import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import {
  createCatalogAdapter,
  createWebSearchAdapter,
  getLiveProjectionEnv,
  runLiveProjection,
  type LiveProjectionEvent,
  type LiveSourceAdapter,
  type NormalizedLiveItem,
} from '@tradeops/ai-runtime';
import { randomBytes } from 'node:crypto';
import { EventFabricService } from '../events/event-fabric.service';
import { PrismaService } from '../prisma/prisma.service';

type JobState = {
  queryId: string;
  organizationId: string;
  query: string;
  createdAt: string;
  completed: boolean;
  cancelled: boolean;
  events: LiveProjectionEvent[];
  items: NormalizedLiveItem[];
  listeners: Set<(ev: LiveProjectionEvent) => void>;
  abort: AbortController;
};

@Injectable()
export class LiveSearchService {
  private readonly logger = new Logger(LiveSearchService.name);
  private readonly jobs = new Map<string, JobState>();
  private readonly maxJobs = 200;

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventFabricService,
  ) {}

  async startQuery(organizationId: string, query: string): Promise<{ queryId: string }> {
    const cfg = getLiveProjectionEnv();
    if (!cfg.enabled) {
      throw new ServiceUnavailableException('Live projection is disabled (LIVE_PROJECTION_ENABLED=false)');
    }
    const q = query.trim();
    if (!q) {
      throw new ServiceUnavailableException('Query is required');
    }

    this.gc();
    const queryId = `qry_${Date.now().toString(36)}_${randomBytes(4).toString('hex')}`;
    const abort = new AbortController();
    const job: JobState = {
      queryId,
      organizationId,
      query: q,
      createdAt: new Date().toISOString(),
      completed: false,
      cancelled: false,
      events: [],
      items: [],
      listeners: new Set(),
      abort,
    };
    this.jobs.set(queryId, job);

    void this.events
      .ingest({
        organizationId,
        eventType: 'live_search.started',
        providerKey: 'live-projection',
        payload: { queryId, query: q },
      })
      .catch(() => undefined);

    // Fire-and-forget pipeline
    void this.runJob(job, cfg.maxItems, cfg.timeoutMs).catch((e) => {
      this.logger.warn(
        `Live search job ${queryId} failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    });

    return { queryId };
  }

  getJob(queryId: string, organizationId: string): JobState {
    const job = this.jobs.get(queryId);
    if (!job || job.organizationId !== organizationId) {
      throw new NotFoundException('Live search query not found');
    }
    return job;
  }

  results(queryId: string, organizationId: string) {
    const job = this.getJob(queryId, organizationId);
    return {
      queryId: job.queryId,
      query: job.query,
      completed: job.completed,
      cancelled: job.cancelled,
      itemCount: job.items.length,
      items: job.items,
      createdAt: job.createdAt,
    };
  }

  cancel(queryId: string, organizationId: string) {
    const job = this.getJob(queryId, organizationId);
    job.cancelled = true;
    job.abort.abort();
    return { queryId, cancelled: true };
  }

  /**
   * Subscribe to events; immediately replays buffer then live tail until complete.
   */
  subscribe(
    queryId: string,
    organizationId: string,
    onEvent: (ev: LiveProjectionEvent) => void,
  ): () => void {
    const job = this.getJob(queryId, organizationId);
    for (const ev of job.events) onEvent(ev);
    if (job.completed) return () => undefined;
    job.listeners.add(onEvent);
    return () => {
      job.listeners.delete(onEvent);
    };
  }

  private push(job: JobState, ev: LiveProjectionEvent) {
    job.events.push(ev);
    if (ev.type === 'item.projected') {
      // Keep latest projection by id
      const idx = job.items.findIndex((i) => i.id === ev.item.id);
      if (idx >= 0) job.items[idx] = ev.item;
      else job.items.push(ev.item);
    }
    if (ev.type === 'item.reranked') {
      const idx = job.items.findIndex((i) => i.id === ev.item.id);
      if (idx >= 0) job.items[idx] = ev.item;
    }
    for (const l of job.listeners) {
      try {
        l(ev);
      } catch {
        /* ignore listener errors */
      }
    }
  }

  private async runJob(
    job: JobState,
    maxItems: number,
    timeoutMs: number,
  ): Promise<void> {
    const sources: LiveSourceAdapter[] = [];

    // 1) Internal catalog (always — operational truth for org products)
    try {
      const products = await this.prisma.client.product.findMany({
        where: { organizationId: job.organizationId },
        take: 200,
        select: {
          id: true,
          title: true,
          description: true,
          primaryImageUrl: true,
          targetPriceMinor: true,
          currency: true,
          brand: true,
          sourcePlatform: true,
          sourceProvenance: true,
        },
      });
      sources.push(
        createCatalogAdapter(
          products.map((p) => ({
            ...p,
            isFixture:
              /fixture/i.test(p.sourcePlatform ?? '') ||
              /fixture/i.test(p.sourceProvenance ?? ''),
          })),
          { id: 'internal_catalog', label: 'Org catalog' },
        ),
      );
    } catch (e) {
      this.push(job, {
        type: 'source.failed',
        queryId: job.queryId,
        source: 'internal_catalog',
        errorCode: 'catalog_unavailable',
        message: e instanceof Error ? e.message.slice(0, 160) : 'Catalog unavailable',
      });
    }

    // 2) Public web (only when WEB_SEARCH_ENABLED + keys)
    sources.push(createWebSearchAdapter(process.env));

    try {
      for await (const ev of runLiveProjection({
        queryId: job.queryId,
        query: job.query,
        sources,
        maxItems,
        timeoutMs,
        enableRerank: true,
        signal: job.abort.signal,
      })) {
        if (job.cancelled) break;
        this.push(job, ev);
      }
    } catch (e) {
      this.push(job, {
        type: 'query.failed',
        queryId: job.queryId,
        errorCode: 'pipeline_error',
        message: e instanceof Error ? e.message.slice(0, 200) : 'Pipeline failed',
      });
    } finally {
      job.completed = true;
      job.listeners.clear();
      void this.events
        .ingest({
          organizationId: job.organizationId,
          eventType: 'live_search.completed',
          providerKey: 'live-projection',
          payload: {
            queryId: job.queryId,
            query: job.query,
            itemCount: job.items.length,
            cancelled: job.cancelled,
          },
        })
        .catch(() => undefined);
    }
  }

  private gc() {
    if (this.jobs.size < this.maxJobs) return;
    const cutoff = Date.now() - 30 * 60_000;
    for (const [id, job] of this.jobs) {
      if (job.completed && Date.parse(job.createdAt) < cutoff) {
        this.jobs.delete(id);
      }
    }
    // hard cap
    if (this.jobs.size >= this.maxJobs) {
      const oldest = [...this.jobs.entries()].sort(
        (a, b) => Date.parse(a[1].createdAt) - Date.parse(b[1].createdAt),
      )[0];
      if (oldest) this.jobs.delete(oldest[0]);
    }
  }
}
