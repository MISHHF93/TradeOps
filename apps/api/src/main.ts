import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { loadEnv } from '@tradeops/config';
import { createLogger } from '@tradeops/logging';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const env = loadEnv();
  const logger = createLogger({ service: 'api', level: env.LOG_LEVEL });

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
    // Required for Stripe webhook signature verification
    rawBody: true,
  });

  app.use(cookieParser());

  // Local Windows: users open either localhost or 127.0.0.1 for the web app.
  // A single WEB_ORIGIN string breaks the other host (CORS + credentialed AI calls).
  const webPort = (() => {
    try {
      return new URL(env.WEB_ORIGIN).port || '3000';
    } catch {
      return '3000';
    }
  })();
  const allowedOrigins = new Set(
    [
      env.WEB_ORIGIN,
      `http://localhost:${webPort}`,
      `http://127.0.0.1:${webPort}`,
    ].filter(Boolean),
  );

  app.enableCors({
    origin: (origin, callback) => {
      // Non-browser tools (no Origin header) and allowlisted web hosts.
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
  });

  app.setGlobalPrefix('api/v1');

  await app.listen(env.API_PORT, env.API_HOST);
  logger.info(
    { host: env.API_HOST, port: env.API_PORT, env: env.NODE_ENV },
    'TradeOps API listening',
  );
}

bootstrap().catch((error: unknown) => {
  const logger = createLogger({ service: 'api', level: 'error' });
  logger.error({ err: error }, 'API failed to start');
  process.exit(1);
});
