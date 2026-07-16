'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { getApiBaseUrl } from '../lib/api';
import { DemoLoopButton } from './demo-loop-button';

export function PipelineActions() {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function evaluate() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/v1/terminal/evaluate`, {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(typeof body.message === 'string' ? body.message : `HTTP ${res.status}`);
        return;
      }
      setMsg(
        `Evaluation: n=${body.sampleSize} MAE units=${body.meanAbsoluteUnitError} · ${body.recommendation}`,
      );
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="terminal-toolbar" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
      <DemoLoopButton label="Fill pipeline (demo loop)" />
      <button type="button" className="btn ghost" disabled={busy} onClick={() => void evaluate()}>
        Evaluate predictions
      </button>
      {msg ? (
        <span className="meta" style={{ maxWidth: 420, whiteSpace: 'normal' }}>
          {msg}
        </span>
      ) : null}
    </div>
  );
}
