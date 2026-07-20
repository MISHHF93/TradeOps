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

/** Human label for briefingSource from the server. Avoid env-key / config jargon. */
export function briefingSourceLabel(source?: string | null): string {
  switch ((source ?? '').toLowerCase()) {
    case 'cohere':
      return 'Live briefing';
    case 'blocked':
      return 'Ranked results';
    case 'empty_store':
      return 'Empty catalog';
    case 'no_qualifiers':
      return 'No matches';
    case 'tools_structured':
      return 'Tool results';
    default:
      return source?.trim() ? source : 'Result';
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
 * Extract briefing latency from operator timeline (user-safe; no env/key chatter).
 * Matches "Writing briefing" (current) and legacy "Phase B" step names.
 */
export function phaseBDetail(timeline?: TimelineStep[] | null): {
  detail: string | null;
  latencyMs: number | null;
  provider: string | null;
  fixedTemplate: boolean | null;
} {
  const steps = timeline ?? [];
  const synth = [...steps]
    .reverse()
    .find((t) => /writing briefing|phase b/i.test(t.step));
  const detail = synth?.detail?.trim() || null;
  let latencyMs: number | null = null;
  let provider: string | null = null;
  if (detail && !/key|api_key|missing|configured|fixed_template/i.test(detail)) {
    const lat = detail.match(/(\d+)\s*ms/i);
    if (lat) latencyMs = Number(lat[1]);
    const prov = detail.match(/provider=([a-z0-9_-]+)/i);
    if (prov) provider = prov[1]!;
  }
  // fixedTemplate intentionally unused in UI — never advertise template meta
  return { detail: null, latencyMs, provider, fixedTemplate: null };
}

export function resolveBriefingText(result: {
  responseSummary?: string | null;
  envelope?: { text?: string | null } | null;
  decisionNote?: string | null;
  navigatorSummary?: string | null;
  plan?: { finalAnswer?: string | null; responseSummary?: string | null } | null;
}): string | null {
  const t =
    result.responseSummary?.trim() ||
    result.decisionNote?.trim() ||
    result.navigatorSummary?.trim() ||
    result.plan?.finalAnswer?.trim() ||
    result.plan?.responseSummary?.trim() ||
    result.envelope?.text?.trim() ||
    '';
  return t || null;
}
