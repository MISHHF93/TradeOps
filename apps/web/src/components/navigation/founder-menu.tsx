'use client';

import Link from 'next/link';
import { useState } from 'react';
import { getAccessMode } from '../../lib/access-mode';

/**
 * Compact founder controls for founder_direct mode.
 * No nonfunctional Logout — authenticated mode can reintroduce it later.
 */
export function FounderMenu({
  email,
  orgName,
}: {
  email?: string | null;
  orgName?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const mode = getAccessMode();

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        className="btn ghost"
        style={{ padding: '6px 10px', fontSize: '0.8rem' }}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        Founder · {orgName ?? 'Workspace'}
      </button>
      {open ? (
        <div
          className="card"
          style={{
            position: 'absolute',
            bottom: '100%',
            left: 0,
            marginBottom: 6,
            minWidth: 220,
            zIndex: 40,
            padding: 10,
            display: 'grid',
            gap: 6,
          }}
        >
          <p className="meta" style={{ margin: 0 }}>
            {email ?? 'founder@tradeops.local'}
          </p>
          <Link href="/terminal/workspace" onClick={() => setOpen(false)}>
            Workspace / personas
          </Link>
          <Link href="/terminal" onClick={() => setOpen(false)}>
            Discover
          </Link>
          <Link href="/terminal/process" onClick={() => setOpen(false)}>
            Cases
          </Link>
          <Link href="/app" onClick={() => setOpen(false)}>
            System settings
          </Link>
          <Link href="/terminal/connectors" onClick={() => setOpen(false)}>
            Connectors
          </Link>
          <Link href="/status" onClick={() => setOpen(false)}>
            Capability status
          </Link>
          <Link href="/app/release-readiness" onClick={() => setOpen(false)}>
            Release readiness
          </Link>
          <p className="meta" style={{ margin: '4px 0 0' }}>
            Access mode: <code>{mode}</code>
          </p>
          {mode === 'founder_direct' ? (
            <p className="meta" style={{ margin: 0 }}>
              Logout unavailable in founder_direct (no multi-user session).
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
