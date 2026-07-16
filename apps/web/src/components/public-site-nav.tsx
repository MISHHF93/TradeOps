import Link from 'next/link';

const PUBLIC_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/product', label: 'Product' },
  { href: '/solutions/product-intelligence', label: 'Solutions' },
  { href: '/integrations', label: 'Integrations' },
  { href: '/tools', label: 'Free tools' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/security', label: 'Security' },
  { href: '/docs', label: 'Docs' },
  { href: '/status', label: 'Status' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

export function PublicSiteNav() {
  return (
    <nav className="nav public-nav" aria-label="Public site">
      <span className="pill">Public website</span>
      {PUBLIC_LINKS.map((l) => (
        <Link key={l.href} href={l.href}>
          {l.label}
        </Link>
      ))}
      <Link className="btn ghost" href="/login" style={{ padding: '6px 12px' }}>
        Sign in
      </Link>
      <Link className="btn primary" href="/register" style={{ padding: '6px 12px' }}>
        Register
      </Link>
    </nav>
  );
}
