/**
 * Vitest Global Setup — uses the real local MongoDB for tests.
 *
 * MongoMemoryServer is unreliable on this machine (5-minute cold-start due
 * to MongoDB 7 binary extraction). Instead, we connect to the local MongoDB
 * instance (mongodb://127.0.0.1:27017) using a dedicated test database
 * (`myownai_test`) that is wiped before each test file.
 *
 * Requirements:
 *   - MongoDB must be running locally on port 27017 (same as dev).
 *   - The test database is created automatically if it doesn't exist.
 *   - The test database is dropped after all tests complete.
 *
 * To use MongoMemoryServer instead, set MONGO_TEST_URI in your environment.
 */

export async function setup({ provide }: { provide: (key: string, value: unknown) => void }) {
  // Allow override via environment for CI / Docker environments.
  const uri = process.env.MONGO_TEST_URI ?? 'mongodb://127.0.0.1:27017/myownai_test';
  provide('mongoUri', uri);
}

export async function teardown() {
  // Nothing to tear down — real MongoDB manages its own lifecycle.
  // The test database collections are cleared between files by setup.ts.
}
