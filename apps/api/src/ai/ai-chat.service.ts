import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  runCohereAgentLoop,
  type TradeOpsCanonicalResponse,
} from '@tradeops/ai-runtime';
import { PrismaService } from '../prisma/prisma.service';
import { TenantOperationalContextService } from './tenant-operational-context.service';

/** Strip anything secret-like before persistence (defense in depth). */
function safeEnvelope(envelope: TradeOpsCanonicalResponse): Record<string, unknown> {
  return {
    schemaVersion: envelope.schemaVersion,
    requestId: envelope.requestId,
    tenantId: envelope.tenantId,
    conversationId: envelope.conversationId,
    status: envelope.status,
    dataMode: envelope.dataMode,
    provenance: envelope.provenance,
    intent: envelope.intent,
    objective: envelope.objective,
    output: {
      text: envelope.output.text,
      artifactType: envelope.output.artifactType,
      artifact: envelope.output.artifact,
    },
    evidence: envelope.evidence,
    actions: envelope.actions,
    warnings: envelope.warnings,
    confidence: envelope.confidence,
    generatedAt: envelope.generatedAt,
    errorCode: envelope.errorCode,
    requiredAction: envelope.requiredAction,
    meta: envelope.meta,
  };
}

@Injectable()
export class AiChatService {
  private readonly logger = new Logger(AiChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly operationalContext: TenantOperationalContextService,
  ) {}

  /**
   * Canonical chat: Cohere agent loop + durable conversation rows.
   * Without COHERE_API_KEY the loop returns blocked — we still persist the turn
   * so the UI shows history (not a disappearing static flash).
   */
  async chat(input: {
    organizationId: string;
    userId?: string | null;
    message: string;
    conversationId?: string;
    workspaceId?: string;
    disableSearch?: boolean;
    permissions?: string[];
    operationalContext?: Record<string, unknown>;
    knowledgeDocuments?: Array<{
      id: string;
      title: string;
      body: string;
      sourceType?: string;
      provider?: string;
      url?: string;
    }>;
    requestedArtifactType?: string;
  }) {
    const message = input.message.trim();
    let conversationId = input.conversationId?.trim() || '';

    if (conversationId) {
      const existing = await this.prisma.client.aiConversation.findFirst({
        where: { id: conversationId, organizationId: input.organizationId },
      });
      if (!existing) {
        throw new NotFoundException('Conversation not found for this tenant');
      }
    } else {
      const title =
        message.length > 80 ? `${message.slice(0, 77)}…` : message || 'New conversation';
      const created = await this.prisma.client.aiConversation.create({
        data: {
          organizationId: input.organizationId,
          userId: input.userId ?? null,
          title,
        },
      });
      conversationId = created.id;
    }

    // Load prior turns so the system prompt + model see multi-turn context
    const prior = await this.prisma.client.aiMessage.findMany({
      where: { conversationId, organizationId: input.organizationId },
      orderBy: { createdAt: 'asc' },
      take: 24,
      select: { role: true, content: true },
    });
    const history = prior
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    await this.prisma.client.aiMessage.create({
      data: {
        organizationId: input.organizationId,
        conversationId,
        role: 'user',
        content: message,
      },
    });

    // Always load tenant DB snapshot so commerce/inventory tools have real context.
    // Client-provided operationalContext overrides individual keys (tests / advanced clients).
    let operationalContext = input.operationalContext;
    try {
      const snapshot = await this.operationalContext.buildSnapshot(
        input.organizationId,
      );
      operationalContext = this.operationalContext.mergeWithClient(
        snapshot,
        input.operationalContext,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Operational snapshot failed; continuing without tenant context: ${msg}`,
      );
      // Minimal empty context so agent-loop can still differentiate blockers
      operationalContext = {
        products: [],
        inventory: { items: [], lowStock: [], totalUnits: 0, productCount: 0 },
        orders: [],
        payments: [],
        transactions: [],
        shipments: [],
        cases: [],
        suppliers: [],
        revenue: {
          orderCount: 0,
          totalMinor: 0,
          currency: 'USD',
          paymentCapturedMinor: 0,
          source: 'none',
        },
        connectors: [],
        meta: {
          organizationId: input.organizationId,
          dataClass: 'EMPTY',
          productCount: 0,
          fixtureProductCount: 0,
          liveProductCount: 0,
          openCaseCount: 0,
          orderCount: 0,
          connectorCount: 0,
          liveConnectorCount: 0,
          generatedAt: new Date().toISOString(),
          snapshotError: msg.slice(0, 200),
        },
        ...(input.operationalContext ?? {}),
      };
    }

    const envelope = await runCohereAgentLoop({
      message,
      tenantId: input.organizationId,
      userId: input.userId ?? undefined,
      conversationId,
      workspaceId: input.workspaceId,
      history,
      disableSearch: input.disableSearch,
      permissions: input.permissions,
      operationalContext,
      knowledgeDocuments: input.knowledgeDocuments,
      requestedArtifactType: input.requestedArtifactType,
    });

    // Always pin conversation id on the response for the client
    const withConv: TradeOpsCanonicalResponse = {
      ...envelope,
      conversationId,
    };

    await this.prisma.client.aiMessage.create({
      data: {
        organizationId: input.organizationId,
        conversationId,
        role: 'assistant',
        content: withConv.output.text,
        status: withConv.status,
        dataMode: withConv.dataMode,
        intentCategory: withConv.intent?.category ?? null,
        informationMode: withConv.intent?.informationMode ?? null,
        provider: withConv.provenance?.aiProvider ?? withConv.meta?.provider ?? null,
        model: withConv.provenance?.aiModel ?? withConv.meta?.model ?? null,
        requestId: withConv.requestId,
        errorCode: withConv.errorCode ?? null,
        responseJson: safeEnvelope(withConv) as object,
      },
    });

    await this.prisma.client.aiConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    this.logger.log(
      `AI chat turn org=${input.organizationId.slice(0, 8)} conv=${conversationId.slice(0, 8)} status=${withConv.status} mode=${withConv.dataMode}`,
    );

    return withConv;
  }

  listConversations(organizationId: string, take = 20) {
    return this.prisma.client.aiConversation.findMany({
      where: { organizationId },
      orderBy: { updatedAt: 'desc' },
      take: Math.min(take, 50),
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { messages: true } },
      },
    });
  }

  async getConversation(organizationId: string, conversationId: string) {
    const conv = await this.prisma.client.aiConversation.findFirst({
      where: { id: conversationId, organizationId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 200,
          select: {
            id: true,
            role: true,
            content: true,
            status: true,
            dataMode: true,
            intentCategory: true,
            informationMode: true,
            provider: true,
            model: true,
            requestId: true,
            errorCode: true,
            createdAt: true,
          },
        },
      },
    });
    if (!conv) throw new NotFoundException('Conversation not found');
    return conv;
  }
}
