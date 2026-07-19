import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { listIndustrialVerticals } from './industrial-domains';
import {
  emptyIndustrialProfile,
  industrialProfileFromProduct,
  rankSubstituteParts,
  scoreIndustrialCompleteness,
} from './industrial-product';
import {
  compareQuotations,
  evaluateProcurementCase,
  matchRequirements,
  parseTechnicalRequirementsFromText,
} from './procurement-engine';
import { buildDigitalTwin, twinNeighborhood } from './digital-twin';
import { listIndustrialRoles } from './industrial-personas';

describe('industrial domains', () => {
  it('lists major industrial verticals', () => {
    const v = listIndustrialVerticals();
    assert.ok(v.length >= 15);
    assert.ok(v.some((x) => x.id === 'automotive_parts'));
    assert.ok(v.some((x) => x.id === 'oil_gas'));
  });
});

describe('industrial product', () => {
  it('extracts profile from product attributesJson', () => {
    const p = industrialProfileFromProduct({
      manufacturer: 'Acme Hydraulics',
      brand: 'Acme',
      countryOfOrigin: 'DE',
      inventoryQuantity: 12,
      supplierCostMinor: 5000,
      targetPriceMinor: 8900,
      currency: 'USD',
      externalId: 'SKU-1',
      attributesJson: {
        industrial: {
          oemPartNumber: 'OEM-99',
          manufacturerPartNumber: 'MPN-99',
          technicalSpecifications: [{ key: 'pressure', value: '3000', unit: 'psi' }],
          moq: 5,
          leadTimeDays: 21,
        },
      },
    });
    assert.equal(p.schemaVersion, 'industrial-v1');
    assert.equal(p.oemPartNumber, 'OEM-99');
    assert.equal(p.manufacturer, 'Acme Hydraulics');
    assert.equal(p.moq, 5);
    const score = scoreIndustrialCompleteness(p);
    assert.ok(score.score >= 40);
  });

  it('ranks substitutes by shared specs', () => {
    const target = emptyIndustrialProfile({
      manufacturer: 'Acme',
      manufacturerPartNumber: 'H-3000-A',
      technicalSpecifications: [
        { key: 'pressure', value: '3000', unit: 'psi' },
        { key: 'port', value: '1/2 NPT' },
      ],
    });
    const ranked = rankSubstituteParts(target, [
      {
        productId: 'p2',
        title: 'Compat valve',
        profile: emptyIndustrialProfile({
          manufacturer: 'Acme',
          manufacturerPartNumber: 'H-3000-B',
          technicalSpecifications: [
            { key: 'pressure', value: '3000', unit: 'psi' },
            { key: 'port', value: '1/2 NPT' },
          ],
        }),
      },
      {
        productId: 'p3',
        title: 'Unrelated',
        profile: emptyIndustrialProfile({
          manufacturer: 'Other',
          technicalSpecifications: [{ key: 'color', value: 'blue' }],
        }),
      },
    ]);
    assert.ok(ranked[0]?.productId === 'p2');
    assert.ok(ranked[0]!.score > 0);
  });
});

describe('procurement engine', () => {
  it('parses free-text technical requirements', () => {
    const reqs = parseTechnicalRequirementsFromText(
      'Need 24V IP67 sensor pressure 3000 psi lead time under 30 days stainless',
    );
    assert.ok(reqs.some((r) => r.key === 'voltage' && String(r.value) === '24'));
    assert.ok(reqs.some((r) => r.key === 'ip' && String(r.value) === '67'));
    assert.ok(reqs.some((r) => r.key === 'pressure'));
    assert.ok(reqs.some((r) => r.key === 'leadTimeDays'));
    assert.ok(reqs.some((r) => r.key === 'material'));
  });

  it('matches requirements and compares quotes', () => {
    const profile = emptyIndustrialProfile({
      technicalSpecifications: [
        { key: 'voltage', value: '24', unit: 'V' },
        { key: 'ip', value: '67' },
      ],
      costMinor: 1000,
      listPriceMinor: 2000,
      currency: 'USD',
    });
    const fit = matchRequirements(profile, [
      { key: 'voltage', operator: 'eq', value: '24', required: true },
      { key: 'ip', operator: 'eq', value: '67', required: true },
    ]);
    assert.equal(fit.matched, 2);

    const quotes = compareQuotations(
      [
        {
          supplierName: 'FastCo',
          unitCostMinor: 1200,
          currency: 'USD',
          leadTimeDays: 10,
          moq: 1,
          shippingMinor: 200,
        },
        {
          supplierName: 'SlowCo',
          unitCostMinor: 900,
          currency: 'USD',
          leadTimeDays: 90,
          moq: 100,
          shippingMinor: 500,
        },
      ],
      10,
    );
    assert.ok(quotes.length === 2);
    assert.ok(quotes[0]!.score >= 0);

    const evaluation = evaluateProcurementCase({
      productId: 'p1',
      title: 'Sensor',
      profile,
      requirements: [{ key: 'voltage', operator: 'eq', value: '24' }],
      quotes: [
        {
          supplierName: 'FastCo',
          unitCostMinor: 1200,
          currency: 'USD',
          leadTimeDays: 10,
          moq: 1,
        },
      ],
      quantity: 5,
    });
    assert.ok(evaluation.action.action);
    assert.ok(evaluation.rfq.status === 'draft');
    assert.match(evaluation.honesty.note, /approval/i);
  });
});

describe('digital twin', () => {
  it('builds graph and neighborhood', () => {
    const twin = buildDigitalTwin({
      organizationId: 'org-1',
      products: [
        {
          id: 'p1',
          title: 'Pump',
          inventoryQuantity: 3,
          manufacturer: 'Acme',
          sourcePlatform: 'fixture-supplier',
        },
      ],
      suppliers: [{ id: 's1', name: 'Supplier A', sourcePlatform: 'fixture-supplier' }],
      offers: [{ productId: 'p1', supplierId: 's1' }],
      artifacts: [{ id: 'a1', productId: 'p1', title: 'Manual' }],
    });
    assert.ok(twin.nodes.length >= 3);
    assert.ok(twin.summary.fixtureNodes >= 1);
    const nb = twinNeighborhood(twin, 'product:p1', 1);
    assert.ok(nb.nodes.some((n) => n.id === 'product:p1'));
    assert.ok(nb.edges.length >= 1);
  });
});

describe('industrial personas', () => {
  it('exposes ten role surfaces', () => {
    const roles = listIndustrialRoles();
    assert.equal(roles.length, 10);
    assert.ok(roles.some((r) => r.id === 'procurement'));
    assert.ok(roles.some((r) => r.id === 'engineering'));
  });
});
