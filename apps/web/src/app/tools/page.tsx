import Link from 'next/link';

const TOOLS = [
  {
    href: '/tools/profit',
    title: 'Unit economics calculator',
    body: 'Contribution profit with fees, shipping, ads, and return reserves. Revenue is never profit.',
  },
  {
    href: '/tools/score',
    title: 'Opportunity score',
    body: 'Explainable 0–100 product opportunity score with component drivers.',
  },
  {
    href: '/tools/policy',
    title: 'Policy gate',
    body: 'Fail-closed restricted-category checks before you list or procure.',
  },
];

export default function ToolsIndexPage() {
  return (
    <section className="hero">
      <div>
        <h1>Free commerce tools</h1>
        <p className="lede">
          Public calculators using the same TradeOps math as the operator terminal. No account
          required. No private store data accessed.
        </p>
      </div>
      <div className="grid">
        {TOOLS.map((t) => (
          <article key={t.href} className="card">
            <h2>{t.title}</h2>
            <p>{t.body}</p>
            <p className="meta">
              <Link href={t.href}>Open tool →</Link>
            </p>
          </article>
        ))}
      </div>
      <p className="meta">
        Operators: <Link href="/terminal">open the full terminal</Link> for connectors, pipeline, and
        weekend Google automation.
      </p>
    </section>
  );
}
