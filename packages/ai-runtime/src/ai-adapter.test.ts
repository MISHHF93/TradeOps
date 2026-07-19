import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getAiAdapter, listAiAdaptersPublic } from './ai-adapter';

describe('AI Adapter', () => {
  it('defaults to OpenAI when AI_PROVIDER unset and no keys', () => {
    const adapter = getAiAdapter({
      AI_PROVIDER: 'openai',
      OPENAI_API_KEY: '',
      XAI_API_KEY: '',
    });
    assert.equal(adapter.id, 'openai');
    assert.equal(adapter.configured, false);
  });

  it('selects OpenAI when key present', () => {
    const adapter = getAiAdapter({
      AI_PROVIDER: 'openai',
      OPENAI_API_KEY: 'sk-test',
    });
    assert.equal(adapter.id, 'openai');
    assert.equal(adapter.configured, true);
  });

  it('selects xAI when AI_PROVIDER=xai and key present', () => {
    const adapter = getAiAdapter({
      AI_PROVIDER: 'xai',
      XAI_API_KEY: 'xai-test',
      OPENAI_API_KEY: '',
    });
    assert.equal(adapter.id, 'xai');
    assert.equal(adapter.configured, true);
  });

  it('falls back to xAI when OpenAI primary but only xAI key set', () => {
    const adapter = getAiAdapter({
      AI_PROVIDER: 'openai',
      OPENAI_API_KEY: '',
      XAI_API_KEY: 'xai-test',
    });
    assert.equal(adapter.id, 'xai');
  });

  it('lists adapters without secrets', () => {
    const pub = listAiAdaptersPublic({
      AI_PROVIDER: 'openai',
      OPENAI_API_KEY: 'sk-test',
    });
    assert.equal(pub.active, 'openai');
    assert.ok(pub.adapters.some((a) => a.id === 'openai'));
    assert.ok(pub.interface.includes('generate'));
  });
});
