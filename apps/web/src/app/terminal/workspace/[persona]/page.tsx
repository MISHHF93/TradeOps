import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AskAiButton } from '../../../../components/ai/ask-ai-button';
import { ProcessPageHeader } from '../../../../components/commerce/process-chrome';
import { PersonaHome } from '../../../../components/workspace/persona-home';
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
 * Persona workspace home — dense operating surface with media-rich cases.
 */
export default async function PersonaWorkspacePage({ params, searchParams }: Props) {
  const { persona: raw } = await params;
  const { procedure: focusProcedure } = await searchParams;
  const persona = raw.toLowerCase() as OperatingPersona;
  if (!VALID.includes(persona)) notFound();

  const result = await terminalGet<ResolvedWorkspace>('/api/v1/workspace');
  if (!result.ok) {
    return (
      <section className="terminal-page">
        <p className="form-error">{result.error}</p>
        <Link href="/terminal/workspace">Choose persona</Link>
      </section>
    );
  }

  const ws = result.data;
  const mismatched = ws.persona !== persona;
  const label = ws.allPersonas.find((p) => p.id === persona)?.label ?? persona;
  const focusObjective =
    ws.surface?.focusObjective ?? ws.currentObjective ?? ws.defaultObjective;

  return (
    <section className="terminal-page persona-workspace-page">
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
            <AskAiButton objective={focusObjective || `Operate as ${label}`} label="Ask AI" />
            {!mismatched && ws.recommendedNextAction ? (
              <Link className="btn secondary" href={ws.recommendedNextAction.href}>
                {ws.recommendedNextAction.label}
              </Link>
            ) : (
              <Link className="btn ghost" href="/terminal/workspace">
                Switch persona
              </Link>
            )}
            <Link className="btn ghost" href="/terminal/process">
              Cases
            </Link>
          </>
        }
      />

      <PersonaHome
        ws={ws}
        persona={persona}
        label={label}
        mismatched={mismatched}
        focusProcedureId={focusProcedure}
      />
    </section>
  );
}
