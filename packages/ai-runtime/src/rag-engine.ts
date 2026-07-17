/**
 * TradeOps RAG Engine (Retrieval-Augmented Generation).
 *
 * "Train" here means continuous org-specific indexing of canonical commerce
 * knowledge — NOT GPU fine-tuning of foundation weights.
 *
 * Pipeline:
 *   sources → chunk → sparse TF-IDF embed → inverted index
 *   query → retrieve top-k → ground context → optional LLM complete
 *
 * Embeddings are transparent bag-of-words TF-IDF (no native binary deps).
 * Optional free-form generation uses SpaceXAI / xAI when XAI_API_KEY is set.
 */

export type RagSourceType =
  | 'product'
  | 'opportunity'
  | 'commerce_case'
  | 'operator_run'
  | 'sop'
  | 'connector'
  | 'manual'
  | 'policy';

export type RagDocument = {
  id: string;
  sourceType: RagSourceType;
  sourceId?: string | null;
  title: string;
  body: string;
  tags?: string[];
  isFixture?: boolean;
  observedAt?: string;
  metadata?: Record<string, unknown>;
};

export type RagChunk = {
  id: string;
  documentId: string;
  sourceType: RagSourceType;
  sourceId?: string | null;
  title: string;
  text: string;
  tags: string[];
  isFixture: boolean;
  observedAt?: string;
  /** Sparse term weights (TF component after index build becomes TF-IDF) */
  terms: Record<string, number>;
  metadata?: Record<string, unknown>;
};

export type RagIndexStats = {
  documentCount: number;
  chunkCount: number;
  vocabularySize: number;
  fixtureChunks: number;
  liveChunks: number;
  sourceBreakdown: Record<string, number>;
  trainedAt: string;
  modelVersion: string;
};

export type RagIndex = {
  organizationId: string;
  chunks: RagChunk[];
  /** document frequency per term */
  df: Record<string, number>;
  nDocs: number;
  stats: RagIndexStats;
};

export type RagHit = {
  chunkId: string;
  documentId: string;
  sourceType: RagSourceType;
  sourceId?: string | null;
  title: string;
  text: string;
  score: number;
  isFixture: boolean;
  tags: string[];
  observedAt?: string;
};

export type RagQueryResult = {
  query: string;
  hits: RagHit[];
  groundedContext: string;
  citations: Array<{ id: string; title: string; sourceType: string; score: number }>;
  indexStats: Pick<RagIndexStats, 'chunkCount' | 'trainedAt' | 'modelVersion'>;
  honesty: {
    note: string;
    embeddingModel: string;
    generationMode: 'retrieval_only' | 'llm_grounded' | 'unavailable';
  };
};

export type RagTrainResult = {
  organizationId: string;
  stats: RagIndexStats;
  honesty: { note: string };
};

export const RAG_MODEL_VERSION = 'rag-tfidf-v1';

const STOP = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'but',
  'in',
  'on',
  'at',
  'to',
  'for',
  'of',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'with',
  'by',
  'from',
  'as',
  'it',
  'this',
  'that',
  'these',
  'those',
  'i',
  'we',
  'you',
  'they',
  'he',
  'she',
  'not',
  'no',
  'yes',
  'do',
  'does',
  'did',
  'if',
  'then',
  'so',
  'than',
  'too',
  'very',
  'can',
  'will',
  'just',
  'about',
  'into',
  'over',
  'after',
  'before',
  'up',
  'down',
  'out',
  'off',
  'our',
  'your',
  'their',
]);

/** Tokenize for sparse retrieval — stable, no stemming deps. */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9%$_\-\s]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !STOP.has(t));
}

export function termFrequency(tokens: string[]): Record<string, number> {
  const tf: Record<string, number> = {};
  for (const t of tokens) {
    tf[t] = (tf[t] ?? 0) + 1;
  }
  // L2-normalize raw TF for cosine stability
  const norm = Math.sqrt(Object.values(tf).reduce((s, v) => s + v * v, 0)) || 1;
  for (const k of Object.keys(tf)) {
    tf[k] = tf[k]! / norm;
  }
  return tf;
}

/** Split long documents into overlapping character windows. */
export function chunkDocument(
  doc: RagDocument,
  options?: { maxChars?: number; overlap?: number },
): RagChunk[] {
  const maxChars = options?.maxChars ?? 900;
  const overlap = options?.overlap ?? 120;
  const body = `${doc.title}\n\n${doc.body}`.trim();
  if (!body) return [];

  const pieces: string[] = [];
  if (body.length <= maxChars) {
    pieces.push(body);
  } else {
    let i = 0;
    while (i < body.length) {
      const end = Math.min(body.length, i + maxChars);
      pieces.push(body.slice(i, end));
      if (end >= body.length) break;
      i = Math.max(0, end - overlap);
    }
  }

  return pieces.map((text, idx) => {
    const tokens = tokenize(text);
    return {
      id: `${doc.id}#${idx}`,
      documentId: doc.id,
      sourceType: doc.sourceType,
      sourceId: doc.sourceId ?? null,
      title: pieces.length > 1 ? `${doc.title} (${idx + 1}/${pieces.length})` : doc.title,
      text,
      tags: doc.tags ?? [],
      isFixture: Boolean(doc.isFixture),
      observedAt: doc.observedAt,
      terms: termFrequency(tokens),
      metadata: doc.metadata,
    };
  });
}

/**
 * Build a sparse TF-IDF index from documents.
 * This is the "train" step for org-specific retrieval.
 */
export function buildRagIndex(
  organizationId: string,
  documents: RagDocument[],
  now = new Date(),
): RagIndex {
  const chunks: RagChunk[] = [];
  for (const doc of documents) {
    chunks.push(...chunkDocument(doc));
  }

  const df: Record<string, number> = {};
  for (const c of chunks) {
    const seen = new Set(Object.keys(c.terms));
    for (const term of seen) {
      df[term] = (df[term] ?? 0) + 1;
    }
  }

  const nDocs = Math.max(1, chunks.length);
  // Convert TF → TF-IDF in place
  for (const c of chunks) {
    const weighted: Record<string, number> = {};
    for (const [term, tf] of Object.entries(c.terms)) {
      const idf = Math.log(1 + nDocs / (1 + (df[term] ?? 0)));
      weighted[term] = tf * idf;
    }
    // re-normalize
    const norm =
      Math.sqrt(Object.values(weighted).reduce((s, v) => s + v * v, 0)) || 1;
    for (const k of Object.keys(weighted)) {
      weighted[k] = weighted[k]! / norm;
    }
    c.terms = weighted;
  }

  const sourceBreakdown: Record<string, number> = {};
  let fixtureChunks = 0;
  for (const c of chunks) {
    sourceBreakdown[c.sourceType] = (sourceBreakdown[c.sourceType] ?? 0) + 1;
    if (c.isFixture) fixtureChunks += 1;
  }

  return {
    organizationId,
    chunks,
    df,
    nDocs,
    stats: {
      documentCount: documents.length,
      chunkCount: chunks.length,
      vocabularySize: Object.keys(df).length,
      fixtureChunks,
      liveChunks: chunks.length - fixtureChunks,
      sourceBreakdown,
      trainedAt: now.toISOString(),
      modelVersion: RAG_MODEL_VERSION,
    },
  };
}

function cosineSparse(a: Record<string, number>, b: Record<string, number>): number {
  let dot = 0;
  // iterate smaller
  const [small, large] =
    Object.keys(a).length <= Object.keys(b).length ? [a, b] : [b, a];
  for (const [k, v] of Object.entries(small)) {
    const w = large[k];
    if (w != null) dot += v * w;
  }
  return dot; // both L2-normalized
}

/**
 * Retrieve top-k chunks for a query. Never invents content.
 */
export function retrieve(
  index: RagIndex,
  query: string,
  options?: {
    topK?: number;
    excludeFixtures?: boolean;
    sourceTypes?: RagSourceType[];
    minScore?: number;
  },
): RagHit[] {
  const topK = options?.topK ?? 8;
  const minScore = options?.minScore ?? 0.02;
  const qTokens = tokenize(query);
  if (qTokens.length === 0 || index.chunks.length === 0) return [];

  const qTf = termFrequency(qTokens);
  const qWeighted: Record<string, number> = {};
  for (const [term, tf] of Object.entries(qTf)) {
    const idf = Math.log(1 + index.nDocs / (1 + (index.df[term] ?? 0)));
    qWeighted[term] = tf * idf;
  }
  const qNorm =
    Math.sqrt(Object.values(qWeighted).reduce((s, v) => s + v * v, 0)) || 1;
  for (const k of Object.keys(qWeighted)) {
    qWeighted[k] = qWeighted[k]! / qNorm;
  }

  const hits: RagHit[] = [];
  for (const c of index.chunks) {
    if (options?.excludeFixtures && c.isFixture) continue;
    if (
      options?.sourceTypes?.length &&
      !options.sourceTypes.includes(c.sourceType)
    ) {
      continue;
    }
    const score = cosineSparse(qWeighted, c.terms);
    if (score < minScore) continue;
    hits.push({
      chunkId: c.id,
      documentId: c.documentId,
      sourceType: c.sourceType,
      sourceId: c.sourceId,
      title: c.title,
      text: c.text,
      score: Math.round(score * 1000) / 1000,
      isFixture: c.isFixture,
      tags: c.tags,
      observedAt: c.observedAt,
    });
  }

  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, topK);
}

/** Build grounded context block for LLM / operator preamble. */
export function buildGroundedContext(
  hits: RagHit[],
  options?: { maxChars?: number },
): string {
  const maxChars = options?.maxChars ?? 3500;
  if (hits.length === 0) {
    return 'No retrieved knowledge chunks. Index may be empty — run RAG train first.';
  }
  const parts: string[] = [
    '## Retrieved org knowledge (RAG)',
    'Use only the following evidence. Do not invent products, prices, or connector success.',
    '',
  ];
  let used = parts.join('\n').length;
  for (let i = 0; i < hits.length; i++) {
    const h = hits[i]!;
    const block = [
      `### [${i + 1}] ${h.title} (${h.sourceType}, score=${h.score})`,
      h.isFixture ? 'DATA CLASS: TEST FIXTURE — not live marketplace truth' : 'DATA CLASS: canonical/live',
      h.text.slice(0, 600),
      '',
    ].join('\n');
    if (used + block.length > maxChars) break;
    parts.push(block);
    used += block.length;
  }
  return parts.join('\n');
}

export function queryRagIndex(
  index: RagIndex,
  query: string,
  options?: {
    topK?: number;
    excludeFixtures?: boolean;
    sourceTypes?: RagSourceType[];
    generationMode?: RagQueryResult['honesty']['generationMode'];
  },
): RagQueryResult {
  const hits = retrieve(index, query, options);
  const groundedContext = buildGroundedContext(hits);
  return {
    query,
    hits,
    groundedContext,
    citations: hits.map((h) => ({
      id: h.chunkId,
      title: h.title,
      sourceType: h.sourceType,
      score: h.score,
    })),
    indexStats: {
      chunkCount: index.stats.chunkCount,
      trainedAt: index.stats.trainedAt,
      modelVersion: index.stats.modelVersion,
    },
    honesty: {
      note: 'RAG retrieves org-indexed chunks only. Empty hits mean no match — not fabricated knowledge. TF-IDF is not a neural embedding model.',
      embeddingModel: RAG_MODEL_VERSION,
      generationMode: options?.generationMode ?? 'retrieval_only',
    },
  };
}

/** Serialize index for disk cache (terms included). */
export function serializeRagIndex(index: RagIndex): string {
  return JSON.stringify(index);
}

export function deserializeRagIndex(raw: string): RagIndex {
  const parsed = JSON.parse(raw) as RagIndex;
  if (!parsed.organizationId || !Array.isArray(parsed.chunks)) {
    throw new Error('Invalid RAG index payload');
  }
  return parsed;
}

/**
 * Convert knowledge-base lesson entries (from operator runs) into RAG docs.
 */
export function knowledgeEntriesToDocuments(
  entries: Array<{
    id: string;
    objectivePattern: string;
    lesson: string;
    evidenceSummary: string;
    confidence: number;
    createdAt: string;
    runId?: string | null;
  }>,
): RagDocument[] {
  return entries.map((e) => ({
    id: `kb-${e.id}`,
    sourceType: 'operator_run' as const,
    sourceId: e.runId ?? e.id,
    title: `Lesson: ${e.objectivePattern.slice(0, 80)}`,
    body: `${e.lesson}\n\nEvidence: ${e.evidenceSummary}\nConfidence: ${e.confidence}`,
    tags: ['knowledge_base', 'lesson'],
    isFixture: false,
    observedAt: e.createdAt,
    metadata: { confidence: e.confidence },
  }));
}
