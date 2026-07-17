import { Module, forwardRef } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { CommerceModule } from '../commerce/commerce.module';
import { IdentityModule } from '../identity/identity.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SaasModule } from '../saas/saas.module';
import { AiController } from './ai.controller';
import { AiOperatorService } from './ai-operator.service';
import { EventFabricService } from '../events/event-fabric.service';
import { HarmonizationService } from '../harmonization/harmonization.service';

@Module({
  imports: [
    PrismaModule,
    IdentityModule,
    CommerceModule,
    BillingModule,
    forwardRef(() => SaasModule),
  ],
  controllers: [AiController],
  providers: [AiOperatorService, EventFabricService, HarmonizationService],
  exports: [AiOperatorService, EventFabricService, HarmonizationService],
})
export class AiModule {}
