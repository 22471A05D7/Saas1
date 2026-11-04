import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    // Selects apps/api/.env.test inside src/lib/env.ts.
    env: { NODE_ENV: 'test' },
    testTimeout: 30000,
    hookTimeout: 30000,
    // The suite shares one PostgreSQL database and truncates between tests, so
    // files must not run concurrently.
    fileParallelism: false,
    pool: 'forks',
  },
});
