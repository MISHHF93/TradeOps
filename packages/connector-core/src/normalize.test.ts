import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildIdempotencyKey, normalizeExternalPayload } from './normalize';

describe('normalizeExternalPayload', () => {
  it('maps fixture order webhook to OrderCreated', () => {
    const n = normalizeExternalPayload({
      providerKey: 'fixture-marketplace',
      topic: 'orders/create',
      isFixture: true,
      raw: {
        externalId: 'ord-1',
        status: 'paid',
        totalMinor: 4999,
        currency: 'USD',
        lines: [{ title: 'Desk', quantity: 1 }],
      },
    });
    assert.equal(n.eventType, 'OrderCreated');
    assert.equal(n.canonical.kind, 'order');
    assert.equal(n.canonical.externalId, 'ord-1');
    assert.equal(n.isFixture, true);
  });

  it('maps inventory topic', () => {
    const n = normalizeExternalPayload({
      providerKey: 'shopify-graphql-admin',
      topic: 'inventory/update',
      raw: { sku: 'SKU-1', quantity: 12 },
    });
    assert.equal(n.eventType, 'InventoryChanged');
    assert.equal(n.canonical.quantity, 12);
  });

  it('never drops unknown payloads', () => {
    const n = normalizeExternalPayload({
      providerKey: 'unknown-vendor',
      topic: 'custom.event',
      raw: { foo: 1 },
    });
    assert.equal(n.eventType, 'WebhookReceived');
    assert.ok(n.confidence < 0.5);
  });

  it('builds stable idempotency keys', () => {
    const a = buildIdempotencyKey('org', 'p', 't', { id: 'x' });
    const b = buildIdempotencyKey('org', 'p', 't', { id: 'x' });
    assert.equal(a, b);
  });
});
