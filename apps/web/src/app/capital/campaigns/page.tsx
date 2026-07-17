import Link from 'next/link';
import { SandboxCampaignForm } from '../../../components/capital/sandbox-campaign-form';
import { formatMoney } from '../../../lib/money';
import { terminalGet } from '../../../lib/terminal-api';

type CampaignsResponse = {
  writeMode: string;
  campaigns: Array<{
    id: string;
    title: string;
    capitalTargetMinor: number;
    currency: string;
    fundingModel: string;
    status: string;
    sandbox: boolean;
    legalReviewStatus: string;
  }>;
  honesty: { note: string };
};

export default async function CapitalCampaignsPage() {
  const result = await terminalGet<CampaignsResponse>('/api/v1/capital/campaigns');
  const rows = result.ok ? result.data.campaigns : [];

  return (
    <section>
      <header className="terminal-header">
        <div>
          <p className="pill">Capital · campaigns</p>
          <h1>Commerce campaigns</h1>
          <p className="lede">
            Campaign-based capital allocation with purpose-restricted budgets. Default mode is
            sandbox — not public crowdfunding.
          </p>
        </div>
        <div className="terminal-toolbar">
          <Link className="btn ghost" href="/capital">
            Capital home
          </Link>
        </div>
      </header>

      {!result.ok ? <p className="form-error">{result.error}</p> : null}
      {result.ok ? (
        <p className="meta">
          Write mode: <code>{result.data.writeMode}</code> · {result.data.honesty.note}
        </p>
      ) : null}

      <SandboxCampaignForm />

      <table className="scanner-table" style={{ marginTop: 24 }}>
        <thead>
          <tr>
            <th>Title</th>
            <th>Target</th>
            <th>Model</th>
            <th>Status</th>
            <th>Sandbox</th>
            <th>Legal</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id}>
              <td>
                <Link href={`/capital/campaigns/${c.id}`}>{c.title}</Link>
              </td>
              <td>{formatMoney(c.capitalTargetMinor, c.currency)}</td>
              <td>{c.fundingModel}</td>
              <td>{c.status}</td>
              <td>{c.sandbox ? 'yes' : 'no'}</td>
              <td>{c.legalReviewStatus}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 ? (
        <p className="meta">No campaigns yet. Create a sandbox campaign above.</p>
      ) : null}
    </section>
  );
}
