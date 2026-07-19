/**
 * Durable, resumable workflow run model.
 * Persisted by the API host (OperatorRun / future WorkflowRun table).
 */

import { getWorkflowTemplate, type WorkflowTemplate } from './templates';
import { runWorkflowTemplate, type WorkflowRunResult } from './runner';

export type DurableRunStatus =
  | 'pending'
  | 'running'
  | 'awaiting_approval'
  | 'completed'
  | 'failed'
  | 'blocked'
  | 'cancelled';

export type DurableStepRecord = {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'skipped' | 'failed' | 'awaiting_approval';
  startedAt?: string;
  completedAt?: string;
  error?: string;
  evidence?: Record<string, unknown>;
};

export type DurableWorkflowRun = {
  runId: string;
  organizationId: string;
  templateKey: string;
  version: string;
  status: DurableRunStatus;
  steps: DurableStepRecord[];
  variables: Record<string, unknown>;
  requiresApproval: boolean;
  dryRun: boolean;
  commerceCaseId?: string | null;
  createdAt: string;
  updatedAt: string;
  message: string;
  events: Array<{ at: string; type: string; detail?: string }>;
};

function now() {
  return new Date().toISOString();
}

/**
 * Create a durable run skeleton from a template (before execution).
 */
export function createDurableRun(input: {
  runId: string;
  organizationId: string;
  templateKey: string;
  variables?: Record<string, unknown>;
  dryRun?: boolean;
  commerceCaseId?: string | null;
}): DurableWorkflowRun | { error: string } {
  const template = getWorkflowTemplate(input.templateKey);
  if (!template) return { error: `Unknown template: ${input.templateKey}` };

  const createdAt = now();
  return {
    runId: input.runId,
    organizationId: input.organizationId,
    templateKey: template.key,
    version: template.version,
    status: 'pending',
    steps: template.steps.map((name, i) => ({
      id: `step-${i}`,
      name,
      status: 'pending',
    })),
    variables: input.variables ?? {},
    requiresApproval: template.requiresApproval,
    dryRun: input.dryRun !== false,
    commerceCaseId: input.commerceCaseId ?? null,
    createdAt,
    updatedAt: createdAt,
    message: 'Run created',
    events: [{ at: createdAt, type: 'run.created' }],
  };
}

/**
 * Advance a durable run by executing the deterministic template runner
 * and mapping results onto step records (resumable snapshot).
 */
export function executeDurableRun(
  run: DurableWorkflowRun,
  ctx?: { productCount?: number },
): DurableWorkflowRun {
  const started = { ...run, status: 'running' as DurableRunStatus, updatedAt: now() };
  started.events = [
    ...run.events,
    { at: started.updatedAt, type: 'run.started' },
  ];

  const result: WorkflowRunResult = runWorkflowTemplate(run.templateKey, {
    organizationId: run.organizationId,
    variables: run.variables,
    productCount: ctx?.productCount,
    dryRun: run.dryRun,
  });

  const completedSet = new Set(result.stepsCompleted);
  const skippedSet = new Set(result.stepsSkipped);

  const steps: DurableStepRecord[] = run.steps.map((s) => {
    if (completedSet.has(s.name)) {
      return {
        ...s,
        status: 'completed',
        startedAt: s.startedAt ?? now(),
        completedAt: now(),
        evidence: { dryRun: run.dryRun },
      };
    }
    if (skippedSet.has(s.name)) {
      const awaiting =
        s.name.includes('approval') ||
        s.name.includes('submit') ||
        s.name.includes('apply_if_approved');
      return {
        ...s,
        status: awaiting && result.requiresApproval ? 'awaiting_approval' : 'skipped',
        completedAt: now(),
      };
    }
    return s;
  });

  let status: DurableRunStatus = 'completed';
  if (result.status === 'blocked') status = 'blocked';
  else if (result.status === 'awaiting_approval') status = 'awaiting_approval';
  else if (result.status === 'partial') {
    status = result.requiresApproval ? 'awaiting_approval' : 'completed';
  }

  const updatedAt = now();
  return {
    ...started,
    status,
    steps,
    requiresApproval: result.requiresApproval,
    message: result.message,
    updatedAt,
    events: [
      ...started.events,
      { at: updatedAt, type: `run.${status}`, detail: result.message },
    ],
  };
}

export function describeDurableTemplate(t: WorkflowTemplate) {
  return {
    key: t.key,
    name: t.name,
    version: t.version,
    durable: true,
    trigger: t.trigger,
    requiresApproval: t.requiresApproval,
    stepCount: t.steps.length,
    executionStatus: t.executionStatus,
  };
}
