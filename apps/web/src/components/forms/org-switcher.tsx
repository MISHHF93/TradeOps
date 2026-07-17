'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { MembershipWithOrgDto } from '@tradeops/contracts';
import { getApiBaseUrl } from '../../lib/api';

export function OrgSwitcher({
  memberships,
  activeOrganizationId,
}: {
  memberships: MembershipWithOrgDto[];
  activeOrganizationId: string | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onChange(organizationId: string) {
    if (!organizationId || organizationId === activeOrganizationId) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/v1/organizations/switch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ organizationId }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        setError(body?.message ?? 'Failed to switch organization');
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

  if (memberships.length === 0) {
    return null;
  }

  return (
    <div className="org-switcher">
      <label>
        Tenant
        <select
          disabled={pending}
          value={activeOrganizationId ?? ''}
          onChange={(e) => void onChange(e.target.value)}
          aria-label="Active tenant organization"
        >
          {memberships.map((m) => (
            <option key={m.organizationId} value={m.organizationId}>
              {m.organization.name} ({m.role})
            </option>
          ))}
        </select>
      </label>
      {error ? <p className="form-error">{error}</p> : null}
    </div>
  );
}
