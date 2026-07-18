import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { agentCatalogPublic, planAgentsForObjective } from './agent-orchestration';

describe('agent orchestration', () => {
  it('routes research intents to research agent', () => {
    const plan = planAgentsForObjective('Find suppliers for industrial pumps');
    assert.equal(plan.primary, 'research');
    assert.ok(plan.roles.includes('orchestrator'));
  });

  it('routes order/fulfill intents to operations', () => {
    const plan = planAgentsForObjective('Show blocked fulfillments and open orders');
    assert.equal(plan.primary, 'operations');
  });

  it('publishes catalog without secrets', () => {
    const c = agentCatalogPublic();
    assert.equal(c.runtime, 'single_cohere_code_first');
    assert.ok(c.agents.length >= 6);
    assert.ok(!JSON.stringify(c).includes('API_KEY'));
  });
});
