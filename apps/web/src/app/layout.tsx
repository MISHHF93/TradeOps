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
 * Root shell — public marketing chrome.
 * Terminal routes mount `.terminal-app` inside main; CSS hides public topbar/footer
 * via `.shell:has(.terminal-app)` so the OS shell (command bar + sidebar + AI rail) owns the viewport.
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
          <header className="topbar public-topbar">
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
            <div className="public-topbar__actions">
              <ThemeToggle />
              <PublicSiteNav />
            </div>
          </header>
          <main className="public-main">{children}</main>
          <footer className="site-footer public-footer">
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
