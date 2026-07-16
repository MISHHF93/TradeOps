'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { getApiBaseUrl } from '../lib/api';
import { DemoLoopButton } from './demo-loop-button';

async function post(path: string, timeoutMs = 60_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { message?: string } | null;
      throw new Error(body?.message ?? `HTTP ${response.status}`);
    }
    return response.json().catch(() => ({}));
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error(`API timeout after ${timeoutMs}ms`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export function TerminalToolbar() {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(label: string, path: string) {
    setBusy(true);
    setMsg(null);
    try {
      const result = await post(path);
      setMsg(`${label}: ${JSON.stringify(result).slice(0, 160)}`);
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="terminal-toolbar" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
      <DemoLoopButton />
      <button
        type="button"
        className="btn ghost"
        disabled={busy}
        title="Administrative · fixture-labeled import into real DB"
        onClick={() => void run('Import', '/api/v1/commerce/import/fixture-supplier')}
      >
        Import fixtures
      </button>
      <button
        type="button"
        className="btn ghost"
        disabled={busy}
        title="Administrative · fixture order ingest"
        onClick={() => void run('Orders', '/api/v1/orders/ingest/fixture')}
      >
        Ingest fixture orders
      </button>
      {msg ? <span className="meta">{msg}</span> : null}
      <span className="meta" style={{ width: '100%' }}>
        Buttons above write real DB rows via fixture connectors — never labeled as live marketplace
        traffic. See /status for classifications.
      </span>
    </div>
  );
}

export function ProductActions({ productId }: { productId: string }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(label: string, path: string) {
    setBusy(true);
    setMsg(null);
    try {
      const result = await post(path);
      setMsg(`${label} OK`);
      console.info(result);
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="terminal-toolbar">
      <button
        type="button"
        className="btn ghost"
        disabled={busy}
        onClick={() => void run('Rescore', `/api/v1/products/${productId}/rescore`)}
      >
        Rescore
      </button>
      <button
        type="button"
        className="btn ghost"
        disabled={busy}
        onClick={() => void run('Simulate', `/api/v1/products/${productId}/simulate`)}
      >
        Run simulation
      </button>
      <button
        type="button"
        className="btn primary"
        disabled={busy}
        onClick={() => void run('Listing draft', `/api/v1/products/${productId}/listing-draft`)}
      >
        Create listing draft
      </button>
      {msg ? <span className="meta">{msg}</span> : null}
    </div>
  );
}

export function ApprovalButtons({ approvalId }: { approvalId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function decide(decision: 'approved' | 'rejected') {
    setBusy(true);
    try {
      await fetch(`${getApiBaseUrl()}/api/v1/approvals/${approvalId}/decide`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ decision }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="approval-actions">
      <button type="button" className="btn primary" disabled={busy} onClick={() => void decide('approved')}>
        Approve
      </button>
      <button type="button" className="btn ghost" disabled={busy} onClick={() => void decide('rejected')}>
        Reject
      </button>
    </span>
  );
}
