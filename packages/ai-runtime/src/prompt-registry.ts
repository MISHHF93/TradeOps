/**
 * Versioned prompt registry — all system instructions owned by TradeOps source.
 * No external playground configs for production behavior.
 */

export type PromptTemplate = {
  id: string;
  version: string;
  purpose: string;
  /** Template body; {{var}} placeholders only — no secrets */
  body: string;
  variables: string[];
};

const prompts = new Map<string, PromptTemplate>();

export function registerPrompt(template: PromptTemplate): void {
  prompts.set(template.id, template);
}

export function getPrompt(id: string): PromptTemplate | undefined {
  return prompts.get(id);
}

export function listPrompts(): PromptTemplate[] {
  return [...prompts.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export function renderPrompt(
  id: string,
  vars: Record<string, string>,
): { ok: true; text: string; version: string } | { ok: false; error: string } {
  const p = prompts.get(id);
  if (!p) return { ok: false, error: `Unknown prompt: ${id}` };
  let text = p.body;
  for (const key of p.variables) {
    const val = vars[key] ?? '';
    text = text.split(`{{${key}}}`).join(val);
  }
  return { ok: true, text, version: p.version };
}

// Built-in COS prompts
registerPrompt({
  id: 'operator.system',
  version: '1.0.0',
  purpose: 'Core AI Operator system instruction',
  variables: ['persona', 'loopMode', 'accessMode'],
  body: [
    'You are the TradeOps AI Operator for a Commerce Operating System.',
    'Persona: {{persona}}. Loop mode: {{loopMode}}. Access: {{accessMode}}.',
    'Operate only through registered TradeOps tools and business capabilities.',
    'Never call vendor APIs directly. Never claim fixture data is live.',
    'Consequential actions (publish, PO, refunds, billing changes) require approval.',
    'Prefer Commerce Case as the unit of work. Cite provenance and confidence.',
  ].join(' '),
});

registerPrompt({
  id: 'operator.case_context',
  version: '1.0.0',
  purpose: 'Inject Commerce Case object workspace into operator run',
  variables: ['caseId', 'productTitle', 'stage', 'stageStatus', 'nextAction', 'preamble'],
  body: [
    'Commerce Case {{caseId}} — "{{productTitle}}".',
    'Stage: {{stage}} ({{stageStatus}}). Next: {{nextAction}}.',
    '{{preamble}}',
  ].join(' '),
});

registerPrompt({
  id: 'operator.research',
  version: '1.0.0',
  purpose: 'Read-only research objective framing',
  variables: ['objective'],
  body: [
    'Research objective (read-only): {{objective}}',
    'Rank products with contribution economics, policy risk, and confidence.',
    'Do not publish or place purchase orders.',
  ].join(' '),
});

registerPrompt({
  id: 'search.system',
  version: '1.0.0',
  purpose: 'Search layer synthesis when mixed evidence is returned',
  variables: ['query'],
  body: [
    'Search query: {{query}}',
    'Prefer internal TradeOps objects. Attribute every hit with connector and fixture labels.',
    'Do not invent products or orders not present in evidence.',
  ].join(' '),
});
