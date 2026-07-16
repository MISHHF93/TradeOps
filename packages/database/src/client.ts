import { PrismaClient } from '@prisma/client';

export type CreatePrismaClientOptions = {
  databaseUrl?: string;
  log?: Array<'query' | 'info' | 'warn' | 'error'>;
};

/**
 * Factory for Prisma clients.
 * Prefer one client per process (API / worker) via DI, not a global singleton imported by UI.
 */
export function createPrismaClient(options: CreatePrismaClientOptions = {}): PrismaClient {
  const datasources = options.databaseUrl
    ? { db: { url: options.databaseUrl } }
    : undefined;

  return new PrismaClient({
    datasources,
    log: options.log ?? (process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error']),
  });
}

export type { PrismaClient };
