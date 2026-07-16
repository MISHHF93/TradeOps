import { Injectable } from '@nestjs/common';
import type { DependencyHealth, HealthResponse } from '@tradeops/contracts';
import { checkDatabaseHealth } from '@tradeops/database';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

const SERVICE_NAME = 'tradeops-api';
const SERVICE_VERSION = '0.1.0';
const startedAt = Date.now();

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getHealth(): Promise<HealthResponse> {
    const [database, redis] = await Promise.all([
      checkDatabaseHealth(this.prisma.client),
      this.redis.checkHealth(),
    ]);

    const dependencies: DependencyHealth[] = [
      {
        name: 'postgres',
        status: database.status,
        latencyMs: database.latencyMs,
        ...(database.message ? { message: database.message } : {}),
      },
      {
        name: 'redis',
        status: redis.status,
        latencyMs: redis.latencyMs,
        ...(redis.message ? { message: redis.message } : {}),
      },
    ];

    const anyDown = dependencies.some((dep) => dep.status === 'down');
    const status = anyDown ? 'degraded' : 'up';

    return {
      status,
      service: SERVICE_NAME,
      version: SERVICE_VERSION,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
      dependencies,
    };
  }

  getLiveness(): { status: 'up'; service: string } {
    return { status: 'up', service: SERVICE_NAME };
  }
}
