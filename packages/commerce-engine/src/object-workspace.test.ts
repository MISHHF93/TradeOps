import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildCaseObjectWorkspace } from './object-workspace';

describe('object workspace', () => {
  it('builds case-centric panels and graph', () => {
    const ws = buildCaseObjectWorkspace({
      caseId: 'case-1',
      productId: 'prod-1',
      productTitle: 'Test Product',
      productCategory: 'home',
      sourcePlatform: 'fixture-supplier',
      currentStage: 'evaluate',
      stageStatus: 'ready',
      nextActionLabel: 'Qualify opportunity',
      nextActionCode: 'qualify',
      opportunityScore: 70,
      offers: [{ supplierName: 'Fixture Co', costMinor: 1000, shippingCostMinor: 200 }],
      listings: [{ id: 'l1', status: 'draft', priceMinor: 2999 }],
      artifacts: [{ id: 'a1', artifactType: 'image', purpose: 'primary', title: 'Hero' }],
    });

    assert.equal(ws.objectType, 'commerce_case');
    assert.ok(ws.panels.some((p) => p.id === 'overview'));
    assert.ok(ws.panels.some((p) => p.id === 'suppliers' && (p.items?.length ?? 0) > 0));
    assert.ok(ws.graph.edges.some((e) => e.relation === 'case_for_product'));
    assert.equal(ws.honesty.isFixtureSource, true);
    assert.ok(ws.aiContext.preamble.includes('TEST FIXTURE'));
  });
});
