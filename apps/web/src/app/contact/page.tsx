import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Contact' };

export default function ContactPage() {
  return (
    <section className="hero">
      <h1>Contact</h1>
      <p className="lede">
        Controlled public launch contact for merchants and partners. This page does not invent a
        support ticket backend that is not implemented.
      </p>
      <article className="card" style={{ maxWidth: 520 }}>
        <h2>Reach the team</h2>
        <p>
          Email: <a href="mailto:borahmasharai@gmail.com">borahmasharai@gmail.com</a>
        </p>
        <p className="meta">
          Repository: <a href="https://github.com/MISHHF93/TradeOps">github.com/MISHHF93/TradeOps</a>
        </p>
        <p className="meta">
          For product feedback, prefer issues on GitHub. For security concerns, email with subject
          prefix <code>[SECURITY]</code>.
        </p>
      </article>
      <p className="meta">
        <Link href="/register">Create a merchant workspace →</Link>
      </p>
    </section>
  );
}
