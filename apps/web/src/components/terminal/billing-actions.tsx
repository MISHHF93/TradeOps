'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { getApiBaseUrl } from '../../lib/api';

export function CheckoutPlanButton({
  planId,
  interval = 'month',
  label,
}: {
  planId: string;
  interval?: 'month' | 'year';
  label?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/v1/billing/checkout`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ planId, interval }),
      });
      const body = (await res.json().catch(() => null)) as {
        message?: string | string[];
        checkoutUrl?: string;
        mode?: string;
        note?: string;
      } | null;
      if (!res.ok) {
        const msg = body?.message;
        setErr(Array.isArray(msg) ? msg.join(', ') : (msg ?? `HTTP ${res.status}`));
        return;
      }
      if (body?.checkoutUrl) {
        if (body.mode === 'stripe' && body.checkoutUrl.startsWith('http')) {
          window.location.href = body.checkoutUrl;
          return;
        }
        router.push(body.checkoutUrl.replace(/^https?:\/\/[^/]+/, '') || '/app/billing');
        router.refresh();
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <span>
      <button type="button" className="btn primary" disabled={busy} onClick={() => void run()}>
        {busy ? 'Starting…' : (label ?? `Subscribe ${planId}`)}
      </button>
      {err ? <span className="form-error"> {err}</span> : null}
    </span>
  );
}

export function OpenBillingPortalButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setErr(null);
    setNote(null);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/v1/billing/portal`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      const body = (await res.json().catch(() => null)) as {
        message?: string | string[];
        portalUrl?: string;
        mode?: string;
        note?: string;
      } | null;
      if (!res.ok) {
        const msg = body?.message;
        setErr(Array.isArray(msg) ? msg.join(', ') : (msg ?? `HTTP ${res.status}`));
        return;
      }
      if (body?.mode === 'stripe' && body.portalUrl?.startsWith('http')) {
        window.location.href = body.portalUrl;
        return;
      }
      setNote(body?.note ?? 'Portal unavailable in development fixture mode.');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <span>
      <button type="button" className="btn secondary" disabled={busy} onClick={() => void run()}>
        {busy ? 'Opening…' : 'Customer billing portal'}
      </button>
      {err ? <span className="form-error"> {err}</span> : null}
      {note ? <span className="meta"> {note}</span> : null}
    </span>
  );
}

export function FixtureReconcileButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/v1/finance/payouts/fixture-reconcile`, {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
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
      <button type="button" className="btn secondary" disabled={busy} onClick={() => void run()}>
        {busy ? 'Reconciling…' : 'Run fixture payout reconcile'}
      </button>
      {err ? <span className="form-error"> {err}</span> : null}
    </span>
  );
}
