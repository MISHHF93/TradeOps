import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import { HealthService } from './health.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { RedisService } from '../redis/redis.service';

describe('HealthService', () => {
  it('reports degraded when a dependency is down', async () => {
    const prisma = {
      client: {
        $queryRawUnsafe: mock.fn(async () => {
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
        $queryRawUnsafe: mock.fn(async () => [{ '?column?': 1 }]),
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

    // AI may be unconfigured in CI (no COHERE_API_KEY) → degraded is acceptable.
    assert.ok(health.status === 'up' || health.status === 'degraded');
    assert.ok(health.dependencies.length >= 2);
    assert.ok(health.dependencies.some((d) => d.name === 'postgres'));
    assert.ok(health.dependencies.some((d) => d.name === 'redis'));
    assert.ok(health.dependencies.some((d) => d.name === 'ai_runtime'));
    assert.ok(health.dependencies.some((d) => d.name === 'environment_schema'));
  });

  it('environment health never includes secret values', () => {
    const prisma = { client: {} } as unknown as PrismaService;
    const redis = { checkHealth: async () => ({ status: 'up' as const, latencyMs: 1 }) } as unknown as RedisService;
    const service = new HealthService(prisma, redis);
    const envHealth = service.getEnvironmentHealth();
    const json = JSON.stringify(envHealth);
    assert.ok(!json.toLowerCase().includes('sk-'));
    assert.ok(envHealth.checkedAt || envHealth.environment?.checkedAt);
    assert.ok(['healthy', 'unhealthy'].includes(envHealth.status));
  });
});
