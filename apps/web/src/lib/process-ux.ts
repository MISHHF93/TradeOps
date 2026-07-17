/**
 * Canonical process / procedure UX vocabulary.
 * One language for stage labels, CTAs, and chrome across the terminal.
 */

export const PROCESS_LABELS = {
  /** Primary board */
  boardTitle: 'Process',
  boardPill: 'Commerce procedure',
  boardLede:
    'Every product opportunity is one Commerce Case. Follow the stage, clear blockers, apply the next transformation.',
  /** Case detail */
  caseTitle: 'Case',
  casePill: 'Commerce Case',
  /** Work queue derived from cases */
  tasksTitle: 'Tasks',
  tasksPill: 'Procedure work queue',
  tasksLede:
    'Open work items derived from Commerce Cases. Each task is a next step or blocker — not a separate todo system.',
  /** Discover stage view */
  discoverTitle: 'Discover',
  discoverPill: 'Stage 1 · Discover',
  discoverLede:
    'Find product candidates. Import creates a Commerce Case on the Process board — not a dead table row.',
  /** Shared CTAs */
  openCase: 'Open case',
  openProcess: 'Process board',
  nextStep: 'Next step',
  syncProcess: 'Sync cases',
  applyTransform: 'Apply next step',
  viewTasks: 'Tasks',
  viewApprovals: 'Approvals',
  viewOrders: 'Orders',
  aiOnCase: 'AI on this case',
  productTwin: 'Product twin',
} as const;

/** Lifecycle stages — human labels (order matters). */
export const PROCESS_STAGES = [
  { id: 'discover', title: 'Discover', short: '1', description: 'Import and scan candidates' },
  { id: 'evaluate', title: 'Evaluate', short: '2', description: 'Score economics and demand' },
  { id: 'qualify', title: 'Qualify', short: '3', description: 'Policy and go/no-go' },
  { id: 'prepare', title: 'Prepare', short: '4', description: 'Listing and media' },
  { id: 'approve', title: 'Approve', short: '5', description: 'Human gate' },
  { id: 'publish', title: 'Publish', short: '6', description: 'Channel live' },
  { id: 'sell', title: 'Sell', short: '7', description: 'Customer orders' },
  { id: 'source', title: 'Source', short: '8', description: 'Supplier PO' },
  { id: 'fulfill', title: 'Fulfill', short: '9', description: 'Ship and track' },
  { id: 'reconcile', title: 'Reconcile', short: '10', description: 'Money truth' },
  { id: 'learn', title: 'Learn', short: '11', description: 'Outcomes vs forecast' },
] as const;

export type ProcessStageId = (typeof PROCESS_STAGES)[number]['id'];

export function stageTitle(id: string | null | undefined): string {
  if (!id) return '—';
  const s = PROCESS_STAGES.find((x) => x.id === id);
  return s?.title ?? id;
}

export function stageStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case 'not_started':
      return 'Not started';
    case 'ready':
      return 'Ready';
    case 'in_progress':
      return 'In progress';
    case 'waiting':
      return 'Waiting';
    case 'blocked':
      return 'Blocked';
    case 'completed':
      return 'Done';
    case 'failed':
      return 'Failed';
    default:
      return status ?? '—';
  }
}

/** Relative path helpers — always deep-link into the process spine. */
export function caseHref(caseId: string): string {
  return `/terminal/process/${caseId}`;
}

export function processBoardHref(stage?: string): string {
  return stage ? `/terminal/process#stage-${stage}` : '/terminal/process';
}

/** Stage views that are projections of Process (not separate products). */
export const STAGE_VIEW_HREFS: Record<string, string> = {
  discover: '/terminal',
  evaluate: '/terminal/opportunities',
  qualify: '/terminal/opportunities',
  prepare: '/terminal/listings',
  approve: '/terminal/approvals',
  publish: '/terminal/listings',
  sell: '/terminal/orders',
  source: '/terminal/orders',
  fulfill: '/terminal/fulfillment',
  reconcile: '/terminal/finance/reconciliation',
  learn: '/terminal/process',
};

export function relatedStageHref(stageId: string): string {
  return STAGE_VIEW_HREFS[stageId] ?? '/terminal/process';
}
