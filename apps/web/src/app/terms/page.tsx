import type { Metadata } from 'next';
import { publicPageMeta } from '../../lib/seo';

export const metadata: Metadata = publicPageMeta({
  title: 'Terms of Service',
  description: 'Terms governing use of TradeOps public tools and merchant workspace.',
  path: '/terms',
});

export default function TermsPage() {
  return (
    <section className="hero">
      <h1>Terms of Service</h1>
      <p className="lede">Draft terms for controlled launch — obtain legal review before broad commercial offer.</p>
      <article className="card">
        <h2>Service description</h2>
        <p>
          TradeOps provides commerce intelligence, orchestration tooling, and automation aids. It does
          not guarantee profit, sales volume, or ranking on external marketplaces.
        </p>
        <h2>Your responsibilities</h2>
        <p>
          You are responsible for marketplace compliance, product accuracy, tax/customs obligations,
          and obtaining rights to use connected accounts and catalogs.
        </p>
        <h2>Approvals and automation</h2>
        <p>
          Consequential financial and marketplace actions require human approval unless you configure
          a narrow preapproved policy. Shadow mode records recommendations without external risk.
        </p>
        <h2>Limitation</h2>
        <p>
          To the maximum extent permitted by law, TradeOps is provided “as is” without warranties of
          merchantability or fitness for a particular purpose.
        </p>
      </article>
    </section>
  );
}
