#!/usr/bin/env node
/**
 * Cross-platform test runner using Node's built-in test runner.
 * Avoids Vitest/Rollup native binaries blocked by some Windows Application Control policies.
 */
import { readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const distDir = resolve(root, process.argv[2] ?? 'dist');

function collectTestFiles(dir, acc = []) {
  if (!existsSync(dir)) {
    return acc;
  }
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      collectTestFiles(full, acc);
    } else if (entry.endsWith('.test.js')) {
      acc.push(full);
    }
  }
  return acc;
}

const files = collectTestFiles(distDir);
if (files.length === 0) {
  console.error(`No test files found under ${distDir}`);
  process.exit(1);
}

const result = spawnSync(process.execPath, ['--test', ...files], {
  stdio: 'inherit',
  env: process.env,
});

process.exit(result.status ?? 1);
