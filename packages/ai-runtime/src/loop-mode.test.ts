import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  detectLiveCredentialHints,
  detectOperatorLiveCredentials,
  resolveLoopMode,
} from './tool-registry';

describe('resolveLoopMode', () => {
  it('defaults to development when nothing forced', () => {
    assert.equal(resolveLoopMode({}), 'development');
    assert.equal(resolveLoopMode(), 'development');
  });

  it('forceShadow is opt-in only', () => {
    assert.equal(resolveLoopMode({ forceShadow: false }), 'development');
    assert.equal(resolveLoopMode({ forceShadow: true }), 'shadow');
  });

  it('forceFixture wins over shadow', () => {
    assert.equal(
      resolveLoopMode({ forceFixture: true, forceShadow: true }),
      'fixture',
    );
  });

  it('controlled_live requires credentials + flag', () => {
    assert.equal(
      resolveLoopMode({
        controlledLiveEnabled: true,
        hasLiveCredentials: false,
      }),
      'development',
    );
    assert.equal(
      resolveLoopMode({
        controlledLiveEnabled: true,
        hasLiveCredentials: true,
      }),
      'controlled_live',
    );
  });

  it('hasLiveCredentials alone stays development (not controlled_live)', () => {
    assert.equal(
      resolveLoopMode({ hasLiveCredentials: true }),
      'development',
    );
  });
});

describe('detectLiveCredentialHints', () => {
  it('false when empty env', () => {
    const r = detectLiveCredentialHints({} as NodeJS.ProcessEnv);
    assert.equal(r.hasLiveCredentials, false);
    assert.equal(detectOperatorLiveCredentials({} as NodeJS.ProcessEnv), false);
  });

  it('true when Cohere or Tavily present', () => {
    assert.equal(
      detectOperatorLiveCredentials({
        COHERE_API_KEY: 'x',
      } as NodeJS.ProcessEnv),
      true,
    );
    assert.equal(
      detectOperatorLiveCredentials({
        TAVILY_API_KEY: 't',
      } as NodeJS.ProcessEnv),
      true,
    );
  });

  it('Google requires both token and merchant id', () => {
    assert.equal(
      detectOperatorLiveCredentials({
        GOOGLE_MERCHANT_ACCESS_TOKEN: 'tok',
      } as NodeJS.ProcessEnv),
      false,
    );
    assert.equal(
      detectOperatorLiveCredentials({
        GOOGLE_MERCHANT_ACCESS_TOKEN: 'tok',
        GOOGLE_MERCHANT_ID: 'id-1',
      } as NodeJS.ProcessEnv),
      true,
    );
  });
});
