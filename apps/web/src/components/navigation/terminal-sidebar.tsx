'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo, useState } from 'react';
import type { ResolvedWorkspace, WorkspaceNavGroup } from '../../lib/workspace';
import { ThemeToggle } from '../layout/theme-toggle';

/** Fallback when workspace API unavailable — minimal spine only */
const FALLBACK_NAV: WorkspaceNavGroup[] = [
  {
    id: 'focus',
    label: 'Focus',
    items: [
      { id: 'home', href: '/terminal/workspace', label: 'Workspace', kind: 'procedure_hub' },
      { id: 'process', href: '/terminal/process', label: 'Cases', kind: 'resource' },
      { id: 'tasks', href: '/terminal/tasks', label: 'Tasks', kind: 'resource' },
      { id: 'ai', href: '/terminal/ai', label: 'AI', kind: 'resource' },
    ],
  },
];

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
}) {
  const pathname = usePathname();
  const groups = useMemo(
    () => (workspace?.nav?.length ? workspace.nav : FALLBACK_NAV),
    [workspace],
  );
  // Collapse "More" by default — reduce cognitive load
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({ more: true });

  function toggle(id: string) {
    setCollapsed((c) => ({ ...c, [id]: !c[id] }));
  }

  return (
    <aside className="terminal-nav" aria-label="Persona workspace navigation">
      <div className="terminal-brand">
        <strong>TradeOps</strong>
        <span>{workspace?.personaLabel ?? 'Commerce OS'}</span>
      </div>

      <p className="meta" style={{ margin: '0 0 6px', fontSize: '0.68rem', lineHeight: 1.3 }}>
        {workspace?.operatingPrinciple ?? 'One User · One Workspace · One Objective · One AI'}
      </p>
      <p className="meta" style={{ margin: '0 0 4px', fontSize: '0.7rem' }}>
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

      {workspace?.surface?.healthLabel || workspace?.recommendedNextAction ? (
        <div
          style={{
            marginBottom: 10,
            padding: '8px 10px',
            borderRadius: 8,
            border: '1px solid var(--border, #333)',
            fontSize: '0.8rem',
            lineHeight: 1.35,
          }}
        >
          {workspace.surface?.healthLabel ? (
            <span className="meta" style={{ display: 'block', margin: '0 0 4px' }}>
              Health <strong>{workspace.surface.healthLabel}</strong>
              {typeof workspace.surface.attentionScore === 'number'
                ? ` · ${workspace.surface.attentionScore}/100`
                : ''}
            </span>
          ) : null}
          {workspace.recommendedNextAction ? (
            <Link href={workspace.recommendedNextAction.href} className="nav-link" style={{ display: 'block' }}>
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
              href={`/terminal/ai?objective=${encodeURIComponent(workspace.surface.focusObjective)}`}
              className="meta"
              style={{ display: 'block', marginTop: 6 }}
            >
              Run focus objective →
            </Link>
          ) : null}
        </div>
      ) : null}

      <nav className="nav-groups">
        {groups.map((g) => {
          const isCollapsed = collapsed[g.id] ?? g.id === 'more';
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
                    const active =
                      pathname === item.href ||
                      (item.href !== '/terminal' &&
                        item.href !== '/terminal/workspace' &&
                        pathname?.startsWith(item.href));
                    return (
                      <li key={item.id}>
                        <Link
                          href={item.href}
                          className={active ? 'nav-link active' : 'nav-link'}
                          title={item.kind}
                          data-status={item.status}
                          data-kind={item.kind}
                        >
                          {item.label}
                          {item.badge ? (
                            <span
                              className="meta"
                              style={{ marginLeft: 6, opacity: 0.85 }}
                              aria-label={`${item.badge} pending`}
                            >
                              ({item.badge})
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
          Need something else? Ask AI or open More.
        </p>
        <ThemeToggle />
        <p className="meta" style={{ fontSize: '0.75rem', margin: '8px 0 0' }}>
          {orgName}
        </p>
        <p className="meta" style={{ fontSize: '0.7rem' }}>
          {email}
        </p>
        {showLogout ? logoutSlot : null}
      </div>
    </aside>
  );
}
