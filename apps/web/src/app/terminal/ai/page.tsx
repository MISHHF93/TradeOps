import Link from 'next/link';
import { AiOperatorConsole } from '../../../components/ai-operator-console';
import { PredictionConsole } from '../../../components/ai/prediction-console';
import { RagConsole } from '../../../components/ai/rag-console';
import { XaiStatusBar } from '../../../components/ai/xai-status-bar';
import {
  ProcessPageHeader,
  ProcessRelatedLinks,
} from '../../../components/commerce/process-chrome';
import { PROCESS_LABELS, stageTitle } from '../../../lib/process-ux';
import { terminalGet } from '../../../lib/terminal-api';

type Props = { searchParams: Promise<{ caseId?: string; objective?: string }> };

export default async function AiWorkspacePage({ searchParams }: Props) {
  const sp = await searchParams;
  const caseId = sp.caseId?.trim();
  const presetObjective = sp.objective?.trim();

  const tools = await terminalGet<{
    tools: Array<{
      name: string;
      description: string;
      actionClass: string;
      approvalRequired: boolean;
    }>;
    loopModes: Array<{ mode: string; meaning: string }>;
    note: string;
  }>('/api/v1/ai/tools');

  const runs = await terminalGet<
    Array<{
      id: string;
      objective: string;
      status: string;
      loopMode: string;
      decision: string | null;
      startedAt: string;
      recommendations: Array<{ title: string; rank: number }>;
    }>
  >('/api/v1/ai/runs?take=10');

  let caseHint: string | undefined;
  let suggested: string[] = [];
  let caseStage: string | undefined;
  if (caseId) {
    const ctx = await terminalGet<{
      currentStage?: string;
      stageStatus?: string;
      nextActionLabel?: string | null;
      suggestedObjectives?: string[];
    }>(`/api/v1/commerce/cases/${caseId}/ai-context`);
    if (ctx.ok) {
      caseStage = ctx.data.currentStage;
      caseHint = `${ctx.data.currentStage} · ${ctx.data.stageStatus}${
        ctx.data.nextActionLabel ? ` · next: ${ctx.data.nextActionLabel}` : ''
      }`;
      suggested = ctx.data.suggestedObjectives ?? [];
    }
  }

  return (
    <section>
      <ProcessPageHeader
        pill="AI Operator · process-aware"
        title="AI Operator"
        lede={
          caseId
            ? 'Bound to a Commerce Case. Recommend the highest-value valid next step for the current stage — do not free-form chat.'
            : 'Lifecycle-aware operator. Bind a case from Process for stage-aware recommendations, or run global discover/health objectives.'
        }
        currentStage={caseStage}
        breadcrumbs={[
          { href: '/terminal/process', label: PROCESS_LABELS.boardTitle },
          { label: 'AI Operator' },
        ]}
        toolbar={
          <>
            <Link className="btn primary" href="/terminal/process">
              {PROCESS_LABELS.openProcess}
            </Link>
            <Link className="btn ghost" href="/terminal/tasks">
              {PROCESS_LABELS.viewTasks}
            </Link>
            {caseId ? (
              <Link className="btn secondary" href={`/terminal/process/${caseId}`}>
                {PROCESS_LABELS.openCase}
              </Link>
            ) : null}
          </>
        }
      />

      <ProcessRelatedLinks primary="process" />

      <XaiStatusBar />

      {caseId && caseHint ? (
        <article className="panel" style={{ marginBottom: 12 }}>
          <h2 style={{ marginTop: 0 }}>
            Case context{caseStage ? ` · ${stageTitle(caseStage)}` : ''}
          </h2>
          <p className="meta">{caseHint}</p>
          {suggested.length > 0 ? (
            <>
              <h3>Suggested objectives</h3>
              <ul className="meta">
                {suggested.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </>
          ) : null}
        </article>
      ) : null}

      <AiOperatorConsole
        commerceCaseId={caseId}
        caseContextHint={caseHint}
        initialObjective={presetObjective}
      />

      <RagConsole />
      <PredictionConsole />

      {tools.ok ? (
        <article className="panel" style={{ marginTop: 16 }}>
          <h2>Tool catalog</h2>
          <p className="meta">{tools.data.note}</p>
          <ul className="meta">
            {tools.data.tools.slice(0, 12).map((t) => (
              <li key={t.name}>
                <strong>{t.name}</strong> · {t.actionClass}
                {t.approvalRequired ? ' · approval' : ''}
              </li>
            ))}
          </ul>
        </article>
      ) : null}

      {runs.ok && runs.data.length > 0 ? (
        <article className="panel" style={{ marginTop: 16 }}>
          <h2>Recent runs</h2>
          <ul className="meta">
            {runs.data.slice(0, 5).map((r) => (
              <li key={r.id}>
                {new Date(r.startedAt).toLocaleString()} · {r.status} · {r.loopMode}
              </li>
            ))}
          </ul>
        </article>
      ) : null}
    </section>
  );
}
