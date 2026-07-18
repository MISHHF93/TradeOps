import { Module, forwardRef } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { CommerceModule } from '../commerce/commerce.module';
// IndustrialService exported from CommerceModule
import { IdentityModule } from '../identity/identity.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SaasModule } from '../saas/saas.module';
import { AiController } from './ai.controller';
import { AiChatService } from './ai-chat.service';
import { AiOperatorService } from './ai-operator.service';
import { LiveSearchController } from './live-search.controller';
import { LiveSearchService } from './live-search.service';
import { RagService } from './rag.service';
import { PredictionService } from './prediction.service';
import { EventFabricService } from '../events/event-fabric.service';
import { HarmonizationService } from '../harmonization/harmonization.service';
import { TenantOperationalContextService } from './tenant-operational-context.service';

@Module({
  imports: [
    PrismaModule,
    IdentityModule,
    CommerceModule,
    BillingModule,
    forwardRef(() => SaasModule),
  ],
  controllers: [AiController, LiveSearchController],
  providers: [
    TenantOperationalContextService,
    AiChatService,
    AiOperatorService,
    LiveSearchService,
    RagService,
    PredictionService,
    EventFabricService,
    HarmonizationService,
  ],
  exports: [
    TenantOperationalContextService,
    AiChatService,
    AiOperatorService,
    LiveSearchService,
    RagService,
    PredictionService,
    EventFabricService,
    HarmonizationService,
  ],
})
export class AiModule {}
