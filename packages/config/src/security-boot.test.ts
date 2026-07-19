import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  evaluateSecurityBoot,
  isPublicNetworkBind,
  isWeakAppSecret,
} from './security-boot';

describe('security boot', () => {
  it('flags public bind', () => {
    assert.equal(isPublicNetworkBind('0.0.0.0'), true);
    assert.equal(isPublicNetworkBind('127.0.0.1'), false);
    assert.equal(isPublicNetworkBind('localhost'), false);
  });

  it('rejects founder_direct on 0.0.0.0 without opt-in', () => {
    const r = evaluateSecurityBoot({
      TRADEOPS_ACCESS_MODE: 'founder_direct',
      API_HOST: '0.0.0.0',
      APP_SECRET: 'a'.repeat(40),
      CREDENTIALS_MASTER_KEY: Buffer.alloc(32).toString('base64'),
    });
    assert.equal(r.ok, false);
    assert.ok(r.errors.some((e) => e.includes('INSECURE')));
  });

  it('allows founder_direct on loopback', () => {
    const r = evaluateSecurityBoot({
      TRADEOPS_ACCESS_MODE: 'founder_direct',
      API_HOST: '127.0.0.1',
      APP_SECRET: 'a'.repeat(40),
      CREDENTIALS_MASTER_KEY: Buffer.from('x'.repeat(32)).toString('base64'),
    });
    assert.equal(r.ok, true);
    assert.equal(r.mode, 'locked_local');
  });

  it('detects weak app secret', () => {
    assert.equal(isWeakAppSecret('dev-only-change-me-to-a-long-random-string'), true);
    assert.equal(isWeakAppSecret('x'.repeat(48)), false);
  });
});
