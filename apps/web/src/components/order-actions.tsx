'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { getApiBaseUrl } from '../lib/api';

export function CompleteFulfillmentButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(
        `${getApiBaseUrl()}/api/v1/orders/${orderId}/complete-fulfillment`,
        { method: 'POST', credentials: 'include', headers: { Accept: 'application/json' } },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        setErr(body?.message ?? `HTTP ${res.status}`);
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <span>
      <button type="button" className="btn ghost" disabled={busy} onClick={() => void run()}>
        Complete fulfillment
      </button>
      {err ? <span className="form-error"> {err}</span> : null}
    </span>
  );
}
