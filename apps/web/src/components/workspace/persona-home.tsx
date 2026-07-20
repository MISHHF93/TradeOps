'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { AskAiButton } from '../ai/ask-ai-button';
import { ProcessCaseCard } from '../commerce/process-case-card';
import { formatMoney } from '../../lib/money';
import type { OperatingPersona, ResolvedWorkspace } from '../../lib/workspace';
import { MerchantWizard } from './merchant-wizard';

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

  const liveConnectorCount = (ws.availableConnectors ?? []).filter(
    (c) => !c.isFixture && /connect|sync|online|healthy/i.test(c.status || ''),
  ).length;

  const fixtureOnlyCatalog = useMemo(() => {
    const insightBlob = (surface?.insights ?? [])
      .map((i) => `${i.title} ${i.detail}`)
      .join(' ');
    const alertBlob = (surface?.alerts ?? []).map((a) => a.message).join(' ');
    const blob = `${insightBlob} ${alertBlob} ${surface?.aiBriefing ?? ''} ${focusObjective ?? ''}`;
    if (/live product|live store|live catalog/i.test(blob) && !/demo catalog only|fixture-only|seed data/i.test(blob)) {
      return liveConnectorCount === 0 && /demo|fixture|seed/i.test(blob);
    }
    return (
      /demo catalog only|fixture-only|seed data|TEST FIXTURE|seed products/i.test(blob) ||
      (liveConnectorCount === 0 && (ws.activeCaseCount ?? 0) > 0 && /demo|fixture|seed/i.test(blob))
    );
  }, [
    surface?.insights,
    surface?.alerts,
    surface?.aiBriefing,
    focusObjective,
    liveConnectorCount,
    ws.activeCaseCount,
  ]);

  const [showDemoCases, setShowDemoCases] = useState(false);

  const starters = (
    fixtureOnlyCatalog
      ? [
          'Find concrete product opportunities worth reselling online with price bands and sources',
          'What USB-powered gadgets are trending for ecommerce this month?',
          focusObjective?.trim() || null,
          'Which live supplier should I connect first when I leave demo mode?',
        ]
      : [
          focusObjective?.trim() || null,
          'Find product opportunities worth evaluating this week',
          'What needs attention on open cases?',
          'Check connector health and what I should fix first',
        ]
  ).filter((s, i, a): s is string => Boolean(s) && a.indexOf(s) === i);

  const visiblePriorities = useMemo(() => {
    const all = surface?.todaysPriorities ?? [];
    if (!fixtureOnlyCatalog) return all;
    // Prefer research / opportunity; demote pure demo-case noise to the end
    return [...all].sort((a, b) => {
      const score = (p: { label: string; reason: string }) => {
        const t = `${p.label} ${p.reason}`.toLowerCase();
        if (/research live|product opportunit|web research/i.test(t)) return 0;
        if (/demo case|seed|fixture|policy signal|storefront not connected/i.test(t)) return 2;
        return 1;
      };
      return score(a) - score(b);
    });
  }, [surface?.todaysPriorities, fixtureOnlyCatalog]);

  return (
    <div className="persona-home">
      <div className="persona-home__status meta">
        Start with intent · AI is the operator · Cases are the work
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

      {/* Founder 60s demo path */}
      <ol className="persona-home__demo-path" aria-label="60 second demo">
        <li>
          <strong>1. Ask AI</strong>
          <span className="meta">Product research with live web sources</span>
        </li>
        <li>
          <strong>2. Compare options</strong>
          <span className="meta">Price band · why · risk in the operator rail</span>
        </li>
        <li>
          <strong>3. Connect when ready</strong>
          <span className="meta">
            <Link href="/terminal/connectors">Go live</Link> for real inventory
          </span>
        </li>
      </ol>

      <MerchantWizard researchObjective={focusObjective ?? undefined} />

      {/* Intent-first hero */}
      <section className="persona-home__hero panel persona-home__intent">
        <div className="persona-home__hero-copy">
          <span className="object-workspace__type">Intent</span>
          <h2 className="persona-home__hero-title">What do you want to do?</h2>
          <p className="persona-home__briefing">
            {surface?.aiBriefing ??
              ws.intelligence?.narrative ??
              'Describe a goal. The AI Operator researches, ranks options, and proposes next steps. You approve anything consequential.'}
          </p>
          {focusObjective ? (
            <p className="meta persona-home__focus-obj">
              Suggested: {focusObjective.slice(0, 220)}
              {focusObjective.length > 220 ? '…' : ''}
            </p>
          ) : null}
          <div className="persona-home__starters" aria-label="Suggested objectives">
            {starters.slice(0, 4).map((s) => (
              <AskAiButton
                key={s}
                objective={s}
                label={s.length > 48 ? `${s.slice(0, 45)}…` : s}
                className="btn ghost persona-home__starter"
              />
            ))}
          </div>
        </div>
        <div className="persona-home__hero-actions">
          <AskAiButton
            objective={focusObjective || `Operate as ${label}`}
            label="Open AI Operator"
            className="btn primary"
          />
          {ws.recommendedNextAction ? (
            <Link className="btn secondary" href={ws.recommendedNextAction.href}>
              {ws.recommendedNextAction.label}
            </Link>
          ) : null}
          <Link className="btn ghost" href="/terminal/process">
            Cases
          </Link>
          <Link className="btn ghost" href="/terminal">
            Find products
          </Link>
          <Link className="btn ghost" href="/terminal/connectors">
            Connections
          </Link>
        </div>
      </section>

      {/* Media-rich priority cases — demo/seed cases collapsed when fixture-only */}
      {(ws.activeCases?.length ?? 0) > 0 ? (
        <section className="persona-home__cases">
          <header className="persona-home__section-head">
            <h2>{fixtureOnlyCatalog ? 'Demo cases' : 'Priority cases'}</h2>
            <div className="persona-home__section-actions">
              {fixtureOnlyCatalog ? (
                <button
                  type="button"
                  className="btn ghost persona-home__toggle-demo"
                  onClick={() => setShowDemoCases((v) => !v)}
                  aria-expanded={showDemoCases}
                >
                  {showDemoCases
                    ? 'Hide demo cases'
                    : `Show ${ws.activeCases!.length} demo case${ws.activeCases!.length === 1 ? '' : 's'}`}
                </button>
              ) : null}
              <Link className="meta" href="/terminal/process">
                Full board →
              </Link>
            </div>
          </header>
          {fixtureOnlyCatalog && !showDemoCases ? (
            <p className="meta persona-home__demo-hint">
              Seed cases are optional walkthroughs (policy rehearsal). Start with{' '}
              <strong>AI Operator</strong> for live market research, or open Connections when you
              are ready to import real inventory.
            </p>
          ) : (
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
          )}
        </section>
      ) : null}

      <div className="persona-home__columns">
        {/* Priorities */}
        <article className="panel">
          <h2>Today&apos;s priorities</h2>
          <p className="meta">Ranked for {label}</p>
          {!visiblePriorities.length ? (
            <p className="meta">No urgent priorities — continue mission work.</p>
          ) : (
            <ol className="persona-home__priority-list">
              {visiblePriorities.map((p) => (
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
