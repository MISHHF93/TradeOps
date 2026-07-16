import { PrismaClient } from '@prisma/client';

const url =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@127.0.0.1:5432/postgres?schema=public&connect_timeout=5';

const prisma = new PrismaClient({ datasources: { db: { url } } });

try {
  const rows = await prisma.$queryRaw`SELECT 1::int AS x`;
  console.log('OK', rows);
} catch (e) {
  console.error('FAIL', e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
