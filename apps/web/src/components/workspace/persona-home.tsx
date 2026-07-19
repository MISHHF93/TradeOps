'use client';

import Link from 'next/link';
import { AskAiButton } from '../ai/ask-ai-button';
import { ProcessCaseCard } from '../commerce/process-case-card';
import { formatMoney } from '../../lib/money';
import type { OperatingPersona, ResolvedWorkspace } from '../../lib/workspace';

/**
 * Dense, media-rich persona home — priorities, cases with thumbs, AI, KPIs.
 */
export function PersonaHome({
  ws,
  persona,
  label,
  mismatched,
  focusProcedureId,
}: {
  ws: ResolvedWorkspace;
  persona: OperatingPersona;
  label: string;
  mismatched: boolean;
  focusProcedureId?: string | null;
}) {
  const surface = ws.surface;
  const procedures = ws.procedures;
  const focus = focusProcedureId
    ? procedures.find((p) => p.id === focusProcedureId)
    : null;

  const focusObjective =
    surface?.focusObjective ?? ws.currentObjective ?? ws.defaultObjective;

  return (
    <div className="persona-home">
      <div className="persona-home__status meta">
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
        {' · '}
        <span>
          {ws.activeCaseCount} cases · {ws.pendingApprovals} approvals · {ws.openBlockers} blockers
        </span>
      </div>

      {mismatched ? (
        <article className="panel persona-home__mismatch">
          <p>
            Active persona is <strong>{ws.personaLabel}</strong>.{' '}
            <Link href="/terminal/workspace">Switch persona</Link> to rebuild sidebar and AI for
            this role.
          </p>
        </article>
      ) : null}

      {/* Hero: AI focus + next action */}
      <section className="persona-home__hero panel">
        <div className="persona-home__hero-copy">
          <span className="object-workspace__type">Focus</span>
          <h2 className="persona-home__hero-title">AI briefing</h2>
          <p className="persona-home__briefing">
            {surface?.aiBriefing ?? ws.intelligence?.narrative ?? ws.currentObjective}
          </p>
          {focusObjective ? (
            <p className="meta persona-home__focus-obj">
              Focus objective: {focusObjective.slice(0, 220)}
              {focusObjective.length > 220 ? '…' : ''}
            </p>
          ) : null}
        </div>
        <div className="persona-home__hero-actions">
          <AskAiButton
            objective={focusObjective || `Operate as ${label}`}
            label="Resolve with AI"
            className="btn ai"
          />
          {ws.recommendedNextAction ? (
            <Link className="btn primary" href={ws.recommendedNextAction.href}>
              {ws.recommendedNextAction.label}
            </Link>
          ) : null}
          <Link className="btn ghost" href="/terminal/process">
            Process board
          </Link>
          <Link className="btn ghost" href="/terminal">
            Discover
          </Link>
        </div>
      </section>

      {/* Media-rich priority cases */}
      {(ws.activeCases?.length ?? 0) > 0 ? (
        <section className="persona-home__cases">
          <header className="persona-home__section-head">
            <h2>Priority cases</h2>
            <Link className="meta" href="/terminal/process">
              Full board →
            </Link>
          </header>
          <ul className="persona-home__case-grid">
            {ws.activeCases!.slice(0, 8).map((c) => (
              <ProcessCaseCard
                key={c.caseId}
                case={{
                  id: c.caseId,
                  productId: c.productId,
                  productTitle: c.productTitle,
                  primaryImageUrl: c.primaryImageUrl,
                  currentStage: c.currentStage,
                  stageStatus: c.stageStatus,
                  nextActionLabel: c.nextActionLabel,
                  nextHref: c.nextHref ?? `/terminal/process/${c.caseId}`,
                  opportunityScore: c.opportunityScore,
                  expectedProfitLabel:
                    c.expectedProfitMinor != null
                      ? formatMoney(c.expectedProfitMinor, c.currency ?? 'USD')
                      : null,
                  blockerMessage: c.blockerMessage,
                }}
              />
            ))}
          </ul>
        </section>
      ) : null}

      <div className="persona-home__columns">
        {/* Priorities */}
        <article className="panel">
          <h2>Today&apos;s priorities</h2>
          <p className="meta">Ranked for {label}</p>
          {!surface?.todaysPriorities?.length ? (
            <p className="meta">No urgent priorities — continue mission work.</p>
          ) : (
            <ol className="persona-home__priority-list">
              {surface.todaysPriorities.map((p) => (
                <li
                  key={p.id}
                  className={
                    p.urgency === 'critical'
                      ? 'is-critical'
                      : p.urgency === 'high'
                        ? 'is-high'
                        : ''
                  }
                >
                  <Link href={p.href}>
                    <strong>{p.label}</strong>
                  </Link>
                  <span className="meta">
                    {p.urgency} · {p.reason}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </article>

        {/* KPIs */}
        <article className="panel">
          <h2>Key KPIs</h2>
          <ul className="kv">
            {(surface?.keyKpis ?? []).map((k) => (
              <li key={k.id}>
                <span>{k.label}</span>
                <strong className={k.tone === 'critical' ? 'text-warning' : undefined}>
                  {k.href ? <Link href={k.href}>{k.value}</Link> : k.value}
                </strong>
              </li>
            ))}
          </ul>
        </article>

        {/* Alerts */}
        <article className="panel">
          <h2>Alerts</h2>
          {(surface?.alerts?.length ?? 0) === 0 ? (
            <p className="meta">No alerts</p>
          ) : (
            <ul className="persona-home__alerts">
              {(surface?.alerts ?? []).map((a) => (
                <li key={a.id}>
                  <span className={`truth-label severity-${a.severity}`}>{a.severity}</span>{' '}
                  {a.href ? <Link href={a.href}>{a.message}</Link> : a.message}
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>

      {/* Insights */}
      {(surface?.insights?.length ?? 0) > 0 ? (
        <section className="panel persona-home__insights">
          <h2>Intelligence insights</h2>
          <div className="persona-home__insight-grid">
            {surface!.insights!.map((ins) => (
              <div key={ins.id} className="persona-home__insight-card">
                <div className="meta">
                  {ins.kind} · urgency {ins.urgencyScore} · conf{' '}
                  {(ins.confidence * 100).toFixed(0)}%
                </div>
                <Link href={ins.href}>
                  <strong>{ins.title}</strong>
                </Link>
                <p className="meta">{ins.detail}</p>
                {ins.suggestedObjective ? (
                  <AskAiButton
                    objective={ins.suggestedObjective}
                    label="Ask AI"
                    className="btn ghost"
                  />
                ) : null}
              </div>
            ))}
          </div>
          {ws.intelligence?.honesty?.note ? (
            <p className="meta">{ws.intelligence.honesty.note}</p>
          ) : null}
        </section>
      ) : null}

      {/* Procedures compact */}
      <section className="panel">
        <h2>Procedures</h2>
        <p className="meta">Ordered work for {label}</p>
        {procedures.length === 0 ? (
          <p className="meta">No procedures for this persona.</p>
        ) : (
          <div className="persona-home__proc-grid">
            {procedures.map((proc) => {
              const isFocus = focus?.id === proc.id;
              return (
                <div
                  key={proc.id}
                  className={`persona-home__proc ${isFocus ? 'is-focus' : ''}`}
                >
                  <h3>
                    <Link href={`/terminal/workspace/${persona}?procedure=${proc.id}`}>
                      {proc.label}
                    </Link>
                  </h3>
                  <p className="meta">{proc.summary}</p>
                  <div className="persona-home__proc-steps">
                    {proc.steps.slice(0, 4).map((s) => (
                      <Link key={s.id} href={s.href} className="persona-home__proc-step">
                        {s.label}
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Actions + objectives */}
      <div className="persona-home__columns persona-home__columns--2">
        <article className="panel">
          <h2>Recommended actions</h2>
          <div className="terminal-toolbar" style={{ flexWrap: 'wrap', gap: 8 }}>
            {(surface?.recommendedActions ?? []).map((a) => (
              <Link
                key={`${a.href}-${a.label}`}
                className="btn secondary"
                href={a.href}
                title={a.reason}
              >
                {a.label}
              </Link>
            ))}
          </div>
        </article>
        <article className="panel">
          <h2>Active objectives</h2>
          <ul className="object-panel__list">
            {(surface?.activeObjectives ?? []).map((o) => (
              <li key={o.id} className="object-panel__item">
                <Link href={o.href}>
                  <strong>{o.title}</strong>
                </Link>
                <span className="meta">
                  {o.kind} · {o.status}
                </span>
              </li>
            ))}
          </ul>
          <p className="meta" style={{ marginTop: 8 }}>
            <Link href="/terminal/objectives">Run history</Link>
          </p>
        </article>
      </div>
    </div>
  );
}
