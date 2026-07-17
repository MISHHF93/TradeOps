import { Injectable, Logger } from '@nestjs/common';
import {
  buildRagIndex,
  completeWithXai,
  deserializeRagIndex,
  isLlmConfigured,
  knowledgeEntriesToDocuments,
  queryRagIndex,
  RAG_SYSTEM_PROMPT,
  serializeRagIndex,
  type KnowledgeBaseEntry,
  type RagDocument,
  type RagIndex,
  type RagQueryResult,
  type RagSourceType,
} from '@tradeops/ai-runtime';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import { EventFabricService } from '../events/event-fabric.service';

/**
 * Org-scoped RAG train / query service.
 * Train = reindex products, cases, runs, connectors into sparse TF-IDF index.
 * Optional xAI completion when XAI_API_KEY is set.
 */
@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);
  private readonly memory = new Map<string, RagIndex>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventFabricService,
  ) {}

  private storageDir(): string {
    const root =
      process.env.TRADEOPS_STORAGE_DIR?.trim() ||
      join(process.cwd(), '.tradeops-storage');
    const dir = join(root, 'rag');
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  private indexPath(organizationId: string): string {
    return join(this.storageDir(), `${organizationId}.json`);
  }

  getIndex(organizationId: string): RagIndex | null {
    const cached = this.memory.get(organizationId);
    if (cached) return cached;
    const path = this.indexPath(organizationId);
    if (!existsSync(path)) return null;
    try {
      const raw = readFileSync(path, 'utf8');
      const index = deserializeRagIndex(raw);
      this.memory.set(organizationId, index);
      return index;
    } catch (e) {
      this.logger.warn(
        `Failed to load RAG index for ${organizationId}: ${e instanceof Error ? e.message : String(e)}`,
      );
      return null;
    }
  }

  status(organizationId: string) {
    const index = this.getIndex(organizationId);
    return {
      trained: Boolean(index),
      stats: index?.stats ?? null,
      llmConfigured: isLlmConfigured(),
      embeddingModel: 'rag-tfidf-v1',
      generationProvider: isLlmConfigured() ? 'xai' : null,
      honesty: {
        note: 'Train rebuilds an org-specific retrieval index from canonical store data. This is not GPU fine-tuning of foundation model weights. Optional free-form answers require XAI_API_KEY.',
      },
    };
  }

  /**
   * Collect corpus from live DB tables — no fabricated documents.
   */
  async collectDocuments(organizationId: string): Promise<RagDocument[]> {
    const docs: RagDocument[] = [];

    const products = await this.prisma.client.product.findMany({
      where: { organizationId },
      include: {
        opportunities: { take: 1, orderBy: { score: 'desc' } },
      },
      take: 200,
      orderBy: { updatedAt: 'desc' },
    });

    for (const p of products) {
      const opp = p.opportunities[0];
      const isFixture = p.sourcePlatform.startsWith('fixture');
      docs.push({
        id: `product:${p.id}`,
        sourceType: 'product',
        sourceId: p.id,
        title: p.title,
        body: [
          p.description ?? '',
          `Category: ${p.category}`,
          p.brand ? `Brand: ${p.brand}` : '',
          `Source: ${p.sourcePlatform}`,
          `Supplier cost minor: ${p.supplierCostMinor}`,
          `Shipping minor: ${p.shippingCostMinor}`,
          `Target price minor: ${p.targetPriceMinor}`,
          `Currency: ${p.currency}`,
          `Inventory: ${p.inventoryQuantity}`,
          opp
            ? `Opportunity score ${opp.score}; signal ${opp.currentSignal}; margin bps ${opp.expectedMarginBps}`
            : '',
          isFixture ? 'TEST FIXTURE — not live marketplace data' : '',
        ]
          .filter(Boolean)
          .join('\n'),
        tags: [p.category, p.sourcePlatform].filter(Boolean) as string[],
        isFixture,
        observedAt: p.dataFreshnessAt?.toISOString?.() ?? p.updatedAt.toISOString(),
        metadata: { productId: p.id },
      });

      if (opp) {
        docs.push({
          id: `opportunity:${opp.id}`,
          sourceType: 'opportunity',
          sourceId: opp.id,
          title: `Opportunity: ${p.title}`,
          body: `Score ${opp.score}. Signal ${opp.currentSignal}. Expected margin bps ${opp.expectedMarginBps}. Expected profit minor ${opp.expectedProfitMinor}. Demand ${opp.demandScore}. Policy risk ${opp.policyRiskScore}. Product ${p.id}.`,
          tags: ['opportunity', String(opp.currentSignal)],
          isFixture,
          observedAt: opp.scoredAt?.toISOString?.() ?? opp.updatedAt?.toISOString?.(),
          metadata: { productId: p.id, opportunityId: opp.id },
        });
      }
    }

    const cases = await this.prisma.client.commerceCase.findMany({
      where: { organizationId },
      include: { product: { select: { title: true, sourcePlatform: true } } },
      take: 100,
      orderBy: { updatedAt: 'desc' },
    });
    for (const c of cases) {
      docs.push({
        id: `case:${c.id}`,
        sourceType: 'commerce_case',
        sourceId: c.id,
        title: `Case: ${c.product?.title ?? c.productId} · ${c.currentStage}`,
        body: [
          `Stage: ${c.currentStage}`,
          `Status: ${c.stageStatus}`,
          c.nextActionLabel ? `Next: ${c.nextActionLabel}` : '',
          c.blockerMessage ? `Blocker: ${c.blockerMessage}` : '',
          c.recommendation ? `Recommendation: ${c.recommendation}` : '',
          c.opportunityScore != null ? `Opportunity score: ${c.opportunityScore}` : '',
          c.product?.sourcePlatform?.startsWith('fixture')
            ? 'TEST FIXTURE product case'
            : '',
        ]
          .filter(Boolean)
          .join('\n'),
        tags: [String(c.currentStage), String(c.stageStatus)],
        isFixture: Boolean(c.product?.sourcePlatform?.startsWith('fixture')),
        observedAt: c.updatedAt.toISOString(),
        metadata: { caseId: c.id, productId: c.productId },
      });
    }

    const runs = await this.prisma.client.operatorRun.findMany({
      where: { organizationId },
      take: 40,
      orderBy: { startedAt: 'desc' },
    });
    for (const r of runs) {
      const plan = (r.planJson ?? {}) as Record<string, unknown>;
      const summary =
        (typeof plan.finalAnswer === 'string' && plan.finalAnswer) ||
        (typeof plan.responseSummary === 'string' && plan.responseSummary) ||
        r.decisionNote ||
        '';
      const kb = plan.knowledgeBaseDelta;
      docs.push({
        id: `run:${r.id}`,
        sourceType: 'operator_run',
        sourceId: r.id,
        title: `AI run: ${r.objective.slice(0, 120)}`,
        body: [
          `Objective: ${r.objective}`,
          `Status: ${r.status}`,
          `Decision: ${r.decision ?? 'n/a'}`,
          summary ? String(summary).slice(0, 2000) : '',
          Array.isArray(kb) ? `Knowledge deltas: ${JSON.stringify(kb).slice(0, 800)}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
        tags: ['operator_run', r.status],
        isFixture: false,
        observedAt: r.startedAt.toISOString(),
        metadata: { runId: r.id },
      });
    }

    // SOP-style static operational knowledge (from process engine labels)
    const sops: Array<{ id: string; title: string; body: string }> = [
      {
        id: 'sop-discover',
        title: 'SOP: Discover opportunities',
        body: 'Scan products, score opportunity, assess policy, rank by contribution margin. Never treat revenue as profit. Fixtures must be labeled.',
      },
      {
        id: 'sop-approve',
        title: 'SOP: Approvals before publish',
        body: 'Listings and purchase orders require human approval before external publish or PO submit. Shadow mode records decisions without live side effects.',
      },
      {
        id: 'sop-isolation',
        title: 'SOP: Production isolation',
        body: 'Set TRADEOPS_PRODUCTION_WORKSPACE=1 to exclude fixture products from scanner and portfolio KPIs. Simulation mode labels synthetic data.',
      },
      {
        id: 'sop-rag',
        title: 'SOP: RAG training',
        body: 'Run RAG train after importing products or completing AI objectives so retrieval reflects the latest org knowledge. Optional XAI_API_KEY enables grounded free-form answers.',
      },
    ];
    for (const s of sops) {
      docs.push({
        id: `sop:${s.id}`,
        sourceType: 'sop',
        sourceId: s.id,
        title: s.title,
        body: s.body,
        tags: ['sop'],
        isFixture: false,
      });
    }

    const connectors = await this.prisma.client.connectorInstallation.findMany({
      where: { organizationId },
      take: 80,
    });
    for (const c of connectors) {
      docs.push({
        id: `connector:${c.id}`,
        sourceType: 'connector',
        sourceId: c.providerKey,
        title: `Connector ${c.displayName || c.providerKey}`,
        body: `Provider ${c.providerKey}. Status ${c.status}. Fixture=${c.isFixture}. Family ${c.family}. Error: ${c.lastError ?? 'none'}.`,
        tags: [c.providerKey, c.status],
        isFixture: c.isFixture,
        observedAt: c.updatedAt?.toISOString?.() ?? undefined,
      });
    }

    return docs;
  }

  async train(organizationId: string, userId?: string | null) {
    const documents = await this.collectDocuments(organizationId);
    const index = buildRagIndex(organizationId, documents);
    this.memory.set(organizationId, index);
    writeFileSync(this.indexPath(organizationId), serializeRagIndex(index), 'utf8');

    await this.events.ingest({
      organizationId,
      eventType: 'ai.rag.trained',
      providerKey: 'tradeops-rag',
      externalEventId: `rag-train-${organizationId}-${Date.now()}`,
      isFixture: false,
      payload: {
        stats: index.stats,
        documentCount: documents.length,
        userId: userId ?? null,
      },
    });

    return {
      organizationId,
      stats: index.stats,
      honesty: {
        note: 'Org index rebuilt from canonical store. Not neural fine-tuning. Fixtures counted separately in stats.',
      },
    };
  }

  async query(
    organizationId: string,
    input: {
      query: string;
      topK?: number;
      excludeFixtures?: boolean;
      sourceTypes?: RagSourceType[];
      /** When true and XAI_API_KEY set, generate grounded answer */
      generate?: boolean;
      autoTrainIfMissing?: boolean;
    },
  ): Promise<
    RagQueryResult & {
      answer?: string | null;
      llm?: { ok: boolean; model?: string; error?: string; latencyMs?: number };
    }
  > {
    let index = this.getIndex(organizationId);
    if (!index && input.autoTrainIfMissing !== false) {
      await this.train(organizationId);
      index = this.getIndex(organizationId);
    }
    if (!index) {
      return {
        query: input.query,
        hits: [],
        groundedContext: 'No RAG index. Call POST /ai/rag/train first.',
        citations: [],
        indexStats: {
          chunkCount: 0,
          trainedAt: new Date(0).toISOString(),
          modelVersion: 'rag-tfidf-v1',
        },
        honesty: {
          note: 'Index missing — train required.',
          embeddingModel: 'rag-tfidf-v1',
          generationMode: 'unavailable',
        },
        answer: null,
      };
    }

    const wantGenerate = Boolean(input.generate) && isLlmConfigured();
    const result = queryRagIndex(index, input.query, {
      topK: input.topK,
      excludeFixtures: input.excludeFixtures,
      sourceTypes: input.sourceTypes,
      generationMode: wantGenerate
        ? 'llm_grounded'
        : isLlmConfigured()
          ? 'retrieval_only'
          : 'unavailable',
    });

    if (!wantGenerate) {
      return { ...result, answer: null };
    }

    const llm = await completeWithXai({
      system: RAG_SYSTEM_PROMPT,
      user: [
        `Objective / question:\n${input.query}`,
        '',
        result.groundedContext,
        '',
        'Respond with: (1) direct answer, (2) evidence citations by title, (3) recommended next TradeOps actions. If evidence is fixture-only, say so.',
      ].join('\n'),
      temperature: 0.2,
      maxTokens: 1000,
    });

    return {
      ...result,
      answer: llm.ok ? llm.text ?? null : null,
      llm: {
        ok: llm.ok,
        model: llm.model,
        error: llm.error,
        latencyMs: llm.latencyMs,
      },
      honesty: {
        ...result.honesty,
        generationMode: llm.ok ? 'llm_grounded' : 'retrieval_only',
        note: llm.ok
          ? result.honesty.note
          : `${result.honesty.note} LLM generation failed or skipped: ${llm.error ?? 'n/a'}`,
      },
    };
  }

  /**
   * Retrieval preamble for operator / navigator (no LLM required).
   */
  async groundObjective(
    organizationId: string,
    objective: string,
  ): Promise<{
    groundedContext: string;
    hits: RagQueryResult['hits'];
    trained: boolean;
  }> {
    const q = await this.query(organizationId, {
      query: objective,
      topK: 6,
      generate: false,
      autoTrainIfMissing: true,
    });
    return {
      groundedContext: q.groundedContext,
      hits: q.hits,
      trained: q.indexStats.chunkCount > 0,
    };
  }

  /** Merge prior knowledge entries into train corpus helper for tests/host. */
  knowledgeDocs(entries: KnowledgeBaseEntry[]): RagDocument[] {
    return knowledgeEntriesToDocuments(entries);
  }
}
