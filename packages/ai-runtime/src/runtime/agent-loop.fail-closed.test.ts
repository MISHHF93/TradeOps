import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { runCohereAgentLoop } from './agent-loop';

describe('agent loop fail-closed (no demo success)', () => {
  it('missing tenant returns blocked, not completed', async () => {
    const res = await runCohereAgentLoop({
      message: 'Hi',
      tenantId: '',
    });
    assert.equal(res.status, 'blocked');
    assert.notEqual(res.status, 'completed');
    assert.equal(res.dataMode, 'unavailable');
    assert.ok(res.errorCode);
    assert.equal(res.confidence, 0);
    assert.equal(res.evidence.length, 0);
  });

  it('missing Cohere key returns blocked with requiredAction (no demo body)', async () => {
    const prev = process.env.COHERE_API_KEY;
    const prevProv = process.env.AI_PROVIDER;
    try {
      delete process.env.COHERE_API_KEY;
      delete process.env.OPENAI_API_KEY;
      delete process.env.XAI_API_KEY;
      process.env.AI_PROVIDER = 'cohere';
      const res = await runCohereAgentLoop({
        message: 'Hi',
        tenantId: 'org_test',
      });
      assert.equal(res.status, 'blocked');
      assert.equal(res.dataMode, 'unavailable');
      assert.equal(res.errorCode, 'AI_PROVIDER_NOT_CONFIGURED');
      assert.ok(res.requiredAction?.includes('COHERE_API_KEY') || res.output.text.includes('COHERE'));
      assert.ok(!/here are (some|three) recommendations/i.test(res.output.text));
      assert.ok(res.provenance.dataMode === 'unavailable');
    } finally {
      if (prev === undefined) delete process.env.COHERE_API_KEY;
      else process.env.COHERE_API_KEY = prev;
      if (prevProv === undefined) delete process.env.AI_PROVIDER;
      else process.env.AI_PROVIDER = prevProv;
    }
  });

  it('disabled AI runtime returns blocked', async () => {
    const prev = process.env.AI_RUNTIME_ENABLED;
    try {
      process.env.AI_RUNTIME_ENABLED = 'false';
      const res = await runCohereAgentLoop({
        message: 'Show inventory',
        tenantId: 'org_test',
      });
      assert.equal(res.status, 'blocked');
      assert.equal(res.errorCode, 'AI_RUNTIME_DISABLED');
    } finally {
      if (prev === undefined) delete process.env.AI_RUNTIME_ENABLED;
      else process.env.AI_RUNTIME_ENABLED = prev;
    }
  });
});
