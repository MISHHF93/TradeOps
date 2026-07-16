import { Injectable, NotFoundException } from '@nestjs/common';
import {
  describeTemplate,
  listWorkflowTemplates,
  runWorkflowTemplate,
} from '@tradeops/workflow-engine';
import { AuditService } from '../identity/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventFabricService } from '../events/event-fabric.service';

@Injectable()
export class WorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: EventFabricService,
  ) {}

  listTemplates() {
    return {
      templates: listWorkflowTemplates().map(describeTemplate),
      note: 'Templates are versioned. Consequential steps remain approval-controlled or credential-blocked.',
    };
  }

  async runTemplate(input: {
    organizationId: string;
    userId?: string | null;
    templateKey: string;
    variables?: Record<string, unknown>;
    dryRun?: boolean;
  }) {
    const productCount = await this.prisma.client.product.count({
      where: { organizationId: input.organizationId },
    });

    const result = runWorkflowTemplate(input.templateKey, {
      organizationId: input.organizationId,
      variables: input.variables,
      productCount,
      dryRun: input.dryRun !== false,
    });

    if (result.status === 'blocked' && result.message.includes('Unknown')) {
      throw new NotFoundException(result.message);
    }

    // Persist as operator run for audit continuity until dedicated workflow tables land fully.
    const run = await this.prisma.client.operatorRun.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId ?? null,
        objective: `workflow:${input.templateKey}`,
        loopMode: result.requiresApproval ? 'shadow' : 'development',
        status:
          result.status === 'awaiting_approval'
            ? 'awaiting_approval'
            : result.status === 'blocked'
              ? 'blocked'
              : 'completed',
        planJson: {
          kind: 'workflow_template',
          templateKey: result.templateKey,
          version: result.version,
          stepsCompleted: result.stepsCompleted,
          stepsSkipped: result.stepsSkipped,
        },
        toolTraceJson: [],
        decisionNote: result.message,
        completedAt: new Date(),
      },
    });

    await this.events.ingest({
      organizationId: input.organizationId,
      eventType: 'workflow.template_run',
      providerKey: 'tradeops-workflow',
      externalEventId: run.id,
      loopMode: result.requiresApproval ? 'shadow' : 'development',
      payload: {
        templateKey: result.templateKey,
        status: result.status,
        message: result.message,
      },
    });

    await this.audit.write({
      action: 'workflow.template_run',
      resourceType: 'workflow',
      resourceId: result.templateKey,
      organizationId: input.organizationId,
      actorUserId: input.userId ?? null,
      metadata: {
        runId: run.id,
        status: result.status,
        version: result.version,
      },
    });

    return { runId: run.id, ...result };
  }
}
