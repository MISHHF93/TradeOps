import { Module } from '@nestjs/common';
import { AiModule } from './ai/ai.module';
import { AutomationModule } from './automation/automation.module';
import { CommerceModule } from './commerce/commerce.module';
import { HealthModule } from './health/health.module';
import { IdentityModule } from './identity/identity.module';
import { PrismaModule } from './prisma/prisma.module';
import { PublicModule } from './public/public.module';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    HealthModule,
    IdentityModule,
    CommerceModule,
    AutomationModule,
    PublicModule,
    AiModule,
  ],
})
export class AppModule {}
