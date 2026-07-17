import Link from 'next/link';
import { formatMoney } from '../../../../lib/money';
import { terminalGet } from '../../../../lib/terminal-api';

type CampaignDetail = {
  writeMode: string;
  campaign: {
    id: string;
    title: string;
    description: string;
    capitalTargetMinor: number;
    currency: string;
    fundingModel: string;
    status: string;
    riskRating: string;
    jurisdiction: string;
    legalReviewStatus: string;
    sandbox: boolean;
    riskDisclosure: unknown;
    economics: unknown;
  };
  budget: {
    inventoryBudgetMinor: number;
    advertisingBudgetMinor: number;
    fulfillmentBudgetMinor: number;
    operatingReserveMinor: number;
    platformFeesMinor: number;
    currency: string;
  } | null;
  commitments: Array<{
    id: string;
    committedAmountMinor: number;
    fundedAmountMinor: number;
    status: string;
  }>;
  disbursements: Array<{
    id: string;
    budgetLine: string;
    amountMinor: number;
    status: string;
    purpose: string;
  }>;
  distributions: Array<{
    id: string;
    recipientType: string;
    principalReturnedMinor: number;
    profitDistributedMinor: number;
    status: string;
  }>;
  ledgerBalances: Record<string, number>;
  honesty: { sandbox: boolean; legalReviewStatus: string; note: string };
};

export default async function CapitalCampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await terminalGet<CampaignDetail>(`/api/v1/capital/campaigns/${id}`);

  if (!result.ok) {
    return (
      <section>
        <p className="form-error">{result.error}</p>
        <Link href="/capital/campaigns">Back</Link>
      </section>
    );
  }

  const d = result.data;
  const c = d.campaign;
  const cur = c.currency;

  return (
    <section>
      <header className="terminal-header">
        <div>
          <p className="pill">
            {c.sandbox ? 'SANDBOX campaign' : 'Campaign'} · {c.status}
          </p>
          <h1>{c.title}</h1>
          <p className="lede">{c.description || 'No description.'}</p>
        </div>
        <div className="terminal-toolbar">
          <Link className="btn ghost" href="/capital/campaigns">
            All campaigns
          </Link>
        </div>
      </header>

      <p className="meta">{d.honesty.note}</p>
      <p className="meta">
        Model <code>{c.fundingModel}</code> · Jurisdiction {c.jurisdiction} · Risk {c.riskRating} ·
        Legal {c.legalReviewStatus}
      </p>

      <div className="detail-grid">
        <article className="panel">
          <h2>Capital</h2>
          <ul className="kv">
            <li>
              <span>Target</span>
              <strong>{formatMoney(c.capitalTargetMinor, cur)}</strong>
            </li>
            <li>
              <span>Commitments</span>
              <strong>{d.commitments.length}</strong>
            </li>
            <li>
              <span>Funded (sum)</span>
              <strong>
                {formatMoney(
                  d.commitments.reduce((s, x) => s + x.fundedAmountMinor, 0),
                  cur,
                )}
              </strong>
            </li>
          </ul>
        </article>

        <article className="panel">
          <h2>Purpose-restricted budget</h2>
          {d.budget ? (
            <ul className="kv">
              <li>
                <span>Inventory</span>
                <strong>{formatMoney(d.budget.inventoryBudgetMinor, cur)}</strong>
              </li>
              <li>
                <span>Advertising</span>
                <strong>{formatMoney(d.budget.advertisingBudgetMinor, cur)}</strong>
              </li>
              <li>
                <span>Fulfillment</span>
                <strong>{formatMoney(d.budget.fulfillmentBudgetMinor, cur)}</strong>
              </li>
              <li>
                <span>Reserve</span>
                <strong>{formatMoney(d.budget.operatingReserveMinor, cur)}</strong>
              </li>
              <li>
                <span>Platform fees</span>
                <strong>{formatMoney(d.budget.platformFeesMinor, cur)}</strong>
              </li>
            </ul>
          ) : (
            <p className="meta">No budget</p>
          )}
        </article>

        <article className="panel">
          <h2>Ledger balances (derived)</h2>
          {Object.keys(d.ledgerBalances).length === 0 ? (
            <p className="meta">No journal entries yet.</p>
          ) : (
            <ul className="kv">
              {Object.entries(d.ledgerBalances).map(([k, v]) => (
                <li key={k}>
                  <span>
                    <code>{k}</code>
                  </span>
                  <strong>{v}</strong>
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>

      <h2 style={{ marginTop: 24 }}>Disbursements</h2>
      {d.disbursements.length === 0 ? (
        <p className="meta">None yet. Disbursements require budget line + approval.</p>
      ) : (
        <table className="scanner-table">
          <thead>
            <tr>
              <th>Line</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Purpose</th>
            </tr>
          </thead>
          <tbody>
            {d.disbursements.map((x) => (
              <tr key={x.id}>
                <td>{x.budgetLine}</td>
                <td>{formatMoney(x.amountMinor, cur)}</td>
                <td>{x.status}</td>
                <td>{x.purpose}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 style={{ marginTop: 24 }}>Distributions</h2>
      {d.distributions.length === 0 ? (
        <p className="meta">
          None calculated. Use dry-run waterfall API — execution gated by DISTRIBUTIONS_ENABLED.
        </p>
      ) : (
        <table className="scanner-table">
          <thead>
            <tr>
              <th>Recipient</th>
              <th>Principal</th>
              <th>Profit</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {d.distributions.map((x) => (
              <tr key={x.id}>
                <td>{x.recipientType}</td>
                <td>{formatMoney(x.principalReturnedMinor, cur)}</td>
                <td>{formatMoney(x.profitDistributedMinor, cur)}</td>
                <td>{x.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <article className="panel" style={{ marginTop: 24 }}>
        <h2>Risk disclosures</h2>
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.85rem' }}>
          {JSON.stringify(c.riskDisclosure, null, 2)}
        </pre>
      </article>
    </section>
  );
}
