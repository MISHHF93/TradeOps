'use client';

import { useCallback, useState } from 'react';
import { getApiBaseUrl } from '../../lib/api';

type RagStatus = {
  trained: boolean;
  stats: {
    documentCount: number;
    chunkCount: number;
    vocabularySize: number;
    fixtureChunks: number;
    liveChunks: number;
    sourceBreakdown: Record<string, number>;
    trainedAt: string;
    modelVersion: string;
  } | null;
  llmConfigured: boolean;
  embeddingModel: string;
  honesty?: { note: string };
};

type QueryResult = {
  query?: string;
  hits?: Array<{
    title: string;
    sourceType: string;
    score: number;
    isFixture: boolean;
    text: string;
  }>;
  answer?: string | null;
  llm?: { ok: boolean; model?: string; error?: string };
  error?: string;
  honesty?: { note: string; generationMode?: string };
  indexStats?: { chunkCount: number; trainedAt: string; modelVersion: string };
};

/**
 * Train (reindex) + query the org RAG engine from the terminal.
 * Retrieval always works offline; free-form answers need XAI_API_KEY.
 */
export function RagConsole() {
  const [status, setStatus] = useState<RagStatus | null>(null);
  const [query, setQuery] = useState(
    'Which products have the best margin and what should I evaluate next?',
  );
  const [generate, setGenerate] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const api = getApiBaseUrl();

  const refreshStatus = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`${api}/api/v1/ai/rag/status`, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error(`Status HTTP ${res.status}`);
      setStatus((await res.json()) as RagStatus);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [api]);

  const train = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${api}/api/v1/ai/rag/train`, {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error(`Train HTTP ${res.status}`);
      const body = (await res.json()) as { stats?: RagStatus['stats']; honesty?: { note: string } };
      setStatus((prev) => ({
        trained: true,
        stats: body.stats ?? null,
        llmConfigured: prev?.llmConfigured ?? false,
        embeddingModel: body.stats?.modelVersion ?? 'rag-tfidf-v1',
        honesty: body.honesty,
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const runQuery = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`${api}/api/v1/ai/rag/query`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          topK: 8,
          generate,
          autoTrainIfMissing: true,
        }),
      });
      if (!res.ok) throw new Error(`Query HTTP ${res.status}`);
      setResult((await res.json()) as QueryResult);
      void refreshStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="panel" style={{ marginTop: 16 }}>
      <h2>RAG Engine · org knowledge training</h2>
      <p className="meta">
        Train rebuilds a sparse TF-IDF index from your products, cases, AI runs, connectors, and
        SOPs. This is continuous retrieval training — not GPU fine-tuning of foundation model
        weights. Optional grounded answers use SpaceXAI/xAI when <code>XAI_API_KEY</code> is set.
      </p>

      <div className="ai-quick-row" style={{ marginBottom: 12, gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="btn primary" disabled={busy} onClick={() => void train()}>
          {busy ? 'Working…' : 'Train / reindex'}
        </button>
        <button
          type="button"
          className="btn ghost"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              const res = await fetch(`${api}/api/v1/ai/rag/export-csv`, {
                method: 'POST',
                credentials: 'include',
                headers: { Accept: 'application/json' },
              });
              if (!res.ok) throw new Error(`Export HTTP ${res.status}`);
              const body = (await res.json()) as { rowCount?: number; fileName?: string };
              setResult({
                query: 'export-csv',
                hits: [],
                honesty: {
                  note: `Wrote ${body.fileName ?? 'artifacts-corpus.csv'} (${body.rowCount ?? 0} rows) at repo root.`,
                },
              });
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          Export artifacts CSV
        </button>
        <button
          type="button"
          className="btn ghost"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              const res = await fetch(`${api}/api/v1/ai/intelligence/rebuild`, {
                method: 'POST',
                credentials: 'include',
                headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
                body: '{}',
              });
              if (!res.ok) throw new Error(`Rebuild HTTP ${res.status}`);
              const body = await res.json();
              setResult({
                query: 'intelligence-rebuild',
                hits: [],
                answer: JSON.stringify(body, null, 2).slice(0, 2500),
              });
              void refreshStatus();
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          Full rebuild (CSV + RAG + predict)
        </button>
        <button
          type="button"
          className="btn ghost"
          disabled={busy}
          onClick={() => void refreshStatus()}
        >
          Refresh status
        </button>
      </div>

      {status ? (
        <ul className="kv">
          <li>
            <span>Trained</span>
            <strong>{status.trained ? 'yes' : 'no'}</strong>
          </li>
          <li>
            <span>Chunks</span>
            <strong>{status.stats?.chunkCount ?? 0}</strong>
          </li>
          <li>
            <span>Documents</span>
            <strong>{status.stats?.documentCount ?? 0}</strong>
          </li>
          <li>
            <span>Vocab</span>
            <strong>{status.stats?.vocabularySize ?? 0}</strong>
          </li>
          <li>
            <span>Fixture chunks</span>
            <strong>{status.stats?.fixtureChunks ?? 0}</strong>
          </li>
          <li>
            <span>LLM (xAI)</span>
            <strong>{status.llmConfigured ? 'configured' : 'retrieval only'}</strong>
          </li>
          <li>
            <span>Model</span>
            <strong>{status.stats?.modelVersion ?? status.embeddingModel}</strong>
          </li>
          {status.stats?.trainedAt ? (
            <li>
              <span>Last train</span>
              <strong>{new Date(status.stats.trainedAt).toLocaleString()}</strong>
            </li>
          ) : null}
        </ul>
      ) : (
        <p className="meta">Click Refresh status or Train to load the index.</p>
      )}

      <label className="meta" style={{ display: 'block', marginTop: 12 }}>
        Query
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          rows={3}
          style={{ width: '100%', marginTop: 4 }}
          aria-label="RAG query"
        />
      </label>

      <label className="meta" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
        <input
          type="checkbox"
          checked={generate}
          onChange={(e) => setGenerate(e.target.checked)}
        />
        Ground free-form answer with xAI Grok (on by default when XAI_API_KEY + mode allow)
      </label>

      <button
        type="button"
        className="btn primary"
        style={{ marginTop: 12 }}
        disabled={busy || !query.trim()}
        onClick={() => void runQuery()}
      >
        Query knowledge
      </button>

      {error ? <p className="form-error">{error}</p> : null}

      {result?.answer ? (
        <div style={{ marginTop: 16 }}>
          <h3>Grounded answer</h3>
          <pre className="meta" style={{ whiteSpace: 'pre-wrap' }}>
            {result.answer}
          </pre>
          {result.llm?.model ? (
            <p className="meta">Model: {result.llm.model}</p>
          ) : null}
        </div>
      ) : null}

      {result?.hits?.length ? (
        <div style={{ marginTop: 16 }}>
          <h3>Retrieved chunks ({result.hits.length})</h3>
          <ol>
            {result.hits.map((h, i) => (
              <li key={`${h.title}-${i}`} style={{ marginBottom: 10 }}>
                <strong>
                  {h.title}
                </strong>{' '}
                <span className="meta">
                  {h.sourceType} · score {h.score}
                  {h.isFixture ? ' · TEST FIXTURE' : ''}
                </span>
                <div className="meta" style={{ whiteSpace: 'pre-wrap' }}>
                  {h.text.slice(0, 280)}
                  {h.text.length > 280 ? '…' : ''}
                </div>
              </li>
            ))}
          </ol>
        </div>
      ) : result && !result.error ? (
        <p className="meta" style={{ marginTop: 12 }}>
          No hits for this query. Train after importing products, or broaden the question.
        </p>
      ) : null}

      {result?.honesty?.note ? (
        <p className="meta" style={{ marginTop: 12 }}>
          {result.honesty.note}
        </p>
      ) : status?.honesty?.note ? (
        <p className="meta" style={{ marginTop: 12 }}>
          {status.honesty.note}
        </p>
      ) : null}
    </article>
  );
}
