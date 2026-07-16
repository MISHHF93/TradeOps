import type { PrismaClient } from '@prisma/client';

export type DatabaseHealthResult = {
  status: 'up' | 'down';
  latencyMs: number;
  message?: string;
};

export async function checkDatabaseHealth(client: PrismaClient): Promise<DatabaseHealthResult> {
  const started = performance.now();
  try {
    // Unsafe form avoids named prepared statements (breaks on PGlite / some pools).
    await client.$queryRawUnsafe('SELECT 1');
    return {
      status: 'up',
      latencyMs: Math.round(performance.now() - started),
    };
  } catch (error) {
    return {
      status: 'down',
      latencyMs: Math.round(performance.now() - started),
      message: error instanceof Error ? error.message : 'Unknown database error',
    };
  }
}
