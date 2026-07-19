import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { validateSynthesisPayload } from '../schemas/base-response';
import { redactSecrets } from '../telemetry/redaction';
import { resolveAIProvider } from '../provider/resolve-provider';

describe('Cohere runtime foundations', () => {
  it('redacts API key-like strings', () => {
    const s = redactSecrets('COHERE_API_KEY=abcdefg1234567890 and sk-proj-ABCDEFGHIJKLMNOP');
    assert.ok(!s.includes('abcdefg1234567890'));
    assert.ok(s.includes('[REDACTED]') || s.includes('[REDACTED_API_KEY]'));
  });

  it('validates synthesis payload', () => {
    const ok = validateSynthesisPayload({
      text: 'Hello',
      artifactType: 'answer',
      artifact: {},
      confidence: 1,
      objectiveTitle: 'Greeting',
      objectiveDescription: 'Hi',
      successCriteria: [],
      intentCategory: 'general',
      informationMode: 'no_search',
      warnings: [],
    });
    assert.equal(ok.ok, true);
    // Code-owned schema repair: partial payloads with text are coerced (not fail-open invent)
    const coerced = validateSynthesisPayload({ text: 'partial answer from model' });
    assert.equal(coerced.ok, true);
    assert.equal(coerced.value?.artifactType, 'answer');
    // Completely empty still fails
    const bad = validateSynthesisPayload(null);
    assert.equal(bad.ok, false);
    const empty = validateSynthesisPayload({});
    assert.equal(empty.ok, false);
  });

  it('resolves cohere when key present', () => {
    const p = resolveAIProvider({
      AI_PROVIDER: 'cohere',
      COHERE_API_KEY: 'test-key-not-real',
    });
    assert.equal(p.id, 'cohere');
    assert.equal(p.configured, true);
  });

  it('fails closed when cohere key missing', () => {
    const p = resolveAIProvider({
      AI_PROVIDER: 'cohere',
      COHERE_API_KEY: '',
      OPENAI_API_KEY: '',
      XAI_API_KEY: '',
    });
    assert.equal(p.id, 'cohere');
    assert.equal(p.configured, false);
  });
});
