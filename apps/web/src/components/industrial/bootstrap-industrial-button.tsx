'use client';

import { useState } from 'react';
import { getApiBaseUrl } from '../../lib/api';

export function BootstrapIndustrialButton() {
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const api = getApiBaseUrl();

  return (
    <div style={{ marginTop: 12 }}>
      <button
        type="button"
        className="btn primary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setMsg(null);
          try {
            const res = await fetch(`${api}/api/v1/industrial/bootstrap-demo`, {
              method: 'POST',
              credentials: 'include',
              headers: { Accept: 'application/json' },
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const body = (await res.json()) as { updated?: number; scanned?: number };
            setMsg(`Enriched ${body.updated ?? 0} / ${body.scanned ?? 0} products with industrial profiles.`);
          } catch (e) {
            setMsg(e instanceof Error ? e.message : String(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? 'Bootstrapping…' : 'Bootstrap demo industrial profiles'}
      </button>
      {msg ? <p className="meta">{msg}</p> : null}
    </div>
  );
}
