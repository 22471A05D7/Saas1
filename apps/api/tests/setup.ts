// Importing the env module loads apps/api/.env.test (because NODE_ENV=test,
// set by vitest.config.ts) and validates it.
import { env } from '../src/lib/env';

if (!env.DATABASE_URL.includes('stockflow_test')) {
  // A hard stop: pointing the suite at the development database would wipe it,
  // because the suite truncates tenant data between tests.
  throw new Error(
    'Refusing to run tests: DATABASE_URL must target the stockflow_test database. ' +
      'Check apps/api/.env.test',
  );
}
