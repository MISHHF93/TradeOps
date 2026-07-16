const { PrismaClient } = require('@prisma/client');

const url =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@127.0.0.1:5432/postgres?schema=public&connect_timeout=5';

const prisma = new PrismaClient({
  datasources: { db: { url } },
});

prisma
  .$queryRawUnsafe('SELECT 1 AS x')
  .then((rows) => {
    console.log('OK', rows);
    return prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('FAIL', e.message);
    await prisma.$disconnect().catch(() => undefined);
    process.exit(1);
  });
