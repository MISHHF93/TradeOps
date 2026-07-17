import Link from 'next/link';
import { FOUNDER_WORKSPACE_PATH, isFounderDirectAccess } from '../../lib/access-mode';

const PUBLIC_LINKS = [
  { href: '/product', label: 'Product' },
  { href: '/platform', label: 'Platform' },
  { href: '/solutions/individual-sellers', label: 'Solutions' },
  { href: '/integrations', label: 'Integrations' },
  { href: '/tools', label: 'Free tools' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/security', label: 'Security' },
  { href: '/docs', label: 'Docs' },
  { href: '/status', label: 'Status' },
];

export function PublicSiteNav() {
  const founder = isFounderDirectAccess();

  return (
    <nav className="nav public-nav" aria-label="Public site">
      <span className="pill">{founder ? 'Founder access' : 'Public website'}</span>
      {PUBLIC_LINKS.map((l) => (
        <Link key={l.href} href={l.href}>
          {l.label}
        </Link>
      ))}
      {founder ? (
        <>
          <Link className="btn primary" href={FOUNDER_WORKSPACE_PATH} style={{ padding: '6px 12px' }}>
            Open TradeOps
          </Link>
          <Link className="btn ghost" href="/platform" style={{ padding: '6px 12px' }}>
            Explore the Platform
          </Link>
        </>
      ) : (
        <>
          <Link className="btn ghost" href="/login" style={{ padding: '6px 12px' }}>
            Sign in
          </Link>
          <Link className="btn primary" href="/register" style={{ padding: '6px 12px' }}>
            Register
          </Link>
        </>
      )}
    </nav>
  );
}
