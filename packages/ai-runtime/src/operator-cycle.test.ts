import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { registerBuiltinTools } from './builtin-tools';
import { parseObjective, runOperatorCycle } from './operator-cycle';
import { listToolsPublic } from './tool-registry';

describe('AI operator cycle', () => {
  registerBuiltinTools();

  it('parses margin and review filters from objective text', () => {
    const f = parseObjective(
      'Find products with predicted margin above 25%, delivery under 12 days, at least 200 reviews, low policy risk',
    );
    assert.equal(f.minMarginBps, 2500);
    assert.equal(f.maxDeliveryDays, 12);
    assert.equal(f.minReviews, 200);
    assert.ok((f.maxPolicyRisk ?? 100) <= 25);
  });

  it('exposes registered tools without secrets', () => {
    const tools = listToolsPublic();
    assert.ok(tools.some((t) => t.name === 'calculateContributionProfit'));
    assert.ok(tools.every((t) => t.actionClass !== 'prohibited' || t.approvalRequired));
  });

  it('runs critic/auditor cycle and never auto-publishes', async () => {
    const result = await runOperatorCycle({
      objective: 'Find products with margin above 15% and low policy risk. Prepare strongest listings.',
      loopMode: 'shadow',
      products: [
        {
          productId: 'p1',
          title: 'Insulated Stainless Water Bottle 32oz',
          description: 'BPA-free travel bottle',
          category: 'Home',
          sourcePlatform: 'fixture-supplier',
          supplierCostMinor: 1800,
          shippingCostMinor: 450,
          targetPriceMinor: 4999,
          marketplaceFeeMinor: 750,
          paymentFeeMinor: 175,
          adAllocationMinor: 300,
          returnReserveMinor: 100,
          currency: 'USD',
          inventoryQuantity: 100,
          rating: 4.6,
          reviewCount: 250,
          dataConfidence: 0.85,
          dataFreshnessAt: new Date().toISOString(),
        },
        {
          productId: 'p2',
          title: 'Tactical Weapon Holster Training Kit',
          description: 'firearm training',
          category: 'Sports',
          sourcePlatform: 'fixture-supplier',
          supplierCostMinor: 2000,
          shippingCostMinor: 500,
          targetPriceMinor: 5600,
          marketplaceFeeMinor: 800,
          paymentFeeMinor: 200,
          adAllocationMinor: 0,
          returnReserveMinor: 0,
          currency: 'USD',
          inventoryQuantity: 10,
          rating: 3,
          reviewCount: 5,
          dataConfidence: 0.5,
          dataFreshnessAt: new Date().toISOString(),
        },
      ],
      ctx: {
        organizationId: 'org',
        loopMode: 'shadow',
        permissions: ['*'],
        deps: {},
      },
    });

    assert.ok(result.plan.steps.length >= 5);
    assert.ok(result.critic);
    assert.ok(result.auditor);
    assert.ok(['accept', 'revise', 'downgrade', 'block', 'escalate'].includes(result.decision));
    // Weapon SKU must not be recommended
    assert.ok(!result.recommendations.some((r) => r.title.toLowerCase().includes('weapon')));
    // Drafts require approval in shadow
    assert.ok(result.recommendations.every((r) => r.approvalRequired));
  });
});
