/**
 * Vitest setupFiles — shared MongoMemoryServer singleton.
 *
 * This file is loaded once per Vitest worker process (registered via
 * vitest.config.ts `setupFiles`). With fileParallelism:false there is exactly
 * ONE worker, so this module is loaded exactly ONCE for the entire test run.
 *
 * Module-level code runs immediately when the module is first imported —
 * before any test file's describe/it blocks execute.  We use top-level
 * `await` (ESM) or an IIFE to kick off MongoMemoryServer.create() and store a
 * promise that test-file beforeAll() hooks can await via setupMongoMemoryServer().
 *
 * NOTE: Vitest setupFiles are executed in the same Node context as test files,
 * so `process.env` mutations are visible to all test modules.
 */
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { afterAll } from 'vitest';

// ── Singleton ────────────────────────────────────────────────────────────────

// We kick off the server immediately so it's ready before the first beforeAll.
const serverReadyPromise: Promise<void> = (async () => {
  const server = await MongoMemoryServer.create();
  process.env.MONGO_TEST_URI = server.getUri();
  await mongoose.connect(server.getUri());

  // Teardown: disconnect & stop after all tests in this worker complete.
  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    await server.stop({ doCleanup: true });
  }, 30_000);
})();

// Export the promise so setup.ts can await it if needed.
export { serverReadyPromise };
