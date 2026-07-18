import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import {
  assertProductionEnv,
  assertSecurityBoot,
  loadEnv,
  publicAccessWarning,
} from '@tradeops/config';
import { createLogger } from '@tradeops/logging';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';

async function bootstrap(): Promise<void> {
  // Refuse insecure public binds with founder_direct / weak secrets
  assertSecurityBoot(process.env);
  // Production: require active AI provider key (COHERE_API_KEY when AI_PROVIDER=cohere)
  assertProductionEnv(process.env);

  // Fail fast if code-owned prompts/schemas/tools are missing (not Cohere Playground)
  const { assertProductionAiAssetsPresent } = await import('@tradeops/ai-runtime');
  assertProductionAiAssetsPresent();

  const env = loadEnv();
  const logger = createLogger({ service: 'api', level: env.LOG_LEVEL });

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
    // Required for Stripe webhook signature verification
    rawBody: true,
  });

  app.useGlobalFilters(new AllExceptionsFilter());
  app.use(cookieParser());

  // Strict CORS: only the configured web origin (not *)
  app.enableCors({
    origin: env.WEB_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
  });

  app.setGlobalPrefix('api/v1');

  await app.listen(env.API_PORT, env.API_HOST);
  logger.info(
    { host: env.API_HOST, port: env.API_PORT, env: env.NODE_ENV },
    'TradeOps API listening',
  );
  const warn = publicAccessWarning(env);
  if (warn) {
    logger.warn(warn);
  }
  if (env.API_HOST === '0.0.0.0' || env.API_HOST === '::') {
    logger.warn(
      'API is bound to all interfaces. Ensure firewall + reverse proxy TLS; prefer API_HOST=127.0.0.1 for local work.',
    );
  }
}

bootstrap().catch((error: unknown) => {
  const logger = createLogger({ service: 'api', level: 'error' });
  logger.error({ err: error }, 'API failed to start');
  process.exit(1);
});
