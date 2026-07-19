import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { loadEnv } from '@tradeops/config';
import Redis from 'ioredis';

export type RedisHealthResult = {
  status: 'up' | 'down';
  latencyMs: number;
  message?: string;
};

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

  async connect(): Promise<void> {
    if (this.client.status === 'wait') {
      await this.client.connect();
    }
  }

  async checkHealth(): Promise<RedisHealthResult> {
    const started = performance.now();
    const timeoutMs = 1500;
    try {
      const result = await Promise.race([
        (async (): Promise<RedisHealthResult> => {
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
        })(),
        new Promise<RedisHealthResult>((resolve) => {
          setTimeout(() => {
            resolve({
              status: 'down',
              latencyMs: timeoutMs,
              message: `Redis health timed out after ${timeoutMs}ms (optional for AI operator)`,
            });
          }, timeoutMs);
        }),
      ]);
      return result;
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
