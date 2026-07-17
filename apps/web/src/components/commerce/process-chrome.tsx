import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  PROCESS_LABELS,
  PROCESS_STAGES,
  processBoardHref,
  stageTitle,
} from '../../lib/process-ux';

type Crumb = { href?: string; label: string };

/**
 * Shared process chrome: breadcrumb + stage strip + optional toolbar.
 * One procedure language across Discover, Process, Tasks, Case, stage views.
 */
export function ProcessBreadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav className="process-breadcrumb" aria-label="Procedure path">
      {items.map((item, i) => (
        <span key={`${item.label}-${i}`} className="process-breadcrumb__item">
          {i > 0 ? <span className="process-breadcrumb__sep" aria-hidden>/</span> : null}
          {item.href ? <Link href={item.href}>{item.label}</Link> : <span>{item.label}</span>}
        </span>
      ))}
    </nav>
  );
}

export function ProcessStageStrip({
  currentStage,
  showLinks = true,
}: {
  currentStage?: string | null;
  showLinks?: boolean;
}) {
  const currentIdx = currentStage
    ? PROCESS_STAGES.findIndex((s) => s.id === currentStage)
    : -1;

  return (
    <ol className="process-stage-strip" aria-label="Commerce procedure stages">
      {PROCESS_STAGES.map((s, idx) => {
        const active = currentStage === s.id;
        const done = currentIdx >= 0 && idx < currentIdx;
        const cls = [
          'process-stage-chip',
          active ? 'is-active' : '',
          done ? 'is-done' : '',
        ]
          .filter(Boolean)
          .join(' ');

        const body = (
          <span className={cls} title={s.description}>
            <span className="process-stage-chip__n" aria-hidden>
              {s.short}
            </span>
            <span className="process-stage-chip__label">{s.title}</span>
          </span>
        );

        return (
          <li key={s.id}>
            {showLinks ? (
              <Link
                href={processBoardHref(s.id)}
                aria-current={active ? 'step' : undefined}
                className="process-stage-strip__link"
              >
                {body}
              </Link>
            ) : (
              body
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function ProcessPageHeader({
  pill,
  title,
  lede,
  currentStage,
  showStageStrip = true,
  breadcrumbs,
  toolbar,
}: {
  pill: string;
  title: string;
  lede: string;
  currentStage?: string | null;
  showStageStrip?: boolean;
  breadcrumbs?: Crumb[];
  toolbar?: ReactNode;
}) {
  return (
    <div className="process-page-header">
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <ProcessBreadcrumb items={breadcrumbs} />
      ) : null}
      <header className="terminal-header">
        <div>
          <p className="pill">{pill}</p>
          <h1 className="workspace-title-active">{title}</h1>
          <p className="lede">{lede}</p>
          {currentStage ? (
            <p className="meta process-page-header__stage">
              Current stage: <strong>{stageTitle(currentStage)}</strong>
            </p>
          ) : null}
        </div>
        {toolbar ? <div className="terminal-toolbar">{toolbar}</div> : null}
      </header>
      {showStageStrip ? <ProcessStageStrip currentStage={currentStage} /> : null}
    </div>
  );
}

export function ProcessRelatedLinks({
  primary = 'process',
}: {
  primary?: 'process' | 'tasks' | 'discover' | 'approvals';
}) {
  const links = [
    { id: 'process' as const, href: '/terminal/process', label: PROCESS_LABELS.openProcess },
    { id: 'tasks' as const, href: '/terminal/tasks', label: PROCESS_LABELS.viewTasks },
    { id: 'discover' as const, href: '/terminal', label: PROCESS_LABELS.discoverTitle },
    {
      id: 'approvals' as const,
      href: '/terminal/approvals',
      label: PROCESS_LABELS.viewApprovals,
    },
  ];
  return (
    <nav className="process-related" aria-label="Procedure navigation">
      {links.map((l) =>
        l.id === primary ? (
          <span key={l.id} className="process-related__active">
            {l.label}
          </span>
        ) : (
          <Link key={l.id} href={l.href} className="process-related__link">
            {l.label}
          </Link>
        ),
      )}
    </nav>
  );
}

/** KPI strip used on Process board + Command center */
export function ProcessKpiStrip({
  items,
}: {
  items: Array<{ label: string; value: string | number; href?: string; warn?: boolean }>;
}) {
  return (
    <div className="process-kpi-strip detail-grid">
      {items.map((item) => (
        <article key={item.label} className="panel process-kpi">
          <h2 className="process-kpi__label">{item.label}</h2>
          <strong
            className={`process-kpi__value${item.warn ? ' text-warning' : ' text-accent'}`}
          >
            {item.value}
          </strong>
          {item.href ? (
            <p className="meta">
              <Link href={item.href}>View</Link>
            </p>
          ) : null}
        </article>
      ))}
    </div>
  );
}
