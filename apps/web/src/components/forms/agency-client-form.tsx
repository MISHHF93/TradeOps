'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { getApiBaseUrl } from '../../lib/api';

export function AgencyClientForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/v1/saas/agency/clients`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        client?: { id: string };
      };
      if (!res.ok) {
        setError(data.message ?? data.error ?? `Failed (${res.status})`);
        return;
      }
      if (data.error) {
        setError(data.error);
        return;
      }
      setName('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card" style={{ display: 'grid', gap: 12, maxWidth: 480 }}>
      <h2 style={{ margin: 0 }}>Add client organization</h2>
      <label>
        Client name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
          placeholder="Acme Commerce Co"
          disabled={busy}
        />
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      <button className="btn primary" type="submit" disabled={busy || name.trim().length < 2}>
        {busy ? 'Creating…' : 'Create isolated client tenant'}
      </button>
      <p className="meta">
        Creates a child organization with parentOrganizationId set. You become owner of the client
        org for delegated setup.
      </p>
    </form>
  );
}
