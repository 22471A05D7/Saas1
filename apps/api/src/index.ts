import { createApp } from './app';
import { env } from './lib/env';
import { disconnectPrisma, prisma } from './lib/prisma';

async function main() {
  // Fail fast with a clear message if PostgreSQL is unreachable, rather than
  // letting the first request surface a confusing error.
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('[stockflow] connected to PostgreSQL');
  } catch {
    console.error(
      '[stockflow] cannot reach PostgreSQL. Check that the server is running and that DATABASE_URL in apps/api/.env is correct.',
    );
    process.exit(1);
  }

  const app = createApp();

  const server = app.listen(env.PORT, () => {
    console.log(`[stockflow] API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });

  const shutdown = (signal: string) => {
    console.log(`\n[stockflow] ${signal} received, shutting down`);
    server.close(() => {
      void disconnectPrisma().finally(() => process.exit(0));
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

void main();
