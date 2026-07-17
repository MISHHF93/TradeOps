import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { PrismaModule } from '../prisma/prisma.module';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { CommercePaymentService } from './commerce-payment.service';

@Module({
  imports: [PrismaModule, IdentityModule],
  controllers: [BillingController],
  providers: [BillingService, CommercePaymentService],
  exports: [BillingService, CommercePaymentService],
})
export class BillingModule {}
