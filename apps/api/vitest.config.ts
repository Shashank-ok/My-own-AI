import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['tests/**/*.test.ts'],

    // globalSetup runs ONCE in the main Vitest process (not in any worker).
    // It uses provide() to pass the MongoMemoryServer URI to all workers.
    globalSetup: ['tests/globalSetup.ts'],

    // Sequential file execution — one worker thread, no concurrent Mongoose
    // connections or MongoMemoryServer instances.
    fileParallelism: false,

    // testTimeout: each individual test has 30 s.
    testTimeout: 30000,
    // hookTimeout: beforeAll/afterAll have 120 s. The globalSetup itself has
    // no timeout limit (it runs outside worker hookTimeout accounting).
    hookTimeout: 120000,

    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/', 'tests/'],
    },
  },
});
