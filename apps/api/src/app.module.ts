import { Module } from '@nestjs/common';
import { AiModule } from './ai/ai.module';
import { AutomationModule } from './automation/automation.module';
import { BillingModule } from './billing/billing.module';
import { CapitalModule } from './capital/capital.module';
import { CommerceModule } from './commerce/commerce.module';
import { HealthModule } from './health/health.module';
import { IdentityModule } from './identity/identity.module';
import { OpsModule } from './ops/ops.module';
import { PrismaModule } from './prisma/prisma.module';
import { PublicModule } from './public/public.module';
import { RedisModule } from './redis/redis.module';
import { SaasModule } from './saas/saas.module';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    HealthModule,
    IdentityModule,
    CommerceModule,
    BillingModule,
    CapitalModule,
    AutomationModule,
    PublicModule,
    AiModule,
    SaasModule,
    OpsModule,
  ],
})
export class AppModule {}

