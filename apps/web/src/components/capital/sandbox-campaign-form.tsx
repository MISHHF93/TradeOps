'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { getApiBaseUrl } from '../../lib/api';

export function SandboxCampaignForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [title, setTitle] = useState('Sandbox: insulated bottles Amazon CA 90d');
  const [target, setTarget] = useState(25000_00);
  const [inventory, setInventory] = useState(14000_00);
  const [ads, setAds] = useState(6000_00);
  const [fulfillment, setFulfillment] = useState(3000_00);
  const [reserve, setReserve] = useState(1500_00);
  const [fees, setFees] = useState(500_00);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/v1/capital/campaigns`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          capitalTargetMinor: target,
          currency: 'CAD',
          fundingModel: 'sandbox',
          inventoryBudgetMinor: inventory,
          advertisingBudgetMinor: ads,
          fulfillmentBudgetMinor: fulfillment,
          operatingReserveMinor: reserve,
          platformFeesMinor: fees,
          riskDisclosureJson: {
            capitalAtRisk: true,
            noGuaranteeOfReturn: true,
            sandbox: true,
          },
        }),
      });
      const body = (await res.json().catch(() => null)) as {
        message?: string | string[];
        campaign?: { id: string };
      } | null;
      if (!res.ok) {
        const msg = body?.message;
        setErr(Array.isArray(msg) ? msg.join(', ') : (msg ?? `HTTP ${res.status}`));
        return;
      }
      if (body?.campaign?.id) {
        router.push(`/capital/campaigns/${body.campaign.id}`);
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="panel" onSubmit={(e) => void submit(e)}>
      <h2>Create sandbox campaign</h2>
      <p className="meta">
        Design-only. Not a public offering. Not funded. Purpose-restricted budget lines required.
      </p>
      <label>
        Title
        <input value={title} onChange={(e) => setTitle(e.target.value)} required />
      </label>
      <label>
        Capital target (minor units, e.g. cents)
        <input
          type="number"
          value={target}
          onChange={(e) => setTarget(Number(e.target.value))}
          min={1}
          required
        />
      </label>
      <div className="detail-grid">
        <label>
          Inventory budget
          <input
            type="number"
            value={inventory}
            onChange={(e) => setInventory(Number(e.target.value))}
            min={0}
          />
        </label>
        <label>
          Advertising budget
          <input type="number" value={ads} onChange={(e) => setAds(Number(e.target.value))} min={0} />
        </label>
        <label>
          Fulfillment budget
          <input
            type="number"
            value={fulfillment}
            onChange={(e) => setFulfillment(Number(e.target.value))}
            min={0}
          />
        </label>
        <label>
          Reserve
          <input
            type="number"
            value={reserve}
            onChange={(e) => setReserve(Number(e.target.value))}
            min={0}
          />
        </label>
        <label>
          Platform fees budget
          <input type="number" value={fees} onChange={(e) => setFees(Number(e.target.value))} min={0} />
        </label>
      </div>
      <button type="submit" className="btn primary" disabled={busy}>
        {busy ? 'Creating…' : 'Create sandbox campaign'}
      </button>
      {err ? <p className="form-error">{err}</p> : null}
    </form>
  );
}
