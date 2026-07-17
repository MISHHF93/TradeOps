import { Module, forwardRef } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { CommerceModule } from '../commerce/commerce.module';
// IndustrialService exported from CommerceModule
import { IdentityModule } from '../identity/identity.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SaasModule } from '../saas/saas.module';
import { AiController } from './ai.controller';
import { AiOperatorService } from './ai-operator.service';
import { RagService } from './rag.service';
import { PredictionService } from './prediction.service';
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
  providers: [
    AiOperatorService,
    RagService,
    PredictionService,
    EventFabricService,
    HarmonizationService,
  ],
  exports: [
    AiOperatorService,
    RagService,
    PredictionService,
    EventFabricService,
    HarmonizationService,
  ],
})
export class AiModule {}
