import Link from 'next/link';
import {
  ProcessPageHeader,
  ProcessRelatedLinks,
} from '../../../components/commerce/process-chrome';
import { PROCESS_LABELS, stageTitle } from '../../../lib/process-ux';
import { terminalGet } from '../../../lib/terminal-api';

type Task = {
  id: string;
  commerceCaseId: string;
  productTitle?: string;
  stage: string;
  actionLabel: string;
  priority: string;
  blocker?: boolean;
  href: string;
  approvalRequired: boolean;
  completionCriteria: string;
};

type Blocker = {
  id: string;
  productTitle?: string;
  stage: string;
  code: string;
  message: string;
  severity: string;
  recommendedResolution: string;
  href: string;
};

export default async function TasksPage() {
  const result = await terminalGet<{
    tasks: Task[];
    blockers: Blocker[];
    sops: Array<{ id: string; name: string; description: string; stepCount: number }>;
    honesty?: { note?: string };
  }>('/api/v1/commerce/tasks');

  if (!result.ok) {
    return (
      <section>
        <p className="form-error">{result.error}</p>
        <Link href="/terminal/process">{PROCESS_LABELS.openProcess}</Link>
      </section>
    );
  }

  const { tasks, blockers, sops } = result.data;

  return (
    <section>
      <ProcessPageHeader
        pill={PROCESS_LABELS.tasksPill}
        title={PROCESS_LABELS.tasksTitle}
        lede={PROCESS_LABELS.tasksLede}
        showStageStrip
        breadcrumbs={[
          { href: '/terminal/workspace', label: 'Workspace' },
          { href: '/terminal/process', label: PROCESS_LABELS.boardTitle },
          { label: PROCESS_LABELS.tasksTitle },
        ]}
        toolbar={
          <>
            <Link className="btn primary" href="/terminal/process">
              {PROCESS_LABELS.openProcess}
            </Link>
            <Link className="btn ghost" href="/terminal/approvals">
              {PROCESS_LABELS.viewApprovals}
            </Link>
          </>
        }
      />

      <ProcessRelatedLinks primary="tasks" />

      {result.data.honesty?.note ? <p className="meta">{result.data.honesty.note}</p> : null}

      {blockers.length > 0 ? (
        <article className="panel wide" style={{ marginBottom: 16 }}>
          <h2>Blockers</h2>
          <table className="compact">
            <thead>
              <tr>
                <th>Severity</th>
                <th>Product</th>
                <th>Stage</th>
                <th>Message</th>
                <th>Resolution</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {blockers.map((b) => (
                <tr key={b.id}>
                  <td className="text-warning">{b.severity}</td>
                  <td>{b.productTitle ?? '—'}</td>
                  <td>{stageTitle(b.stage)}</td>
                  <td style={{ whiteSpace: 'normal' }}>{b.message}</td>
                  <td style={{ whiteSpace: 'normal' }} className="meta">
                    {b.recommendedResolution}
                  </td>
                  <td>
                    <Link href={b.href}>{PROCESS_LABELS.openCase}</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      ) : null}

      <article className="panel wide">
        <h2>Open tasks</h2>
        {tasks.length === 0 ? (
          <p className="meta">
            No open process tasks. When products enter Discover or hit blockers, work items appear
            here with one next step per Commerce Case.
          </p>
        ) : (
          <table className="compact">
            <thead>
              <tr>
                <th>Priority</th>
                <th>Product</th>
                <th>Stage</th>
                <th>Action</th>
                <th>Done when</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.id}>
                  <td>{t.priority}</td>
                  <td>{t.productTitle ?? '—'}</td>
                  <td>{stageTitle(t.stage)}</td>
                  <td style={{ whiteSpace: 'normal' }}>
                    {t.actionLabel}
                    {t.blocker ? ' · blocker' : ''}
                    {t.approvalRequired ? ' · approval' : ''}
                  </td>
                  <td style={{ whiteSpace: 'normal' }} className="meta">
                    {t.completionCriteria}
                  </td>
                  <td>
                    <Link href={t.href}>{PROCESS_LABELS.nextStep}</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </article>

      {sops.length > 0 ? (
        <article className="panel" style={{ marginTop: 16 }}>
          <h2>Standard procedures (reference)</h2>
          <p className="meta">
            SOPs describe how work should complete. Live work still flows through Process and Tasks.
          </p>
          <ul>
            {sops.map((s) => (
              <li key={s.id}>
                <strong>{s.name}</strong>
                <span className="meta">
                  {' '}
                  · {s.stepCount} steps · {s.description}
                </span>
              </li>
            ))}
          </ul>
        </article>
      ) : null}
    </section>
  );
}
