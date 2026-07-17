import { Module, forwardRef } from '@nestjs/common';
import { EventFabricService } from '../events/event-fabric.service';
import { IdentityModule } from '../identity/identity.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SaasModule } from '../saas/saas.module';
import { AutomationController } from './automation.controller';
import { GoogleWeekendService } from './google-weekend.service';
import { WorkflowService } from './workflow.service';

@Module({
  imports: [PrismaModule, IdentityModule, forwardRef(() => SaasModule)],
  controllers: [AutomationController],
  providers: [GoogleWeekendService, WorkflowService, EventFabricService],
  exports: [GoogleWeekendService, WorkflowService],
})
export class AutomationModule {}
