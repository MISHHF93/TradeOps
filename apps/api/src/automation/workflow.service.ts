import { Inject, Injectable, NotFoundException, forwardRef } from '@nestjs/common';
import {
  describeTemplate,
  listWorkflowTemplates,
  runWorkflowTemplate,
} from '@tradeops/workflow-engine';
import { AuditService } from '../identity/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventFabricService } from '../events/event-fabric.service';
import { SaasService } from '../saas/saas.service';

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
              : result.status === 'partial'
                ? 'completed'
                : 'completed',
        planJson: {
          kind: 'workflow_template',
          templateKey: result.templateKey,
          version: result.version,
          stepsCompleted: result.stepsCompleted,
          stepsSkipped: result.stepsSkipped,
          // Prisma InputJsonValue — structured evidence is runtime-safe
          evidence: result.evidence as object,
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

    // Meter only successful template runs (not unknown-template 404s)
    if (result.status !== 'blocked' || !result.message.includes('Unknown')) {
      await this.saas.incrementUsage(input.organizationId, 'workflow_runs', 1);
    }

    return { runId: run.id, ...result };
  }
}
