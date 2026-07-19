'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getApiBaseUrl } from '../../lib/api';

type NormalizedLiveItem = {
  id: string;
  sourceId: string;
  source: string;
  title: string;
  description?: string;
  url: string;
  imageUrl?: string;
  price?: { amount: number; currency: string };
  seller?: { name: string; rating?: number };
  availability: string;
  score?: number;
  retrievedAt: string;
  dataMode: string;
};

type LiveEvent =
  | { type: string; queryId?: string; query?: string; message?: string; summary?: string }
  | {
      type: 'item.projected' | 'item.discovered' | 'item.normalized' | 'item.reranked';
      item: NormalizedLiveItem;
      rank?: number;
    }
  | { type: 'source.started' | 'source.completed' | 'source.failed'; source: string; label?: string; message?: string; itemCount?: number }
  | { type: 'query.completed'; itemCount: number; summary?: string };

/**
 * Live product projection UI — POST query, SSE item stream.
 * Never holds API keys; backend owns credentials + adapters.
 */
export function LiveProjectionPanel() {
  const [query, setQuery] = useState('industrial pumps under 2000');
  const [running, setRunning] = useState(false);
  const [queryId, setQueryId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('Idle');
  const [log, setLog] = useState<string[]>([]);
  const [items, setItems] = useState<NormalizedLiveItem[]>([]);
  const esRef = useRef<EventSource | null>(null);

  const pushLog = useCallback((line: string) => {
    setLog((prev) => [line, ...prev].slice(0, 40));
  }, []);

  const stopStream = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    setRunning(false);
  }, []);

  useEffect(() => () => stopStream(), [stopStream]);

  async function startSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q || running) return;

    stopStream();
    setItems([]);
    setLog([]);
    setStatus('Starting…');
    setRunning(true);

    const base = getApiBaseUrl();
    try {
      const res = await fetch(`${base}/api/v1/live-search`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ query: q }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setStatus(body.message ?? `HTTP ${res.status}`);
        setRunning(false);
        return;
      }
      const body = (await res.json()) as { queryId: string };
      setQueryId(body.queryId);
      setStatus(`Streaming ${body.queryId}…`);
      pushLog(`query.started ${body.queryId}`);

      const es = new EventSource(`${base}/api/v1/live-search/${body.queryId}/events`, {
        withCredentials: true,
      });
      esRef.current = es;

      es.onmessage = (msg) => {
        let ev: LiveEvent;
        try {
          ev = JSON.parse(msg.data) as LiveEvent;
        } catch {
          return;
        }
        handleEvent(ev);
      };
      es.onerror = () => {
        // Stream end or network error
        pushLog('sse closed/error');
        stopStream();
        setStatus((s) => (s.startsWith('Done') ? s : 'Stream closed'));
      };
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Failed to start');
      setRunning(false);
    }
  }

  function handleEvent(ev: LiveEvent) {
    const t = ev.type;
    if (t === 'sse.open') {
      pushLog('sse.open');
      return;
    }
    if (t === 'source.started' && 'source' in ev) {
      pushLog(`source.started ${(ev as { source: string; label?: string }).source}`);
      setStatus(`Searching ${(ev as { label?: string; source: string }).label ?? (ev as { source: string }).source}…`);
      return;
    }
    if (t === 'source.failed' && 'message' in ev) {
      pushLog(`source.failed ${(ev as { source: string; message?: string }).source}: ${(ev as { message?: string }).message}`);
      return;
    }
    if (t === 'source.completed' && 'itemCount' in ev) {
      pushLog(`source.completed ${(ev as { source: string }).source} ×${(ev as { itemCount?: number }).itemCount ?? 0}`);
      return;
    }
    if (
      (t === 'item.projected' || t === 'item.reranked') &&
      'item' in ev &&
      (ev as { item: NormalizedLiveItem }).item
    ) {
      const item = (ev as { item: NormalizedLiveItem }).item;
      setItems((prev) => {
        const next = prev.filter((x) => x.id !== item.id);
        next.push(item);
        next.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
        return next;
      });
      if (t === 'item.projected') {
        pushLog(`item.projected ${item.title.slice(0, 48)}`);
      }
      return;
    }
    if (t === 'query.completed') {
      const c = ev as { itemCount?: number; summary?: string };
      setStatus(`Done · ${c.itemCount ?? 0} items${c.summary ? ` · ${c.summary}` : ''}`);
      pushLog(`query.completed ${c.itemCount ?? 0}`);
      stopStream();
      return;
    }
    if (t === 'query.failed') {
      setStatus((ev as { message?: string }).message ?? 'Query failed');
      pushLog(`query.failed`);
      stopStream();
    }
  }

  async function cancel() {
    if (!queryId) {
      stopStream();
      return;
    }
    try {
      await fetch(`${getApiBaseUrl()}/api/v1/live-search/${queryId}/cancel`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      /* ignore */
    }
    stopStream();
    setStatus('Cancelled');
  }

  return (
    <section className="panel" style={{ marginBottom: 20 }}>
      <header style={{ marginBottom: 12 }}>
        <p className="pill">Live projection · SSE</p>
        <h2 style={{ margin: '6px 0' }}>Progressive product discovery</h2>
        <p className="meta" style={{ margin: 0 }}>
          Catalog + optional web search → normalize → Cohere rerank → stream cards. API keys stay on
          the server.
        </p>
      </header>

      <form onSubmit={startSearch} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find industrial pumps under $2,000…"
          aria-label="Live search query"
          style={{ flex: '1 1 240px', minHeight: 36 }}
          disabled={running}
        />
        <button type="submit" className="btn primary" disabled={running || !query.trim()}>
          {running ? 'Streaming…' : 'Live search'}
        </button>
        {running ? (
          <button type="button" className="btn secondary" onClick={() => void cancel()}>
            Cancel
          </button>
        ) : null}
      </form>

      <p className="meta" style={{ marginBottom: 10 }}>
        {status}
        {queryId ? ` · ${queryId}` : ''}
      </p>

      {items.length > 0 ? (
        <div className="detail-grid" style={{ marginBottom: 12 }}>
          {items.map((item) => (
            <article className="panel" key={item.id} style={{ padding: 12 }}>
              <p className="meta" style={{ margin: '0 0 4px' }}>
                {item.source} · {item.dataMode}
                {typeof item.score === 'number' ? ` · score ${item.score.toFixed(2)}` : ''}
              </p>
              <h3 style={{ margin: '0 0 6px', fontSize: '1rem' }}>{item.title}</h3>
              {item.price ? (
                <p style={{ margin: '0 0 6px' }}>
                  <strong>
                    {item.price.currency} {item.price.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </strong>
                </p>
              ) : null}
              {item.description ? (
                <p className="meta" style={{ margin: '0 0 8px' }}>
                  {item.description.slice(0, 180)}
                  {item.description.length > 180 ? '…' : ''}
                </p>
              ) : null}
              {item.url.startsWith('/') ? (
                <Link className="btn ghost" href={item.url}>
                  Open in TradeOps
                </Link>
              ) : (
                <a className="btn ghost" href={item.url} target="_blank" rel="noreferrer">
                  Open source
                </a>
              )}
              <p className="meta" style={{ margin: '8px 0 0', fontSize: '0.65rem' }}>
                {item.retrievedAt}
              </p>
            </article>
          ))}
        </div>
      ) : (
        <p className="meta">Projected items appear here as sources respond.</p>
      )}

      {log.length > 0 ? (
        <details>
          <summary className="meta">Event log ({log.length})</summary>
          <ul className="meta" style={{ margin: '8px 0 0', paddingLeft: 18 }}>
            {log.map((line, i) => (
              <li key={`${i}-${line.slice(0, 12)}`}>{line}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
