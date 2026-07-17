'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { getApiBaseUrl } from '../../lib/api';
import type { OperatingPersona } from '../../lib/workspace';

export function PersonaSwitcher({
  current,
  personas,
  currentHome,
}: {
  current: OperatingPersona;
  personas: Array<{ id: OperatingPersona; label: string; homeHref: string }>;
  currentHome: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function select(persona: OperatingPersona, homeHref: string) {
    setBusy(persona);
    setError(null);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/v1/workspace/persona`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persona }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? `Failed (${res.status})`);
      }
      router.push(homeHref);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to switch persona');
    } finally {
      setBusy(null);
    }
  }

  return (
    <article className="panel">
      <h2>Personas</h2>
      <p className="meta">
        Switching persona rebuilds the left sidebar, default AI objective, and allowed tools.
        Backend services stay the same.
      </p>
      {error ? <p className="form-error">{error}</p> : null}
      <div className="detail-grid">
        {personas.map((p) => {
          const active = p.id === current;
          return (
            <div key={p.id} className="panel" style={{ margin: 0 }}>
              <h3 style={{ marginTop: 0 }}>
                {p.label}
                {active ? ' · active' : ''}
              </h3>
              <p className="meta">
                <Link href={p.homeHref}>Preview home</Link>
              </p>
              <button
                type="button"
                className="button"
                disabled={busy !== null || active}
                onClick={() => select(p.id, p.homeHref)}
              >
                {active ? 'Current' : busy === p.id ? 'Switching…' : `Work as ${p.label}`}
              </button>
            </div>
          );
        })}
      </div>
      <p className="meta" style={{ marginTop: 12 }}>
        Current home: <Link href={currentHome}>{currentHome}</Link>
      </p>
    </article>
  );
}
