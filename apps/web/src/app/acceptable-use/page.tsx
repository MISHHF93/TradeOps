import type { Metadata } from 'next';
import { publicPageMeta } from '../../lib/seo';

export const metadata: Metadata = publicPageMeta({
  title: 'Acceptable Use',
  description: 'Prohibited uses of TradeOps including restricted goods and abuse.',
  path: '/acceptable-use',
});

export default function AcceptableUsePage() {
  return (
    <section className="hero">
      <h1>Acceptable Use Policy</h1>
      <article className="card">
        <p>You may not use TradeOps to:</p>
        <ul>
          <li>list or procure prohibited weapons, controlled substances, or counterfeit goods;</li>
          <li>bypass marketplace fees, taxes, or policy enforcement;</li>
          <li>fabricate reviews, customers, or transactions;</li>
          <li>attack, scrape, or overload TradeOps or connected platforms beyond authorized APIs;</li>
          <li>exfiltrate other tenants’ data;</li>
          <li>disable audit or approval controls.</li>
        </ul>
        <p className="meta">Violations may result in suspension and reporting to authorities or marketplaces.</p>
      </article>
    </section>
  );
}
