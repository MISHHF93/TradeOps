/**
 * User-facing operator objective helpers.
 *
 * System / workspace / state-engine preambles must never be shown as the
 * human "Objective" or "Description" on Opportunities / Objectives pages.
 * They belong only in AI context (planJson / prompt assembly).
 */

const SYSTEM_MARKERS = [
  /^You are\b/i,
  /TradeOps Intelligence/i,
  /TradeOps Commerce State Engine/i,
  /single intelligent AI for the/i,
  /Allowed tools for this persona/i,
  /Ranked operational insights/i,
  /Do not merely answer questions/i,
  /Central TradeOps AI operator/i,
];

/**
 * Extract the operator's real goal from a stored OperatorRun.objective value.
 * Handles legacy rows that accidentally concatenated AI preambles.
 */
export function sanitizeOperatorObjective(raw: string | null | undefined): string {
  const text = String(raw ?? '').trim();
  if (!text) return '';

  // Case-bound runs: "...\n\nOperator objective:\n{user}"
  const opMarker = /Operator objective:\s*/i;
  if (opMarker.test(text)) {
    const parts = text.split(opMarker);
    const last = (parts[parts.length - 1] ?? '').trim();
    if (last) return collapseWhitespace(last);
  }

  // Workspace preamble ends with "Focus objective ...:\n{user}"
  const focusMarker = /Focus objective \(start here unless user overrides\):\s*/i;
  if (focusMarker.test(text)) {
    const after = text.split(focusMarker).pop()?.trim() ?? '';
    if (after && !looksLikeSystemPrompt(after)) {
      return collapseWhitespace(after);
    }
  }

  if (!looksLikeSystemPrompt(text)) {
    return collapseWhitespace(text);
  }

  // Prefer last non-system paragraph
  const blocks = text
    .split(/\n\n+/)
    .map((b) => b.trim())
    .filter(Boolean);
  for (let i = blocks.length - 1; i >= 0; i--) {
    const b = blocks[i]!;
    if (looksLikeSystemPrompt(b)) continue;
    if (b.length >= 8 && b.length <= 800) return collapseWhitespace(b);
  }

  // Prefer a short non-system line
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]!;
    if (looksLikeSystemPrompt(line)) continue;
    if (line.startsWith('•') || line.startsWith('-')) continue;
    if (line.length >= 12 && line.length <= 240) return line;
  }

  return 'Operator run';
}

export function looksLikeSystemPrompt(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (SYSTEM_MARKERS.some((re) => re.test(t))) return true;
  // Long multi-line instruction blobs are not user objectives
  if (t.length > 600 && t.split('\n').length >= 6) {
    if (/Mission:|Organization:|Health:|persona|workspace/i.test(t)) return true;
  }
  return false;
}

/** Short label for tables / lists */
export function operatorObjectiveLabel(
  raw: string | null | undefined,
  maxLen = 120,
): string {
  const clean = sanitizeOperatorObjective(raw);
  if (clean.length <= maxLen) return clean;
  return `${clean.slice(0, maxLen - 1)}…`;
}

/**
 * Prefer plan summaries for "description" UI — never system prompts.
 */
export function operatorRunDescription(input: {
  objective?: string | null;
  decisionNote?: string | null;
  planJson?: {
    responseSummary?: string;
    navigatorSummary?: string;
    finalAnswer?: string;
    interpretation?: string;
    userObjective?: string;
    executionPackage?: {
      objective?: { goal?: string; desiredOutcome?: string };
    };
  } | null;
}): { objective: string; description: string | null } {
  const plan = input.planJson ?? {};
  const fromPlan =
    (typeof plan.userObjective === 'string' && plan.userObjective.trim()) ||
    plan.executionPackage?.objective?.goal ||
    '';
  const objective = sanitizeOperatorObjective(fromPlan || input.objective);

  const descriptionCandidates = [
    plan.navigatorSummary,
    plan.responseSummary,
    plan.finalAnswer,
    plan.interpretation,
    plan.executionPackage?.objective?.desiredOutcome,
    input.decisionNote,
  ]
    .map((s) => (typeof s === 'string' ? s.trim() : ''))
    .filter(Boolean)
    .filter((s) => !looksLikeSystemPrompt(s));

  return {
    objective,
    description: descriptionCandidates[0] ?? null,
  };
}

function collapseWhitespace(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}
