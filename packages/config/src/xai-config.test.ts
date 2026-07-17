import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getXaiConfig,
  resolveAiMode,
  shouldDefaultGenerate,
  shouldUseXai,
  xaiPublicStatus,
} from './xai-config';

describe('xai config', () => {
  it('auto resolves to tools_only without key', () => {
    const env = { TRADEOPS_AI_MODE: 'auto' } as NodeJS.ProcessEnv;
    assert.equal(resolveAiMode(env), 'tools_only');
    assert.equal(shouldUseXai(env), false);
    assert.equal(shouldDefaultGenerate(env), false);
  });

  it('auto resolves to xai_rag with key', () => {
    const env = {
      TRADEOPS_AI_MODE: 'auto',
      XAI_API_KEY: 'xai-test-key',
    } as NodeJS.ProcessEnv;
    assert.equal(resolveAiMode(env), 'xai_rag');
    assert.equal(shouldUseXai(env), true);
    assert.equal(shouldDefaultGenerate(env), true);
  });

  it('xai_disabled wins even with key', () => {
    const env = {
      TRADEOPS_AI_MODE: 'xai_disabled',
      XAI_API_KEY: 'xai-test-key',
    } as NodeJS.ProcessEnv;
    assert.equal(resolveAiMode(env), 'xai_disabled');
    assert.equal(shouldUseXai(env), false);
  });

  it('xai_rag_tools requires key else tools_only', () => {
    assert.equal(
      resolveAiMode({ TRADEOPS_AI_MODE: 'xai_rag_tools' } as NodeJS.ProcessEnv),
      'tools_only',
    );
    assert.equal(
      resolveAiMode({
        TRADEOPS_AI_MODE: 'xai_rag_tools',
        XAI_API_KEY: 'k',
      } as NodeJS.ProcessEnv),
      'xai_rag_tools',
    );
  });

  it('public status never includes api key', () => {
    const st = xaiPublicStatus({
      XAI_API_KEY: 'secret-should-not-leak',
      XAI_CHAT_MODEL: 'grok-4.5',
    } as NodeJS.ProcessEnv);
    assert.equal(st.configured, true);
    assert.equal(st.provider, 'xai');
    assert.equal(st.chatModel, 'grok-4.5');
    assert.ok(!JSON.stringify(st).includes('secret-should-not-leak'));
  });

  it('getXaiConfig defaults base URL and model', () => {
    const c = getXaiConfig({ XAI_API_KEY: 'k' } as NodeJS.ProcessEnv);
    assert.equal(c.baseUrl, 'https://api.x.ai/v1');
    assert.equal(c.chatModel, 'grok-4.5');
    assert.equal(c.provider, 'xai');
  });

  it('TRADEOPS_AI_DEFAULT_GENERATE=0 disables default generate', () => {
    const env = {
      XAI_API_KEY: 'k',
      TRADEOPS_AI_DEFAULT_GENERATE: '0',
    } as NodeJS.ProcessEnv;
    assert.equal(shouldDefaultGenerate(env), false);
  });
});
