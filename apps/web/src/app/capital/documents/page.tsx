import Link from 'next/link';

export default function CapitalDocumentsPage() {
  return (
    <section>
      <header className="terminal-header">
        <div>
          <p className="pill">Capital · documents</p>
          <h1>Agreements &amp; disclosures</h1>
        </div>
        <Link className="btn ghost" href="/capital">
          Capital home
        </Link>
      </header>
      <article className="panel">
        <p>
          Investment agreements, risk acknowledgements, and KYC evidence packages will be stored
          with provider references — never invented verification results.
        </p>
        <p className="meta">
          Document vault integration is planned. Campaign risk disclosures already attach to each
          sandbox campaign record.
        </p>
      </article>
    </section>
  );
}
