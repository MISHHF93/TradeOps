import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildEnvelope, validateObjectivePayload } from './response-envelope';

describe('TradeOps AI response envelope', () => {
  it('builds text+json envelope', () => {
    const env = buildEnvelope({
      tenantId: 't1',
      text: 'Hello',
      json: { objective: 'test', recommendations: [], confidence: 0.9, sources: [] },
      confidence: 0.9,
    });
    assert.equal(env.output.text, 'Hello');
    assert.equal(env.tenantId, 't1');
    assert.ok(env.requestId.startsWith('req_'));
    assert.equal(env.status, 'completed');
  });

  it('validates objective payload', () => {
    const ok = validateObjectivePayload({
      text: 'Answer',
      objective: 'Find parts',
      recommendations: [{ title: 'A', reason: 'B', score: 1 }],
      confidence: 0.8,
      sources: [{ provider: 'tavily', sourceType: 'web' }],
    });
    assert.equal(ok.ok, true);
    const bad = validateObjectivePayload({ text: 'only' });
    assert.equal(bad.ok, false);
  });
});
