import { Module, forwardRef } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { IdentityModule } from '../identity/identity.module';
import { ArtifactService } from './artifact.service';
import { CommerceCaseService } from './commerce-case.service';
import { CommerceController } from './commerce.controller';
import { CommerceService } from './commerce.service';
import { EcosystemService } from './ecosystem.service';
import { WorkspaceService } from './workspace.service';

@Module({
  imports: [IdentityModule, forwardRef(() => BillingModule)],
  controllers: [CommerceController],
  providers: [
    CommerceService,
    ArtifactService,
    CommerceCaseService,
    EcosystemService,
    WorkspaceService,
  ],
  exports: [
    CommerceService,
    ArtifactService,
    CommerceCaseService,
    EcosystemService,
    WorkspaceService,
  ],
})
export class CommerceModule {}
