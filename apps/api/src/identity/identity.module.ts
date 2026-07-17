import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuditService } from './audit.service';
import { AuthRateLimitService } from './auth-rate-limit.service';
import { AuthController } from './auth.controller';
import { AuthGuard, PermissionsGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { FounderAccessService } from './founder-access.service';
import { OrgsController } from './orgs.controller';
import { OrgsService } from './orgs.service';
import { SessionService } from './session.service';

@Module({
  controllers: [AuthController, OrgsController],
  providers: [
    AuthService,
    AuthRateLimitService,
    OrgsService,
    SessionService,
    AuditService,
    FounderAccessService,
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
  ],
  exports: [SessionService, AuditService, AuthService, OrgsService, FounderAccessService],
})
export class IdentityModule {}
