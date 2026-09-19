import path from 'node:path';
import { defineConfig } from 'vitest/config';

import { TEST_DATABASE_URL } from './tests/test-env.ts';

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts', 'app/api/**/*.ts'],
      reporter: ['text-summary', 'text'],
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'node',
          include: ['tests/unit/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          environment: 'node',
          include: ['tests/integration/**/*.test.ts'],
          globalSetup: ['tests/integration/global-setup.ts'],
          // All integration files share one database; run them one at a time.
          fileParallelism: false,
          env: { DATABASE_URL: TEST_DATABASE_URL },
        },
      },
    ],
  },
});
