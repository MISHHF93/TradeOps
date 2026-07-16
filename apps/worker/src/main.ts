import { loadEnv } from '@tradeops/config';
import { createPrismaClient, checkDatabaseHealth } from '@tradeops/database';
import { createLogger } from '@tradeops/logging';
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';

const PLATFORM_QUEUE = 'tradeops.platform';
const HEARTBEAT_JOB = 'heartbeat';

async function bootstrap(): Promise<void> {
  const env = loadEnv();
  const logger = createLogger({ service: 'worker', level: env.LOG_LEVEL });

  const connection = new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: true,
  });

  try {
    await connection.connect();
    logger.info('Connected to Redis');
  } catch (error) {
    logger.warn(
      { err: error instanceof Error ? error.message : error },
      'Redis unavailable — worker will exit after reporting status',
    );
    process.exitCode = 1;
    return;
  }

  const prisma = createPrismaClient({ databaseUrl: env.DATABASE_URL });
  const dbHealth = await checkDatabaseHealth(prisma);
  if (dbHealth.status === 'down') {
    logger.warn({ message: dbHealth.message }, 'PostgreSQL unhealthy at worker boot');
  } else {
    logger.info({ latencyMs: dbHealth.latencyMs }, 'PostgreSQL reachable');
  }

  const queue = new Queue(PLATFORM_QUEUE, { connection });
  await queue.add(
    HEARTBEAT_JOB,
    { source: 'worker-boot', at: new Date().toISOString() },
    {
      removeOnComplete: 100,
      removeOnFail: 100,
      repeat: { every: 60_000 },
      jobId: 'platform-heartbeat',
    },
  );

  const worker = new Worker(
    PLATFORM_QUEUE,
    async (job) => {
      if (job.name === HEARTBEAT_JOB) {
        const health = await checkDatabaseHealth(prisma);
        logger.info(
          {
            jobId: job.id,
            database: health.status,
            latencyMs: health.latencyMs,
          },
          'Platform heartbeat processed',
        );
        return { ok: true, database: health.status };
      }
      logger.warn({ jobName: job.name }, 'Unknown job name');
      return { ok: false };
    },
    { connection },
  );

  worker.on('failed', (job, error) => {
    logger.error({ jobId: job?.id, err: error.message }, 'Job failed');
  });

  logger.info({ queue: PLATFORM_QUEUE }, 'TradeOps worker online');

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down worker');
    await worker.close();
    await queue.close();
    await prisma.$disconnect().catch(() => undefined);
    connection.disconnect();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

bootstrap().catch((error: unknown) => {
  const logger = createLogger({ service: 'worker', level: 'error' });
  logger.error({ err: error }, 'Worker failed to start');
  process.exit(1);
});
