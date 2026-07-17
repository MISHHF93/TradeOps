import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { FounderAccessBanner } from '../components/founder-access-banner';
import { Ga4Analytics } from '../components/ga4';
import { PublicSiteNav } from '../components/public-site-nav';
import { ThemeToggle, themeInitScript } from '../components/theme-toggle';
import { FOUNDER_WORKSPACE_PATH, isFounderDirectAccess } from '../lib/access-mode';
import './globals.css';
/* Workflow node palette utilities live in globals (single token source) */

export const metadata: Metadata = {
  title: {
    default: 'TradeOps — The AI Command Center for Global Commerce',
    template: '%s · TradeOps',
  },
  description:
    'TradeOps is the AI command center for multichannel commerce: products, suppliers, marketplaces, workflows, and cash flow in one governed operating system.',
};

/**
 * Root shell — Midnight Exchange visual system (theme.md).
 * Terminal layout hides public chrome via CSS :has(.terminal-shell).
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  const founder = isFounderDirectAccess();

  return (
    <html lang="en" data-theme="dark" data-density="compact" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <Ga4Analytics />
        <FounderAccessBanner />
        <div className="shell">
          <header className="topbar">
            <Link href={founder ? FOUNDER_WORKSPACE_PATH : '/'} className="brand">
              <span className="mark" aria-hidden />
              <div>
                <strong>TradeOps</strong>
                <p>
                  {founder
                    ? 'Discover. Decide. Execute.'
                    : 'The AI Command Center for Global Commerce'}
                </p>
              </div>
            </Link>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <ThemeToggle />
              <PublicSiteNav />
            </div>
          </header>
          <main>{children}</main>
          <footer className="site-footer">
            <div>
              <strong>TradeOps</strong>
              <p className="meta">
                One system for products, channels, suppliers, workflows, and cash flow. External
                platforms own transactions. TradeOps does not fabricate live API success.
              </p>
            </div>
            <div className="footer-links">
              <Link href="/security">Security</Link>
              <Link href="/status">Capability status</Link>
              <Link href="/docs">Docs</Link>
              {founder ? (
                <Link href={FOUNDER_WORKSPACE_PATH}>Terminal</Link>
              ) : (
                <Link href="/login">Merchant sign in</Link>
              )}
              <Link href="/app">Workspace</Link>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
