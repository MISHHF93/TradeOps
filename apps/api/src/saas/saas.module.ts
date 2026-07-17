import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { IdentityModule } from '../identity/identity.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SaasController } from './saas.controller';
import { SaasService } from './saas.service';

@Module({
  imports: [PrismaModule, IdentityModule, BillingModule],
  controllers: [SaasController],
  providers: [SaasService],
  exports: [SaasService],
})
export class SaasModule {}
