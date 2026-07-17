'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { getApiBaseUrl } from '../../lib/api';

type Example = {
  id: string;
  name: string;
  description: string;
  objective: string;
  targetMarket?: string;
  requiredCapabilities: string[];
  riskClass: string;
  expectedStages: string[];
  completionCriteria: string[];
  objectiveTypeHint: string;
  runnable: boolean;
  readiness: string;
  reason: string;
  liveConnectorCount: number;
  fixtureConnectorCount: number;
  capabilities: Array<{
    capability: string;
    available: boolean;
    dataClass: string;
    providerKeys: string[];
  }>;
};

function readinessClass(r: string): string {
  if (r === 'ready') return 'text-positive';
  if (r === 'partially_ready') return 'text-warning';
  if (r === 'credentials_required' || r === 'not_implemented') return 'text-blocked';
  if (r === 'connector_unhealthy') return 'text-negative';
  return 'text-accent';
}

/**
 * Run live examples through POST /api/v1/ai/live-examples/:id/run
 */
export function LiveExamplesClient({ examples }: { examples: Example[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runExample(id: string) {
    setBusyId(id);
    setMsg(null);
    setError(null);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/v1/ai/live-examples/${id}/run`, {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceShadow: true }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        message?: string;
        blocked?: boolean;
        runId?: string;
        resultsPath?: string;
        responseSummary?: string;
        readiness?: string;
        objectiveType?: string;
        approvalRequired?: boolean;
        recommendations?: unknown[];
      };
      if (!res.ok) {
        throw new Error(body.message ?? `HTTP ${res.status}`);
      }
      if (body.blocked) {
        setMsg(body.message ?? 'Example blocked');
        return;
      }
      setMsg(
        body.responseSummary ??
          `Completed · type=${body.objectiveType} · approval=${String(body.approvalRequired)} · recs=${body.recommendations?.length ?? 0}`,
      );
      if (body.resultsPath) {
        router.push(body.resultsPath);
      } else if (body.runId) {
        router.push(`/terminal/objectives/${body.runId}`);
      } else {
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Run failed');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {msg ? <p className="meta text-accent">{msg}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}

      {examples.map((ex) => (
        <article key={ex.id} className="panel">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
              alignItems: 'flex-start',
            }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <h2 style={{ margin: '0 0 4px' }}>{ex.name}</h2>
              <p className="meta" style={{ margin: 0 }}>
                {ex.description}
              </p>
              <p style={{ margin: '8px 0' }}>
                <span className={`truth-label ${readinessClass(ex.readiness)}`}>
                  {ex.readiness.replace(/_/g, ' ')}
                </span>{' '}
                <span className="meta">{ex.reason}</span>
              </p>
              <p className="meta">
                Risk: <strong>{ex.riskClass}</strong> · Hint:{' '}
                <strong className="text-accent">{ex.objectiveTypeHint}</strong>
                {ex.targetMarket ? ` · Market ${ex.targetMarket}` : ''} · Live connectors:{' '}
                {ex.liveConnectorCount} · Fixture: {ex.fixtureConnectorCount}
              </p>
            </div>
            <div className="terminal-toolbar">
              <button
                type="button"
                className="btn ai"
                disabled={!!busyId || !ex.runnable}
                onClick={() => void runExample(ex.id)}
                title={ex.runnable ? 'Run through real operator services' : 'Not fully wired'}
              >
                {busyId === ex.id ? 'Running…' : ex.runnable ? 'Run example' : 'Not runnable'}
              </button>
              <Link className="btn ghost" href="/terminal/objectives">
                Objectives history
              </Link>
            </div>
          </div>

          <h3>Objective</h3>
          <p style={{ marginTop: 0 }}>{ex.objective}</p>

          <h3>Required capabilities</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {ex.capabilities.map((c) => (
              <span
                key={c.capability}
                className={`ai-tool-chip ${c.available ? '' : ''}`}
                title={c.providerKeys.join(', ') || 'none'}
              >
                {c.capability}
                {c.available ? ` · ${c.dataClass}` : ' · missing'}
              </span>
            ))}
          </div>

          <h3>Expected stages</h3>
          <p className="meta">{ex.expectedStages.join(' → ')}</p>

          <h3>Completion criteria</h3>
          <ul className="meta">
            {ex.completionCriteria.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  );
}
