import assert from 'node:assert/strict';
import { describe, it, afterEach } from 'node:test';
import { CommercePaymentService } from './commerce-payment.service';

/**
 * Unit tests for pure readiness policy (no DB).
 * Full PO gate integration is covered by e2e after fixture order ingest.
 */
describe('commerce payment readiness policy', () => {
  const svc = new CommercePaymentService(
    // unused in pure method
    null as never,
    null as never,
  );

  const prev = process.env.TRADEOPS_ALLOW_AUTHORIZED_SOURCING;

  afterEach(() => {
    if (prev === undefined) delete process.env.TRADEOPS_ALLOW_AUTHORIZED_SOURCING;
    else process.env.TRADEOPS_ALLOW_AUTHORIZED_SOURCING = prev;
  });

  it('ready when captured with positive amount', () => {
    const r = svc.paymentReadinessForOrder({
      status: 'captured',
      capturedAmountMinor: 1000,
      authorizedAmountMinor: 0,
    });
    assert.equal(r.ready, true);
  });

  it('not ready when failed', () => {
    const r = svc.paymentReadinessForOrder({
      status: 'failed',
      capturedAmountMinor: 0,
      authorizedAmountMinor: 0,
    });
    assert.equal(r.ready, false);
  });

  it('authorized only when policy env set', () => {
    delete process.env.TRADEOPS_ALLOW_AUTHORIZED_SOURCING;
    const blocked = svc.paymentReadinessForOrder({
      status: 'authorized',
      capturedAmountMinor: 0,
      authorizedAmountMinor: 500,
    });
    assert.equal(blocked.ready, false);

    process.env.TRADEOPS_ALLOW_AUTHORIZED_SOURCING = 'true';
    const allowed = svc.paymentReadinessForOrder({
      status: 'authorized',
      capturedAmountMinor: 0,
      authorizedAmountMinor: 500,
    });
    assert.equal(allowed.ready, true);
  });
});
