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
    assert.equal(env.TRADEOPS_ACCESS_MODE, 'founder_direct');
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

  it('parses TRADEOPS_ACCESS_MODE', () => {
    assert.equal(
      loadEnv({ TRADEOPS_ACCESS_MODE: 'authenticated' }).TRADEOPS_ACCESS_MODE,
      'authenticated',
    );
  });
});

describe('isAuthBypassEnabled', () => {
  afterEach(() => {
    resetEnvCache();
  });

  it('is on in development by default (founder_direct)', () => {
    const env = loadEnv({ NODE_ENV: 'development' });
    assert.equal(isAuthBypassEnabled(env), true);
  });

  it('legacy AUTH_BYPASS alone is off in production when mode is authenticated', () => {
    const env = loadEnv({
      NODE_ENV: 'production',
      AUTH_BYPASS: 'true',
      TRADEOPS_ACCESS_MODE: 'authenticated',
    });
    assert.equal(isAuthBypassEnabled(env), false);
  });

  it('founder_direct enables identity in production for private founder deploy', () => {
    const env = loadEnv({
      NODE_ENV: 'production',
      AUTH_BYPASS: 'false',
      TRADEOPS_ACCESS_MODE: 'founder_direct',
    });
    assert.equal(isAuthBypassEnabled(env), true);
  });
});

