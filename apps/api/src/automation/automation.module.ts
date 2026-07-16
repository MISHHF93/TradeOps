import { Module } from '@nestjs/common';
import { EventFabricService } from '../events/event-fabric.service';
import { IdentityModule } from '../identity/identity.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AutomationController } from './automation.controller';
import { GoogleWeekendService } from './google-weekend.service';
import { WorkflowService } from './workflow.service';

@Module({
  imports: [PrismaModule, IdentityModule],
  controllers: [AutomationController],
  providers: [GoogleWeekendService, WorkflowService, EventFabricService],
  exports: [GoogleWeekendService, WorkflowService],
})
export class AutomationModule {}
