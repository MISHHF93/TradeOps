import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ProcessPageHeader,
  ProcessRelatedLinks,
} from '../../../../components/commerce/process-chrome';
import { PROCESS_LABELS } from '../../../../lib/process-ux';
import { terminalGet } from '../../../../lib/terminal-api';
import type { OperatingPersona, ResolvedWorkspace } from '../../../../lib/workspace';

const VALID: OperatingPersona[] = [
  'executive',
  'operator',
  'researcher',
  'analyst',
  'developer',
  'administrator',
];

type Props = {
  params: Promise<{ persona: string }>;
  searchParams: Promise<{ procedure?: string }>;
};

/**
 * Persona home — procedure-first dashboard for one operating role.
 * Process board remains the shared case spine.
 */
export default async function PersonaWorkspacePage({ params, searchParams }: Props) {
  const { persona: raw } = await params;
  const { procedure: focusProcedure } = await searchParams;
  const persona = raw.toLowerCase() as OperatingPersona;
  if (!VALID.includes(persona)) notFound();

  const result = await terminalGet<ResolvedWorkspace>('/api/v1/workspace');
  if (!result.ok) {
    return (
      <section>
        <p className="form-error">{result.error}</p>
        <Link href="/terminal/process">{PROCESS_LABELS.openProcess}</Link>
      </section>
    );
  }

  const ws = result.data;
  const mismatched = ws.persona !== persona;
  const procedures = ws.procedures;
  const focus = focusProcedure
    ? procedures.find((p) => p.id === focusProcedure)
    : procedures[0];
  const label = ws.allPersonas.find((p) => p.id === persona)?.label ?? persona;

  return (
    <section>
      <ProcessPageHeader
        pill={`${label} workspace`}
        title={`${label} workspace`}
        lede={
          mismatched
            ? `You are set to ${ws.personaLabel}. Switch persona to fully adopt this workspace, or browse procedures below.`
            : ws.mission
        }
        showStageStrip
        breadcrumbs={[
          { href: '/terminal/workspace', label: 'Workspace' },
          { label },
        ]}
        toolbar={
          <>
            <Link className="btn primary" href="/terminal/process">
              {PROCESS_LABELS.openProcess}
            </Link>
            <Link className="btn secondary" href="/terminal/tasks">
              {PROCESS_LABELS.viewTasks}
            </Link>
            {!mismatched && ws.recommendedNextAction ? (
              <Link className="btn ghost" href={ws.recommendedNextAction.href}>
                {ws.recommendedNextAction.label}
              </Link>
            ) : (
              <Link className="btn ghost" href="/terminal/workspace">
                Switch persona
              </Link>
            )}
          </>
        }
      />

      <ProcessRelatedLinks primary="process" />

      {mismatched ? (
        <article className="panel" style={{ marginBottom: 16 }}>
          <p>
            Active persona is <strong>{ws.personaLabel}</strong>.{' '}
            <Link href="/terminal/workspace">Switch persona</Link> to rebuild sidebar and AI for
            this role.
          </p>
        </article>
      ) : null}

      <div className="detail-grid">
        <article className="panel">
          <h2>Mission metrics</h2>
          <ul className="kv">
            <li>
              <span>Tasks</span>
              <strong>{ws.openTasks}</strong>
            </li>
            <li>
              <span>Blockers</span>
              <strong>{ws.openBlockers}</strong>
            </li>
            <li>
              <span>Approvals</span>
              <strong>{ws.pendingApprovals}</strong>
            </li>
            <li>
              <span>Open cases</span>
              <strong>{ws.activeCaseCount}</strong>
            </li>
          </ul>
          {ws.recommendedNextAction && !mismatched ? (
            <p>
              <Link href={ws.recommendedNextAction.href} className="btn primary">
                {ws.recommendedNextAction.label}
              </Link>
            </p>
          ) : null}
          <p>
            <Link href="/terminal/ai">AI with workspace context</Link>
          </p>
        </article>

        <article className="panel">
          <h2>Active Commerce Cases</h2>
          {!ws.activeCases?.length ? (
            <p className="meta">
              No open cases.{' '}
              <Link href="/terminal">{PROCESS_LABELS.discoverTitle}</Link> to open the process
              spine.
            </p>
          ) : (
            <ul>
              {ws.activeCases.map((c) => (
                <li key={c.caseId}>
                  <Link href={`/terminal/process/${c.caseId}`}>
                    {c.productTitle ?? c.productId}
                  </Link>
                  <span className="meta">
                    {' '}
                    · {c.currentStage}/{c.stageStatus}
                    {c.nextActionLabel ? ` · ${c.nextActionLabel}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p>
            <Link href="/terminal/process">{PROCESS_LABELS.openProcess}</Link>
          </p>
        </article>
      </div>

      <article className="panel" style={{ marginTop: 16 }}>
        <h2>Procedures</h2>
        <p className="meta">
          Beginning → middle → completion. Follow steps; Process holds the case record.
        </p>
        <div className="detail-grid">
          {procedures.map((p) => (
            <div
              key={p.id}
              className="panel"
              style={{
                margin: 0,
                outline: focus?.id === p.id ? '1px solid var(--color-accent, #25c7e8)' : undefined,
              }}
            >
              <h3 style={{ marginTop: 0 }}>{p.label}</h3>
              <p className="meta">{p.summary}</p>
              <ol style={{ paddingLeft: 18 }}>
                {p.steps.map((s, i) => (
                  <li key={s.id} style={{ marginBottom: 8 }}>
                    <span className="meta">{i + 1}. </span>
                    <Link href={s.href}>{s.label}</Link>
                    <div className="meta" style={{ margin: 0 }}>
                      {s.description}
                      {s.commerceStage ? ` · stage: ${s.commerceStage}` : ''}
                    </div>
                  </li>
                ))}
              </ol>
              <p className="meta">
                <strong>Complete when:</strong> {p.completionCriteria}
              </p>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
