'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { getApiBaseUrl } from '../../lib/api';

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/v1/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: String(fd.get('email') ?? ''),
          password: String(fd.get('password') ?? ''),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { message?: string | string[] };
      if (!res.ok) {
        const m = body.message;
        setError(typeof m === 'string' ? m : Array.isArray(m) ? m.join('; ') : `HTTP ${res.status}`);
        return;
      }
      router.push('/app');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="auth-form card" onSubmit={(e) => void onSubmit(e)}>
      <label>
        Email
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={process.env.NODE_ENV === 'production' ? '' : 'founder@tradeops.local'}
        />
      </label>
      <label>
        Password
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          defaultValue={process.env.NODE_ENV === 'production' ? '' : 'TradeOps-Demo-2026!'}
        />
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      <button className="btn primary" type="submit" disabled={busy}>
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
      <p className="meta">
        No account? <Link href="/register">Register a merchant organization</Link>
      </p>
      <p className="meta">
        Seeded local identity (after setup:db): founder@tradeops.local — real session cookie, not a fake login.
      </p>
    </form>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/v1/auth/register`, {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: String(fd.get('email') ?? ''),
          password: String(fd.get('password') ?? ''),
          displayName: String(fd.get('displayName') ?? ''),
          organizationName: String(fd.get('organizationName') ?? ''),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { message?: string | string[] };
      if (!res.ok) {
        const m = body.message;
        setError(typeof m === 'string' ? m : Array.isArray(m) ? m.join('; ') : `HTTP ${res.status}`);
        return;
      }
      router.push('/app');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="auth-form card" onSubmit={(e) => void onSubmit(e)}>
      <label>
        Display name
        <input name="displayName" required minLength={1} placeholder="Your name" />
      </label>
      <label>
        Work email
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <label>
        Password (min 8)
        <input name="password" type="password" autoComplete="new-password" required minLength={8} />
      </label>
      <label>
        Organization name
        <input name="organizationName" required minLength={2} placeholder="Acme Commerce Co" />
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      <button className="btn primary" type="submit" disabled={busy}>
        {busy ? 'Creating account…' : 'Create merchant account'}
      </button>
      <p className="meta">
        Already registered? <Link href="/login">Sign in</Link>
      </p>
      <p className="meta">
        Registration creates a real multi-tenant organization and session. No private catalog is
        pre-loaded for new orgs until you connect data or run fixture development tools.
      </p>
    </form>
  );
}

export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    try {
      await fetch(`${getApiBaseUrl()}/api/v1/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      router.push('/');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" className="btn ghost" disabled={busy} onClick={() => void logout()}>
      {busy ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
