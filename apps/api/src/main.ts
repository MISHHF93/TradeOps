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

  app.enableCors({
    origin: env.WEB_ORIGIN,
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
