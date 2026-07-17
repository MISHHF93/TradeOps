'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { getApiBaseUrl } from '../../lib/api';

export function WatchlistButton({ productId }: { productId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function add() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/v1/watchlist/${productId}`, {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const body = (await res.json().catch(() => ({}))) as { message?: string; note?: string };
      if (!res.ok) {
        setMsg(body.message ?? `HTTP ${res.status}`);
        return;
      }
      setMsg('On watchlist');
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <button type="button" className="btn ghost" disabled={busy} onClick={() => void add()}>
        {busy ? '…' : 'Watch'}
      </button>
      {msg ? <span className="meta">{msg}</span> : null}
    </span>
  );
}
