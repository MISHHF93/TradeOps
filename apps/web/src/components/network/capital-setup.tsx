'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { getApiBaseUrl } from '../../lib/api';

export function CapitalSetupActions() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [log, setLog] = useState<string | null>(null);

  async function ensureAccountAndMandate() {
    setBusy(true);
    setErr(null);
    setLog(null);
    try {
      const accRes = await fetch(`${getApiBaseUrl()}/api/v1/network/capital/accounts`, {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ currency: 'CAD' }),
      });
      const accBody = (await accRes.json().catch(() => null)) as {
        message?: string | string[];
        account?: { id: string };
      } | null;
      if (!accRes.ok) {
        const msg = accBody?.message;
        setErr(Array.isArray(msg) ? msg.join(', ') : (msg ?? `HTTP ${accRes.status}`));
        return;
      }
      const accountId = accBody?.account?.id;
      if (!accountId) {
        setErr('No account id returned');
        return;
      }

      const manRes = await fetch(`${getApiBaseUrl()}/api/v1/network/capital/mandates`, {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          capitalAccountId: accountId,
          maximumCapitalMinor: 2_500_000,
          maximumProductExposureMinor: 500_000,
          maximumDailySpendMinor: 100_000,
          maximumAdvertisingMinor: 300_000,
          minimumMarginBps: 1500,
          approvalThresholdMinor: 50_000,
          allowedChannels: ['amazon', 'shopify'],
          allowedCountries: ['CA'],
          riskLevel: 'conservative',
          approve: true,
        }),
      });
      if (!manRes.ok) {
        const b = (await manRes.json().catch(() => null)) as { message?: string } | null;
        setErr(b?.message ?? `Mandate HTTP ${manRes.status}`);
        return;
      }

      const fundRes = await fetch(`${getApiBaseUrl()}/api/v1/network/capital/funding`, {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          capitalAccountId: accountId,
          amountMinor: 250_000,
          idempotencyKey: `sandbox_fund_${Date.now()}`,
          simulateConfirm: true,
        }),
      });
      if (!fundRes.ok) {
        const b = (await fundRes.json().catch(() => null)) as { message?: string } | null;
        setErr(b?.message ?? `Funding HTTP ${fundRes.status}`);
        return;
      }

      setLog(
        'Sandbox account + approved mandate + simulated funding posted. Not real money. Not partner custody.',
      );
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        className="btn primary"
        disabled={busy}
        onClick={() => void ensureAccountAndMandate()}
      >
        {busy ? 'Setting up…' : 'Sandbox: create account + mandate + fund'}
      </button>
      {err ? <p className="form-error">{err}</p> : null}
      {log ? <p className="meta">{log}</p> : null}
    </div>
  );
}
