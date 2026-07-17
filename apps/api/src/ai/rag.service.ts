import { Injectable, Logger } from '@nestjs/common';
import {
  artifactCorpusToCsv,
  artifactToCorpusRow,
  buildArtifactTextForRag,
  buildRagIndex,
  completeWithXai,
  deserializeRagIndex,
  embedWithXai,
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
      embeddingModel: index?.stats.modelVersion ?? 'rag-tfidf-v1',
      embeddingMode: index?.stats.embeddingMode ?? 'tfidf',
      generationProvider: isLlmConfigured() ? 'xai' : null,
      honesty: {
        note: 'Train rebuilds an org-specific retrieval index (products, artifacts, cases, runs, connectors, SOPs). Not GPU fine-tuning. Optional free-form answers and dense API embeddings require XAI_API_KEY; local dense hybrid always available.',
      },
    };
  }

  private repoRoot(): string {
    // Prefer monorepo root when API runs from apps/api
    const cwd = process.cwd();
    if (existsSync(join(cwd, 'pnpm-workspace.yaml'))) return cwd;
    const parent = join(cwd, '..', '..');
    if (existsSync(join(parent, 'pnpm-workspace.yaml'))) return parent;
    return cwd;
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

    // Product artifacts — text metadata only (no binary embed)
    try {
      const artifacts = await this.prisma.client.productArtifact.findMany({
        where: { organizationId },
        include: {
          product: {
            select: {
              title: true,
              sourcePlatform: true,
              sourceProvenance: true,
            },
          },
        },
        take: 800,
        orderBy: { collectedAt: 'desc' },
      });
      for (const a of artifacts) {
        const isFixture =
          Boolean(a.product?.sourcePlatform?.startsWith('fixture')) ||
          a.sourceType === 'generated' ||
          Boolean(a.sourcePlatform?.includes('fixture'));
        const text = buildArtifactTextForRag({
          productTitle: a.product?.title,
          title: a.title,
          altText: a.altText,
          description: a.description,
          artifactType: String(a.artifactType),
          purpose: String(a.purpose),
          mimeType: a.mimeType,
          rightsStatus: String(a.rightsStatus),
          publicationStatus: String(a.publicationStatus),
        });
        docs.push({
          id: `artifact:${a.id}`,
          sourceType: 'artifact',
          sourceId: a.id,
          title: a.title || `${a.artifactType} · ${a.purpose}`,
          body: [
            text,
            a.filename ? `Filename: ${a.filename}` : '',
            a.storageKey ? `Storage key: ${a.storageKey}` : '',
            a.qualityScore != null ? `Quality: ${a.qualityScore}` : '',
            a.completenessScore != null
              ? `Completeness: ${a.completenessScore}`
              : '',
            isFixture ? 'TEST FIXTURE — not live marketplace media' : '',
          ]
            .filter(Boolean)
            .join('\n'),
          tags: [String(a.artifactType), String(a.purpose), String(a.publicationStatus)],
          isFixture,
          observedAt: a.collectedAt?.toISOString?.() ?? undefined,
          metadata: {
            productId: a.productId,
            artifactId: a.id,
            mimeType: a.mimeType,
          },
        });
      }
    } catch (e) {
      this.logger.warn(
        `artifact corpus skipped: ${e instanceof Error ? e.message : String(e)}`,
      );
    }

    return docs;
  }

  /**
   * Export ProductArtifact rows to repo-root artifacts-corpus.csv
   */
  async exportArtifactCsv(organizationId: string) {
    const artifacts = await this.prisma.client.productArtifact.findMany({
      where: { organizationId },
      include: {
        product: {
          select: {
            title: true,
            sourcePlatform: true,
            sourceProvenance: true,
          },
        },
      },
      take: 2000,
      orderBy: { collectedAt: 'desc' },
    });

    const rows = artifacts.map((a) =>
      artifactToCorpusRow({
        organizationId,
        artifactId: a.id,
        productId: a.productId,
        productTitle: a.product?.title,
        artifactType: String(a.artifactType),
        purpose: String(a.purpose),
        sourceType: String(a.sourceType),
        sourcePlatform: a.sourcePlatform ?? a.product?.sourcePlatform,
        title: a.title,
        altText: a.altText,
        description: a.description,
        mimeType: a.mimeType,
        filename: a.filename,
        storageKey: a.storageKey,
        externalUrl: a.externalUrl,
        rightsStatus: String(a.rightsStatus),
        publicationStatus: String(a.publicationStatus),
        visibility: String(a.visibility),
        qualityScore: a.qualityScore,
        completenessScore: a.completenessScore,
        confidence: a.confidence,
        isFixture:
          Boolean(a.product?.sourcePlatform?.startsWith('fixture')) ||
          a.sourceType === 'generated',
        collectedAt: a.collectedAt?.toISOString?.() ?? null,
        sourceProvenance: a.product?.sourceProvenance,
      }),
    );

    const csv = artifactCorpusToCsv(rows);
    const outPath = join(this.repoRoot(), 'artifacts-corpus.csv');
    writeFileSync(outPath, csv, 'utf8');

    await this.events.ingest({
      organizationId,
      eventType: 'ai.rag.export_csv',
      providerKey: 'tradeops-rag',
      externalEventId: `rag-csv-${organizationId}-${Date.now()}`,
      isFixture: false,
      payload: { path: outPath, rowCount: rows.length },
    });

    return {
      path: outPath,
      fileName: 'artifacts-corpus.csv',
      rowCount: rows.length,
      honesty: {
        note: 'CSV is text metadata only. Fixture rows labeled. Binaries not embedded.',
      },
    };
  }

  async train(
    organizationId: string,
    userId?: string | null,
    options?: { tryXaiEmbeddings?: boolean },
  ) {
    let documents = await this.collectDocuments(organizationId);

    // Optional xAI dense embeddings on first N docs (fail → local dense in buildRagIndex)
    let embeddingNote = 'local dense hybrid (hashing projection) + TF-IDF';
    if (options?.tryXaiEmbeddings !== false && isLlmConfigured()) {
      const batch = documents.slice(0, 40);
      const texts = batch.map((d) => `${d.title}\n${d.body}`.slice(0, 1500));
      const emb = await embedWithXai(texts);
      if (emb.ok && emb.vectors?.length === batch.length) {
        for (let i = 0; i < batch.length; i++) {
          documents[i] = { ...documents[i]!, dense: emb.vectors[i] };
        }
        // remaining docs get local dense in buildRagIndex
        embeddingNote = `xAI dense on ${batch.length} docs (${emb.model}); rest local dense + TF-IDF`;
      } else {
        embeddingNote = `xAI embeddings unavailable (${emb.error ?? 'n/a'}); using local dense + TF-IDF`;
      }
    }

    const index = buildRagIndex(organizationId, documents, new Date(), {
      attachLocalDense: true,
    });
    this.memory.set(organizationId, index);
    writeFileSync(this.indexPath(organizationId), serializeRagIndex(index), 'utf8');

    // Also refresh artifact CSV at repo root for offline inspection
    let csvPath: string | null = null;
    try {
      const exp = await this.exportArtifactCsv(organizationId);
      csvPath = exp.path;
    } catch (e) {
      this.logger.warn(
        `CSV export during train failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    }

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
        embeddingNote,
        csvPath,
      },
    });

    return {
      organizationId,
      stats: index.stats,
      embeddingNote,
      csvPath,
      honesty: {
        note: 'Org index rebuilt from canonical store including ProductArtifacts. Not neural fine-tuning of foundation weights. Fixtures counted separately.',
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
