import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Documentation' };

export default function DocsPage() {
  return (
    <section className="hero">
      <h1>Documentation</h1>
      <p className="lede">
        Operator runbooks live in the repository. Public summary for merchants and developers:
      </p>
      <div className="grid">
        <article className="card">
          <h2>First run (local)</h2>
          <p>
            <code>pnpm setup</code> → <code>pnpm run bootstrap:local</code> → <code>npm start</code>
          </p>
          <p className="meta">See docs/FIRST_RUN.md in the repo</p>
        </article>
        <article className="card">
          <h2>API surfaces</h2>
          <p>
            Public: <code>/api/v1/public/*</code> · Auth: <code>/api/v1/auth/*</code> · App:{' '}
            <code>/api/v1/terminal/*</code>, <code>/api/v1/ai/*</code>
          </p>
        </article>
        <article className="card">
          <h2>Loop modes</h2>
          <p>fixture · development · shadow · controlled_live · automated_live</p>
          <p className="meta">
            <Link href="/how-it-works">How it works →</Link>
          </p>
        </article>
        <article className="card">
          <h2>Capability status</h2>
          <p>Machine-readable honesty for every primary control.</p>
          <p className="meta">
            <Link href="/status">Open status →</Link>
          </p>
        </article>
      </div>
    </section>
  );
}
