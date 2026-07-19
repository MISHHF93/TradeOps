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

    // Host-loaded evidence for operational/shadow templates (never invent scores/stock)
    const opportunities = await this.prisma.client.opportunity.findMany({
      where: { organizationId: input.organizationId },
      include: {
        product: {
          select: {
            id: true,
            title: true,
            sourcePlatform: true,
            inventoryQuantity: true,
          },
        },
      },
      orderBy: { score: 'desc' },
      take: 100,
    });

    const scoredOpportunities = opportunities.map((o) => ({
      productId: o.productId,
      title: o.product.title,
      score: o.score,
      expectedMarginBps: o.expectedMarginBps,
      currentSignal: o.currentSignal,
      sourcePlatform: o.product.sourcePlatform,
      isFixture: o.product.sourcePlatform.startsWith('fixture'),
    }));

    const listings = await this.prisma.client.listing.findMany({
      where: {
        organizationId: input.organizationId,
        status: { in: ['active', 'draft', 'pending_approval'] },
      },
      include: {
        product: {
          select: { id: true, title: true, inventoryQuantity: true },
        },
      },
      take: 100,
    });

    const inventorySnapshots = listings.map((l) => ({
      productId: l.productId,
      title: l.product.title,
      quantity: l.product.inventoryQuantity ?? 0,
      listingId: l.id,
      listingStatus: l.status,
    }));

    // Preflight unknown templates + host-evidence path for operational templates
    const result = runWorkflowTemplate(input.templateKey, {
      organizationId: input.organizationId,
      variables: input.variables,
      productCount,
      dryRun: input.dryRun !== false,
      scoredOpportunities,
      inventorySnapshots,
    });
    if (result.status === 'blocked' && result.message.includes('Unknown')) {
      throw new NotFoundException(result.message);
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
          // Host-loaded evidence snapshot (never invented)
          evidence: result.evidence as object,
          scoredOpportunityCount: scoredOpportunities.length,
          inventorySnapshotCount: inventorySnapshots.length,
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
