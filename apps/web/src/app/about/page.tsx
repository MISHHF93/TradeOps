import type { Metadata } from 'next';
import Link from 'next/link';
import { publicPageMeta } from '../../lib/seo';

export const metadata: Metadata = publicPageMeta({
  title: 'About',
  description: 'TradeOps — the AI operating system for commerce.',
  path: '/about',
});

export default function AboutPage() {
  return (
    <section className="hero">
      <h1>About TradeOps</h1>
      <p className="lede">
        TradeOps owns intelligence and orchestration. External platforms own transactions. We
        connect authorized systems, measure real contribution profit, and keep humans in control of
        money-risking actions.
      </p>
      <p>
        <Link className="btn primary" href="/register">
          Register
        </Link>
      </p>
    </section>
  );
}
