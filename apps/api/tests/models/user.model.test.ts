import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { User } from '../../src/models/User';
import {
  setupMongoMemoryServer,
  teardownMongoMemoryServer,
  clearMongoMemoryServer,
} from './setup';

describe('User Model', () => {
  beforeAll(async () => {
    await setupMongoMemoryServer();
  });

  afterAll(async () => {
    await teardownMongoMemoryServer();
  });

  beforeEach(async () => {
    await clearMongoMemoryServer();
  });

  it('should create and save a valid user with default role', async () => {
    const userData = {
      email: 'Test.User@example.com',
      passwordHash: '$2b$10$abcdef1234567890qwerty',
      name: 'Test User',
    };

    const user = new User(userData);
    const saved = await user.save();

    expect(saved._id).toBeDefined();
    expect(saved.email).toBe('test.user@example.com'); // lowercased
    expect(saved.role).toBe('user'); // default
    expect(saved.passwordHash).toBe(userData.passwordHash);
    expect(saved.createdAt).toBeInstanceOf(Date);
    expect(saved.updatedAt).toBeInstanceOf(Date);
  });

  it('should enforce unique email constraint', async () => {
    const userData = {
      email: 'unique@example.com',
      passwordHash: 'hash123',
      name: 'User One',
    };

    await new User(userData).save();
    await User.init(); // ensure indexes built in memory server

    const duplicate = new User({
      email: 'UNIQUE@example.com',
      passwordHash: 'hash456',
      name: 'User Two',
    });

    await expect(duplicate.save()).rejects.toThrow();
  });

  it('should fail validation if required fields are missing', async () => {
    const invalidUser = new User({});
    await expect(invalidUser.save()).rejects.toThrow();
  });
});
