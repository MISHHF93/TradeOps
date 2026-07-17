'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo, useState } from 'react';
import type { ResolvedWorkspace, WorkspaceNavGroup } from '../../lib/workspace';
import { FounderMenu } from './founder-menu';
import { ThemeToggle } from '../layout/theme-toggle';

/** Fallback when workspace API unavailable — minimal procedure spine only */
const FALLBACK_NAV: WorkspaceNavGroup[] = [
  {
    id: 'workspace',
    label: 'Workspace',
    items: [
      { id: 'home', href: '/terminal/workspace', label: 'Choose persona', kind: 'procedure_hub' },
      { id: 'process', href: '/terminal/process', label: 'Process', kind: 'resource' },
      { id: 'tasks', href: '/terminal/tasks', label: 'Tasks', kind: 'resource' },
      { id: 'discover', href: '/terminal', label: 'Discover', kind: 'procedure_step' },
      { id: 'ai', href: '/terminal/ai', label: 'AI Operator', kind: 'resource' },
    ],
  },
];

export function TerminalSidebar({
  founderDirect,
  orgName,
  email,
  role,
  segment,
  planTier,
  showLogout,
  logoutSlot,
  workspace,
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
}) {
  const pathname = usePathname();
  const groups = useMemo(
    () => (workspace?.nav?.length ? workspace.nav : FALLBACK_NAV),
    [workspace],
  );
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  function toggle(id: string) {
    setCollapsed((c) => ({ ...c, [id]: !c[id] }));
  }

  return (
    <aside className="terminal-nav" aria-label="Persona workspace navigation">
      <div className="terminal-brand">
        <strong>TradeOps</strong>
        <span>{workspace?.personaLabel ?? 'Commerce OS'} workspace</span>
      </div>

      <p className="meta" style={{ margin: '0 0 8px', fontSize: '0.7rem' }}>
        {workspace?.personaLabel ?? segment ?? '—'} · {planTier ?? '—'} · {role}
      </p>

      {workspace?.recommendedNextAction ? (
        <Link
          href={workspace.recommendedNextAction.href}
          className="nav-link"
          style={{
            display: 'block',
            marginBottom: 10,
            padding: '8px 10px',
            borderRadius: 8,
            border: '1px solid var(--border, #333)',
            fontSize: '0.8rem',
            lineHeight: 1.35,
          }}
        >
          <span className="meta" style={{ display: 'block', margin: 0 }}>
            Next action
          </span>
          <strong>{workspace.recommendedNextAction.label}</strong>
          <span className="meta" style={{ display: 'block', margin: '2px 0 0' }}>
            {workspace.recommendedNextAction.reason}
          </span>
        </Link>
      ) : null}

      <nav className="nav-groups">
        {groups.map((g) => {
          const isCollapsed = collapsed[g.id];
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
        <ThemeToggle />
        <p className="meta" style={{ fontSize: '0.75rem', margin: '8px 0 0' }}>
          {orgName}
        </p>
        <p className="meta" style={{ fontSize: '0.7rem' }}>
          {email}
        </p>
        {founderDirect ? (
          <FounderMenu email={email} orgName={orgName} />
        ) : showLogout ? (
          logoutSlot
        ) : null}
      </div>
    </aside>
  );
}
