import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['tests/**/*.test.ts'],

    // tests/globalSetup.ts starts ONE MongoMemoryServer and connects Mongoose
    // before any test file runs. This avoids repeated create() calls and the
    // Windows binary-lock timeouts they cause.
    setupFiles: ['tests/globalSetup.ts'],

    // Sequential file execution — one worker, one Mongoose connection, one mongod.
    fileParallelism: false,

    // Generous timeouts: the first test in a fresh repo must wait for
    // MongoMemoryServer.create() which can take 10–30 s.
    testTimeout: 30000,
    hookTimeout: 120000,

    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/', 'tests/'],
    },
  },
});
