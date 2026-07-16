import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import { checkDatabaseHealth } from './health';
import type { PrismaClient } from '@prisma/client';

describe('checkDatabaseHealth', () => {
  it('reports up when the query succeeds', async () => {
    const client = {
      $queryRaw: mock.fn(async () => [{ '?column?': 1 }]),
    } as unknown as PrismaClient;

    const result = await checkDatabaseHealth(client);
    assert.equal(result.status, 'up');
    assert.ok(result.latencyMs >= 0);
  });

  it('reports down when the query fails', async () => {
    const client = {
      $queryRaw: mock.fn(async () => {
        throw new Error('connection refused');
      }),
    } as unknown as PrismaClient;

    const result = await checkDatabaseHealth(client);
    assert.equal(result.status, 'down');
    assert.match(result.message ?? '', /connection refused/);
  });
});
