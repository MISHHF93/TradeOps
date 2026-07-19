'use client';

import { useState } from 'react';
import { getApiBaseUrl } from '../../lib/api';

export function ProcurementEvaluatePanel({ productId }: { productId: string }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const api = getApiBaseUrl();

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${api}/api/v1/industrial/procurement/evaluate`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productId,
          quantity: 10,
          requirements: [],
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setResult(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="panel" style={{ marginTop: 16 }}>
      <h2>Evaluate procurement case</h2>
      <p className="meta">Product {productId.slice(0, 8)}…</p>
      <button type="button" className="btn primary" disabled={busy} onClick={() => void run()}>
        {busy ? 'Evaluating…' : 'Run procurement evaluation'}
      </button>
      {error ? <p className="form-error">{error}</p> : null}
      {result ? (
        <pre className="meta" style={{ whiteSpace: 'pre-wrap', marginTop: 12, maxHeight: 420, overflow: 'auto' }}>
          {JSON.stringify(result, null, 2)}
        </pre>
      ) : null}
    </article>
  );
}
