import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { loadEnv } from '@tradeops/config';
import { tenantCacheKey } from '@tradeops/domain';
import Redis from 'ioredis';

export type RedisHealthResult = {
  status: 'up' | 'down';
  latencyMs: number;
  message?: string;
};

/**
 * Redis access — all cache keys for tenant data MUST use tenantCacheKey / tenantGet/Set.
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client: Redis;

  constructor() {
    const env = loadEnv();
    this.client = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
      lazyConnect: true,
      // Do not spin reconnect forever when Redis is intentionally offline (local first-run).
      retryStrategy: (times) => (times > 2 ? null : 200),
      reconnectOnError: () => false,
      showFriendlyErrorStack: false,
    });

    // Prevent Node "Unhandled error event" spam when Redis is down.
    this.client.on('error', () => {
      /* health endpoint reports degraded */
    });
  }

  /** Tenant-isolated cache get */
  async tenantGet(
    organizationId: string,
    namespace: string,
    ...parts: string[]
  ): Promise<string | null> {
    try {
      await this.connect();
      return await this.client.get(tenantCacheKey(organizationId, namespace, ...parts));
    } catch {
      return null;
    }
  }

  /** Tenant-isolated cache set with optional TTL seconds */
  async tenantSet(
    organizationId: string,
    namespace: string,
    value: string,
    ttlSeconds?: number,
    ...parts: string[]
  ): Promise<boolean> {
    try {
      await this.connect();
      const key = tenantCacheKey(organizationId, namespace, ...parts);
      if (ttlSeconds && ttlSeconds > 0) {
        await this.client.set(key, value, 'EX', ttlSeconds);
      } else {
        await this.client.set(key, value);
      }
      return true;
    } catch {
      return false;
    }
  }

  async tenantDel(organizationId: string, namespace: string, ...parts: string[]): Promise<void> {
    try {
      await this.connect();
      await this.client.del(tenantCacheKey(organizationId, namespace, ...parts));
    } catch {
      /* ignore */
    }
  }

  async connect(): Promise<void> {
    if (this.client.status === 'wait') {
      await this.client.connect();
    }
  }

  async checkHealth(): Promise<RedisHealthResult> {
    const started = performance.now();
    try {
      await this.connect();
      const pong = await this.client.ping();
      if (pong !== 'PONG') {
        return {
          status: 'down',
          latencyMs: Math.round(performance.now() - started),
          message: `Unexpected PING response: ${pong}`,
        };
      }
      return {
        status: 'up',
        latencyMs: Math.round(performance.now() - started),
      };
    } catch (error) {
      // Reset for a clean next health attempt
      try {
        this.client.disconnect();
      } catch {
        /* ignore */
      }
      return {
        status: 'down',
        latencyMs: Math.round(performance.now() - started),
        message: error instanceof Error ? error.message : 'Unknown Redis error',
      };
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client.status !== 'end') {
      await this.client.quit().catch(() => this.client.disconnect());
    }
  }
}
