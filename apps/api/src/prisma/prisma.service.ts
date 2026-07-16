import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { loadEnv } from '@tradeops/config';
import { createPrismaClient, type PrismaClient } from '@tradeops/database';
import { createLogger } from '@tradeops/logging';

const logger = createLogger({ service: 'api-prisma' });

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  readonly client: PrismaClient;

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

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect().catch(() => undefined);
  }
}
