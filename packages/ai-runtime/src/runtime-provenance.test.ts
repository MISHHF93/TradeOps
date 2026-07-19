import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  blockedReasonForMissingProvider,
  buildProvenance,
  getSimulationPolicy,
} from './runtime-provenance';

describe('runtime provenance', () => {
  it('builds source label without secrets', () => {
    const p = buildProvenance({
      dataMode: 'live',
      aiProvider: 'cohere',
      aiModel: 'command-a-03-2025',
      toolNames: ['search.manager', 'commerce.list'],
      traceId: 'trace_abc',
    });
    assert.equal(p.dataMode, 'live');
    assert.ok(p.sourceLabel.includes('Live'));
    assert.ok(p.sourceLabel.includes('cohere'));
    assert.ok(!p.sourceLabel.toLowerCase().includes('api_key'));
  });

  it('defaults simulation and cache off', () => {
    const s = getSimulationPolicy({
      NODE_ENV: 'development',
      ENABLE_SIMULATION_MODE: 'false',
      AI_RESPONSE_CACHE_ENABLED: '',
    });
    assert.equal(s.simulationEnabled, false);
    assert.equal(s.responseCacheEnabled, false);
    assert.equal(s.aiRuntimeEnabled, true);
  });

  it('rejects production simulation without allow flag', () => {
    const s = getSimulationPolicy({
      NODE_ENV: 'production',
      ENABLE_SIMULATION_MODE: 'true',
    });
    assert.equal(s.productionSimulationRejected, true);
    assert.equal(s.simulationEnabled, false);
  });

  it('blocked reason for cohere is actionable', () => {
    const r = blockedReasonForMissingProvider('cohere');
    assert.equal(r.status, 'blocked');
    assert.equal(r.errorCode, 'AI_PROVIDER_NOT_CONFIGURED');
    assert.ok(r.requiredAction.includes('COHERE_API_KEY'));
  });
});
