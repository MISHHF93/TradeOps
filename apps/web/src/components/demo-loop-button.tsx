'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { DEFAULT_API_TIMEOUT_MS, getApiBaseUrl } from '../lib/api';

/** Full vertical slice can take well over 30s on PGlite. */
const DEMO_LOOP_TIMEOUT_MS = Math.max(DEFAULT_API_TIMEOUT_MS, 180_000);

/** Runs the full local commerce vertical slice against the API (AUTH_BYPASS). */
export function DemoLoopButton({ label = 'Run full demo loop' }: { label?: string }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setMsg(null);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DEMO_LOOP_TIMEOUT_MS);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/v1/terminal/demo-loop`, {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      const body = (await res.json().catch(() => ({}))) as {
        message?: string | string[];
        product?: { title?: string; signal?: string; score?: number };
        evaluation?: { sampleSize?: number; recommendation?: string };
        pipeline?: { stages?: Array<{ id: string; status: string }> };
        ordersIngested?: number;
        fulfillmentsCompleted?: number;
      };
      if (!res.ok) {
        const m = body.message;
        setMsg(typeof m === 'string' ? m : Array.isArray(m) ? m.join('; ') : `HTTP ${res.status}`);
        return;
      }
      const complete =
        body.pipeline?.stages?.filter((s) => s.status === 'complete').length ?? 0;
      const total = body.pipeline?.stages?.length ?? 0;
      setMsg(
        `${body.product?.title ?? 'Product'} · ${body.product?.signal ?? ''} · ` +
          `orders=${body.ordersIngested ?? 0} fulfill=${body.fulfillmentsCompleted ?? 0} · ` +
          `pipeline ${complete}/${total} · n=${body.evaluation?.sampleSize ?? 0}`,
      );
      router.refresh();
    } catch (e) {
      const aborted = e instanceof Error && e.name === 'AbortError';
      setMsg(
        aborted
          ? `Demo loop timed out after ${DEMO_LOOP_TIMEOUT_MS}ms`
          : e instanceof Error
            ? e.message
            : 'Demo loop failed',
      );
    } finally {
      clearTimeout(timer);
      setBusy(false);
    }
  }

  return (
    <div className="terminal-toolbar">
      <button type="button" className="btn primary" disabled={busy} onClick={() => void run()}>
        {busy ? 'Running demo loop…' : label}
      </button>
      {msg ? (
        <span className="meta" style={{ maxWidth: 520, whiteSpace: 'normal' }}>
          {msg}
        </span>
      ) : null}
    </div>
  );
}
