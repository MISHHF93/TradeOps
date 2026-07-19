'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent, type ReactNode } from 'react';
import { FOUNDER_WORKSPACE_PATH } from '../../lib/access-mode';
import { getApiBaseUrl } from '../../lib/api';
import { CommandSearchResults } from './command-search-results';
import { CommandPaletteHost } from './command-palette';
import { ThemeToggle } from './theme-toggle';

/**
 * Global Command Bar — accent on search focus / command gateway only.
 * Live Search Manager typeahead with media previews.
 */
export function CommandBar({
  envLabel = 'local',
  accessMode = 'founder_direct',
  connectorSummary,
  founderSlot,
}: {
  envLabel?: string;
  accessMode?: string;
  connectorSummary?: string;
  founderSlot?: ReactNode;
}) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  async function onSearch(e: FormEvent) {
    e.preventDefault();
    const query = q.trim();
    if (!query) return;
    if (query.startsWith('/')) {
      router.push(query);
      return;
    }
    // Unified Search Layer — prefer object hits with provenance
    try {
      const searchRes = await fetch(
        `${getApiBaseUrl()}/api/v1/search?q=${encodeURIComponent(query)}`,
        { credentials: 'include', headers: { Accept: 'application/json' } },
      );
      if (searchRes.ok) {
        const body = (await searchRes.json()) as {
          hits?: Array<{ href?: string; objectType?: string; score?: number }>;
        };
        const top = body.hits?.[0];
        if (top?.href && (top.score ?? 0) >= 0.35) {
          setSearchFocused(false);
          router.push(top.href);
          return;
        }
      }
    } catch {
      /* fall through */
    }
    // AI-first navigation: server intent catalog when available
    try {
      const res = await fetch(
        `${getApiBaseUrl()}/api/v1/workspace/navigate?q=${encodeURIComponent(query)}`,
        { credentials: 'include', headers: { Accept: 'application/json' } },
      );
      if (res.ok) {
        const body = (await res.json()) as {
          matched?: boolean;
          href?: string;
          note?: string;
        };
        if (body.href) {
          if (!body.matched && body.href.includes('/ai')) {
            router.push(`/terminal/objectives?objective=${encodeURIComponent(query)}`);
            return;
          }
          router.push(body.href);
          return;
        }
      }
    } catch {
      // fall through to local heuristics
    }
    const lower = query.toLowerCase();
    if (
      lower.includes('process') ||
      lower.includes('case') ||
      lower.includes('board') ||
      lower.includes('lifecycle')
    ) {
      router.push('/terminal/process');
      return;
    }
    if (lower.includes('task') || lower.includes('blocker')) {
      router.push('/terminal/tasks');
      return;
    }
    if (
      lower.includes('scan') ||
      lower.includes('discover') ||
      lower.includes('product')
    ) {
      router.push('/terminal');
      return;
    }
    if (lower.includes('order') || lower.includes('fulfill') || lower.includes('ship')) {
      router.push(lower.includes('fulfill') || lower.includes('ship') ? '/terminal/fulfillment' : '/terminal/orders');
      return;
    }
    if (lower.includes('ai') || lower.includes('operator')) {
      router.push('/terminal/objectives');
      return;
    }
    if (lower.includes('cash') || lower.includes('portfolio') || lower.includes('revenue')) {
      router.push(lower.includes('cash') ? '/terminal/cashflow' : '/terminal/portfolio');
      return;
    }
    if (lower.includes('approv') || lower.includes('decision')) {
      router.push('/terminal/approvals');
      return;
    }
    if (lower.includes('connect')) {
      router.push('/terminal/connectors');
      return;
    }
    if (lower.includes('persona') || lower.includes('workspace')) {
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

      <div className="command-bar-search-wrap">
        <form className="command-bar-search" onSubmit={onSearch} role="search">
          <label className="sr-only" htmlFor="global-search">
            Global search
          </label>
          <input
            id="global-search"
            className={q.trim() ? 'filter-active' : undefined}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => {
              // delay so click on hit registers
              window.setTimeout(() => setSearchFocused(false), 180);
            }}
            placeholder="Search products, cases, media…"
            autoComplete="off"
            aria-describedby="search-kbd-hint"
            aria-expanded={searchFocused && q.trim().length >= 2}
            aria-controls="command-search-results"
          />
          <kbd id="search-kbd-hint" className="kbd-hint" title="Open full command palette">
            ⌘K
          </kbd>
          <button
            type="submit"
            className="btn secondary"
            style={{ minHeight: 32, padding: '4px 12px', borderRadius: 999 }}
          >
            Go
          </button>
        </form>
        {searchFocused ? (
          <div id="command-search-results">
            <CommandSearchResults
              query={q}
              onNavigate={() => {
                setSearchFocused(false);
                setQ('');
              }}
            />
          </div>
        ) : null}
      </div>

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
        <ThemeToggle />
        {founderSlot}
      </div>
    </header>
  );
}
