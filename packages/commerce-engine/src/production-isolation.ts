/**
 * Production workspace isolation — fixtures/simulation never silently pollute live KPIs.
 */

export type DataClass = 'live' | 'canonical' | 'fixture' | 'simulation' | 'unavailable';

export function isSimulationMode(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  const v = (env.TRADEOPS_SIMULATION_MODE ?? env.NEXT_PUBLIC_TRADEOPS_SIMULATION_MODE ?? '')
    .toString()
    .trim()
    .toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

export function isProductionWorkspaceStrict(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  if (isSimulationMode(env)) return false;
  const v = (env.TRADEOPS_PRODUCTION_WORKSPACE ?? '').toString().trim().toLowerCase();
  if (v === '1' || v === 'true' || v === 'yes' || v === 'on') return true;
  return env.NODE_ENV === 'production' && !isSimulationMode(env);
}

/** True when sourcePlatform or providerKey is a local fixture adapter. */
export function isFixtureSource(source: string | null | undefined): boolean {
  if (!source) return false;
  const s = source.toLowerCase();
  return s.startsWith('fixture') || s.includes('fixture-') || s === 'demo' || s === 'sample';
}

export function classifySource(input: {
  isFixture?: boolean | null;
  sourcePlatform?: string | null;
  providerKey?: string | null;
  sourceProvenance?: string | null;
  simulationMode?: boolean;
}): DataClass {
  if (input.simulationMode || isSimulationMode()) {
    if (input.isFixture || isFixtureSource(input.sourcePlatform) || isFixtureSource(input.providerKey)) {
      return 'fixture';
    }
    return 'simulation';
  }
  if (
    input.isFixture ||
    isFixtureSource(input.sourcePlatform) ||
    isFixtureSource(input.providerKey) ||
    (input.sourceProvenance ?? '').toLowerCase().includes('fixture')
  ) {
    return 'fixture';
  }
  if ((input.sourceProvenance ?? '').startsWith('live_http:')) {
    return 'live';
  }
  return 'canonical';
}

/**
 * Filter product-like rows for production workspaces.
 * In strict production mode, fixture rows are excluded unless allowFixturesInSimulation.
 */
export function filterForProductionWorkspace<T extends { sourcePlatform?: string | null }>(
  rows: T[],
  options?: { allowFixtures?: boolean; env?: NodeJS.ProcessEnv },
): { rows: T[]; excludedFixtures: number; simulationMode: boolean; strict: boolean } {
  const env = options?.env ?? process.env;
  const simulationMode = isSimulationMode(env);
  const strict = isProductionWorkspaceStrict(env);
  const allowFixtures = options?.allowFixtures ?? (simulationMode || !strict);

  if (allowFixtures) {
    return { rows, excludedFixtures: 0, simulationMode, strict };
  }

  const kept: T[] = [];
  let excludedFixtures = 0;
  for (const r of rows) {
    if (isFixtureSource(r.sourcePlatform)) {
      excludedFixtures += 1;
      continue;
    }
    kept.push(r);
  }
  return { rows: kept, excludedFixtures, simulationMode, strict };
}

export function simulationBanner(env: NodeJS.ProcessEnv = process.env): {
  active: boolean;
  label: string;
  note: string;
} {
  const active = isSimulationMode(env);
  return {
    active,
    label: active ? 'SIMULATION MODE' : 'PRODUCTION MODE',
    note: active
      ? 'Fixture and synthetic data may appear. Explicitly labeled — not live marketplace truth.'
      : 'Production workspace: KPIs must be live connectors, canonical store, or labeled unavailable. No fabricated metrics.',
  };
}
