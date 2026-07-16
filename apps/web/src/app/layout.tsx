import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'TradeOps',
  description: 'The AI Operating System for Global Commerce',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <header className="topbar">
            <Link href="/terminal" className="brand">
              <span className="mark" aria-hidden />
              <div>
                <strong>TradeOps</strong>
                <p>AI Operating System for Global Commerce</p>
              </div>
            </Link>
            <nav className="nav">
              <span className="pill">Local mode · no login</span>
              <Link href="/terminal">Terminal</Link>
              <Link href="/app">Account</Link>
            </nav>
          </header>
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
