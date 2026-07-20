import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
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

/** Legacy stored personas → operating persona (matches commerce-engine resolveOperatingPersona). */
const LEGACY_PERSONA: Record<string, OperatingPersona> = {
  founder: 'researcher',
  procurement: 'operator',
  finance: 'executive',
  agency: 'administrator',
  auditor: 'executive',
};

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
  const key = raw.toLowerCase();
  if (LEGACY_PERSONA[key]) {
    const qs = focusProcedure ? `?procedure=${encodeURIComponent(focusProcedure)}` : '';
    redirect(`/terminal/workspace/${LEGACY_PERSONA[key]}${qs}`);
  }
  const persona = key as OperatingPersona;
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
        pill="Home · Intent"
        title="Home"
        lede={
          mismatched
            ? `You are set to ${ws.personaLabel}. Switch persona to fully adopt this workspace.`
            : `${label}: ${ws.mission} Start with AI, work Cases, connect systems.`
        }
        breadcrumbs={[{ href: '/terminal/workspace', label: 'Home' }, { label }]}
        toolbar={
          <>
            <AskAiButton
              objective={focusObjective || `Operate as ${label}`}
              label="Open AI"
              className="btn primary"
            />
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
