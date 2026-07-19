import { Inject, Injectable, NotFoundException, forwardRef } from '@nestjs/common';
import {
  createDurableRun,
  describeDurableTemplate,
  describeTemplate,
  executeDurableRun,
  listWorkflowTemplates,
  runWorkflowTemplate,
} from '@tradeops/workflow-engine';
import { randomUUID } from 'node:crypto';
import { AuditService } from '../identity/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventFabricService } from '../events/event-fabric.service';
import { SaasService } from '../saas/saas.service';

/** Prisma JSON columns — cast structured durable snapshots. */
function asJson(value: unknown): object {
  return value as object;
}

@Injectable()
export class WorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: EventFabricService,
    @Inject(forwardRef(() => SaasService)) private readonly saas: SaasService,
  ) {}

  listTemplates() {
    return {
      templates: listWorkflowTemplates().map((t) => ({
        ...describeTemplate(t),
        durable: describeDurableTemplate(t),
      })),
      note: 'Templates are versioned, durable, and approval-aware. Consequential steps stay gated.',
    };
  }

  async runTemplate(input: {
    organizationId: string;
    userId?: string | null;
    templateKey: string;
    variables?: Record<string, unknown>;
    dryRun?: boolean;
    commerceCaseId?: string | null;
  }) {
    // Server-side entitlement gate (never UI-only)
    await this.saas.assertWorkflowRunAllowed(input.organizationId);

    const productCount = await this.prisma.client.product.count({
      where: { organizationId: input.organizationId },
    });

    // Preflight unknown templates
    const probe = runWorkflowTemplate(input.templateKey, {
      organizationId: input.organizationId,
      variables: input.variables,
      productCount,
      dryRun: true,
    });
    if (probe.status === 'blocked' && probe.message.includes('Unknown')) {
      throw new NotFoundException(probe.message);
    }

    const runId = randomUUID();
    const skeleton = createDurableRun({
      runId,
      organizationId: input.organizationId,
      templateKey: input.templateKey,
      variables: input.variables,
      dryRun: input.dryRun !== false,
      commerceCaseId: input.commerceCaseId ?? null,
    });
    if ('error' in skeleton) {
      throw new NotFoundException(skeleton.error);
    }

    const durable = executeDurableRun(skeleton, { productCount });

    // Persist as operator run for audit continuity until dedicated workflow tables land fully.
    const run = await this.prisma.client.operatorRun.create({
      data: {
        id: runId,
        organizationId: input.organizationId,
        userId: input.userId ?? null,
        objective: `workflow:${input.templateKey}`,
        loopMode: durable.requiresApproval ? 'shadow' : 'development',
        status:
          durable.status === 'awaiting_approval'
            ? 'awaiting_approval'
            : durable.status === 'blocked'
              ? 'blocked'
              : durable.status === 'failed'
                ? 'failed'
                : 'completed',
        planJson: asJson({
          kind: 'workflow_template_durable',
          templateKey: durable.templateKey,
          version: durable.version,
          durable,
          stepsCompleted: durable.steps
            .filter((s) => s.status === 'completed')
            .map((s) => s.name),
          stepsSkipped: durable.steps
            .filter((s) => s.status === 'skipped' || s.status === 'awaiting_approval')
            .map((s) => s.name),
        }),
        toolTraceJson: [],
        decisionNote: durable.message,
        completedAt: new Date(),
      },
    });

    await this.events.ingest({
      organizationId: input.organizationId,
      eventType: 'workflow.template_run',
      providerKey: 'tradeops-workflow',
      externalEventId: run.id,
      loopMode: durable.requiresApproval ? 'shadow' : 'development',
      payload: {
        templateKey: durable.templateKey,
        status: durable.status,
        message: durable.message,
        commerceCaseId: durable.commerceCaseId,
        durableSteps: durable.steps.map((s) => ({ name: s.name, status: s.status })),
      },
    });

    await this.audit.write({
      action: 'workflow.template_run',
      resourceType: 'workflow',
      resourceId: durable.templateKey,
      organizationId: input.organizationId,
      actorUserId: input.userId ?? null,
      metadata: {
        runId: run.id,
        status: durable.status,
        version: durable.version,
        durable: true,
      },
    });

    // Meter only successful template runs (not unknown-template 404s)
    if (durable.status !== 'blocked' || !durable.message.includes('Unknown')) {
      await this.saas.incrementUsage(input.organizationId, 'workflow_runs', 1);
    }

    return {
      runId: run.id,
      templateKey: durable.templateKey,
      version: durable.version,
      status:
        durable.status === 'awaiting_approval'
          ? 'awaiting_approval'
          : durable.status === 'blocked'
            ? 'blocked'
            : durable.status === 'completed'
              ? 'completed'
              : 'partial',
      stepsCompleted: durable.steps.filter((s) => s.status === 'completed').map((s) => s.name),
      stepsSkipped: durable.steps
        .filter((s) => s.status === 'skipped' || s.status === 'awaiting_approval')
        .map((s) => s.name),
      requiresApproval: durable.requiresApproval,
      message: durable.message,
      evidence: {
        organizationId: input.organizationId,
        dryRun: durable.dryRun,
        durable,
      },
      durable,
    };
  }
}
