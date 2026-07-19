import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadDotEnvFiles } from './dotenv';
import { loadEnv, resetEnvCache } from './index';

describe('dotenv + loadEnv Cohere', () => {
  it('loadEnv rejects empty COHERE_API_KEY as unconfigured', () => {
    resetEnvCache();
    const env = loadEnv({
      COHERE_API_KEY: '   ',
      NODE_ENV: 'test',
    } as NodeJS.ProcessEnv);
    assert.equal(env.COHERE_API_KEY, undefined);
    assert.equal(env.COHERE_CHAT_MODEL, 'command-a-plus-05-2026');
  });

  it('loadEnv accepts trimmed COHERE_API_KEY', () => {
    resetEnvCache();
    const env = loadEnv({
      COHERE_API_KEY: '  secret-key  ',
      NODE_ENV: 'test',
    } as NodeJS.ProcessEnv);
    assert.equal(env.COHERE_API_KEY, 'secret-key');
  });

  it('loadDotEnvFiles fills empty process keys from file', () => {
    const dir = join(tmpdir(), `tradeops-env-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'pnpm-workspace.yaml'), 'packages: []\n');
    writeFileSync(join(dir, '.env'), 'COHERE_API_KEY=from-file\nCOHERE_CHAT_MODEL=command-a-plus-05-2026\n');
    const target: NodeJS.ProcessEnv = { COHERE_API_KEY: '' };
    const result = loadDotEnvFiles(target, dir);
    assert.ok(result.filesRead.some((f) => f.endsWith('.env')));
    assert.equal(target.COHERE_API_KEY, 'from-file');
    rmSync(dir, { recursive: true, force: true });
  });
});
