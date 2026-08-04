/**
 * Per-test-file MongoDB helpers.
 *
 * MongoMemoryServer lifecycle is managed by tests/globalSetup.ts (a Vitest
 * setupFiles entry). The server and Mongoose connection are created ONCE for
 * the entire test run.
 *
 * Usage in each test file:
 *
 *   beforeAll(async () => { await setupMongoMemoryServer(); });
 *   afterAll(async  () => { await teardownMongoMemoryServer(); });  // no-op
 *   beforeEach(async () => { await clearMongoMemoryServer(); });
 */
import mongoose from 'mongoose';
import { serverReadyPromise } from '../globalSetup'; // wait for singleton

// Re-export promise so tests can import it directly if needed.
export { serverReadyPromise };

/**
 * Called in each test file's beforeAll().
 * Awaits the singleton promise so any test that runs before the IIFE in
 * globalSetup.ts finishes will wait safely.
 */
export async function setupMongoMemoryServer(): Promise<void> {
  await serverReadyPromise;
}

/**
 * Called in each test file's afterAll().
 * Intentionally a no-op — the connection is kept alive across all files.
 * The real teardown is registered by globalSetup.ts via a single afterAll().
 */
export async function teardownMongoMemoryServer(): Promise<void> {
  // no-op — owned by globalSetup.ts
}

/**
 * Wipes all MongoDB collections between tests to ensure isolation.
 */
export async function clearMongoMemoryServer(): Promise<void> {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}
