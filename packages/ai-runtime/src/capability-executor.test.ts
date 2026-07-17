import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  invokeCapability,
  suggestCapabilitiesForObjective,
  xaiToolNameToCapability,
} from './capability-executor';

describe('Capability executor', () => {
  it('maps xAI tool names to capabilities', () => {
    assert.equal(xaiToolNameToCapability('research_web_search'), 'research.web_search');
    assert.equal(xaiToolNameToCapability('commerce_get_orders'), 'commerce.get_orders');
  });

  it('suggests research + commerce for market product questions', () => {
    const caps = suggestCapabilitiesForObjective(
      'Find high-demand BMW M240i performance parts we could sell',
    );
    assert.ok(caps.includes('research.web_search'));
  });

  it('blocks inventing operational data without context', async () => {
    const r = await invokeCapability({
      capability: 'commerce.get_orders',
      tenantId: 't1',
      parameters: { dateFrom: '2026-07-01' },
    });
    assert.equal(r.ok, false);
    assert.equal(r.data.error, 'operational_data_required');
    assert.ok(
      r.warnings.some((w) => /operational|adapter|authenticated/i.test(w)) ||
        String(r.data.message ?? '').includes('connector'),
    );
  });

  it('returns operational slice from context', async () => {
    const r = await invokeCapability({
      capability: 'commerce.get_orders',
      tenantId: 't1',
      operationalContext: {
        orders: [{ id: 'o1', total: 120 }],
      },
    });
    assert.equal(r.ok, true);
    assert.equal(r.evidence[0]?.sourceType, 'connector');
  });

  it('queues write capabilities for approval', async () => {
    const r = await invokeCapability({
      capability: 'payments.issue_refund',
      tenantId: 't1',
      parameters: { paymentId: 'pay_1', amount: 10 },
    });
    assert.equal(r.ok, true);
    assert.equal(r.write, true);
    assert.equal(r.actions[0]?.status, 'awaiting_approval');
    assert.equal(r.actions[0]?.requiresApproval, true);
  });
});
