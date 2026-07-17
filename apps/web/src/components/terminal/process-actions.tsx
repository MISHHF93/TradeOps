'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { getApiBaseUrl } from '../../lib/api';

export function ProcessAdvanceButton({
  caseId,
  toStage,
  label,
  style,
}: {
  caseId: string;
  toStage: string;
  label?: string;
  style?: React.CSSProperties;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!caseId || !toStage) return null;

  async function advance() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/v1/commerce/cases/${caseId}/advance`, {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ toStage }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          (body as { message?: string }).message ?? `HTTP ${res.status}`,
        );
      }
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Advance failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={style}>
      <button
        type="button"
        className="btn primary"
        disabled={busy || !caseId}
        onClick={() => void advance()}
      >
        {busy ? 'Advancing…' : label ?? `Advance to ${toStage}`}
      </button>
      {err ? <p className="form-error">{err}</p> : null}
    </div>
  );
}

export function ProcessSyncButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function sync() {
    setBusy(true);
    try {
      await fetch(`${getApiBaseUrl()}/api/v1/commerce/process/sync`, {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" className="btn ghost" disabled={busy} onClick={() => void sync()}>
      {busy ? 'Syncing…' : 'Sync cases'}
    </button>
  );
}
