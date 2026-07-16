import { getWorkflowTemplate, type WorkflowTemplate } from './templates';

export type WorkflowRunResult = {
  templateKey: string;
  version: string;
  status: 'completed' | 'awaiting_approval' | 'blocked' | 'partial';
  stepsCompleted: string[];
  stepsSkipped: string[];
  requiresApproval: boolean;
  message: string;
  evidence: Record<string, unknown>;
};

/**
 * Deterministic template runner for v1.
 * Real connector side-effects only when host injects handlers and approvals pass.
 */
export function runWorkflowTemplate(
  key: string,
  ctx: {
    organizationId: string;
    variables?: Record<string, unknown>;
    productCount?: number;
    dryRun?: boolean;
  },
): WorkflowRunResult {
  const template = getWorkflowTemplate(key);
  if (!template) {
    return {
      templateKey: key,
      version: '0',
      status: 'blocked',
      stepsCompleted: [],
      stepsSkipped: [],
      requiresApproval: false,
      message: `Unknown workflow template: ${key}`,
      evidence: {},
    };
  }

  if (template.executionStatus === 'coming_soon') {
    return {
      templateKey: template.key,
      version: template.version,
      status: 'blocked',
      stepsCompleted: [],
      stepsSkipped: template.steps,
      requiresApproval: template.requiresApproval,
      message: `${template.name} is not fully executable yet (coming_soon). Template recorded for planning only.`,
      evidence: { executionStatus: template.executionStatus },
    };
  }

  const stepsCompleted: string[] = [];
  const stepsSkipped: string[] = [];
  for (const step of template.steps) {
    if (step.includes('submit') || step.includes('apply_if_approved') || step.includes('reconcile_external')) {
      if (template.requiresApproval || template.executionStatus === 'shadow_only' || ctx.dryRun !== false) {
        stepsSkipped.push(step);
        continue;
      }
    }
    stepsCompleted.push(step);
  }

  const awaiting = template.requiresApproval || stepsSkipped.some((s) => s.includes('approval'));
  return {
    templateKey: template.key,
    version: template.version,
    status: awaiting ? 'awaiting_approval' : stepsSkipped.length ? 'partial' : 'completed',
    stepsCompleted,
    stepsSkipped,
    requiresApproval: template.requiresApproval,
    message: awaiting
      ? `${template.name}: plan executed through draft/evidence; consequential steps require approval or live connectors.`
      : `${template.name}: completed permitted steps.`,
    evidence: {
      organizationId: ctx.organizationId,
      variables: ctx.variables ?? {},
      productCount: ctx.productCount ?? null,
      dryRun: ctx.dryRun !== false,
      executionStatus: template.executionStatus,
    },
  };
}

export function describeTemplate(t: WorkflowTemplate) {
  return {
    key: t.key,
    name: t.name,
    version: t.version,
    description: t.description,
    trigger: t.trigger,
    requiresApproval: t.requiresApproval,
    steps: t.steps,
    variables: t.variables,
    executionStatus: t.executionStatus,
  };
}
