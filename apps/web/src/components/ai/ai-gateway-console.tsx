'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { getApiBaseUrl } from '../../lib/api';

type GatewayEvidence = {
  sourceType: string;
  provider: string;
  title?: string;
  url?: string;
  retrievedAt: string;
  freshness: string;
  snippet?: string;
};

type GatewayAction = {
  actionId: string;
  capability: string;
  status: string;
  requiresApproval: boolean;
  parameters: Record<string, unknown>;
};

type GatewayRecommendation = {
  title: string;
  reason: string;
  score: number;
  product?: string;
  estimatedDemand?: string;
  estimatedMarginPercent?: number;
  risk?: string;
};

type TradeOpsAIResponse = {
  requestId: string;
  tenantId: string;
  conversationId: string;
  output: {
    text: string;
    json: {
      objective?: string;
      recommendations?: GatewayRecommendation[];
      confidence?: number;
      sources?: Array<{ provider: string; sourceType: string; url?: string }>;
      informationNeed?: string;
      capabilitiesInvoked?: string[];
      error?: string;
    };
  };
  status: string;
  confidence: number;
  evidence: GatewayEvidence[];
  actions: GatewayAction[];
  warnings: string[];
  generatedAt: string;
  meta?: {
    schemaVersion?: string;
    aiProvider?: string;
    model?: string;
    informationNeed?: string;
    searchUsed?: boolean;
    toolsInvoked?: string[];
  };
};

type Catalog = {
  platform?: {
    xaiConfigured?: boolean;
    tavilyConfigured?: boolean;
    xaiModel?: string;
    architecture?: { rule?: string };
  };
  capabilities?: Array<{
    name: string;
    domain: string;
    description: string;
    write: boolean;
    requiresApproval: boolean;
    informationClass: string;
  }>;
  skills?: string[];
  note?: string;
};

const PRESETS = [
  'Find high-demand BMW M240i performance parts and identify which ones we could sell profitably.',
  'Why did our revenue decrease this week?',
  'What is social sentiment and trending talk on X about aftermarket brake kits?',
  'Compare supplier options for aluminum charge pipes (public research only).',
];

/**
 * Unified AI Gateway console — one AI, text + validated JSON envelope.
 * Frontend never chooses Tavily vs Shopify vs Stripe; the gateway does.
 */
export function AiGatewayConsole({
  initialObjective = '',
}: {
  initialObjective?: string;
}) {
  const [objective, setObjective] = useState(initialObjective);
  const [disableSearch, setDisableSearch] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<TradeOpsAIResponse | null>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${getApiBaseUrl()}/api/v1/ai/gateway`, {
          credentials: 'include',
          cache: 'no-store',
        });
        if (!res.ok) return;
        const data = (await res.json()) as Catalog;
        if (!cancelled) setCatalog(data);
      } catch {
        /* catalog optional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const run = useCallback(
    async (e?: FormEvent) => {
      e?.preventDefault();
      const obj = objective.trim();
      if (!obj) {
        setError('Enter an objective.');
        return;
      }
      setBusy(true);
      setError(null);
      try {
        const res = await fetch(`${getApiBaseUrl()}/api/v1/ai/gateway/run`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ objective: obj, disableSearch }),
        });
        const text = await res.text();
        let parsed: unknown = null;
        try {
          parsed = text ? JSON.parse(text) : null;
        } catch {
          parsed = null;
        }
        if (!res.ok) {
          const msg =
            typeof parsed === 'object' &&
            parsed &&
            'message' in parsed &&
            typeof (parsed as { message: unknown }).message === 'string'
              ? (parsed as { message: string }).message
              : `Gateway HTTP ${res.status}`;
          setError(msg);
          setResponse(null);
          return;
        }
        setResponse(parsed as TradeOpsAIResponse);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setResponse(null);
      } finally {
        setBusy(false);
      }
    },
    [objective, disableSearch],
  );

  const json = response?.output?.json;
  const recommendations = json?.recommendations ?? [];

  return (
    <article className="panel" style={{ marginBottom: 16 }}>
      <h2 style={{ marginTop: 0 }}>TradeOps AI Gateway</h2>
      <p className="meta" style={{ marginTop: 0 }}>
        One AI · AI Adapter (OpenAI primary) · Search Manager · Capability Gateway · connectors for
        operational truth. Response always includes <code>output.text</code> and{' '}
        <code>output.json</code>.
      </p>

      {catalog?.platform ? (
        <p className="meta">
          Runtime: <strong>{catalog.platform.aiProvider ?? 'openai'}</strong>
          {' · '}
          Model:{' '}
          <strong>
            {(catalog.platform as { openaiModel?: string; xaiModel?: string }).openaiModel ??
              catalog.platform.xaiModel ??
              '—'}
          </strong>
          {' · '}
          OpenAI:{' '}
          {(catalog.platform as { openaiConfigured?: boolean }).openaiConfigured
            ? 'key set'
            : 'missing'}
          {' · '}
          xAI: {catalog.platform.xaiConfigured ? 'key set' : 'optional'}
          {' · '}
          Tavily: {catalog.platform.tavilyConfigured ? 'key set' : 'optional'}
          {catalog.skills?.length ? (
            <>
              {' · '}
              Skills: {catalog.skills.join(', ')}
            </>
          ) : null}
        </p>
      ) : null}

      <form onSubmit={run}>
        <label className="meta" htmlFor="gateway-objective">
          Objective
        </label>
        <textarea
          id="gateway-objective"
          value={objective}
          onChange={(ev) => setObjective(ev.target.value)}
          rows={3}
          style={{ width: '100%', marginTop: 6, marginBottom: 8 }}
          placeholder="e.g. Find high-demand BMW M240i performance parts…"
          disabled={busy}
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 8 }}>
          <label className="meta" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={disableSearch}
              onChange={(ev) => setDisableSearch(ev.target.checked)}
              disabled={busy}
            />
            Disable public web search (operational / connector-only)
          </label>
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? 'Running…' : 'Run gateway'}
          </button>
        </div>
      </form>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {PRESETS.map((p) => (
          <button
            key={p.slice(0, 24)}
            type="button"
            className="btn ghost"
            style={{ fontSize: 12 }}
            disabled={busy}
            onClick={() => setObjective(p)}
          >
            {p.length > 48 ? `${p.slice(0, 48)}…` : p}
          </button>
        ))}
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      {response ? (
        <div style={{ display: 'grid', gap: 12 }}>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 12,
              alignItems: 'baseline',
            }}
          >
            <span className="meta">
              Status: <strong>{response.status}</strong>
            </span>
            <span className="meta">
              Confidence: <strong>{(response.confidence * 100).toFixed(0)}%</strong>
            </span>
            <span className="meta">
              Need: <strong>{response.meta?.informationNeed ?? json?.informationNeed ?? '—'}</strong>
            </span>
            <span className="meta">id: {response.requestId}</span>
          </div>

          <section>
            <h3 style={{ marginBottom: 6 }}>Text</h3>
            <div
              style={{
                whiteSpace: 'pre-wrap',
                lineHeight: 1.5,
                padding: 12,
                borderRadius: 8,
                border: '1px solid var(--border, #333)',
                background: 'var(--panel-muted, transparent)',
              }}
            >
              {response.output.text}
            </div>
          </section>

          {recommendations.length > 0 ? (
            <section>
              <h3 style={{ marginBottom: 6 }}>Recommendations (JSON cards)</h3>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                  gap: 10,
                }}
              >
                {recommendations.map((r, i) => (
                  <div
                    key={`${r.title}-${i}`}
                    style={{
                      border: '1px solid var(--border, #333)',
                      borderRadius: 8,
                      padding: 12,
                    }}
                  >
                    <strong>{r.title}</strong>
                    <p className="meta" style={{ margin: '6px 0' }}>
                      {r.reason}
                    </p>
                    <p className="meta" style={{ margin: 0 }}>
                      score {(r.score * (r.score <= 1 ? 100 : 1)).toFixed(0)}
                      {r.estimatedDemand ? ` · demand ${r.estimatedDemand}` : ''}
                      {typeof r.estimatedMarginPercent === 'number'
                        ? ` · margin ${r.estimatedMarginPercent}%`
                        : ''}
                      {r.risk ? ` · risk ${r.risk}` : ''}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {response.actions?.length ? (
            <section>
              <h3 style={{ marginBottom: 6 }}>Actions</h3>
              <ul className="meta">
                {response.actions.map((a) => (
                  <li key={a.actionId}>
                    <code>{a.capability}</code> · {a.status}
                    {a.requiresApproval ? ' · needs approval' : ''}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {response.evidence?.length ? (
            <section>
              <h3 style={{ marginBottom: 6 }}>Evidence</h3>
              <ul className="meta">
                {response.evidence.slice(0, 12).map((e, i) => (
                  <li key={`${e.provider}-${e.url ?? e.title ?? i}`}>
                    [{e.sourceType}/{e.provider}]{' '}
                    {e.url ? (
                      <a href={e.url} target="_blank" rel="noreferrer">
                        {e.title || e.url}
                      </a>
                    ) : (
                      e.title || e.snippet || e.provider
                    )}{' '}
                    · {e.freshness}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {response.warnings?.length ? (
            <section>
              <h3 style={{ marginBottom: 6 }}>Warnings</h3>
              <ul className="meta">
                {response.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </section>
          ) : null}

          <details>
            <summary className="meta">Raw JSON envelope</summary>
            <pre
              style={{
                overflow: 'auto',
                maxHeight: 320,
                fontSize: 12,
                padding: 10,
                borderRadius: 8,
                border: '1px solid var(--border, #333)',
              }}
            >
              {JSON.stringify(response, null, 2)}
            </pre>
          </details>
        </div>
      ) : null}

      {catalog?.capabilities?.length ? (
        <details style={{ marginTop: 12 }}>
          <summary className="meta">Normalized capabilities ({catalog.capabilities.length})</summary>
          <ul className="meta">
            {catalog.capabilities.map((c) => (
              <li key={c.name}>
                <code>{c.name}</code> · {c.informationClass}
                {c.write ? ' · write' : ''}
                {c.requiresApproval ? ' · approval' : ''}
              </li>
            ))}
          </ul>
          <p className="meta">{catalog.note}</p>
        </details>
      ) : null}
    </article>
  );
}
