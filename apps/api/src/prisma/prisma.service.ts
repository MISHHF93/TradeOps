import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { loadEnv } from '@tradeops/config';
import {
  checkDatabaseHealth,
  createPrismaClient,
  type PrismaClient,
} from '@tradeops/database';
import { createLogger } from '@tradeops/logging';

const logger = createLogger({ service: 'api-prisma' });

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  readonly client: PrismaClient;
  private reconnecting: Promise<boolean> | null = null;

  constructor() {
    const env = loadEnv();
    this.client = createPrismaClient({ databaseUrl: env.DATABASE_URL });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.client.$connect();
      logger.info('Connected to PostgreSQL');
    } catch (error) {
      // Boot must succeed without Postgres so local tooling and liveness still work.
      // Readiness is reported via /api/v1/health.
      logger.warn(
        { err: error instanceof Error ? error.message : error },
        'PostgreSQL unavailable at boot — health will report degraded',
      );
    }
  }

  /**
   * Soft reconnect when PGlite restarts underneath a long-lived Nest process.
   * Coalesces concurrent callers so we don't thrash $connect.
   */
  async ensureConnected(): Promise<boolean> {
    if (this.reconnecting) return this.reconnecting;
    this.reconnecting = (async () => {
      try {
        const health = await checkDatabaseHealth(this.client);
        if (health.status === 'up') {
          if (health.message?.includes('reconnected')) {
            logger.info('PostgreSQL reconnected after connection drop');
          }
          return true;
        }
        logger.warn({ msg: health.message }, 'PostgreSQL still down after reconnect attempt');
        return false;
      } finally {
        this.reconnecting = null;
      }
    })();
    return this.reconnecting;
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect().catch(() => undefined);
  }
}
