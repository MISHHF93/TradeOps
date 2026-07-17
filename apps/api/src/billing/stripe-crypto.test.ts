import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { describe, it } from 'node:test';
import { redactSecrets, verifyStripeWebhookSignature } from './stripe-crypto';

describe('stripe webhook signature', () => {
  it('accepts a valid signature', () => {
    const secret = 'whsec_test_secret';
    const rawBody = JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed' });
    const timestamp = Math.floor(Date.now() / 1000);
    const signed = `${timestamp}.${rawBody}`;
    const v1 = createHmac('sha256', secret).update(signed, 'utf8').digest('hex');
    const r = verifyStripeWebhookSignature({
      rawBody,
      signatureHeader: `t=${timestamp},v1=${v1}`,
      secret,
    });
    assert.equal(r.ok, true);
  });

  it('rejects invalid signature', () => {
    const r = verifyStripeWebhookSignature({
      rawBody: '{}',
      signatureHeader: `t=${Math.floor(Date.now() / 1000)},v1=deadbeef`,
      secret: 'whsec_test',
    });
    assert.equal(r.ok, false);
  });

  it('rejects missing header', () => {
    const r = verifyStripeWebhookSignature({
      rawBody: '{}',
      signatureHeader: undefined,
      secret: 'whsec_test',
    });
    assert.equal(r.ok, false);
  });

  it('redacts secret-like strings', () => {
    const r = redactSecrets({
      key: 'sk_test_abc',
      nested: { password: 'x', ok: 1 },
    }) as { key: string; nested: { password: string; ok: number } };
    assert.equal(r.key, '[REDACTED]');
    assert.equal(r.nested.password, '[REDACTED]');
    assert.equal(r.nested.ok, 1);
  });
});
