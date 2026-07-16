import type { Metadata } from 'next';
import { publicPageMeta } from '../../lib/seo';

export const metadata: Metadata = publicPageMeta({
  title: 'Privacy',
  description: 'TradeOps privacy practices for public tools and merchant workspaces.',
  path: '/privacy',
});

export default function PrivacyPage() {
  return (
    <section className="hero">
      <h1>Privacy Policy</h1>
      <p className="lede">
        This is a production-facing draft for controlled launch. It is not a substitute for legal
        review. Update before a broad public commercial launch.
      </p>
      <article className="card">
        <h2>What we collect</h2>
        <p>
          Account registration data (name, email, password hash), organization metadata, commerce
          operational data you import or connect, and audit logs of security-relevant actions.
        </p>
        <h2>What we do not sell</h2>
        <p>We do not sell personal information or private store catalogs.</p>
        <h2>Public free tools</h2>
        <p>
          Public calculators process inputs you submit for that request and do not require a private
          catalog. Do not submit personal data of third parties into free tools.
        </p>
        <h2>Analytics</h2>
        <p>
          Optional GA4 (when configured) is privacy-aware and must not receive credentials, PII of
          customers, or raw order payloads. See docs/TRADEOPS_GA4.md.
        </p>
        <h2>Contact</h2>
        <p>
          Privacy questions: <a href="mailto:borahmasharai@gmail.com">borahmasharai@gmail.com</a>
        </p>
      </article>
    </section>
  );
}
