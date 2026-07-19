/**
 * Task-level prompts — versioned fragments injected by intent.
 * Production configuration lives in source, not Cohere Playground.
 */

export const TASK_PROMPT_OPERATIONAL_V1 = {
  id: 'task-operational',
  version: '1.0.0',
  description: 'Operational commerce / inventory / orders tasks',
  createdAt: '2026-07-18',
  changeNotes: 'Initial operational task prompt',
  supportedSchemas: ['operational_brief', 'answer', 'execution_plan'],
  text: `Task type: authenticated operational analysis.
Use connector and database tool results only for operational claims.
If tools return empty, say so — do not invent inventory, orders, or payments.
Propose next actions with approval flags for writes.`,
} as const;

export const TASK_PROMPT_RESEARCH_V1 = {
  id: 'task-research',
  version: '1.0.0',
  description: 'Public market / supplier / product research',
  createdAt: '2026-07-18',
  changeNotes: 'Initial research task prompt',
  supportedSchemas: ['research_report', 'product_comparison', 'supplier_comparison'],
  text: `Task type: external research.
Cite evidence from search/retrieval.
Do not treat public web results as tenant inventory or order truth.
Separate observed facts from inference.`,
} as const;

export const TASK_PROMPT_PROCUREMENT_V1 = {
  id: 'task-procurement',
  version: '1.0.0',
  description: 'Procurement / RFQ / supplier comparison',
  createdAt: '2026-07-18',
  changeNotes: 'Initial procurement task prompt',
  supportedSchemas: ['procurement_plan', 'supplier_comparison'],
  text: `Task type: procurement.
Compare suppliers with explicit cost, MOQ, lead time, and risk when data exists.
Never create purchase orders without approval.`,
} as const;

export const TASK_PROMPT_COMPLIANCE_V1 = {
  id: 'task-compliance',
  version: '1.0.0',
  description: 'Policy / restricted goods / compliance',
  createdAt: '2026-07-18',
  changeNotes: 'Initial compliance task prompt',
  supportedSchemas: ['risk_assessment', 'answer'],
  text: `Task type: compliance and policy risk.
Flag restricted categories. Prefer fail-closed recommendations.
Do not approve prohibited goods.`,
} as const;
