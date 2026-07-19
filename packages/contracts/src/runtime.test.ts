import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CORE_WIRING_MATRIX,
  STANDARD_EVENT_TYPES,
  buildDomainEvent,
  dataModeFromPlatform,
  wrapEnvelope,
} from './runtime';

describe('runtime contract', () => {
  it('wraps responses with dataMode and ids', () => {
    const env = wrapEnvelope({
      tenantId: 'org-1',
      data: { ok: true },
      state: 'completed',
      dataMode: 'fixture',
      text: 'done',
    });
    assert.equal(env.meta.tenantId, 'org-1');
    assert.equal(env.meta.dataMode, 'fixture');
    assert.ok(env.meta.requestId.length > 8);
    assert.equal(env.data.ok, true);
  });

  it('maps fixture platforms to fixture dataMode', () => {
    assert.equal(dataModeFromPlatform('fixture-supplier'), 'fixture');
    assert.equal(dataModeFromPlatform('shopify'), 'live');
  });

  it('builds domain events with correlation fields', () => {
    const e = buildDomainEvent({
      eventType: 'CommerceCaseAdvanced',
      tenantId: 'org-1',
      entityId: 'case-1',
      entityType: 'commerce_case',
      dataMode: 'fixture',
      payload: { from: 'discover', to: 'evaluate' },
    });
    assert.equal(e.eventType, 'CommerceCaseAdvanced');
    assert.ok(e.correlationId);
    assert.ok(e.traceId);
    assert.equal(e.schemaVersion, '1.0.0');
  });

  it('wiring matrix has no decorative rows without status', () => {
    assert.ok(CORE_WIRING_MATRIX.length >= 10);
    for (const row of CORE_WIRING_MATRIX) {
      assert.ok(row.uiAction);
      assert.ok(row.route);
      assert.ok(['wired', 'partial', 'blocked', 'decorative_removed'].includes(row.status));
    }
  });

  it('standard event catalog is non-empty', () => {
    assert.ok(STANDARD_EVENT_TYPES.includes('AIObjectiveCompleted'));
    assert.ok(STANDARD_EVENT_TYPES.includes('ListingPublished'));
  });
});
