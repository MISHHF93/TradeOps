import Link from 'next/link';
import { CapitalSetupActions } from '../../../components/network/capital-setup';
import { terminalGet } from '../../../lib/terminal-api';

export default async function NetworkCapitalPage() {
  const result = await terminalGet<{
    hasAccount: boolean;
    account?: { id: string; status: string; sandbox: boolean; verification: unknown };
    activeMandate?: {
      id: string;
      status: string;
      maximumCapitalMinor: number;
      riskLevel: string;
      minimumMarginBps: number;
    } | null;
    honesty?: { note: string };
  }>('/api/v1/network/capital');

  return (
    <section>
      <header className="terminal-header">
        <div>
          <p className="pill">Network · operating capital</p>
          <h1>Commerce capital account</h1>
          <p className="lede">
            Client-owned operating budget. Verification and partner funding required before live
            deployment. Never an editable fake balance.
          </p>
        </div>
        <Link className="btn ghost" href="/network/portfolio">
          Portfolio
        </Link>
      </header>

      {!result.ok ? <p className="form-error">{result.error}</p> : null}

      <article className="panel">
        <h2>Account state</h2>
        {result.ok && result.data.hasAccount ? (
          <>
            <p>
              Status: <strong>{result.data.account?.status}</strong>
              {result.data.account?.sandbox ? ' · SANDBOX' : ''}
            </p>
            <pre style={{ fontSize: '0.8rem', whiteSpace: 'pre-wrap' }}>
              {JSON.stringify(result.data.account?.verification, null, 2)}
            </pre>
          </>
        ) : (
          <p className="meta">No account yet.</p>
        )}
        <CapitalSetupActions />
      </article>

      <article className="panel" style={{ marginTop: 16 }}>
        <h2>Active CommerceMandate</h2>
        {result.ok && result.data.activeMandate ? (
          <ul className="kv">
            <li>
              <span>Status</span>
              <strong>{result.data.activeMandate.status}</strong>
            </li>
            <li>
              <span>Risk</span>
              <strong>{result.data.activeMandate.riskLevel}</strong>
            </li>
            <li>
              <span>Max capital (minor)</span>
              <strong>{result.data.activeMandate.maximumCapitalMinor}</strong>
            </li>
            <li>
              <span>Min margin bps</span>
              <strong>{result.data.activeMandate.minimumMarginBps}</strong>
            </li>
          </ul>
        ) : (
          <p className="meta">No mandate. Create via sandbox setup or API.</p>
        )}
      </article>
    </section>
  );
}
