import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hashPassword, verifyPassword } from './password';
import { generateSessionToken, hashSessionToken } from './session-token';
import { SESSION_COOKIE_NAME, buildSessionCookieOptions } from './cookie';

describe('password hashing', () => {
  it('hashes and verifies a password', async () => {
    const hash = await hashPassword('correct-horse-battery');
    assert.equal(await verifyPassword('correct-horse-battery', hash), true);
    assert.equal(await verifyPassword('wrong-password', hash), false);
  });

  it('rejects short passwords', async () => {
    await assert.rejects(() => hashPassword('short'), /at least 8/);
  });
});

describe('session tokens', () => {
  it('produces unique tokens and stable hashes', () => {
    const a = generateSessionToken();
    const b = generateSessionToken();
    assert.notEqual(a, b);
    assert.equal(hashSessionToken(a), hashSessionToken(a));
    assert.notEqual(hashSessionToken(a), hashSessionToken(b));
  });
});

describe('session cookie options', () => {
  it('uses secure cookies only in production', () => {
    const dev = buildSessionCookieOptions({ isProduction: false, maxAgeSeconds: 3600 });
    const prod = buildSessionCookieOptions({ isProduction: true, maxAgeSeconds: 3600 });
    assert.equal(dev.secure, false);
    assert.equal(prod.secure, true);
    assert.equal(SESSION_COOKIE_NAME, 'tradeops_session');
  });
});
