import Link from 'next/link';
import type { ReactNode } from 'react';
import { getServerSession } from '../../lib/session';

const NAV = [
  { href: '/terminal', label: 'Scanner' },
  { href: '/terminal/pipeline', label: 'Pipeline' },
  { href: '/terminal/signals', label: 'Signals' },
  { href: '/terminal/portfolio', label: 'Portfolio' },
  { href: '/terminal/cashflow', label: 'Cash flow' },
  { href: '/terminal/orders', label: 'Orders' },
  { href: '/terminal/approvals', label: 'Approvals' },
  { href: '/terminal/connectors', label: 'Connectors' },
  { href: '/app', label: 'Account' },
];

export default async function TerminalLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession();

  return (
    <div className="terminal-shell">
      <aside className="terminal-nav">
        <div className="terminal-brand">
          <strong>TradeOps</strong>
          <span>Commerce Terminal</span>
        </div>
        <nav>
          {NAV.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <p className="meta">
          {session?.activeOrganization?.name ?? 'Local mode'} ·{' '}
          {session?.activeRole ?? 'seed DB'} · no login
        </p>
      </aside>
      <div className="terminal-main">{children}</div>
    </div>
  );
}
