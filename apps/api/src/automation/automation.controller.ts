import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CurrentAuth, Public, RequirePermissions } from '../identity/decorators';
import type { AuthContext } from '../identity/types';
import { GoogleWeekendService } from './google-weekend.service';
import { WorkflowService } from './workflow.service';

@Controller('automation')
export class AutomationController {
  constructor(
    private readonly googleWeekend: GoogleWeekendService,
    private readonly workflows: WorkflowService,
  ) {}

  /** Public machine-readable live-feed registry (no secrets). */
  @Public()
  @Get('feeds')
  listFeeds() {
    return {
      feeds: this.googleWeekend.listFeedRegistry(),
      note: 'Registry entries describe official APIs. Live use requires authorization; fixture feeds are labeled.',
    };
  }

  @Get('workflows/templates')
  @RequirePermissions('automation:read')
  listWorkflowTemplates(@CurrentAuth() _auth: AuthContext) {
    return this.workflows.listTemplates();
  }

  @Post('workflows/run')
  @RequirePermissions('automation:write')
  runWorkflow(
    @CurrentAuth() auth: AuthContext,
    @Body()
    body: {
      templateKey?: string;
      variables?: Record<string, unknown>;
      dryRun?: boolean;
    },
  ) {
    if (!auth.activeOrganizationId) {
      return { error: 'Active organization required' };
    }
    return this.workflows.runTemplate({
      organizationId: auth.activeOrganizationId,
      userId: auth.userId,
      templateKey: body.templateKey ?? 'product_opportunity_discovery',
      variables: body.variables,
      dryRun: body.dryRun !== false,
    });
  }

  @Get('google/weekend/status')
  @RequirePermissions('connectors:read')
  googleWeekendStatus(@CurrentAuth() _auth: AuthContext) {
    return this.googleWeekend.getStatus();
  }

  @Post('google/weekend/prepare')
  @RequirePermissions('connectors:write', 'products:read')
  prepareGoogleWeekend(
    @CurrentAuth() auth: AuthContext,
    @Query('forceShadow') forceShadow?: string,
  ) {
    return this.googleWeekend.prepareWeekendFeed({
      forceShadow: forceShadow === '1' || forceShadow === 'true',
      organizationId: auth.activeOrganizationId ?? undefined,
      userId: auth.userId,
    });
  }
}
