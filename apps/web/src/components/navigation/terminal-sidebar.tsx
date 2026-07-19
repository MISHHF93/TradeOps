'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo, useState } from 'react';
import { buildClientFallbackNav } from '../../lib/nav-catalog';
import type { ResolvedWorkspace, WorkspaceNavGroup } from '../../lib/workspace';

/**
 * Persona workspace nav — prefers server ResolvedWorkspace.nav.
 * Offline fallback uses nav-catalog hybrid (Focus · Operate · Platform · More).
 * Multi-tenancy labels are display-only (server-resolved).
 */
export function TerminalSidebar({
  founderDirect: _founderDirect,
  orgName,
  email,
  role,
  segment,
  planTier,
  showLogout,
  logoutSlot,
  workspace,
  tenantLabel,
  workspaceLabel,
  commerceMode,
  navSource,
}: {
  founderDirect: boolean;
  orgName: string;
  email: string;
  role: string;
  segment?: string;
  planTier?: string;
  showLogout?: boolean;
  logoutSlot?: React.ReactNode;
  workspace?: ResolvedWorkspace | null;
  /** Server-resolved tenant display (slug or short id) */
  tenantLabel?: string | null;
  workspaceLabel?: string | null;
  commerceMode?: string | null;
  /** When workspace API failed — show honesty banner */
  navSource?: 'workspace' | 'fallback';
}) {
  const pathname = usePathname();
  const groups = useMemo((): WorkspaceNavGroup[] => {
    if (workspace?.nav?.length) return workspace.nav;
    return buildClientFallbackNav();
  }, [workspace]);

  const usingFallback = navSource === 'fallback' || !workspace?.nav?.length;

  // Only "More" collapsed by default — Focus / Operate / Platform stay open
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({ more: true });

  function toggle(id: string) {
    setCollapsed((c) => ({ ...c, [id]: !c[id] }));
  }

  return (
    <aside className="terminal-nav" aria-label="Persona workspace navigation">
      <div className="terminal-brand">
        <strong>{workspace?.personaLabel ?? segment ?? 'Commerce OS'}</strong>
        <span>{workspace?.mission ?? 'One User · One Workspace · One Objective · One AI'}</span>
      </div>

      <p className="nav-principle">
        {workspace?.operatingPrinciple ?? 'One User · One Workspace · One Objective · One AI'}
      </p>
      <p className="nav-meta-line">
        {workspace?.personaLabel ?? segment ?? '—'} · {planTier ?? '—'} · {role}
      </p>
      {(tenantLabel || workspaceLabel || commerceMode) && (
        <p
          className="meta"
          style={{ margin: '0 0 8px', fontSize: '0.65rem', opacity: 0.9 }}
          title="Server-resolved tenant isolation context"
        >
          Tenant {tenantLabel ?? '—'}
          {workspaceLabel ? ` · WS ${workspaceLabel}` : ''}
          {commerceMode ? ` · ${commerceMode}` : ''}
        </p>
      )}

      {usingFallback ? (
        <p className="meta" style={{ margin: '0 0 8px', fontSize: '0.68rem', opacity: 0.95 }}>
          Catalog nav{workspace ? '' : ' · workspace API offline'}
        </p>
      ) : null}

      {workspace?.surface?.healthLabel || workspace?.recommendedNextAction ? (
        <div className="nav-insight">
          {workspace.surface?.healthLabel ? (
            <span className="meta" style={{ display: 'block', margin: 0 }}>
              Health <strong>{workspace.surface.healthLabel}</strong>
              {typeof workspace.surface.attentionScore === 'number'
                ? ` · ${workspace.surface.attentionScore}/100`
                : ''}
            </span>
          ) : null}
          {workspace.recommendedNextAction ? (
            <Link href={workspace.recommendedNextAction.href}>
              <span className="meta" style={{ display: 'block', margin: 0 }}>
                Next action
              </span>
              <strong>{workspace.recommendedNextAction.label}</strong>
              <span className="meta" style={{ display: 'block', margin: '2px 0 0' }}>
                {workspace.recommendedNextAction.reason}
              </span>
            </Link>
          ) : null}
          {workspace.surface?.focusObjective ? (
            <Link
              href={`/terminal/objectives?objective=${encodeURIComponent(workspace.surface.focusObjective)}`}
              className="meta"
              style={{ display: 'block', marginTop: 2 }}
            >
              Run focus objective →
            </Link>
          ) : null}
        </div>
      ) : null}

      <nav className="nav-groups">
        {groups.map((g) => {
          // Focus / Operate / Platform expanded unless user collapsed; More starts collapsed
          const defaultCollapsed = g.id === 'more';
          const isCollapsed = collapsed[g.id] ?? defaultCollapsed;
          return (
            <div key={g.id} className="nav-group">
              <button
                type="button"
                className="nav-group-label"
                onClick={() => toggle(g.id)}
                aria-expanded={!isCollapsed}
              >
                {g.label}
                <span aria-hidden>{isCollapsed ? '+' : '−'}</span>
              </button>
              {!isCollapsed ? (
                <ul className="nav-group-items">
                  {g.items.map((item) => {
                    const pathOnly = item.href.split('?')[0] ?? item.href;
                    const active =
                      pathname === pathOnly ||
                      (pathOnly !== '/terminal' &&
                        pathOnly !== '/terminal/workspace' &&
                        Boolean(pathname?.startsWith(pathOnly)));
                    return (
                      <li key={item.id}>
                        <Link
                          href={item.href}
                          className={active ? 'nav-link active' : 'nav-link'}
                          title={item.kind}
                          data-status={item.status}
                          data-kind={item.kind}
                        >
                          <span>{item.label}</span>
                          {item.badge ? (
                            <span className="nav-badge" aria-label={`${item.badge} pending`}>
                              {item.badge}
                            </span>
                          ) : null}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
          );
        })}
      </nav>

      <div className="terminal-nav-footer">
        <p className="meta" style={{ fontSize: '0.68rem', marginBottom: 8 }}>
          Jump anywhere with ⌘K · expand More for persona extras
        </p>
        <p className="meta" style={{ fontSize: '0.75rem', margin: 0, fontWeight: 600 }}>
          {orgName}
        </p>
        <p className="meta" style={{ fontSize: '0.7rem', margin: 0 }}>
          {email}
        </p>
        {showLogout ? logoutSlot : null}
      </div>
    </aside>
  );
}
