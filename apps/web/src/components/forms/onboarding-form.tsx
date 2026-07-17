'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { getApiBaseUrl } from '../../lib/api';

const SEGMENTS = [
  { value: 'individual', label: 'Individual operator', hint: 'Dropship / solo founder / creator' },
  { value: 'smb', label: 'Small / medium business', hint: 'Team + multiple channels' },
  { value: 'agency', label: 'Agency', hint: 'Multiple client organizations' },
  { value: 'enterprise', label: 'Enterprise', hint: 'Multi-entity / governance' },
] as const;

const MODELS = [
  'dropshipping',
  'marketplace_seller',
  'dtc',
  'multichannel',
  'wholesale',
  'agency',
  'other',
];

export function OnboardingForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/v1/saas/onboarding`, {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          segment: String(fd.get('segment')),
          businessModel: String(fd.get('businessModel')),
          onboardingStep: 'segment_selected',
          onboardingComplete: false,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) {
        setError(body.error ?? body.message ?? `HTTP ${res.status}`);
        return;
      }
      router.push('/terminal/cockpit');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="auth-form card" onSubmit={(e) => void onSubmit(e)}>
      <label>
        Customer segment
        <select name="segment" required defaultValue="individual">
          {SEGMENTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label} — {s.hint}
            </option>
          ))}
        </select>
      </label>
      <label>
        Business model
        <select name="businessModel" required defaultValue="dropshipping">
          {MODELS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      <button className="btn primary" type="submit" disabled={busy}>
        {busy ? 'Saving…' : 'Continue to founder cockpit'}
      </button>
      <p className="meta">
        Server sets plan defaults (evaluation/starter/growth/agency/enterprise) and workspace persona.
        Entitlements are enforced API-side.
      </p>
    </form>
  );
}
