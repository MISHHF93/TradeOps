/**
 * Provenance helpers for operator briefings.
 * Makes it obvious whether text is Cohere-generated vs honest non-generative status.
 */

export type BriefingSource =
  | 'cohere'
  | 'blocked'
  | 'empty_store'
  | 'no_qualifiers'
  | 'tools_structured'
  | string;

export type TimelineStep = {
  at?: string;
  step: string;
  status: string;
  detail?: string;
};

/** Human label for briefingSource from the server. */
export function briefingSourceLabel(source?: string | null): string {
  switch ((source ?? '').toLowerCase()) {
    case 'cohere':
      return 'Cohere (live)';
    case 'blocked':
      return 'Blocked — no fixed essay';
    case 'empty_store':
      return 'Empty store';
    case 'no_qualifiers':
      return 'No qualifiers';
    case 'tools_structured':
      return 'Tools only';
    default:
      return source?.trim() ? source : 'Unknown';
  }
}

/** CSS modifier for provenance chip. */
export function briefingSourceTone(
  source?: string | null,
): 'ok' | 'warn' | 'muted' | 'blocked' {
  switch ((source ?? '').toLowerCase()) {
    case 'cohere':
      return 'ok';
    case 'blocked':
      return 'blocked';
    case 'empty_store':
    case 'no_qualifiers':
      return 'warn';
    case 'tools_structured':
      return 'muted';
    default:
      return 'muted';
  }
}

/** True when the user-facing briefing body is model-generated prose. */
export function isGenerativeBriefing(source?: string | null): boolean {
  return (source ?? '').toLowerCase() === 'cohere';
}

/**
 * Extract Phase B latency / provider detail from operator timeline.
 * Example detail: "provider=cohere 9205ms schema=operator_briefing"
 */
export function phaseBDetail(timeline?: TimelineStep[] | null): {
  detail: string | null;
  latencyMs: number | null;
  provider: string | null;
  fixedTemplate: boolean | null;
} {
  const steps = timeline ?? [];
  const synth = [...steps].reverse().find((t) => /phase b/i.test(t.step));
  const sourceLine = [...steps].reverse().find((t) => /briefing source/i.test(t.step));
  const detail = synth?.detail?.trim() || null;
  let latencyMs: number | null = null;
  let provider: string | null = null;
  if (detail) {
    const lat = detail.match(/(\d+)\s*ms/i);
    if (lat) latencyMs = Number(lat[1]);
    const prov = detail.match(/provider=([a-z0-9_-]+)/i);
    if (prov) provider = prov[1]!;
  }
  let fixedTemplate: boolean | null = null;
  if (sourceLine?.detail) {
    if (/fixed_template=false/i.test(sourceLine.detail)) fixedTemplate = false;
    else if (/fixed_template=true/i.test(sourceLine.detail)) fixedTemplate = true;
  }
  return { detail, latencyMs, provider, fixedTemplate };
}

export function resolveBriefingText(result: {
  responseSummary?: string | null;
  envelope?: { text?: string | null } | null;
  decisionNote?: string | null;
}): string | null {
  const t =
    result.responseSummary?.trim() ||
    result.envelope?.text?.trim() ||
    result.decisionNote?.trim() ||
    '';
  return t || null;
}
