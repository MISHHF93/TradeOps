'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent, type ReactNode } from 'react';
import { FOUNDER_WORKSPACE_PATH } from '../../lib/access-mode';
import { CommandPaletteHost } from './command-palette';
import { ThemeToggle } from './theme-toggle';

/**
 * Global Command Bar — accent on search focus / command gateway only.
 * Panels stay neutral.
 */
export function CommandBar({
  envLabel = 'local',
  accessMode = 'founder_direct',
  connectorSummary,
  orgName,
  founderSlot,
}: {
  envLabel?: string;
  accessMode?: string;
  connectorSummary?: string;
  orgName?: string;
  founderSlot?: ReactNode;
}) {
  const router = useRouter();
  const [q, setQ] = useState('');

  function onSearch(e: FormEvent) {
    e.preventDefault();
    const query = q.trim().toLowerCase();
    if (!query) return;
    if (query.startsWith('/')) {
      router.push(query);
      return;
    }
    if (
      query.includes('process') ||
      query.includes('case') ||
      query.includes('board') ||
      query.includes('lifecycle')
    ) {
      router.push('/terminal/process');
      return;
    }
    if (query.includes('task') || query.includes('blocker')) {
      router.push('/terminal/tasks');
      return;
    }
    if (
      query.includes('scan') ||
      query.includes('discover') ||
      query.includes('product')
    ) {
      router.push('/terminal');
      return;
    }
    if (query.includes('order') || query.includes('fulfill')) {
      router.push(query.includes('fulfill') ? '/terminal/fulfillment' : '/terminal/orders');
      return;
    }
    if (query.includes('ai') || query.includes('operator')) {
      router.push('/terminal/ai');
      return;
    }
    if (query.includes('cash') || query.includes('portfolio')) {
      router.push(query.includes('cash') ? '/terminal/cashflow' : '/terminal/portfolio');
      return;
    }
    if (query.includes('approv')) {
      router.push('/terminal/approvals');
      return;
    }
    if (query.includes('connect')) {
      router.push('/terminal/connectors');
      return;
    }
    if (query.includes('persona') || query.includes('workspace')) {
      router.push('/terminal/workspace');
      return;
    }
    router.push(`/terminal?q=${encodeURIComponent(q.trim())}`);
  }

  return (
    <header className="command-bar" role="banner">
      <Link href={FOUNDER_WORKSPACE_PATH} className="command-bar-brand">
        <span className="mark mark-sm" aria-hidden />
        <span className="command-bar-title">TradeOps</span>
      </Link>

      <form className="command-bar-search" onSubmit={onSearch} role="search">
        <label className="sr-only" htmlFor="global-search">
          Global search
        </label>
        <input
          id="global-search"
          className={q.trim() ? 'filter-active' : undefined}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search or jump…"
          autoComplete="off"
          aria-describedby="search-kbd-hint"
        />
        <kbd id="search-kbd-hint" className="kbd-hint" title="Open full command palette">
          ⌘K
        </kbd>
        <button type="submit" className="btn secondary" style={{ minHeight: 30, padding: '4px 10px' }}>
          Go
        </button>
      </form>

      <div className="command-bar-actions">
        <CommandPaletteHost />
        <span className="truth-label" title="Deployment environment">
          {envLabel.toUpperCase()}
        </span>
        <span className="truth-label truth-shadow" title="Access mode">
          {accessMode}
        </span>
        {connectorSummary ? (
          <span
            className="connector-active-chip"
            title="Active connectors — accent marks connection, not health outcome"
          >
            <span className="conn-dot" aria-hidden />
            <span>{connectorSummary}</span>
          </span>
        ) : null}
        {orgName ? (
          <span className="meta" style={{ margin: 0, fontSize: '0.7rem', maxWidth: 120 }} title={orgName}>
            {orgName}
          </span>
        ) : null}
        <ThemeToggle />
        {founderSlot}
      </div>
    </header>
  );
}
