import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { isAuthBypassEnabled, loadEnv, resetEnvCache } from './index';

describe('loadEnv', () => {
  afterEach(() => {
    resetEnvCache();
  });

  it('applies safe development defaults', () => {
    const env = loadEnv({ NODE_ENV: 'development' });
    assert.equal(env.API_PORT, 4000);
    assert.match(env.DATABASE_URL, /postgresql:\/\//);
    assert.match(env.REDIS_URL, /redis:\/\//);
    assert.equal(env.AUTH_BYPASS, true);
  });

  it('coerces numeric ports from strings', () => {
    const env = loadEnv({ API_PORT: '4100', WEB_PORT: '3100' });
    assert.equal(env.API_PORT, 4100);
    assert.equal(env.WEB_PORT, 3100);
  });

  it('parses AUTH_BYPASS from common string forms', () => {
    assert.equal(loadEnv({ AUTH_BYPASS: 'false' }).AUTH_BYPASS, false);
    resetEnvCache();
    assert.equal(loadEnv({ AUTH_BYPASS: '0' }).AUTH_BYPASS, false);
    resetEnvCache();
    assert.equal(loadEnv({ AUTH_BYPASS: 'true' }).AUTH_BYPASS, true);
  });
});

describe('isAuthBypassEnabled', () => {
  afterEach(() => {
    resetEnvCache();
  });

  it('is on in development by default', () => {
    const env = loadEnv({ NODE_ENV: 'development' });
    assert.equal(isAuthBypassEnabled(env), true);
  });

  it('never enables bypass in production', () => {
    const env = loadEnv({ NODE_ENV: 'production', AUTH_BYPASS: 'true' });
    assert.equal(isAuthBypassEnabled(env), false);
  });
});
