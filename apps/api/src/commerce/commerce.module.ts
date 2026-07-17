import { Module, forwardRef } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { EventFabricService } from '../events/event-fabric.service';
import { IdentityModule } from '../identity/identity.module';
import { ArtifactService } from './artifact.service';
import { CommerceCaseService } from './commerce-case.service';
import { CommerceController } from './commerce.controller';
import { CommerceRuntimeService } from './commerce-runtime.service';
import { CommerceService } from './commerce.service';
import { ConnectorOpsService } from './connector-ops.service';
import { EcosystemService } from './ecosystem.service';
import { LiveConnectorService } from './live-connector.service';
import { OpsSyncScheduler } from './ops-sync.scheduler';
import { WorkspaceService } from './workspace.service';
import { IndustrialService } from './industrial.service';
import { IndustrialController } from './industrial.controller';

@Module({
  imports: [IdentityModule, forwardRef(() => BillingModule)],
  controllers: [CommerceController, IndustrialController],
  providers: [
    CommerceService,
    ArtifactService,
    CommerceCaseService,
    EcosystemService,
    WorkspaceService,
    CommerceRuntimeService,
    LiveConnectorService,
    ConnectorOpsService,
    EventFabricService,
    OpsSyncScheduler,
    IndustrialService,
  ],
  exports: [
    CommerceService,
    ArtifactService,
    CommerceCaseService,
    EcosystemService,
    WorkspaceService,
    CommerceRuntimeService,
    LiveConnectorService,
    ConnectorOpsService,
    IndustrialService,
  ],
})
export class CommerceModule {}
