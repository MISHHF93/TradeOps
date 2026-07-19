'use client';

import { useCallback, useEffect, useState } from 'react';
import { getApiBaseUrl } from '../../lib/api';

type AiStatus = {
  provider?: string;
  configured?: boolean;
  mode?: string;
  chatModel?: string;
  embedModel?: string | null;
  defaultGenerate?: boolean;
  note?: string;
  usesXai?: boolean;
  rag?: { trained?: boolean; embeddingMode?: string };
  probe?: { ok?: boolean; latencyMs?: number; error?: string; model?: string };
};

/**
 * xAI-first status strip for the AI terminal.
 */
export function XaiStatusBar() {
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [probing, setProbing] = useState(false);
  const api = getApiBaseUrl();

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`${api}/api/v1/ai/status`, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStatus((await res.json()) as AiStatus);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const probe = async () => {
    setProbing(true);
    setError(null);
    try {
      const res = await fetch(`${api}/api/v1/ai/xai/probe`, {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error(`Probe HTTP ${res.status}`);
      const body = (await res.json()) as AiStatus & {
        probe?: AiStatus['probe'];
      };
      setStatus((prev) => ({ ...prev, ...body, probe: body.probe }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setProbing(false);
    }
  };

  const connected = Boolean(status?.configured && status?.usesXai !== false);
  const label = !status
    ? 'Loading xAI…'
    : status.configured
      ? `xAI · ${status.chatModel ?? 'grok'} · mode ${status.mode ?? '—'}`
      : 'xAI not configured · tools + local RAG only';

  return (
    <article
      className="panel"
      style={{
        marginBottom: 16,
        borderLeft: connected
          ? '3px solid var(--accent, #25C7E8)'
          : '3px solid var(--border, #333)',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <strong>{label}</strong>
          <p className="meta" style={{ margin: '4px 0 0' }}>
            {status?.note ??
              'Primary free-form provider is xAI Grok. Set XAI_API_KEY in server .env (console.x.ai).'}
            {status?.rag?.trained
              ? ` · RAG trained (${status.rag.embeddingMode ?? 'index'})`
              : ' · RAG not trained yet'}
            {status?.probe
              ? status.probe.ok
                ? ` · probe ok ${status.probe.latencyMs}ms`
                : ` · probe failed: ${status.probe.error ?? 'error'}`
              : ''}
          </p>
        </div>
        <div className="ai-quick-row" style={{ gap: 8 }}>
          <button type="button" className="btn ghost" onClick={() => void load()}>
            Refresh
          </button>
          <button
            type="button"
            className="btn primary"
            disabled={probing || !status?.configured}
            onClick={() => void probe()}
          >
            {probing ? 'Probing…' : 'Probe xAI'}
          </button>
        </div>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
    </article>
  );
}
