import { loadEnv } from '@tradeops/config';
import {
  GOOGLE_MERCHANT_PROVIDER_KEY,
  GoogleMerchantConnector,
  isWeekendLocal,
  nextWeekendMorning,
} from '@tradeops/connector-google-merchant';
import { createPrismaClient, checkDatabaseHealth } from '@tradeops/database';
import { createLogger } from '@tradeops/logging';
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';

const PLATFORM_QUEUE = 'tradeops.platform';
const HEARTBEAT_JOB = 'heartbeat';
const GOOGLE_WEEKEND_JOB = 'google-weekend-feed';

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
      'Redis unavailable — worker weekend Google job will not be queue-scheduled (API in-process scheduler still runs)',
    );
    process.exitCode = 0;
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

  // Weekend Google Merchant feed: Saturday and Sunday 09:00 UTC-ish via cron.
  // Shadow by default inside job handler when credentials are missing.
  await queue.add(
    GOOGLE_WEEKEND_JOB,
    { source: 'worker-schedule', next: nextWeekendMorning().toISOString() },
    {
      removeOnComplete: 50,
      removeOnFail: 50,
      repeat: { pattern: '0 9 * * 6,0' },
      jobId: 'google-weekend-feed',
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

      if (job.name === GOOGLE_WEEKEND_JOB) {
        logger.info(
          { jobId: job.id, isWeekend: isWeekendLocal(), next: nextWeekendMorning().toISOString() },
          'Google weekend feed job started',
        );
        const accessToken = process.env.GOOGLE_MERCHANT_ACCESS_TOKEN?.trim();
        const merchantId = process.env.GOOGLE_MERCHANT_ID?.trim();
        const connector = new GoogleMerchantConnector(
          accessToken || merchantId ? { accessToken, merchantId } : null,
        );

        const org =
          (await prisma.organization.findFirst({ where: { slug: 'demo-commerce' } })) ??
          (await prisma.organization.findFirst({ orderBy: { createdAt: 'asc' } }));

        if (!org) {
          logger.warn('No organization for weekend Google feed');
          return { ok: false, reason: 'organization_missing' };
        }

        const products = await prisma.product.findMany({
          where: { organizationId: org.id },
          take: 100,
          orderBy: { updatedAt: 'desc' },
        });

        const result = await connector.prepareWeekendFeed(
          products.map((p) => ({
            externalId: p.externalId,
            title: p.title,
            description: p.description,
            targetPriceMinor: p.targetPriceMinor,
            currency: p.currency,
            inventoryQuantity: p.inventoryQuantity,
            sourcePlatform: p.sourcePlatform,
            dataConfidence: p.dataConfidence,
            dataFreshnessAt: p.dataFreshnessAt,
            isFixtureSource: p.sourcePlatform.startsWith('fixture'),
          })),
        );

        logger.info(
          {
            jobId: job.id,
            provider: GOOGLE_MERCHANT_PROVIDER_KEY,
            mode: result.mode,
            prepared: result.preparedCount,
            posted: result.postedCount,
            live: result.livePostSucceeded,
            status: result.status,
          },
          'Google weekend feed job finished',
        );
        return result;
      }

      logger.warn({ jobName: job.name }, 'Unknown job name');
      return { ok: false };
    },
    { connection },
  );

  worker.on('failed', (job, error) => {
    logger.error({ jobId: job?.id, err: error.message }, 'Job failed');
  });

  logger.info(
    { queue: PLATFORM_QUEUE, nextGoogleWeekend: nextWeekendMorning().toISOString() },
    'TradeOps worker online (heartbeat + weekend Google feed schedule)',
  );

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
