import Link from 'next/link';

export default function CapitalPortfolioPage() {
  return (
    <section>
      <header className="terminal-header">
        <div>
          <p className="pill">Capital · portfolio</p>
          <h1>Capital provider portfolio</h1>
          <p className="lede">
            Live portfolio of funded campaigns will appear here when custody, verification, and
            distribution gates are legally enabled. Until then, this is a placeholder shell.
          </p>
        </div>
        <Link className="btn ghost" href="/capital">
          Capital home
        </Link>
      </header>
      <article className="panel">
        <p>
          <strong>Status:</strong> legal-review / sandbox only. No pooled portfolio management (
          <code>POOLED_INVESTMENT_ENABLED=false</code>).
        </p>
        <p className="meta">
          Track sandbox campaign performance under{' '}
          <Link href="/capital/campaigns">Campaigns</Link>.
        </p>
      </article>
    </section>
  );
}
