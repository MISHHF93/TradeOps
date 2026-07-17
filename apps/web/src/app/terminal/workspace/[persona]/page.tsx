import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ProcessPageHeader,
} from '../../../../components/commerce/process-chrome';
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
 * Persona workspace home — focused operating surface:
 * Priorities → AI Briefing → Objectives → Actions → KPIs → Alerts → Everything else
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
        <Link href="/terminal/workspace">Choose persona</Link>
      </section>
    );
  }

  const ws = result.data;
  const mismatched = ws.persona !== persona;
  const surface = ws.surface;
  const procedures = ws.procedures;
  const focus = focusProcedure
    ? procedures.find((p) => p.id === focusProcedure)
    : null;
  const label = ws.allPersonas.find((p) => p.id === persona)?.label ?? persona;

  return (
    <section>
      <ProcessPageHeader
        pill={`${label} workspace`}
        title={`${label} workspace`}
        lede={
          mismatched
            ? `You are set to ${ws.personaLabel}. Switch persona to fully adopt this workspace.`
            : ws.mission
        }
        breadcrumbs={[
          { href: '/terminal/workspace', label: 'Workspaces' },
          { label },
        ]}
        toolbar={
          <>
            <Link className="btn primary" href="/terminal/ai">
              AI
            </Link>
            {!mismatched && ws.recommendedNextAction ? (
              <Link className="btn secondary" href={ws.recommendedNextAction.href}>
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

      <p className="meta" style={{ marginBottom: 16 }}>
        {ws.operatingPrinciple ?? 'One User · One Workspace · One Objective · One AI'}
        {surface?.healthLabel ? (
          <>
            {' '}
            · Health <strong className="text-accent">{surface.healthLabel}</strong>
            {typeof surface.attentionScore === 'number'
              ? ` · attention ${surface.attentionScore}/100`
              : ''}
          </>
        ) : null}
      </p>

      {mismatched ? (
        <article className="panel" style={{ marginBottom: 16 }}>
          <p>
            Active persona is <strong>{ws.personaLabel}</strong>.{' '}
            <Link href="/terminal/workspace">Switch persona</Link> to rebuild sidebar and AI for
            this role.
          </p>
        </article>
      ) : null}

      {focus ? (
        <article className="panel" style={{ marginBottom: 16 }}>
          <h2>Procedure: {focus.label}</h2>
          <p className="meta">{focus.summary}</p>
          <ol>
            {focus.steps.map((s) => (
              <li key={s.id}>
                <Link href={s.href}>{s.label}</Link>
                <span className="meta"> — {s.description}</span>
              </li>
            ))}
          </ol>
          <p className="meta">Done when: {focus.completionCriteria}</p>
        </article>
      ) : null}

      {/* 1. Today's priorities — intelligence-ranked */}
      <article className="panel" style={{ marginBottom: 16 }}>
        <h2>Today&apos;s priorities</h2>
        <p className="meta">Ranked by operational intelligence for {label}.</p>
        {!surface?.todaysPriorities?.length ? (
          <p className="meta">No urgent priorities — continue mission work.</p>
        ) : (
          <ol className="ai-timeline">
            {surface.todaysPriorities.map((p) => (
              <li key={p.id} className={p.urgency === 'critical' ? 'failed' : 'done'}>
                <Link href={p.href}>
                  <strong>{p.label}</strong>
                </Link>
                <span className="meta">
                  {' '}
                  · {p.urgency} · {p.reason}
                </span>
              </li>
            ))}
          </ol>
        )}
      </article>

      {/* Ranked insights with one-click AI objectives */}
      {(surface?.insights?.length ?? 0) > 0 ? (
        <article className="panel" style={{ marginBottom: 16 }}>
          <h2>Intelligence insights</h2>
          <ul className="kv">
            {surface!.insights!.map((ins) => (
              <li key={ins.id}>
                <span>
                  {ins.kind} · {ins.urgencyScore} · {(ins.confidence * 100).toFixed(0)}%
                </span>
                <strong style={{ whiteSpace: 'normal', fontWeight: 500 }}>
                  <Link href={ins.href}>{ins.title}</Link>
                  <span className="meta"> — {ins.detail}</span>
                  {ins.suggestedAiQuery ? (
                    <>
                      {' '}
                      <Link
                        className="btn ghost"
                        style={{ minHeight: 28, display: 'inline-flex', marginLeft: 6 }}
                        href={`/terminal/ai?objective=${encodeURIComponent(ins.suggestedObjective)}`}
                      >
                        Ask AI
                      </Link>
                    </>
                  ) : null}
                </strong>
              </li>
            ))}
          </ul>
          {ws.intelligence?.honesty?.note ? (
            <p className="meta">{ws.intelligence.honesty.note}</p>
          ) : null}
        </article>
      ) : null}

      <div className="detail-grid">
        {/* 2. AI Briefing */}
        <article className="panel">
          <h2>AI briefing</h2>
          <p>{surface?.aiBriefing ?? ws.currentObjective}</p>
          {surface?.focusObjective ? (
            <p className="meta" style={{ marginTop: 8 }}>
              Focus objective: {surface.focusObjective.slice(0, 200)}
              {surface.focusObjective.length > 200 ? '…' : ''}
            </p>
          ) : null}
          <p style={{ marginTop: 12 }}>
            <Link
              className="btn ai"
              href={`/terminal/ai?objective=${encodeURIComponent(
                surface?.focusObjective ?? ws.currentObjective,
              )}`}
            >
              Resolve focus objective
            </Link>
          </p>
        </article>

        {/* 3. Active objectives */}
        <article className="panel">
          <h2>Active objectives</h2>
          <ul>
            {(surface?.activeObjectives ?? []).map((o) => (
              <li key={o.id} style={{ marginBottom: 8 }}>
                <Link href={o.href}>{o.title}</Link>
                <span className="meta">
                  {' '}
                  · {o.kind} · {o.status}
                </span>
              </li>
            ))}
          </ul>
          <p className="meta">
            <Link href="/terminal/objectives">Objective history</Link>
          </p>
        </article>
      </div>

      {/* 4. Recommended actions */}
      <article className="panel" style={{ marginTop: 16 }}>
        <h2>Next recommended actions</h2>
        <div className="terminal-toolbar" style={{ flexWrap: 'wrap', gap: 8 }}>
          {(surface?.recommendedActions ?? []).map((a) => (
            <Link key={`${a.href}-${a.label}`} className="btn secondary" href={a.href} title={a.reason}>
              {a.label}
            </Link>
          ))}
        </div>
      </article>

      {/* 5. Key KPIs */}
      <article className="panel" style={{ marginTop: 16 }}>
        <h2>Key KPIs</h2>
        <ul className="kv">
          {(surface?.keyKpis ?? []).map((k) => (
            <li key={k.id}>
              <span>{k.label}</span>
              <strong className={k.tone === 'critical' ? 'text-accent' : undefined}>
                {k.href ? <Link href={k.href}>{k.value}</Link> : k.value}
              </strong>
            </li>
          ))}
        </ul>
      </article>

      {/* 6. Alerts */}
      <article className="panel" style={{ marginTop: 16 }}>
        <h2>Alerts</h2>
        <ul>
          {(surface?.alerts ?? []).map((a) => (
            <li key={a.id} style={{ marginBottom: 6 }}>
              <span className="truth-label">{a.severity}</span>{' '}
              {a.href ? <Link href={a.href}>{a.message}</Link> : a.message}
            </li>
          ))}
        </ul>
      </article>

      {/* Active cases strip */}
      {(ws.activeCases?.length ?? 0) > 0 ? (
        <article className="panel" style={{ marginTop: 16 }}>
          <h2>Commerce Cases in flight</h2>
          <ul>
            {ws.activeCases!.slice(0, 5).map((c) => (
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
        </article>
      ) : null}

      {/* 7. Everything else */}
      <article className="panel" style={{ marginTop: 16 }}>
        <h2>Everything else</h2>
        <p className="meta">
          {surface?.everythingElseHint ??
            'Ask AI or expand More in the sidebar for capabilities outside your focus set.'}
        </p>
        <div className="terminal-toolbar" style={{ marginTop: 8, flexWrap: 'wrap', gap: 8 }}>
          <Link className="btn ghost" href="/terminal/ai">
            Ask AI
          </Link>
          <Link className="btn ghost" href="/terminal/process">
            Process board
          </Link>
          <Link className="btn ghost" href="/terminal/workspace">
            Switch persona
          </Link>
        </div>
      </article>
    </section>
  );
}
