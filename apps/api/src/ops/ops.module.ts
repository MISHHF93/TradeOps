import { Module } from '@nestjs/common';
import { CommerceModule } from '../commerce/commerce.module';
import { HealthModule } from '../health/health.module';
import { IdentityModule } from '../identity/identity.module';
import { PrismaModule } from '../prisma/prisma.module';
import { OpsCommandController } from './ops-command.controller';
import { OpsCommandService } from './ops-command.service';

@Module({
  imports: [PrismaModule, IdentityModule, HealthModule, CommerceModule],
  controllers: [OpsCommandController],
  providers: [OpsCommandService],
  exports: [OpsCommandService],
})
export class OpsModule {}
