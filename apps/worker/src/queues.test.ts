import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

/** Queue naming contract — keep stable for observability and dashboards. */
export const PLATFORM_QUEUE = 'tradeops.platform';
export const HEARTBEAT_JOB = 'heartbeat';

describe('worker queue contracts', () => {
  it('uses namespaced queue and job identifiers', () => {
    assert.equal(PLATFORM_QUEUE.startsWith('tradeops.'), true);
    assert.equal(HEARTBEAT_JOB, 'heartbeat');
  });
});
