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
import { SearchService } from './search.service';
import { WorkspaceService } from './workspace.service';
import { DiagnosticsController } from '../ops/diagnostics.controller';
import { DiagnosticsService } from '../ops/diagnostics.service';
import { RedisModule } from '../redis/redis.module';
import { LifecyclePathService } from './lifecycle-path.service';

@Module({
  imports: [IdentityModule, RedisModule, forwardRef(() => BillingModule)],
  controllers: [CommerceController, DiagnosticsController],
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
    SearchService,
    DiagnosticsService,
    LifecyclePathService,
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
    SearchService,
    DiagnosticsService,
    LifecyclePathService,
  ],
})
export class CommerceModule {}
