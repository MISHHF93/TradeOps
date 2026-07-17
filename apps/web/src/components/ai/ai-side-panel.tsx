'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { getApiBaseUrl } from '../../lib/api';

const QUICK = [
  'Find products worth evaluating.',
  'Inspect connector health.',
  'Show active orders and cash exposure.',
  'Prepare strongest products for approval.',
  'Diagnose platform errors and policy blocks.',
];

/**
 * Persistent AI operator strip on terminal pages (professor / AI_OPERATOR.md).
 * Full workspace remains at /terminal/ai.
 */
export function AiSidePanel() {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [objective, setObjective] = useState(QUICK[0]!);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<{
    decision?: string;
    note?: string;
    recs?: number;
    runId?: string;
  } | null>(null);

  async function run(e?: FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/v1/ai/operator/run`, {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ objective, forceShadow: true }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        message?: string;
        decision?: string;
        decisionNote?: string;
        recommendations?: unknown[];
        runId?: string;
      };
      if (!res.ok) {
        setError(body.message ?? `HTTP ${res.status}`);
        return;
      }
      setLast({
        decision: body.decision,
        note: body.decisionNote,
        recs: body.recommendations?.length ?? 0,
        runId: body.runId,
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Run failed');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="btn ai ai-side-panel-fab" onClick={() => setOpen(true)}>
        AI Operator
      </button>
    );
  }

  return (
    <aside className="ai-side-panel" aria-label="AI Operator side panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: '0.95rem' }}>AI Operator</strong>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/terminal/ai" className="meta">
            Full workspace
          </Link>
          <button type="button" className="btn ghost" style={{ padding: '2px 8px' }} onClick={() => setOpen(false)}>
            Hide
          </button>
        </div>
      </div>
      <p className="meta" style={{ margin: 0 }}>
        Shadow by default · typed tools · approval-gated consequences
      </p>
      <form onSubmit={(e) => void run(e)} style={{ display: 'grid', gap: 8 }}>
        <textarea
          className="ai-objective-input"
          value={objective}
          onChange={(e) => setObjective(e.target.value)}
          rows={3}
          disabled={busy}
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {QUICK.map((q) => (
            <button
              key={q}
              type="button"
              className="btn ghost"
              style={{ padding: '2px 6px', fontSize: '0.7rem' }}
              disabled={busy}
              onClick={() => setObjective(q)}
            >
              {q.slice(0, 28)}…
            </button>
          ))}
        </div>
        <button className="btn primary" type="submit" disabled={busy || !objective.trim()}>
          {busy ? 'Running…' : 'Run objective'}
        </button>
      </form>
      {error ? <p className="form-error">{error}</p> : null}
      {last ? (
        <div className="meta">
          <div>
            Decision: <strong>{last.decision}</strong> · recs {last.recs}
          </div>
          {last.note ? <div style={{ marginTop: 4 }}>{last.note.slice(0, 200)}</div> : null}
        </div>
      ) : null}
    </aside>
  );
}
