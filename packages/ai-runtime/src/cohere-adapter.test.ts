import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildCohereChatV2Body,
  classifyCohereHttpError,
  diagnoseCohereConfig,
  resolveCohereApiKey,
  cohereChatModel,
} from './cohere-adapter';
import { resolveProviderFromEnv } from './provider-abstraction';

describe('Cohere adapter configuration', () => {
  it('rejects missing and whitespace-only keys', () => {
    assert.equal(resolveCohereApiKey({} as NodeJS.ProcessEnv), undefined);
    assert.equal(resolveCohereApiKey({ COHERE_API_KEY: '' } as NodeJS.ProcessEnv), undefined);
    assert.equal(resolveCohereApiKey({ COHERE_API_KEY: '   ' } as NodeJS.ProcessEnv), undefined);
    assert.equal(
      resolveCohereApiKey({ COHERE_API_KEY: '  real-key  ' } as NodeJS.ProcessEnv),
      'real-key',
    );
    assert.equal(
      resolveCohereApiKey({ CO_API_KEY: 'alt' } as NodeJS.ProcessEnv),
      'alt',
    );
  });

  it('defaults chat model to command-a-plus-05-2026', () => {
    assert.equal(cohereChatModel({} as NodeJS.ProcessEnv), 'command-a-plus-05-2026');
    assert.equal(
      cohereChatModel({ COHERE_CHAT_MODEL: 'custom-model' } as NodeJS.ProcessEnv),
      'custom-model',
    );
  });

  it('resolveProviderFromEnv ignores empty Cohere key', () => {
    assert.equal(
      resolveProviderFromEnv({ COHERE_API_KEY: '  ', AI_PROVIDER: 'cohere' } as NodeJS.ProcessEnv),
      'none',
    );
    assert.equal(
      resolveProviderFromEnv({ COHERE_API_KEY: 'k', AI_PROVIDER: 'cohere' } as NodeJS.ProcessEnv),
      'cohere',
    );
  });

  it('diagnoseCohereConfig reports COHERE_KEY_MISSING without a key', () => {
    const d = diagnoseCohereConfig({} as NodeJS.ProcessEnv);
    assert.equal(d.configured, false);
    assert.equal(d.errorCode, 'COHERE_KEY_MISSING');
    assert.equal(d.model, 'command-a-plus-05-2026');
    assert.equal(d.keyLength, 0);
  });

  it('classifies HTTP errors into stable codes', () => {
    assert.equal(classifyCohereHttpError(401, 'unauthorized'), 'COHERE_KEY_INVALID');
    assert.equal(classifyCohereHttpError(403, 'forbidden'), 'COHERE_KEY_INVALID');
    assert.equal(classifyCohereHttpError(429, 'rate'), 'COHERE_RATE_LIMITED');
    assert.equal(classifyCohereHttpError(404, 'model not found'), 'COHERE_MODEL_INVALID');
    assert.equal(classifyCohereHttpError(400, 'invalid schema'), 'COHERE_SCHEMA_INVALID');
    assert.equal(classifyCohereHttpError(503, 'down'), 'COHERE_PROVIDER_UNAVAILABLE');
  });

  it('buildCohereChatV2Body uses json_object when schemaId set', () => {
    const body = buildCohereChatV2Body(
      {
        prompt: 'Brief this run',
        schemaId: 'operator_briefing',
        temperature: 0.2,
      },
      { COHERE_CHAT_MODEL: 'command-a-plus-05-2026' } as NodeJS.ProcessEnv,
    );
    assert.equal(body.model, 'command-a-plus-05-2026');
    const rf = body.response_format as { type: string; schema?: { required?: string[] } };
    assert.equal(rf.type, 'json_object');
    assert.ok(Array.isArray(rf.schema?.required));
    assert.ok(rf.schema!.required!.includes('narrative'));
    const messages = body.messages as Array<{ role: string; content: string }>;
    assert.ok(messages.some((m) => /json/i.test(m.content)));
  });

  it('buildCohereChatV2Body does not set strict_tools for Phase B synthesis', () => {
    const body = buildCohereChatV2Body(
      { prompt: 'hello', schemaId: 'operator_briefing' },
      {} as NodeJS.ProcessEnv,
    );
    assert.equal(body.strict_tools, undefined);
  });
});
