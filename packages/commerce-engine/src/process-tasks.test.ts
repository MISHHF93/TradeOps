import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildCaseAiContext,
  deriveBlockersFromCases,
  deriveTasksFromCases,
  listSopTemplates,
} from './process-tasks';

describe('process-tasks', () => {
  it('derives critical blocker task first', () => {
    const tasks = deriveTasksFromCases([
      {
        caseId: 'c1',
        productId: 'p1',
        productTitle: 'Blocked SKU',
        currentStage: 'qualify',
        stageStatus: 'blocked',
        blockerCode: 'policy_blocked',
        blockerMessage: 'Policy blocked',
        nextActionCode: 'resolve_blocker',
        nextActionLabel: 'Resolve',
      },
      {
        caseId: 'c2',
        productId: 'p2',
        productTitle: 'Good SKU',
        currentStage: 'evaluate',
        stageStatus: 'completed',
        nextActionCode: 'qualify',
        nextActionLabel: 'Qualify opportunity',
        opportunityScore: 80,
      },
    ]);
    assert.equal(tasks[0]!.priority, 'critical');
    assert.equal(tasks[0]!.blocker, true);
    assert.ok(tasks.some((t) => t.actionCode === 'qualify'));
  });

  it('derives blockers list', () => {
    const b = deriveBlockersFromCases([
      {
        caseId: 'c1',
        productId: 'p1',
        currentStage: 'qualify',
        stageStatus: 'blocked',
        blockerCode: 'policy_blocked',
        blockerMessage: 'Policy blocked',
      },
    ]);
    assert.equal(b.length, 1);
    assert.equal(b[0]!.severity, 'critical');
  });

  it('lists SOP templates', () => {
    const sops = listSopTemplates();
    assert.ok(sops.find((s) => s.id === 'product-launch'));
    assert.ok(sops.find((s) => s.id === 'customer-order'));
  });

  it('builds stage-aware AI context', () => {
    const ctx = buildCaseAiContext({
      caseId: 'c1',
      productTitle: 'Water Bottle',
      currentStage: 'evaluate',
      stageStatus: 'completed',
      nextActionLabel: 'Qualify opportunity',
    });
    assert.match(ctx, /evaluate/i);
    assert.match(ctx, /stage-bound/i);
    assert.match(ctx, /Qualify/);
  });
});
