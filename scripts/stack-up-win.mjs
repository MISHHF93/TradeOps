#!/usr/bin/env node
/**
 * Safe Windows stack ensure — DB :51214 → API :4000 → Web :3000 → supervisor.
 *
 * Default: only start missing/unhealthy services (never free healthy ports).
 *   node scripts/stack-up-win.mjs
 *   node scripts/stack-up-win.mjs --force   # bounce all (free + restart)
 *   node scripts/stack-up-win.mjs --no-supervise
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  apiHealthy,
  freePort,
  loadDotEnv,
  nodeBin,
  portOpen,
  root,
  stackPorts,
  startApi,
  startDb,
  startWeb,
  startWebDev,
  waitPort,
  webHealthy,
} from './stack-lib.mjs';

const args = new Set(process.argv.slice(2));
const force = args.has('--force');
const noSupervise = args.has('--no-supervise');

async function main() {
  const env = loadDotEnv();
  for (const [k, v] of Object.entries(env)) {
    if (process.env[k] === undefined || String(process.env[k]).trim() === '') {
      process.env[k] = v;
    }
  }
  const ports = stackPorts(env);

  console.log('TradeOps stack-up-win (safe ensure)');
  console.log(`  root=${root}`);
  console.log(`  force=${force}`);

  // 1) DB
  if (force) {
    freePort(ports.db);
    await new Promise((r) => setTimeout(r, 800));
  }
  if (!(await portOpen(ports.db))) {
    startDb(env);
    if (!(await waitPort(ports.db, 'PGlite', 120))) process.exit(1);
    console.log(`OK PGlite :${ports.db}`);
  } else {
    console.log(`OK PGlite already :${ports.db}`);
  }

  // 2) API
  if (force) {
    freePort(ports.api);
    await new Promise((r) => setTimeout(r, 800));
  }
  if (!(await apiHealthy(ports.api))) {
    if (await portOpen(ports.api)) {
      // half-dead listener
      freePort(ports.api);
      await new Promise((r) => setTimeout(r, 500));
    }
    if (!(await portOpen(ports.db))) {
      console.error('DB died before API start');
      process.exit(1);
    }
    const apiMain = join(root, 'apps', 'api', 'dist', 'main.js');
    if (!existsSync(apiMain)) {
      console.error('API not built. Run: pnpm --filter @tradeops/api build');
      process.exit(1);
    }
    startApi(env);
    if (!(await waitPort(ports.api, 'API', 50))) process.exit(1);
    // wait postgres-up
    for (let i = 0; i < 40; i++) {
      if (await apiHealthy(ports.api)) break;
      await new Promise((r) => setTimeout(r, 1000));
    }
    if (await apiHealthy(ports.api)) console.log(`OK API healthy :${ports.api}`);
    else console.warn(`WARN API :${ports.api} listening but postgres not green yet`);
  } else {
    console.log(`OK API already healthy :${ports.api}`);
  }

  // 3) Web
  if (force) {
    freePort(ports.web);
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!(await portOpen(ports.web))) {
    startWeb(env);
    if (!(await waitPort(ports.web, 'Web', 40))) {
      console.log('Web production start failed — trying next dev…');
      freePort(ports.web);
      startWebDev(env);
      if (!(await waitPort(ports.web, 'Web(dev)', 90))) process.exit(1);
    }
    console.log(`OK Web :${ports.web}`);
  } else {
    console.log(`OK Web already :${ports.web}`);
  }

  // 4) Supervisor (detached, single instance)
  if (!noSupervise) {
    console.log('→ ensure supervisor');
    spawnSync(
      nodeBin,
      [join(root, 'scripts', 'stack-supervise.mjs'), '--daemon'],
      { cwd: root, encoding: 'utf8', windowsHide: true, stdio: 'inherit' },
    );
  }

  console.log('\n=== Stack ===');
  console.log(`  DB  :${ports.db}`);
  console.log(`  API :${ports.api}  http://127.0.0.1:${ports.api}/api/v1/health`);
  console.log(`  Web :${ports.web}  http://127.0.0.1:${ports.web}`);
  console.log('  Supervisor keeps services up (pnpm stack:stop to kill all).');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
