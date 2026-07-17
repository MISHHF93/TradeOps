import Link from 'next/link';
import {
  ProcessPageHeader,
  ProcessRelatedLinks,
} from '../../../components/commerce/process-chrome';
import { ApprovalActionCell } from '../../../components/terminal/approval-actions';
import { PROCESS_LABELS } from '../../../lib/process-ux';
import { terminalGet } from '../../../lib/terminal-api';

export default async function ApprovalsPage() {
  const result = await terminalGet<
    Array<{
      id: string;
      kind: string;
      status: string;
      note: string | null;
      createdAt: string;
      decidedAt?: string | null;
      listing: {
        id: string;
        status: string;
        sku: string;
        productId?: string;
      } | null;
      supplierPurchaseOrder: { id: string; isDraft: boolean; costMinor: number } | null;
    }>
  >('/api/v1/approvals');

  const rows = result.ok ? result.data : [];
  const pending = rows.filter((r) => r.status === 'pending').length;

  return (
    <section>
      <ProcessPageHeader
        pill="Stage view · Approve"
        title={PROCESS_LABELS.viewApprovals}
        lede={`Consequential actions only: marketplace publish, supplier POs, price changes. Research never lands here.${
          pending ? ` · ${pending} pending` : ' · queue clear'
        }`}
        currentStage="approve"
        breadcrumbs={[
          { href: '/terminal/process', label: PROCESS_LABELS.boardTitle },
          { label: PROCESS_LABELS.viewApprovals },
        ]}
        toolbar={
          <>
            <Link className="btn primary" href="/terminal/process">
              {PROCESS_LABELS.openProcess}
            </Link>
            <Link className="btn ghost" href="/terminal/tasks">
              {PROCESS_LABELS.viewTasks}
            </Link>
          </>
        }
      />
      <ProcessRelatedLinks primary="approvals" />
      {!result.ok ? <p className="form-error">{result.error}</p> : null}
      {rows.length === 0 ? (
        <article className="panel">
          <p>
            No actions require approval. Listing publish and supplier purchase submissions appear when
            a case reaches <strong>Prepare → Approve</strong>. Open the{' '}
            <Link href="/terminal/process">{PROCESS_LABELS.openProcess}</Link> or{' '}
            <Link href="/terminal/tasks">{PROCESS_LABELS.viewTasks}</Link>.
          </p>
        </article>
      ) : null}
      <table className="scanner-table" aria-label="Approval queue">
        <thead>
          <tr>
            <th>Kind</th>
            <th>Status</th>
            <th>Note / target</th>
            <th>Created</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id}>
              <td>
                <code>{a.kind}</code>
                {a.listing?.status === 'draft' ? (
                  <span className="meta"> · draft</span>
                ) : null}
              </td>
              <td>
                <span
                  className={
                    a.status === 'pending'
                      ? 'text-warning'
                      : a.status === 'approved'
                        ? 'text-positive'
                        : a.status === 'rejected'
                          ? 'text-negative'
                          : undefined
                  }
                >
                  {a.status}
                </span>
              </td>
              <td style={{ whiteSpace: 'normal', maxWidth: 360 }}>
                {a.note}
                {a.listing ? ` · listing ${a.listing.sku} (${a.listing.status})` : ''}
                {a.supplierPurchaseOrder
                  ? ` · PO draft cost ${a.supplierPurchaseOrder.costMinor}`
                  : ''}
              </td>
              <td>{new Date(a.createdAt).toLocaleString()}</td>
              <td>
                <ApprovalActionCell
                  approvalId={a.id}
                  status={a.status}
                  kind={a.kind}
                  listingId={a.listing?.id}
                  productId={a.listing?.productId}
                  note={a.note}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
