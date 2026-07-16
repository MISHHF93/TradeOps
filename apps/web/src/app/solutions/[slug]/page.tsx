import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { publicPageMeta } from '../../../lib/seo';

const SOLUTIONS: Record<string, { title: string; body: string }> = {
  dropshipping: {
    title: 'Dropshipping operations',
    body: 'Score supplier offers, protect margin, and route orders with approval-controlled purchase orders — without claiming automated purchasing without human gates.',
  },
  'multichannel-commerce': {
    title: 'Multichannel commerce',
    body: 'Canonical products and listings across storefront and marketplace adapters. Live channels require your OAuth credentials; fixtures stay labeled.',
  },
  'product-intelligence': {
    title: 'Product intelligence',
    body: 'Contribution profit, opportunity scores, and policy gates using the same commerce-engine math as free tools and the terminal.',
  },
  'supplier-intelligence': {
    title: 'Supplier intelligence',
    body: 'Compare cost, shipping, reliability, and policy risk before capital commitment.',
  },
  'commerce-automation': {
    title: 'Commerce automation',
    body: 'Versioned workflow templates with shadow defaults and approval-controlled consequential steps.',
  },
  'predictive-commerce': {
    title: 'Predictive commerce',
    body: 'Baseline forecasts with transparent evaluation against outcomes — not guaranteed sales.',
  },
};

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return Object.keys(SOLUTIONS).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const s = SOLUTIONS[slug];
  if (!s) return { title: 'Solutions' };
  return publicPageMeta({
    title: s.title,
    description: s.body.slice(0, 155),
    path: `/solutions/${slug}`,
  });
}

export default async function SolutionPage({ params }: Props) {
  const { slug } = await params;
  const s = SOLUTIONS[slug];
  if (!s) notFound();
  return (
    <section className="hero">
      <p className="pill">Solutions</p>
      <h1>{s.title}</h1>
      <p className="lede">{s.body}</p>
      <div className="cta-row">
        <Link className="btn primary" href="/register">
          Start registration
        </Link>
        <Link className="btn ghost" href="/status">
          Capability status
        </Link>
      </div>
    </section>
  );
}
