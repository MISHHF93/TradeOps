/**
 * TradeOps Retrieval Engine — enterprise semantic search over platform knowledge.
 *
 * Default implementation: Cohere (embed + rerank).
 * Fallback: local lexical ranking when Cohere is not configured.
 *
 * Generation stays on the AI Adapter (OpenAI primary). Cohere is not the whole runtime.
 */

import { getAiPlatformConfig } from '@tradeops/config';
import {
  cohereClassifyZeroShot,
  cohereEmbed,
  cohereRerank,
  probeCohere,
} from './cohere-client';
import type { TradeOpsEvidence } from './response-envelope';

export type RetrievalDocument = {
  id: string;
  title: string;
  body: string;
  sourceType?: string;
  provider?: string;
  url?: string;
  metadata?: Record<string, unknown>;
};

export type RetrievalHit = {
  id: string;
  title: string;
  body: string;
  score: number;
  sourceType?: string;
  provider?: string;
  url?: string;
};

export type RetrievalResult = {
  ok: boolean;
  error?: string;
  engine: 'cohere' | 'local_lexical';
  query: string;
  hits: RetrievalHit[];
  evidence: TradeOpsEvidence[];
  warnings: string[];
  latencyMs: number;
};

export type RetrievalEngine = {
  id: 'cohere' | 'local';
  configured: boolean;
  embed(texts: string[], inputType?: 'search_query' | 'search_document'): Promise<{
    ok: boolean;
    vectors?: number[][];
    error?: string;
  }>;
  retrieve(input: {
    query: string;
    documents: RetrievalDocument[];
    topK?: number;
  }): Promise<RetrievalResult>;
  classify(input: {
    text: string;
    labels: string[];
  }): Promise<{ ok: boolean; label?: string; confidence?: number; error?: string }>;
  probe(): Promise<{ ok: boolean; configured: boolean; error?: string; engine: string }>;
};

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function lexicalScore(query: string, doc: string): number {
  const q = query.toLowerCase().split(/\W+/).filter((t) => t.length > 2);
  if (!q.length) return 0;
  const d = doc.toLowerCase();
  let hits = 0;
  for (const t of q) {
    if (d.includes(t)) hits += 1;
  }
  return hits / q.length;
}

function toEvidence(hits: RetrievalHit[]): TradeOpsEvidence[] {
  return hits.map((h) => ({
    sourceType: (h.sourceType === 'connector' || h.sourceType === 'database'
      ? h.sourceType
      : h.sourceType === 'document'
        ? 'document'
        : 'document') as TradeOpsEvidence['sourceType'],
    provider: h.provider ?? 'retrieval',
    title: h.title,
    url: h.url,
    retrievedAt: new Date().toISOString(),
    freshness: 'recent' as const,
    snippet: h.body.slice(0, 400),
  }));
}

function cohereRetrievalEngine(): RetrievalEngine {
  const cfg = getAiPlatformConfig();
  const apiKey = cfg.cohereApiKey;
  const options = {
    apiKey,
    baseUrl: cfg.cohereBaseUrl,
    embedModel: cfg.cohereEmbedModel,
    rerankModel: cfg.cohereRerankModel,
    chatModel: cfg.cohereChatModel,
  };

  return {
    id: 'cohere',
    configured: Boolean(apiKey),
    async embed(texts, inputType = 'search_document') {
      const r = await cohereEmbed({ texts, inputType, options });
      return { ok: r.ok, vectors: r.vectors, error: r.error };
    },
    async retrieve(input) {
      const t0 = Date.now();
      const warnings: string[] = [];
      if (!apiKey) {
        return localLexicalRetrieve(input, t0, 'COHERE_API_KEY not set — lexical fallback');
      }
      if (!input.documents.length) {
        return {
          ok: true,
          engine: 'cohere',
          query: input.query,
          hits: [],
          evidence: [],
          warnings: ['no documents provided for retrieval'],
          latencyMs: Date.now() - t0,
        };
      }

      const topK = Math.min(input.topK ?? 8, 20);
      const docTexts = input.documents.map(
        (d) => `${d.title}\n${d.body}`.slice(0, 3000),
      );

      // Prefer rerank when we have a moderate corpus (best enterprise retrieval path)
      if (input.documents.length <= 100) {
        const rr = await cohereRerank({
          query: input.query,
          documents: docTexts,
          topN: topK,
          options,
        });
        if (rr.ok && rr.results?.length) {
          const hits: RetrievalHit[] = rr.results.map((r) => {
            const doc = input.documents[r.index]!;
            return {
              id: doc.id,
              title: doc.title,
              body: doc.body,
              score: r.relevanceScore,
              sourceType: doc.sourceType,
              provider: doc.provider ?? 'cohere',
              url: doc.url,
            };
          });
          return {
            ok: true,
            engine: 'cohere',
            query: input.query,
            hits,
            evidence: toEvidence(hits),
            warnings,
            latencyMs: Date.now() - t0,
          };
        }
        if (!rr.ok) warnings.push(`Cohere rerank: ${rr.error}`);
      }

      // Embed + cosine for larger sets or rerank failure
      const qEmb = await cohereEmbed({
        texts: [input.query],
        inputType: 'search_query',
        options,
      });
      if (!qEmb.ok || !qEmb.vectors?.[0]) {
        return localLexicalRetrieve(
          input,
          t0,
          qEmb.error ?? 'query embed failed',
        );
      }
      const dEmb = await cohereEmbed({
        texts: docTexts.slice(0, 64),
        inputType: 'search_document',
        options,
      });
      if (!dEmb.ok || !dEmb.vectors?.length) {
        return localLexicalRetrieve(
          input,
          t0,
          dEmb.error ?? 'document embed failed',
        );
      }

      const scored = input.documents.slice(0, dEmb.vectors.length).map((doc, i) => ({
        doc,
        score: cosine(qEmb.vectors![0]!, dEmb.vectors![i]!),
      }));
      scored.sort((a, b) => b.score - a.score);
      const hits: RetrievalHit[] = scored.slice(0, topK).map(({ doc, score }) => ({
        id: doc.id,
        title: doc.title,
        body: doc.body,
        score,
        sourceType: doc.sourceType,
        provider: doc.provider ?? 'cohere',
        url: doc.url,
      }));

      return {
        ok: true,
        engine: 'cohere',
        query: input.query,
        hits,
        evidence: toEvidence(hits),
        warnings,
        latencyMs: Date.now() - t0,
      };
    },
    async classify(input) {
      if (!apiKey) return { ok: false, error: 'COHERE_API_KEY not set' };
      const r = await cohereClassifyZeroShot({
        text: input.text,
        labels: input.labels,
        options,
      });
      return {
        ok: r.ok,
        label: r.label,
        confidence: r.confidence,
        error: r.error,
      };
    },
    async probe() {
      const p = await probeCohere(options);
      return {
        ok: p.ok,
        configured: p.configured,
        error: p.error,
        engine: 'cohere',
      };
    },
  };
}

function localLexicalRetrieve(
  input: { query: string; documents: RetrievalDocument[]; topK?: number },
  t0: number,
  warn?: string,
): RetrievalResult {
  const topK = Math.min(input.topK ?? 8, 20);
  const scored = input.documents.map((doc) => ({
    doc,
    score: lexicalScore(input.query, `${doc.title} ${doc.body}`),
  }));
  scored.sort((a, b) => b.score - a.score);
  const hits: RetrievalHit[] = scored
    .filter((s) => s.score > 0)
    .slice(0, topK)
    .map(({ doc, score }) => ({
      id: doc.id,
      title: doc.title,
      body: doc.body,
      score,
      sourceType: doc.sourceType,
      provider: doc.provider ?? 'local_lexical',
      url: doc.url,
    }));
  return {
    ok: true,
    engine: 'local_lexical',
    query: input.query,
    hits,
    evidence: toEvidence(hits),
    warnings: warn ? [warn] : [],
    latencyMs: Date.now() - t0,
  };
}

function localRetrievalEngine(): RetrievalEngine {
  return {
    id: 'local',
    configured: true,
    async embed() {
      return { ok: false, error: 'local engine has no dense embeddings' };
    },
    async retrieve(input) {
      return localLexicalRetrieve(input, Date.now());
    },
    async classify() {
      return { ok: false, error: 'local engine has no classifier — set COHERE_API_KEY' };
    },
    async probe() {
      return { ok: true, configured: true, engine: 'local_lexical' };
    },
  };
}

/**
 * Active retrieval engine: Cohere when configured, else local lexical.
 */
export function getRetrievalEngine(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): RetrievalEngine {
  const cfg = getAiPlatformConfig(env);
  if (cfg.cohereConfigured && cfg.cohereRetrievalEnabled) {
    return cohereRetrievalEngine();
  }
  return localRetrievalEngine();
}

export function retrievalEnginePublicStatus(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
) {
  const cfg = getAiPlatformConfig(env);
  const engine = getRetrievalEngine(env);
  return {
    engine: engine.id,
    configured: engine.configured,
    cohereConfigured: cfg.cohereConfigured,
    cohereRetrievalEnabled: cfg.cohereRetrievalEnabled,
    embedModel: cfg.cohereEmbedModel,
    rerankModel: cfg.cohereRerankModel,
    role: 'enterprise_retrieval_rag_embeddings_classification',
    note: 'Cohere is the retrieval engine — not the sole generation runtime. Generation uses AI Adapter (OpenAI primary).',
  };
}
