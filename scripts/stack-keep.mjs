#!/usr/bin/env node
/**
 * Keep TradeOps local stack healthy.
 *
 *   node scripts/stack-keep.mjs              # one ensure pass (--once)
 *   node scripts/stack-keep.mjs --daemon     # long-lived supervisor (+ Windows watchdog)
 *   node scripts/stack-keep.mjs --status     # print supervisor status
 *
 * Cycle 5: default path for "always on" local dev after scorecard loops.
 */
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const daemon = argv.includes('--daemon');
const status = argv.includes('--status');

let superviseArgs;
if (status) superviseArgs = ['--status'];
else if (daemon) superviseArgs = ['--daemon'];
else superviseArgs = ['--once'];

const r = spawnSync(
  process.execPath,
  [join(root, 'scripts', 'stack-supervise.mjs'), ...superviseArgs],
  {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
    windowsHide: true,
  },
);

// Prisma deprecation noise on Windows may set non-zero; treat as soft when stack is up.
process.exit(typeof r.status === 'number' ? r.status : 1);
