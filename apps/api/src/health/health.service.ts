import { Injectable } from '@nestjs/common';
import type { DependencyHealth, HealthResponse } from '@tradeops/contracts';
import {
  aiPlatformPublicStatus,
  environmentManifestPublicStatus,
  envValidationPublicStatus,
  isAiRuntimeConfigured,
} from '@tradeops/config';
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
    // Bound total health work so a stuck Redis/DB never hangs load balancers / UI probes.
    const withTimeout = <T>(p: Promise<T>, ms: number, fallback: T): Promise<T> =>
      Promise.race([
        p,
        new Promise<T>((resolve) => {
          setTimeout(() => resolve(fallback), ms);
        }),
      ]);

    // ensureConnected soft-reconnects after PGlite blips before the health probe.
    await withTimeout(this.prisma.ensureConnected(), 2500, false);

    const [database, redis] = await Promise.all([
      withTimeout(
        checkDatabaseHealth(this.prisma.client),
        3000,
        { status: 'down' as const, latencyMs: 3000, message: 'Database health timeout' },
      ),
      withTimeout(
        this.redis.checkHealth(),
        2000,
        { status: 'down' as const, latencyMs: 2000, message: 'Redis health timeout' },
      ),
    ]);

    const envStatus = envValidationPublicStatus();
    const ai = aiPlatformPublicStatus();
    const aiConfigured = isAiRuntimeConfigured();

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
        message:
          redis.status === 'up'
            ? redis.message
            : `${redis.message ?? 'unavailable'} (optional locally — queues/cache only; API continues)`,
      },
      {
        name: 'ai_runtime',
        status: aiConfigured ? 'up' : 'down',
        message: aiConfigured
          ? `provider=${ai.aiProvider} configured`
          : `provider=${ai.aiProvider} missing credentials (set server-side key; never public)`,
      },
      {
        name: 'environment_schema',
        status: envStatus.ok ? 'up' : 'down',
        message: envStatus.ok
          ? 'schema ok'
          : `${envStatus.errorCount} validation error(s) — see GET /api/v1/health/environment`,
      },
    ];

    // Redis is optional for founder/local — do not degrade overall health when only redis is down.
    // Postgres down or AI missing still degrades. Operators read redis line for queue readiness.
    const criticalDown = dependencies.some(
      (dep) => dep.status === 'down' && dep.name !== 'redis',
    );
    const status = criticalDown ? 'degraded' : 'up';

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

  /**
   * Environment + provider matrix for operators.
   * Never includes secret values — only configured / missing / disabled statuses.
   */
  getEnvironmentHealth() {
    const envStatus = envValidationPublicStatus();
    const manifest = environmentManifestPublicStatus();
    const ai = aiPlatformPublicStatus();
    return {
      status: envStatus.ok ? 'healthy' : 'unhealthy',
      checkedAt: envStatus.checkedAt,
      environment: envStatus,
      ai: {
        provider: ai.aiProvider,
        runtimeConfigured: ai.runtimeConfigured,
        cohereConfigured: ai.cohereConfigured,
        openaiConfigured: ai.openaiConfigured,
        xaiConfigured: ai.xaiConfigured,
        tavilyConfigured: ai.tavilyConfigured,
        search: ai.search,
        responseContract: ai.responseContract,
      },
      manifest: {
        total: manifest.totalManifest,
        configured: manifest.configured,
        missingRequiredProduction: manifest.missingRequiredProduction,
        ai: manifest.ai,
      },
      note: 'Secret values are never returned. Rotate any key that was exposed in chat.',
    };
  }
}
