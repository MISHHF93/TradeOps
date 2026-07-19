'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { getApiBaseUrl } from '../../lib/api';
import type { WorkspaceSummary } from '../../lib/tenancy';

/**
 * Workspace (business unit) switcher.
 * Selection is always confirmed by the API membership check.
 */
export function WorkspaceSwitcher({
  activeWorkspaceId,
}: {
  activeWorkspaceId?: string | null;
}) {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/v1/tenancy/workspaces`, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return;
      const data = (await res.json()) as WorkspaceSummary[];
      setWorkspaces(Array.isArray(data) ? data : []);
    } catch {
      /* ignore — switcher is optional UI */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onChange(workspaceId: string) {
    if (!workspaceId || workspaceId === activeWorkspaceId) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/v1/tenancy/workspaces/switch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ workspaceId }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        setError(body?.message ?? 'Failed to switch workspace');
        setPending(false);
        return;
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setPending(false);
    }
  }

  if (workspaces.length <= 1) {
    return null;
  }

  return (
    <div className="org-switcher workspace-switcher">
      <label>
        Workspace
        <select
          disabled={pending}
          value={activeWorkspaceId ?? workspaces.find((w) => w.isDefault)?.id ?? ''}
          onChange={(e) => void onChange(e.target.value)}
        >
          {workspaces.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
              {w.isDefault ? ' (default)' : ''}
            </option>
          ))}
        </select>
      </label>
      {error ? <p className="form-error">{error}</p> : null}
    </div>
  );
}
