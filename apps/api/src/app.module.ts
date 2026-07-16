import { Module } from '@nestjs/common';
import { CommerceModule } from './commerce/commerce.module';
import { HealthModule } from './health/health.module';
import { IdentityModule } from './identity/identity.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [PrismaModule, RedisModule, HealthModule, IdentityModule, CommerceModule],
})
export class AppModule {}
