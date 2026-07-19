'use client';

import { useCallback, useState } from 'react';
import { getApiBaseUrl } from '../../lib/api';

type PredStatus = {
  outcomeSampleSize: number;
  demandForecastCount: number;
  activeModel: { version: string; createdAt: string } | null;
  weights: { unitBias: number; modelVersion: string; sampleSize: number } | null;
  honesty?: { note: string };
};

/**
 * Train / run transparent prediction engine from the terminal.
 */
export function PredictionConsole() {
  const [status, setStatus] = useState<PredStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const api = getApiBaseUrl();

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`${api}/api/v1/ai/prediction/status`, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStatus((await res.json()) as PredStatus);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [api]);

  const post = async (path: string, label: string) => {
    setBusy(true);
    setError(null);
    setLog(null);
    try {
      const res = await fetch(`${api}${path}`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: '{}',
      });
      if (!res.ok) throw new Error(`${label} HTTP ${res.status}`);
      const body = await res.json();
      setLog(`${label}: ${JSON.stringify(body, null, 2).slice(0, 2000)}`);
      void refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="panel" style={{ marginTop: 16 }}>
      <h2>Prediction Engine</h2>
      <p className="meta">
        Transparent demand/profit/signal forecasts (baseline-ma-v2 + outcome bias fit). Not a neural
        black box. Empty history → zero units, low confidence.
      </p>
      <div className="ai-quick-row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <button type="button" className="btn ghost" disabled={busy} onClick={() => void refresh()}>
          Refresh status
        </button>
        <button
          type="button"
          className="btn primary"
          disabled={busy}
          onClick={() => void post('/api/v1/ai/prediction/train', 'Train')}
        >
          Train model
        </button>
        <button
          type="button"
          className="btn primary"
          disabled={busy}
          onClick={() => void post('/api/v1/ai/prediction/run', 'Run')}
        >
          Run batch
        </button>
        <button
          type="button"
          className="btn ghost"
          disabled={busy}
          onClick={() => void post('/api/v1/ai/prediction/evaluate', 'Evaluate')}
        >
          Evaluate
        </button>
        <button
          type="button"
          className="btn ghost"
          disabled={busy}
          onClick={() => void post('/api/v1/ai/prediction/export-csv', 'Export CSV')}
        >
          Export predictions.csv
        </button>
      </div>
      {status ? (
        <ul className="kv">
          <li>
            <span>Outcomes</span>
            <strong>{status.outcomeSampleSize}</strong>
          </li>
          <li>
            <span>Forecasts stored</span>
            <strong>{status.demandForecastCount}</strong>
          </li>
          <li>
            <span>Model</span>
            <strong>{status.activeModel?.version ?? status.weights?.modelVersion ?? '—'}</strong>
          </li>
          <li>
            <span>Unit bias</span>
            <strong>{status.weights?.unitBias?.toFixed?.(3) ?? '1.000'}</strong>
          </li>
        </ul>
      ) : (
        <p className="meta">Refresh status to load model metrics.</p>
      )}
      {error ? <p className="form-error">{error}</p> : null}
      {log ? (
        <pre className="meta" style={{ whiteSpace: 'pre-wrap', maxHeight: 240, overflow: 'auto' }}>
          {log}
        </pre>
      ) : null}
      {status?.honesty?.note ? <p className="meta">{status.honesty.note}</p> : null}
    </article>
  );
}
