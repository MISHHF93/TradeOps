import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { listWorkflowTemplates, runWorkflowTemplate } from './index';

describe('workflow templates', () => {
  it('exposes versioned core templates', () => {
    const keys = listWorkflowTemplates().map((t) => t.key);
    assert.ok(keys.includes('product_opportunity_discovery'));
    assert.ok(keys.includes('supplier_routing'));
    assert.ok(keys.includes('forecast_evaluation'));
  });

  it('does not auto-submit consequential steps without approval path', () => {
    const result = runWorkflowTemplate('margin_protection', {
      organizationId: 'org',
      dryRun: true,
    });
    assert.equal(result.requiresApproval, true);
    assert.ok(result.stepsSkipped.some((s) => s.includes('apply') || s.includes('approval')));
    assert.notEqual(result.status, 'completed');
  });

  it('blocks coming_soon templates honestly', () => {
    const result = runWorkflowTemplate('inventory_protection', { organizationId: 'org' });
    assert.equal(result.status, 'blocked');
  });
});
