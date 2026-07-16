import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { PublicSiteNav } from '../components/public-site-nav';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'TradeOps — AI Operating System for Global Commerce',
    template: '%s · TradeOps',
  },
  description:
    'TradeOps is a marketplace-independent commerce OS: profit intelligence, AI operator, workflow automation, and multi-channel orchestration with honest connector status.',
};

/**
 * Root shell — public website chrome by default.
 * Terminal layout replaces chrome density for the authenticated app surface.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <header className="topbar">
            <Link href="/" className="brand">
              <span className="mark" aria-hidden />
              <div>
                <strong>TradeOps</strong>
                <p>AI Operating System for Global Commerce</p>
              </div>
            </Link>
            <PublicSiteNav />
          </header>
          <main>{children}</main>
          <footer className="site-footer">
            <div>
              <strong>TradeOps</strong>
              <p className="meta">
                Intelligence and orchestration for physical commerce. External platforms own
                transactions. TradeOps does not fabricate live API success.
              </p>
            </div>
            <div className="footer-links">
              <Link href="/security">Security</Link>
              <Link href="/status">Capability status</Link>
              <Link href="/docs">Docs</Link>
              <Link href="/login">Merchant sign in</Link>
              <Link href="/app">Workspace</Link>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
