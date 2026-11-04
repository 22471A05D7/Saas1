import { PrismaClient } from '@prisma/client';
import { env, isProduction } from './env';

/**
 * Centralized Prisma Client.
 *
 * A single instance is shared across the whole process. In development `tsx
 * watch` reloads modules on every change, so the instance is cached on
 * `globalThis` to avoid exhausting the PostgreSQL connection pool with a new
 * client per reload.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isProduction ? ['error'] : ['error', 'warn'],
  });

if (!isProduction) {
  globalForPrisma.prisma = prisma;
}

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}

export type { Prisma } from '@prisma/client';
export { env };
