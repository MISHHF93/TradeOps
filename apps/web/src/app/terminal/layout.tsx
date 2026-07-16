import Link from 'next/link';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { LogoutButton } from '../../components/auth-forms';
import { StatusBadge } from '../../components/status-badge';
import { noIndexMeta } from '../../lib/seo';
import { getServerSession } from '../../lib/session';

export const metadata: Metadata = {
  ...noIndexMeta,
  title: 'Terminal',
};

const NAV = [
  { href: '/terminal', label: 'Scanner', status: 'operational' as const },
  { href: '/terminal/ai', label: 'AI Operator', status: 'approval_controlled' as const },
  { href: '/terminal/pipeline', label: 'Pipeline', status: 'operational' as const },
  { href: '/terminal/signals', label: 'Signals', status: 'operational' as const },
  { href: '/terminal/portfolio', label: 'Portfolio', status: 'operational' as const },
  { href: '/terminal/cashflow', label: 'Cash flow', status: 'operational' as const },
  { href: '/terminal/orders', label: 'Orders', status: 'operational' as const },
  { href: '/terminal/approvals', label: 'Approvals', status: 'operational' as const },
  { href: '/terminal/connectors', label: 'Connectors', status: 'operational' as const },
  { href: '/terminal/automations', label: 'Automations', status: 'credential_blocked' as const },
  { href: '/app', label: 'Account', status: 'operational' as const },
];

/**
 * Authenticated application chrome.
 * Does not inherit public marketing nav assumptions — workspace boundary.
 */
export default async function TerminalLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession();

  return (
    <div className="terminal-shell app-surface">
      <aside className="terminal-nav">
        <div className="terminal-brand">
          <strong>TradeOps App</strong>
          <span>Merchant workspace</span>
        </div>
        <p className="meta" style={{ margin: '0 0 8px' }}>
          <StatusBadge status="operational" /> private surface
        </p>
        <nav>
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} title={item.status}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div style={{ marginTop: 'auto', display: 'grid', gap: 8 }}>
          <p className="meta">
            {session?.activeOrganization?.name ?? 'No org'} · {session?.activeRole ?? '—'}
          </p>
          <p className="meta" style={{ fontSize: '0.75rem' }}>
            {session?.user.email ?? 'No session'}
          </p>
          <Link href="/" className="meta">
            ← Public website
          </Link>
          <LogoutButton />
        </div>
      </aside>
      <div className="terminal-main">{children}</div>
    </div>
  );
}
