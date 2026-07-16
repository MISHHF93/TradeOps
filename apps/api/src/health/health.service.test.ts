import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import { HealthService } from './health.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { RedisService } from '../redis/redis.service';

describe('HealthService', () => {
  it('reports degraded when a dependency is down', async () => {
    const prisma = {
      client: {
        $queryRaw: mock.fn(async () => {
          throw new Error('db down');
        }),
      },
    } as unknown as PrismaService;

    const redis = {
      checkHealth: mock.fn(async () => ({
        status: 'up' as const,
        latencyMs: 1,
      })),
    } as unknown as RedisService;

    const service = new HealthService(prisma, redis);
    const health = await service.getHealth();

    assert.equal(health.status, 'degraded');
    assert.equal(health.service, 'tradeops-api');
    assert.equal(health.dependencies.find((d) => d.name === 'postgres')?.status, 'down');
  });

  it('reports up when dependencies are healthy', async () => {
    const prisma = {
      client: {
        $queryRaw: mock.fn(async () => [{ '?column?': 1 }]),
      },
    } as unknown as PrismaService;

    const redis = {
      checkHealth: mock.fn(async () => ({
        status: 'up' as const,
        latencyMs: 2,
      })),
    } as unknown as RedisService;

    const service = new HealthService(prisma, redis);
    const health = await service.getHealth();

    assert.equal(health.status, 'up');
    assert.equal(health.dependencies.length, 2);
  });
});
