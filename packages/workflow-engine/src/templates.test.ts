import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { listWorkflowTemplates, runWorkflowTemplate } from './index';

describe('workflow templates', () => {
  it('exposes versioned core templates', () => {
    const keys = listWorkflowTemplates().map((t) => t.key);
    assert.ok(keys.includes('product_opportunity_discovery'));
    assert.ok(keys.includes('supplier_routing'));
    assert.ok(keys.includes('forecast_evaluation'));
    assert.ok(keys.includes('inventory_protection'));
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

  it('inventory_protection is shadow_only with draft evidence — no external reconcile', () => {
    const result = runWorkflowTemplate('inventory_protection', {
      organizationId: 'org',
      inventorySnapshots: [
        {
          productId: 'p1',
          title: 'Low stock SKU',
          quantity: 0,
          listingId: 'l1',
          listingStatus: 'active',
        },
      ],
      variables: { minStock: 5, pauseBelow: 1 },
    });
    assert.notEqual(result.status, 'blocked');
    assert.equal(result.requiresApproval, true);
    assert.ok(result.stepsSkipped.includes('reconcile_external'));
    assert.equal(result.evidence.atRiskCount, 1);
    assert.ok(Array.isArray(result.evidence.draftActions));
    assert.equal(
      (result.evidence.draftActions as Array<{ applied: boolean }>)[0]?.applied,
      false,
    );
  });

  it('product_opportunity_discovery ranks host opportunities without inventing scores', () => {
    const empty = runWorkflowTemplate('product_opportunity_discovery', {
      organizationId: 'org',
      scoredOpportunities: [],
      productCount: 0,
    });
    assert.equal(empty.evidence.candidatesLoaded, 0);
    assert.equal(empty.evidence.qualifyingCount, 0);
    assert.match(String(empty.evidence.honesty), /empty|No opportunity/i);

    const withRows = runWorkflowTemplate('product_opportunity_discovery', {
      organizationId: 'org',
      productCount: 3,
      variables: { minMarginBps: 2500, topN: 2 },
      scoredOpportunities: [
        {
          productId: 'a',
          title: 'Good',
          score: 90,
          expectedMarginBps: 3000,
          currentSignal: 'BUY',
          isFixture: true,
        },
        {
          productId: 'b',
          title: 'Blocked',
          score: 99,
          expectedMarginBps: 4000,
          currentSignal: 'BLOCKED',
        },
        {
          productId: 'c',
          title: 'Thin',
          score: 80,
          expectedMarginBps: 1000,
          currentSignal: 'HOLD',
        },
        {
          productId: 'd',
          title: 'Also good',
          score: 85,
          expectedMarginBps: 2800,
          currentSignal: 'SCALE',
          isFixture: false,
        },
      ],
    });
    assert.equal(withRows.evidence.candidatesLoaded, 4);
    assert.equal(withRows.evidence.qualifyingCount, 2);
    const top = withRows.evidence.topOpportunities as Array<{ productId: string }>;
    assert.equal(top[0]?.productId, 'a');
    assert.equal(top[1]?.productId, 'd');
    assert.ok(withRows.stepsCompleted.includes('score_opportunity'));
  });
});
