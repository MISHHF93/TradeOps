'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { getApiBaseUrl } from '../../lib/api';

/**
 * Status-aware approval Action column (§8 / §19).
 * pending → Review | Approve | Reject
 * approved → View Result (execute already ran on approve for fixture publish)
 * rejected → View Reason
 * failed would → Retry (not in schema yet)
 */
export function ApprovalActionCell({
  approvalId,
  status,
  kind,
  listingId,
  productId,
  note,
}: {
  approvalId: string;
  status: string;
  kind: string;
  listingId?: string | null;
  productId?: string | null;
  note?: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function decide(decision: 'approved' | 'rejected') {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/v1/approvals/${approvalId}/decide`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ decision }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? `HTTP ${res.status}`);
      }
      setMsg(decision === 'approved' ? 'Approved & executed' : 'Rejected');
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  const s = status.toLowerCase();

  if (s === 'pending') {
    return (
      <span className="approval-actions" style={{ flexWrap: 'wrap', gap: 4 }}>
        <button
          type="button"
          className="btn approve"
          disabled={busy}
          onClick={() => void decide('approved')}
          title="Approve and execute consequential action"
        >
          Approve
        </button>
        <button
          type="button"
          className="btn destructive"
          disabled={busy}
          onClick={() => void decide('rejected')}
        >
          Reject
        </button>
        {productId ? (
          <Link className="btn ghost" href={`/terminal/products/${productId}`} style={{ minHeight: 28 }}>
            Review
          </Link>
        ) : null}
        {msg ? <span className="meta">{msg}</span> : null}
      </span>
    );
  }

  if (s === 'approved') {
    return (
      <span className="approval-actions" style={{ flexWrap: 'wrap', gap: 4 }}>
        {productId ? (
          <Link className="btn secondary" href={`/terminal/products/${productId}`}>
            View result
          </Link>
        ) : (
          <span className="meta">Executed</span>
        )}
        <span className="truth-label truth-live" title={kind}>
          {kind}
        </span>
        {msg ? <span className="meta">{msg}</span> : null}
      </span>
    );
  }

  if (s === 'rejected') {
    return (
      <span className="approval-actions">
        <span className="meta" title={note ?? undefined}>
          View reason
        </span>
        {note ? <span className="meta">{note.slice(0, 40)}</span> : null}
      </span>
    );
  }

  if (s === 'cancelled') {
    return <span className="meta">Cancelled</span>;
  }

  return <span className="meta">{status}</span>;
}
