'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { getApiBaseUrl } from '../../lib/api';

export function ConnectorProbeButton({ providerKey }: { providerKey: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function probe() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(
        `${getApiBaseUrl()}/api/v1/ops/connectors/${encodeURIComponent(providerKey)}/probe`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { Accept: 'application/json' },
        },
      );
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        note?: string;
        status?: string;
      };
      if (!res.ok) {
        setMsg(body.note ?? `HTTP ${res.status}`);
        return;
      }
      setMsg(body.ok ? `ok · ${body.status}` : body.note ?? body.status ?? 'probed');
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'probe failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 2 }}>
      <button
        type="button"
        className="btn ghost"
        style={{ minHeight: 24, fontSize: 11, padding: '2px 8px' }}
        disabled={busy}
        onClick={() => void probe()}
      >
        {busy ? '…' : 'Probe'}
      </button>
      {msg ? <span className="meta" style={{ fontSize: 10 }}>{msg}</span> : null}
    </span>
  );
}
