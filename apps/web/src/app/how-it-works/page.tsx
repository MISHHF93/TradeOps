import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'How it works' };

const STEPS = [
  'Connect authorized channels (or use fixture development loop for local testing)',
  'Ingest products, offers, and events into the canonical TradeOps model',
  'Score contribution profit, opportunity, and policy risk',
  'Run AI operator objectives through typed tools with critic + auditor',
  'Queue consequential actions for human approval',
  'Execute permitted workflows; observe outcomes; evaluate forecasts',
];

export default function HowItWorksPage() {
  return (
    <section className="hero">
      <h1>How TradeOps works</h1>
      <p className="lede">
        One canonical internal world. Many external adapters. AI operates only on approved tools and
        models — never unfiltered marketplace payloads.
      </p>
      <ol className="pipeline-flow">
        {STEPS.map((s, i) => (
          <li key={s} className="pipeline-stage status-complete">
            <span className="pipeline-step">{i + 1}</span>
            <div>
              <strong>{s}</strong>
            </div>
          </li>
        ))}
      </ol>
      <p className="meta">
        Loop modes: <strong>fixture</strong> · <strong>development</strong> · <strong>shadow</strong> ·{' '}
        <strong>controlled_live</strong> · <strong>automated_live</strong>. Shadow is live evaluation —
        not a fake demo.
      </p>
      <Link className="btn primary" href="/docs">
        Read documentation
      </Link>
    </section>
  );
}
