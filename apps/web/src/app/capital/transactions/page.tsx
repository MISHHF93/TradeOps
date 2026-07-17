import Link from 'next/link';

export default function CapitalTransactionsPage() {
  return (
    <section>
      <header className="terminal-header">
        <div>
          <p className="pill">Capital · transactions</p>
          <h1>Capital transactions</h1>
        </div>
        <Link className="btn ghost" href="/capital">
          Capital home
        </Link>
      </header>
      <article className="panel">
        <p>
          Funding transactions, safeguarded balances, and provider payment references will list here
          when <code>CAPITAL_CUSTODY_ENABLED</code> and payment rails are approved.
        </p>
        <p className="meta">
          Today: ledger entries are campaign-scoped and visible on each campaign detail page.
          Ordinary SaaS charges appear under <Link href="/app/billing">Billing</Link>. Channel
          shopper payments appear under <Link href="/terminal/finance/payments">Finance</Link>.
        </p>
      </article>
    </section>
  );
}
