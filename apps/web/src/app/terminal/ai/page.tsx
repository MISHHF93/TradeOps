import Link from 'next/link';
import { AiGatewayConsole } from '../../../components/ai/ai-gateway-console';
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

/**
 * AI platform workspace — gateway, retrieval, prediction, status.
 * Universal objective composer lives in the persistent right rail (AiContextPanel).
 * Durable runs: /terminal/objectives · long-form: /terminal/objectives/[id]
 * (AiOperatorConsole removed — rail + ai-operator-client are canonical.)
 */
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
        pill="TradeOps AI · unified stack"
        title="TradeOps AI"
        lede={
          caseId
            ? 'Bound to a Commerce Case. Gateway + retrieval + prediction for the current stage. Run objectives from the AI Operator rail on the right.'
            : 'One AI stack (Cohere code-first runtime). Gateway, Search/RAG, and prediction live here. Universal objectives run from the right rail — not a full-page operator console.'
        }
        currentStage={caseStage}
        breadcrumbs={[
          { href: '/terminal/process', label: PROCESS_LABELS.boardTitle },
          { label: 'AI platform' },
        ]}
        toolbar={
          <>
            <Link className="btn primary" href="/terminal/objectives">
              Run history
            </Link>
            <Link className="btn ghost" href="/terminal/process">
              {PROCESS_LABELS.openProcess}
            </Link>
            <Link className="btn secondary" href="/terminal/ai/runtime-lab">
              Runtime lab
            </Link>
            {caseId ? (
              <Link className="btn secondary" href={`/terminal/process/${caseId}`}>
                {PROCESS_LABELS.openCase}
              </Link>
            ) : null}
          </>
        }
      />

      <ProcessRelatedLinks primary="ai" />

      <XaiStatusBar />

      <AiGatewayConsole initialObjective={presetObjective} />

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
              <p className="meta">
                Paste a suggestion into the AI Operator rail on the right to execute.
              </p>
            </>
          ) : null}
        </article>
      ) : null}

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
                <Link href={`/terminal/objectives/${r.id}`}>
                  {(r.objective || 'Operator run').slice(0, 90)}
                </Link>
                {' · '}
                {new Date(r.startedAt).toLocaleString()} · {r.status} · {r.loopMode}
              </li>
            ))}
          </ul>
        </article>
      ) : null}
    </section>
  );
}
