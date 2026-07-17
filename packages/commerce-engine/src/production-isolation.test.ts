import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  classifySource,
  filterForProductionWorkspace,
  isFixtureSource,
  isSimulationMode,
  simulationBanner,
} from './production-isolation';

describe('production isolation', () => {
  it('detects fixture sources', () => {
    assert.equal(isFixtureSource('fixture-supplier'), true);
    assert.equal(isFixtureSource('shopify-graphql-admin'), false);
  });

  it('classifies live_http provenance as live', () => {
    assert.equal(
      classifySource({
        sourceProvenance: 'live_http:shopify-graphql-admin',
        simulationMode: false,
      }),
      'live',
    );
  });

  it('filters fixtures in strict production', () => {
    const { rows, excludedFixtures, strict } = filterForProductionWorkspace(
      [
        { sourcePlatform: 'fixture-supplier' },
        { sourcePlatform: 'shopify-graphql-admin' },
      ],
      {
        env: {
          NODE_ENV: 'production',
          TRADEOPS_SIMULATION_MODE: '0',
          TRADEOPS_PRODUCTION_WORKSPACE: '1',
        } as NodeJS.ProcessEnv,
      },
    );
    assert.equal(strict, true);
    assert.equal(excludedFixtures, 1);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.sourcePlatform, 'shopify-graphql-admin');
  });

  it('allows fixtures in simulation mode', () => {
    assert.equal(
      isSimulationMode({ TRADEOPS_SIMULATION_MODE: '1' } as NodeJS.ProcessEnv),
      true,
    );
    const banner = simulationBanner({ TRADEOPS_SIMULATION_MODE: '1' } as NodeJS.ProcessEnv);
    assert.equal(banner.active, true);
    assert.match(banner.label, /SIMULATION/);
  });
});
