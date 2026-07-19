import type { PrismaClient } from '@prisma/client';

export type DatabaseHealthResult = {
  status: 'up' | 'down';
  latencyMs: number;
  message?: string;
};

function isConnectionError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return /closed the connection|Connection reset|Can't reach database|ECONNREFUSED|ECONNRESET|Server has closed|P1001|P1017|P2024|timed out|Connection terminated/i.test(
    msg,
  );
}

/**
 * Probe DB with SELECT 1. On connection-drop errors (common with PGlite restarts),
 * disconnect + reconnect once and retry so a transient blip does not leave the
 * process permanently unhealthy until full API restart.
 */
export async function checkDatabaseHealth(client: PrismaClient): Promise<DatabaseHealthResult> {
  const started = performance.now();
  const probe = async () => {
    // Unsafe form avoids named prepared statements (breaks on PGlite / some pools).
    await client.$queryRawUnsafe('SELECT 1');
  };

  try {
    await probe();
    return {
      status: 'up',
      latencyMs: Math.round(performance.now() - started),
    };
  } catch (error) {
    if (!isConnectionError(error)) {
      return {
        status: 'down',
        latencyMs: Math.round(performance.now() - started),
        message: error instanceof Error ? error.message : 'Unknown database error',
      };
    }
    // Soft reconnect for PGlite / pool death
    try {
      await client.$disconnect().catch(() => undefined);
      await client.$connect();
      await probe();
      return {
        status: 'up',
        latencyMs: Math.round(performance.now() - started),
        message: 'reconnected after connection drop',
      };
    } catch (retryError) {
      return {
        status: 'down',
        latencyMs: Math.round(performance.now() - started),
        message:
          retryError instanceof Error
            ? retryError.message
            : error instanceof Error
              ? error.message
              : 'Unknown database error',
      };
    }
  }
}

/**
 * Ensure client can query; reconnect if needed. Use before critical request paths
 * that would otherwise surface "Server has closed the connection".
 */
export async function ensureDatabaseConnection(client: PrismaClient): Promise<boolean> {
  const h = await checkDatabaseHealth(client);
  return h.status === 'up';
}
