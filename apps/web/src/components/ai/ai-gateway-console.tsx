'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { getApiBaseUrl } from '../../lib/api';
import type { TradeOpsAiChatResponse } from '../../lib/ai-response-contract';
import { aiChatDisplayText, isAiBlocked } from '../../lib/ai-response-contract';

type GatewayRecommendation = {
  title: string;
  reason: string;
  score: number;
  product?: string;
  estimatedDemand?: string;
  estimatedMarginPercent?: number;
  risk?: string;
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

/** Presets labeled by what they need so blocked states are expected, not “random fixed answers”. */
const PRESETS = [
  {
    label: 'Ops · inventory risks (tenant catalog)',
    text: 'What are my top inventory risks this week based on our product catalog?',
  },
  {
    label: 'Ops · open cases (tenant data)',
    text: 'List open product cases that need attention and name the blockers.',
  },
  {
    label: 'Knowledge · operator loop (no tools)',
    text: 'Explain what the TradeOps operator loop does in one short paragraph.',
  },
  {
    label: 'Research · needs web search keys',
    text: 'Search the web for current US tariff news on apparel imports.',
  },
];

/**
 * Unified AI Gateway console — one AI, text + validated JSON envelope.
 * Frontend never chooses Tavily vs Shopify vs Stripe; the gateway does.
 */
type ThreadTurn = {
  role: 'user' | 'assistant';
  content: string;
  status?: string;
  dataMode?: string;
  provider?: string | null;
  model?: string | null;
  requestId?: string;
};

export function AiGatewayConsole({
  initialObjective = '',
}: {
  initialObjective?: string;
}) {
  const [objective, setObjective] = useState(initialObjective);
  const [disableSearch, setDisableSearch] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<TradeOpsAiChatResponse | null>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [thread, setThread] = useState<ThreadTurn[]>([]);

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
        setError('Enter a message (e.g. Hi).');
        return;
      }
      setBusy(true);
      setError(null);
      setThread((prev) => [...prev, { role: 'user', content: obj }]);
      try {
        const res = await fetch(`${getApiBaseUrl()}/api/v1/ai/chat`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            message: obj,
            disableSearch,
            conversationId: conversationId ?? undefined,
          }),
        });
        const text = await res.text();
        let parsed: TradeOpsAiChatResponse | null = null;
        try {
          parsed = text ? (JSON.parse(text) as TradeOpsAiChatResponse) : null;
        } catch {
          parsed = null;
        }
        // Nest may return 201 for POST even when body.status is blocked — always use body.
        if (!res.ok && !parsed) {
          setError(`Chat HTTP ${res.status}`);
          return;
        }
        if (parsed) {
          setResponse(parsed);
          if (parsed.conversationId) setConversationId(parsed.conversationId);
          setThread((prev) => [
            ...prev,
            {
              role: 'assistant',
              content: aiChatDisplayText(parsed),
              status: parsed.status,
              dataMode: parsed.dataMode ?? parsed.provenance?.dataMode,
              provider: parsed.provenance?.aiProvider ?? parsed.meta?.provider,
              model: parsed.provenance?.aiModel ?? parsed.meta?.model,
              requestId: parsed.requestId,
            },
          ]);
          if (isAiBlocked(parsed) || parsed.status === 'failed') {
            setError(
              [parsed.errorCode, parsed.requiredAction, aiChatDisplayText(parsed)]
                .filter(Boolean)
                .join(' — '),
            );
          }
        }
        setObjective('');
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [objective, disableSearch, conversationId],
  );

  const json = response?.output?.json as
    | { recommendations?: GatewayRecommendation[] }
    | undefined;
  const artifact = response?.output?.artifact;
  const recommendations =
    json?.recommendations ??
    (Array.isArray(artifact?.recommendations)
      ? (artifact?.recommendations as GatewayRecommendation[])
      : []);

  const isBlockedOrFailed = Boolean(
    response && (isAiBlocked(response) || response.status === 'failed'),
  );

  return (
    <article className="panel" style={{ marginBottom: 16 }}>
      <h2 style={{ marginTop: 0 }}>TradeOps AI · live Cohere chat</h2>
      <p className="meta" style={{ marginTop: 0 }}>
        Canonical path: <code>POST /api/v1/ai/chat</code> → Cohere agent runtime (not a static script).
        Look for <strong>Live · cohere · model</strong> under each reply. Catalog answers may say
        TEST_FIXTURE when only demo products are seeded — that is honesty, not offline mode.
      </p>

      {catalog?.platform ? (
        <p className="meta">
          Provider: <strong>{(catalog.platform as { aiProvider?: string }).aiProvider ?? 'cohere'}</strong>
          {' · '}
          Cohere:{' '}
          {(catalog.platform as { cohereConfigured?: boolean }).cohereConfigured
            ? 'key set'
            : 'missing — set COHERE_API_KEY'}
          {' · '}
          OpenAI (optional search):{' '}
          {(catalog.platform as { openaiConfigured?: boolean }).openaiConfigured
            ? 'key set'
            : 'unset'}
          {' · '}
          xAI: {catalog.platform.xaiConfigured ? 'key set' : 'optional'}
          {catalog.skills?.length ? (
            <>
              {' · '}
              Skills: {catalog.skills.join(', ')}
            </>
          ) : null}
        </p>
      ) : null}

      {conversationId ? (
        <p className="meta">
          Conversation: <code>{conversationId.slice(0, 8)}…</code> (saved in database)
        </p>
      ) : (
        <p className="meta">New conversation will be created on first send and stored in the DB.</p>
      )}

      {thread.length > 0 ? (
        <div
          style={{
            display: 'grid',
            gap: 8,
            marginBottom: 12,
            maxHeight: 320,
            overflow: 'auto',
            padding: 8,
            border: '1px solid var(--border, #333)',
            borderRadius: 8,
          }}
        >
          {thread.map((t, i) => (
            <div
              key={`${t.role}-${i}`}
              style={{
                padding: 8,
                borderRadius: 6,
                background:
                  t.role === 'user' ? 'var(--panel-muted, #111)' : 'transparent',
              }}
            >
              <div className="meta">
                <strong>{t.role === 'user' ? 'You' : 'TradeOps AI'}</strong>
                {t.status ? ` · ${t.status}` : ''}
                {t.dataMode ? ` · ${t.dataMode}` : ''}
                {t.provider ? ` · ${t.provider}` : ''}
                {t.model ? ` · ${t.model}` : ''}
              </div>
              <div style={{ whiteSpace: 'pre-wrap', marginTop: 4 }}>{t.content}</div>
            </div>
          ))}
        </div>
      ) : null}

      <form onSubmit={run}>
        <label className="meta" htmlFor="gateway-objective">
          Message
        </label>
        <textarea
          id="gateway-objective"
          value={objective}
          onChange={(ev) => setObjective(ev.target.value)}
          rows={3}
          style={{ width: '100%', marginTop: 6, marginBottom: 8 }}
          placeholder='Try "Hi" — needs COHERE_API_KEY for a live reply (not a canned script)'
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
            {busy ? 'Thinking…' : 'Send'}
          </button>
          <button
            type="button"
            className="btn ghost"
            disabled={busy}
            onClick={() => {
              setConversationId(null);
              setThread([]);
              setResponse(null);
              setError(null);
            }}
          >
            New conversation
          </button>
        </div>
      </form>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            className="btn ghost"
            style={{ fontSize: 12 }}
            disabled={busy}
            onClick={() => setObjective(p.text)}
            title={p.text}
          >
            {p.label}
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
              Status:{' '}
              <strong
                className={
                  isBlockedOrFailed
                    ? 'text-blocked'
                    : response.status === 'partial'
                      ? 'text-warning'
                      : 'text-accent'
                }
              >
                {response.status}
              </strong>
            </span>
            <span className="meta">
              Mode: <strong>{response.dataMode ?? response.provenance?.dataMode ?? '—'}</strong>
            </span>
            <span className="meta">
              AI:{' '}
              <strong>
                {response.provenance?.sourceLabel ??
                  `${response.meta?.provider ?? '—'} · ${response.meta?.model ?? '—'}`}
              </strong>
            </span>
            {response.meta?.latencyMs != null ? (
              <span className="meta">
                Latency: <strong>{response.meta.latencyMs}ms</strong>
              </span>
            ) : null}
            <span className="meta">
              Confidence: <strong>{(response.confidence * 100).toFixed(0)}%</strong>
            </span>
            <span className="meta">
              Need:{' '}
              <strong>
                {response.intent?.informationMode ??
                  response.meta?.informationNeed ??
                  json?.informationNeed ??
                  '—'}
              </strong>
            </span>
            <span className="meta">
              Provider:{' '}
              <strong>
                {response.provenance?.aiProvider ??
                  response.meta?.provider ??
                  response.meta?.aiProvider ??
                  '—'}
              </strong>
            </span>
            <span className="meta">id: {response.requestId}</span>
          </div>

          {response.provenance?.sourceLabel ? (
            <p className="meta" style={{ margin: 0 }}>
              Source: <strong>{response.provenance.sourceLabel}</strong>
              {response.provenance.traceId ? (
                <> · trace {response.provenance.traceId.slice(0, 16)}</>
              ) : null}
            </p>
          ) : null}

          {isBlockedOrFailed ? (
            <div className="form-error" style={{ padding: 12, borderRadius: 8 }}>
              <strong>{response.errorCode ?? response.status}</strong>
              {response.requiredAction ||
              (typeof response.output?.artifact === 'object' &&
                response.output.artifact &&
                'requiredAction' in response.output.artifact) ? (
                <p style={{ marginBottom: 0 }}>
                  Action:{' '}
                  {response.requiredAction ??
                    String(
                      (response.output.artifact as { requiredAction?: string }).requiredAction ??
                        '',
                    )}
                </p>
              ) : null}
            </div>
          ) : null}

          {response.dataMode === 'simulation' ? (
            <p className="text-warning">
              <strong>SIMULATION</strong> — not live operational data.
            </p>
          ) : null}

          <section>
            <h3 style={{ marginBottom: 6 }}>Text</h3>
            <div
              style={{
                whiteSpace: 'pre-wrap',
                lineHeight: 1.5,
                padding: 12,
                borderRadius: 8,
                border: isBlockedOrFailed
                  ? '1px solid var(--danger, #a33)'
                  : '1px solid var(--border, #333)',
                background: 'var(--panel-muted, transparent)',
              }}
            >
              {response.output.text}
            </div>
          </section>

          {response.output.artifactType ? (
            <p className="meta">
              Artifact: <code>{response.output.artifactType}</code>
            </p>
          ) : null}

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
