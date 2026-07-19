import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ProcessKpiStrip,
  ProcessPageHeader,
} from '../../../components/commerce/process-chrome';
import { PersonaSwitcher } from '../../../components/workspace/persona-switcher';
import { PROCESS_LABELS } from '../../../lib/process-ux';
import { terminalGet } from '../../../lib/terminal-api';
import type { ResolvedWorkspace } from '../../../lib/workspace';

type Props = {
  searchParams: Promise<{ switch?: string }>;
};

/**
 * Workspace entry:
 * - Default: redirect to active persona home (One User · One Workspace)
 * - ?switch=1: persona switchboard
 */
export default async function WorkspaceIndexPage({ searchParams }: Props) {
  const sp = await searchParams;
  const wantSwitch = sp.switch === '1' || sp.switch === 'true';

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

  // One User · One Workspace — land on intelligent persona home unless switching
  if (!wantSwitch && ws.homeHref) {
    redirect(ws.homeHref);
  }

  return (
    <section>
      <ProcessPageHeader
        pill="One User · One Workspace · One Objective · One AI"
        title="Switch operating workspace"
        lede="Pick the persona that matches your role. Navigation, AI context, and intelligence re-rank for that mission."
        breadcrumbs={[{ label: 'Workspaces' }]}
        toolbar={
          <>
            <Link className="btn primary" href={ws.homeHref}>
              Open {ws.personaLabel} home
            </Link>
            <Link className="btn secondary" href="/terminal/objectives">
              Ask AI
            </Link>
            {ws.recommendedNextAction ? (
              <Link className="btn ghost" href={ws.recommendedNextAction.href}>
                {ws.recommendedNextAction.label}
              </Link>
            ) : null}
          </>
        }
      />

      {ws.surface?.healthLabel ? (
        <p className="meta" style={{ marginBottom: 12 }}>
          Health <strong className="text-accent">{ws.surface.healthLabel}</strong>
          {typeof ws.surface.attentionScore === 'number'
            ? ` · attention ${ws.surface.attentionScore}/100`
            : ''}
        </p>
      ) : null}

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
        {ws.surface?.aiBriefing ? <p>{ws.surface.aiBriefing}</p> : null}
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
    </section>
  );
}
