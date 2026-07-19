import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  architecturePublicStatus,
  DATA_FABRIC_ENTITIES,
  PLATFORM_EVENT_TYPES,
  PLATFORM_LAYERS,
  ROUTE_ALIASES,
} from './architecture';

describe('architecture registry', () => {
  it('defines full platform layers', () => {
    assert.ok(PLATFORM_LAYERS.includes('data_fabric'));
    assert.ok(PLATFORM_LAYERS.includes('connector'));
    assert.ok(PLATFORM_LAYERS.includes('live_projection'));
    assert.ok(PLATFORM_LAYERS.includes('event_fabric'));
  });

  it('lists data fabric entities and events', () => {
    assert.ok(DATA_FABRIC_ENTITIES.length >= 20);
    assert.ok(PLATFORM_EVENT_TYPES.includes('live_search.started'));
    assert.ok(PLATFORM_EVENT_TYPES.includes('order.created'));
  });

  it('aliases legacy routes to canonical destinations', () => {
    assert.equal(ROUTE_ALIASES['/terminal/pipeline'], '/terminal/process');
    assert.equal(ROUTE_ALIASES['/terminal/control-tower'], '/terminal/ops');
  });

  it('public status never includes secrets', () => {
    const s = architecturePublicStatus();
    assert.ok(!JSON.stringify(s).toLowerCase().includes('api_key'));
    assert.equal(s.platform.includes('Commerce'), true);
  });
});
