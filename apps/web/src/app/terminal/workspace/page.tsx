import Link from 'next/link';
import {
  ProcessKpiStrip,
  ProcessPageHeader,
  ProcessRelatedLinks,
} from '../../../components/commerce/process-chrome';
import { PersonaSwitcher } from '../../../components/workspace/persona-switcher';
import { PROCESS_LABELS } from '../../../lib/process-ux';
import { terminalGet } from '../../../lib/terminal-api';
import type { ResolvedWorkspace } from '../../../lib/workspace';

/**
 * Persona switchboard — pick operating role; Process spine stays shared.
 */
export default async function WorkspaceIndexPage() {
  const result = await terminalGet<ResolvedWorkspace>('/api/v1/workspace');

  if (!result.ok) {
    return (
      <section>
        <h1>Workspace</h1>
        <p className="form-error">{result.error}</p>
        <p className="meta">
          Sign in or use founder direct mode. Workspace Resolver needs an organization membership.
        </p>
        <Link href="/terminal/process">{PROCESS_LABELS.openProcess}</Link>
      </section>
    );
  }

  const ws = result.data;

  return (
    <section>
      <ProcessPageHeader
        pill="Commerce OS · personas"
        title="Operating workspaces"
        lede="Choose the persona that matches your role. Navigation, procedures, and AI context rebuild around that mission — Process cases stay the same."
        showStageStrip
        breadcrumbs={[{ label: 'Workspace' }]}
        toolbar={
          <>
            <Link className="btn primary" href={ws.homeHref}>
              Open {ws.personaLabel} home
            </Link>
            <Link className="btn secondary" href="/terminal/process">
              {PROCESS_LABELS.openProcess}
            </Link>
            {ws.recommendedNextAction ? (
              <Link className="btn ghost" href={ws.recommendedNextAction.href}>
                {ws.recommendedNextAction.label}
              </Link>
            ) : null}
          </>
        }
      />

      <ProcessRelatedLinks primary="process" />

      <ProcessKpiStrip
        items={[
          { label: 'Open tasks', value: ws.openTasks, href: '/terminal/tasks' },
          {
            label: 'Blockers',
            value: ws.openBlockers,
            warn: ws.openBlockers > 0,
            href: '/terminal/tasks',
          },
          {
            label: 'Pending approvals',
            value: ws.pendingApprovals,
            href: '/terminal/approvals',
          },
          {
            label: 'Active cases',
            value: ws.activeCaseCount,
            href: '/terminal/process',
          },
        ]}
      />

      <article className="panel" style={{ marginBottom: 16 }}>
        <h2 style={{ marginTop: 0 }}>Active: {ws.personaLabel}</h2>
        <p className="meta">{ws.mission}</p>
        {ws.recommendedNextAction ? (
          <p>
            <Link href={ws.recommendedNextAction.href} className="btn primary">
              Next: {ws.recommendedNextAction.label}
            </Link>
            <span className="meta" style={{ marginLeft: 8 }}>
              {ws.recommendedNextAction.reason}
            </span>
          </p>
        ) : null}
      </article>

      <PersonaSwitcher
        current={ws.persona}
        personas={ws.allPersonas}
        currentHome={ws.homeHref}
      />

      <article className="panel" style={{ marginTop: 16 }}>
        <h2>Procedures for {ws.personaLabel}</h2>
        <p className="meta">
          Each procedure ends on Process. Steps open stage views; the case is the source of truth.
        </p>
        <div className="detail-grid">
          {ws.procedures.map((p) => (
            <div key={p.id} className="panel" style={{ margin: 0 }}>
              <h3 style={{ marginTop: 0 }}>{p.label}</h3>
              <p className="meta">{p.summary}</p>
              <ol style={{ paddingLeft: 18, margin: '8px 0' }}>
                {p.steps.map((s) => (
                  <li key={s.id} style={{ marginBottom: 6 }}>
                    <Link href={s.href}>{s.label}</Link>
                    <div className="meta" style={{ margin: 0 }}>
                      {s.description}
                    </div>
                  </li>
                ))}
              </ol>
              <p className="meta">Done when: {p.completionCriteria}</p>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
