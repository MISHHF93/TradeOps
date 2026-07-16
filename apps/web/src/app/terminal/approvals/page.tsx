import { ApprovalButtons } from '../../../components/terminal-actions';
import { terminalGet } from '../../../lib/terminal-api';

export default async function ApprovalsPage() {
  const result = await terminalGet<
    Array<{
      id: string;
      kind: string;
      status: string;
      note: string | null;
      createdAt: string;
      listing: { id: string; status: string; sku: string } | null;
      supplierPurchaseOrder: { id: string; isDraft: boolean; costMinor: number } | null;
    }>
  >('/api/v1/approvals');

  const rows = result.ok ? result.data : [];

  return (
    <section>
      <h1>Approval queue</h1>
      <p className="lede">
        Default is human approval before listing publish and supplier purchase-order execution. Full
        automation is off.
      </p>
      {!result.ok ? <p className="form-error">{result.error}</p> : null}
      <table className="scanner-table">
        <thead>
          <tr>
            <th>Kind</th>
            <th>Status</th>
            <th>Note</th>
            <th>Created</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id}>
              <td>{a.kind}</td>
              <td>{a.status}</td>
              <td>
                {a.note}
                {a.listing ? ` · listing ${a.listing.sku} (${a.listing.status})` : ''}
                {a.supplierPurchaseOrder
                  ? ` · PO draft cost ${a.supplierPurchaseOrder.costMinor}`
                  : ''}
              </td>
              <td>{new Date(a.createdAt).toLocaleString()}</td>
              <td>{a.status === 'pending' ? <ApprovalButtons approvalId={a.id} /> : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
