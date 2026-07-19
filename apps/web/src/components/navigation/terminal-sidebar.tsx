'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo, useState } from 'react';
import type { ResolvedWorkspace, WorkspaceNavGroup } from '../../lib/workspace';

/** Fallback when workspace API unavailable — same spine as commerce-engine Focus */
/** Offline fallback — BO spine only; AI is the right rail, not Focus. */
const FALLBACK_NAV: WorkspaceNavGroup[] = [
  {
    id: 'focus',
    label: 'Focus',
    items: [
      { id: 'home', href: '/terminal/workspace', label: 'Home', kind: 'procedure_hub' },
      { id: 'discover', href: '/terminal', label: 'Discover', kind: 'procedure_step' },
      { id: 'process', href: '/terminal/process', label: 'Cases', kind: 'procedure_hub' },
      { id: 'opps', href: '/terminal/opportunities', label: 'Opportunities', kind: 'procedure_step' },
      { id: 'tasks', href: '/terminal/tasks', label: 'Tasks', kind: 'resource' },
    ],
  },
  {
    id: 'more',
    label: 'More',
    items: [
      { id: 'orders', href: '/terminal/orders', label: 'Orders', kind: 'procedure_step' },
      { id: 'approvals', href: '/terminal/approvals', label: 'Approvals', kind: 'resource' },
      { id: 'objectives', href: '/terminal/objectives', label: 'AI run history', kind: 'resource' },
      { id: 'connectors', href: '/terminal/connectors', label: 'Connectors', kind: 'resource' },
      { id: 'switch', href: '/terminal/workspace?switch=1', label: 'Switch persona', kind: 'admin' },
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

      <p className="nav-principle">
        {workspace?.operatingPrinciple ?? 'One User · One Workspace · One Objective · One AI'}
      </p>
      <p className="nav-meta-line">
        {workspace?.personaLabel ?? segment ?? '—'} · {planTier ?? '—'} · {role}
      </p>

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
