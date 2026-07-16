import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AiController } from './ai.controller';
import { AiOperatorService } from './ai-operator.service';
import { EventFabricService } from '../events/event-fabric.service';
import { HarmonizationService } from '../harmonization/harmonization.service';

@Module({
  imports: [PrismaModule, IdentityModule],
  controllers: [AiController],
  providers: [AiOperatorService, EventFabricService, HarmonizationService],
  exports: [AiOperatorService, EventFabricService, HarmonizationService],
})
export class AiModule {}
