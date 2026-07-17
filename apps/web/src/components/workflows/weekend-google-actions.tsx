'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { getApiBaseUrl } from '../../lib/api';

export function WeekendGoogleActions() {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function prepare(forceShadow: boolean) {
    setBusy(true);
    setMsg(null);
    try {
      const q = forceShadow ? '?forceShadow=true' : '';
      const res = await fetch(`${getApiBaseUrl()}/api/v1/automation/google/weekend/prepare${q}`, {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      const body = (await res.json().catch(() => ({}))) as {
        message?: string;
        mode?: string;
        preparedCount?: number;
        livePostSucceeded?: boolean;
      };
      if (!res.ok) {
        setMsg(body.message ?? `HTTP ${res.status}`);
        return;
      }
      setMsg(
        `${body.mode} mode · prepared=${body.preparedCount ?? 0} · live=${String(body.livePostSucceeded)} · ${body.message ?? ''}`,
      );
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="terminal-toolbar">
      <button
        type="button"
        className="btn primary"
        disabled={busy}
        title="Operational · shadow prepare — no live Google post"
        onClick={() => void prepare(true)}
      >
        Prepare weekend feed (shadow)
      </button>
      <button
        type="button"
        className="btn ghost"
        disabled={busy}
        title="Credential-blocked for live post · shadow if no OAuth"
        onClick={() => void prepare(false)}
      >
        Run weekend job now
      </button>
      {msg ? (
        <span className="meta" style={{ maxWidth: 480, whiteSpace: 'normal' }}>
          {msg}
        </span>
      ) : null}
      <span className="meta" style={{ width: '100%' }}>
        Live Google Merchant post remains credential-blocked until OAuth + Content API client succeed
        — never a fabricated success.
      </span>
    </div>
  );
}
