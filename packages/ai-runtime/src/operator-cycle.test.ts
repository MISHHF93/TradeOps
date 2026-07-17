import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { registerBuiltinTools } from './builtin-tools';
import {
  classifyObjective,
  parseObjective,
  runOperatorCycle,
} from './operator-cycle';
import {
  evaluateExampleReadiness,
  getLiveExample,
  listLiveExamples,
} from './live-examples';
import { listToolsPublic } from './tool-registry';

const waterBottle = {
  productId: 'p1',
  title: 'Insulated Stainless Water Bottle 32oz',
  description: 'BPA-free travel bottle',
  category: 'Home',
  sourcePlatform: 'fixture-supplier',
  supplierCostMinor: 940,
  shippingCostMinor: 420,
  targetPriceMinor: 3499,
  marketplaceFeeMinor: 610,
  paymentFeeMinor: 120,
  adAllocationMinor: 200,
  returnReserveMinor: 80,
  currency: 'USD',
  inventoryQuantity: 100,
  rating: 4.6,
  reviewCount: 250,
  dataConfidence: 0.85,
  dataFreshnessAt: new Date().toISOString(),
  opportunityScore: 82,
};

const weapon = {
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
};

describe('AI operator cycle', () => {
  registerBuiltinTools();

  it('classifies research objective as READ_ONLY_ANALYSIS without approval', () => {
    const c = classifyObjective('Find products worth evaluating.');
    assert.equal(c.objectiveType, 'READ_ONLY_ANALYSIS');
    assert.equal(c.approvalRequired, false);
    assert.equal(c.riskClass, 'read_only');
    assert.ok((c.filters.minMarginBps ?? 0) >= 2000);
  });

  it('parses Canada / $20 cost / 25% margin / three products objective', () => {
    const c = classifyObjective(
      'Find three products under $20 supplier cost that could sell in Canada with at least a 25% expected margin.',
    );
    assert.equal(c.objectiveType, 'READ_ONLY_ANALYSIS');
    assert.equal(c.approvalRequired, false);
    assert.equal(c.filters.topN, 3);
    assert.equal(c.filters.minMarginBps, 2500);
    assert.equal(c.filters.maxSupplierCostMinor, 2000);
    assert.equal(c.filters.targetMarket, 'CA');
  });

  it('classifies publish objective as requiring approval', () => {
    const c = classifyObjective('Publish listing for water bottle to marketplace');
    assert.equal(c.objectiveType, 'PUBLISH_LISTING');
    assert.equal(c.approvalRequired, true);
  });

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
    assert.ok(tools.some((t) => t.name === 'forecastDemand'));
    assert.ok(tools.every((t) => t.actionClass !== 'prohibited' || t.approvalRequired));
  });

  it('forecastDemand tool returns baseline-ma-v2 and empty-history honesty', async () => {
    const { getTool } = await import('./tool-registry');
    const tool = getTool('forecastDemand');
    assert.ok(tool);
    const empty = (await tool!.execute(
      { observations: '[]', horizonDays: 14 },
      {
        organizationId: 'org',
        loopMode: 'shadow',
        permissions: ['analytics:read', 'ai:read'],
        deps: {},
      },
    )) as { expectedUnits: number; modelVersion: string; confidence: number };
    assert.equal(empty.expectedUnits, 0);
    assert.equal(empty.modelVersion, 'baseline-ma-v2');
    assert.ok(empty.confidence <= 0.2);

    const withHist = (await tool!.execute(
      {
        observations: JSON.stringify(
          Array.from({ length: 14 }, (_, i) => ({
            date: `2026-06-${String(i + 1).padStart(2, '0')}`,
            units: 10,
          })),
        ),
        horizonDays: 7,
      },
      {
        organizationId: 'org',
        loopMode: 'shadow',
        permissions: ['analytics:read', 'ai:read'],
        deps: {},
      },
    )) as { expectedUnits: number; modelVersion: string };
    assert.ok(withHist.expectedUnits > 0);
    assert.equal(withHist.modelVersion, 'baseline-ma-v2');
  });

  it('read-only evaluate returns ranked products without approval', async () => {
    const result = await runOperatorCycle({
      objective: 'Find products worth evaluating.',
      loopMode: 'shadow',
      products: [waterBottle, weapon],
      ctx: {
        organizationId: 'org',
        loopMode: 'shadow',
        permissions: ['*'],
        deps: {},
      },
    });

    assert.equal(result.objectiveType, 'READ_ONLY_ANALYSIS');
    assert.equal(result.approvalRequired, false);
    assert.equal(result.decision, 'accept');
    assert.ok(result.timeline.length >= 5);
    assert.ok(result.responseSummary.length > 10);
    assert.ok(result.recommendations.length >= 1);
    assert.ok(result.recommendations.every((r) => r.approvalRequired === false));
    assert.ok(result.recommendations.every((r) => r.actionClass === 'read_only'));
    assert.ok(result.recommendations.every((r) => r.productCard != null));
    // Weapon SKU must not be recommended
    assert.ok(!result.recommendations.some((r) => r.title.toLowerCase().includes('weapon')));
    // Title is product name, not "Prepare listing draft"
    assert.ok(
      result.recommendations.some((r) => r.title.includes('Water Bottle')),
    );
  });

  it('draft listing objective may propose drafts but weapon still blocked', async () => {
    const result = await runOperatorCycle({
      objective:
        'Find products with margin above 15% and low policy risk. Prepare strongest listings.',
      loopMode: 'shadow',
      products: [waterBottle, weapon],
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
    assert.ok(!result.recommendations.some((r) => r.title.toLowerCase().includes('weapon')));
  });

  it('live examples catalog includes Canadian scan as runnable', () => {
    const list = listLiveExamples();
    assert.ok(list.length >= 5);
    const ca = getLiveExample('canadian-product-opportunity-scan');
    assert.ok(ca);
    assert.equal(ca!.runnable, true);
    assert.equal(ca!.riskClass, 'read_only');
    const ready = evaluateExampleReadiness(ca!, {
      connectors: [
        {
          providerKey: 'fixture-supplier',
          status: 'connected',
          isFixture: true,
        },
      ],
      productCount: 5,
    });
    assert.equal(ready.readiness, 'partially_ready');
    assert.ok(ready.fixtureConnectorCount >= 1);
  });

  it('empty product store returns clear empty message', async () => {
    const result = await runOperatorCycle({
      objective: 'Find products worth evaluating.',
      loopMode: 'shadow',
      products: [],
      ctx: {
        organizationId: 'org',
        loopMode: 'shadow',
        permissions: ['*'],
        deps: {},
      },
    });
    assert.equal(result.recommendations.length, 0);
    assert.ok(/could not search|no product/i.test(result.responseSummary));
    assert.equal(result.candidateStats.retrieved, 0);
  });
});
