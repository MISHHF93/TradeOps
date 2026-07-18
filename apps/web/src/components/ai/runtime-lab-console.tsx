'use client';

import { useCallback, useEffect, useState } from 'react';
import { getApiBaseUrl } from '../../lib/api';

type HealthPayload = {
  status: string;
  runtime?: {
    enabled?: boolean;
    provider?: string;
    configured?: boolean;
    model?: string;
    providerProbe?: string;
    simulationMode?: boolean;
    responseCacheEnabled?: boolean;
    error?: string | null;
  };
  dependencies?: Record<string, string>;
  lastCheckedAt?: string;
  note?: string;
};

type ChatResponse = {
  requestId?: string;
  status?: string;
  dataMode?: string;
  confidence?: number;
  errorCode?: string;
  requiredAction?: string;
  output?: { text?: string; artifactType?: string; artifact?: unknown };
  provenance?: {
    sourceLabel?: string;
    aiProvider?: string | null;
    aiModel?: string | null;
    toolNames?: string[];
    traceId?: string;
    dataMode?: string;
  };
  warnings?: string[];
  evidence?: unknown[];
  actions?: Array<{ status?: string; requiresApproval?: boolean; description?: string }>;
  meta?: { latencyMs?: number; provider?: string; model?: string; toolsInvoked?: string[] };
};

type LabCase = {
  id: string;
  name: string;
  input: string;
  expect: string;
};

const CASES: LabCase[] = [
  {
    id: 'A',
    name: 'Greeting',
    input: 'Hi',
    expect: 'Real Cohere when key set; no tools; dataMode=live; never demo.',
  },
  {
    id: 'B',
    name: 'Classification',
    input: 'Classify this request: show my delayed shipments.',
    expect: 'Logistics intent; no fabricated shipment rows; blocked if connector missing.',
  },
  {
    id: 'C',
    name: 'Public research',
    input: 'Find current Canadian automotive aftermarket trends.',
    expect: 'Search when enabled; blocked/partial if WEB_SEARCH_ENABLED=false; no invented citations.',
  },
  {
    id: 'D',
    name: 'Commerce',
    input: 'Show our products with low inventory.',
    expect: 'Tenant-scoped tools; no sample catalog invented by the model.',
  },
  {
    id: 'E',
    name: 'Sensitive action',
    input: 'Reduce low-selling products by 20 percent.',
    expect: 'Proposal only; approval required; never claims execution completed.',
  },
];

/**
 * Admin/dev lab for proving the real Cohere path.
 * Never invents answers client-side — only displays backend envelopes.
 */
export function RuntimeLabConsole() {
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, { res: ChatResponse | null; error: string | null; ms: number }>>(
    {},
  );

  const refreshHealth = useCallback(async () => {
    setHealthError(null);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/v1/ai/health`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const text = await res.text();
      let data: unknown = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = null;
      }
      if (!res.ok) {
        setHealth(null);
        setHealthError(
          typeof data === 'object' && data && 'message' in data
            ? String((data as { message: unknown }).message)
            : `Health HTTP ${res.status}`,
        );
        return;
      }
      setHealth(data as HealthPayload);
    } catch (e) {
      setHealth(null);
      setHealthError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void refreshHealth();
  }, [refreshHealth]);

  const runCase = useCallback(async (c: LabCase) => {
    setBusyId(c.id);
    const t0 = Date.now();
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/v1/ai/chat`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ message: c.input, disableSearch: c.id === 'D' || c.id === 'E' }),
      });
      const text = await res.text();
      let parsed: ChatResponse | null = null;
      try {
        parsed = text ? (JSON.parse(text) as ChatResponse) : null;
      } catch {
        parsed = null;
      }
      if (!res.ok) {
        setResults((prev) => ({
          ...prev,
          [c.id]: {
            res: parsed,
            error:
              parsed?.output?.text ||
              (parsed as { message?: string } | null)?.message ||
              `HTTP ${res.status}`,
            ms: Date.now() - t0,
          },
        }));
        return;
      }
      setResults((prev) => ({
        ...prev,
        [c.id]: { res: parsed, error: null, ms: Date.now() - t0 },
      }));
    } catch (e) {
      setResults((prev) => ({
        ...prev,
        [c.id]: {
          res: null,
          error: e instanceof Error ? e.message : String(e),
          ms: Date.now() - t0,
        },
      }));
    } finally {
      setBusyId(null);
    }
  }, []);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <article className="panel">
        <h2 style={{ marginTop: 0 }}>Runtime health</h2>
        <p className="meta">
          <code>GET /api/v1/ai/health</code> — configuration + live provider probe (no secrets).
        </p>
        <button type="button" className="btn secondary" onClick={() => void refreshHealth()}>
          Refresh health
        </button>
        {healthError ? <p className="form-error">{healthError}</p> : null}
        {health ? (
          <ul className="kv" style={{ marginTop: 12 }}>
            <li>
              <span>Status</span>
              <strong
                className={
                  health.status === 'healthy'
                    ? 'text-accent'
                    : health.status === 'blocked'
                      ? 'text-blocked'
                      : 'text-warning'
                }
              >
                {health.status}
              </strong>
            </li>
            <li>
              <span>Provider</span>
              <strong>{health.runtime?.provider ?? '—'}</strong>
            </li>
            <li>
              <span>Configured</span>
              <strong>{String(health.runtime?.configured ?? false)}</strong>
            </li>
            <li>
              <span>Model</span>
              <strong>{health.runtime?.model ?? '—'}</strong>
            </li>
            <li>
              <span>Probe</span>
              <strong>{health.runtime?.providerProbe ?? '—'}</strong>
            </li>
            <li>
              <span>Simulation</span>
              <strong>{String(health.runtime?.simulationMode ?? false)}</strong>
            </li>
            <li>
              <span>AI cache</span>
              <strong>{String(health.runtime?.responseCacheEnabled ?? false)}</strong>
            </li>
            <li>
              <span>Search</span>
              <strong>{health.dependencies?.search ?? '—'}</strong>
            </li>
          </ul>
        ) : null}
        {health?.runtime?.error ? (
          <p className="form-error">{health.runtime.error}</p>
        ) : null}
        <p className="meta">{health?.note}</p>
      </article>

      <article className="panel">
        <h2 style={{ marginTop: 0 }}>Live cases (canonical chat only)</h2>
        <p className="meta">
          Each case calls <code>POST /api/v1/ai/chat</code>. The browser never invents assistant
          text. Missing Cohere key → <strong>blocked</strong>, not a demo answer.
        </p>
        <div style={{ display: 'grid', gap: 16 }}>
          {CASES.map((c) => {
            const r = results[c.id];
            const status = r?.res?.status;
            const blocked = status === 'blocked' || status === 'failed' || r?.error;
            return (
              <div
                key={c.id}
                style={{
                  border: '1px solid var(--border, #333)',
                  borderRadius: 8,
                  padding: 12,
                }}
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                  <strong>
                    Test {c.id} — {c.name}
                  </strong>
                  <button
                    type="button"
                    className="btn primary"
                    disabled={busyId !== null}
                    onClick={() => void runCase(c)}
                  >
                    {busyId === c.id ? 'Running…' : 'Run'}
                  </button>
                </div>
                <p className="meta" style={{ marginBottom: 4 }}>
                  Input: <code>{c.input}</code>
                </p>
                <p className="meta">Expect: {c.expect}</p>
                {r ? (
                  <div style={{ marginTop: 8 }}>
                    {r.error && !r.res ? (
                      <p className="form-error">{r.error}</p>
                    ) : (
                      <>
                        <p className="meta">
                          Status:{' '}
                          <strong className={blocked ? 'text-blocked' : 'text-accent'}>
                            {r.res?.status ?? '—'}
                          </strong>
                          {' · '}
                          Mode: <strong>{r.res?.dataMode ?? r.res?.provenance?.dataMode ?? '—'}</strong>
                          {' · '}
                          {r.ms}ms
                        </p>
                        {r.res?.provenance?.sourceLabel ? (
                          <p className="meta">Source: {r.res.provenance.sourceLabel}</p>
                        ) : null}
                        {r.res?.errorCode ? (
                          <p className="form-error">
                            {r.res.errorCode}
                            {r.res.requiredAction ? ` — ${r.res.requiredAction}` : ''}
                          </p>
                        ) : null}
                        <p className="meta">
                          id: {r.res?.requestId ?? '—'} · tools:{' '}
                          {(r.res?.provenance?.toolNames ?? r.res?.meta?.toolsInvoked ?? []).join(
                            ', ',
                          ) || 'none'}
                          {' · '}
                          provider: {r.res?.provenance?.aiProvider ?? r.res?.meta?.provider ?? '—'}
                          {' · '}
                          model: {r.res?.provenance?.aiModel ?? r.res?.meta?.model ?? '—'}
                        </p>
                        <div
                          style={{
                            whiteSpace: 'pre-wrap',
                            marginTop: 8,
                            padding: 10,
                            borderRadius: 6,
                            background: 'var(--panel-muted, transparent)',
                            border: blocked
                              ? '1px solid var(--danger, #a33)'
                              : '1px solid var(--border, #333)',
                          }}
                        >
                          {r.res?.output?.text ?? r.error ?? '—'}
                        </div>
                        {r.res?.actions && r.res.actions.length > 0 ? (
                          <ul className="meta">
                            {r.res.actions.map((a, i) => (
                              <li key={i}>
                                Action: {a.description ?? '—'} · {a.status}
                                {a.requiresApproval ? ' · approval required' : ''}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </article>
    </div>
  );
}
