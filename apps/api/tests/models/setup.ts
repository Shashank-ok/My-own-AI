/**
 * Per-test-file MongoDB helpers.
 *
 * Uses the real local MongoDB (mongodb://127.0.0.1:27017/myownai_test) via
 * the URI injected from tests/globalSetup.ts. This avoids the 5-minute cold-
 * start cost of MongoMemoryServer on this machine.
 *
 * Each test file:
 *   beforeAll  → setupMongoMemoryServer()   connects Mongoose to test DB
 *   afterAll   → teardownMongoMemoryServer() disconnects Mongoose
 *   beforeEach → clearMongoMemoryServer()   wipes all collections for isolation
 */
import mongoose from 'mongoose';
import { inject } from 'vitest';

export async function setupMongoMemoryServer(): Promise<void> {
  const uri = inject('mongoUri') as string;
  if (!uri) {
    throw new Error(
      "'mongoUri' was not injected. Ensure globalSetup: ['tests/globalSetup.ts'] is set in vitest.config.ts.",
    );
  }
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri);
  }
}

export async function teardownMongoMemoryServer(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

export async function clearMongoMemoryServer(): Promise<void> {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}
