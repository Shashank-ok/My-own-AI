import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { DocumentModel } from '../../src/models/Document';
import {
  setupMongoMemoryServer,
  teardownMongoMemoryServer,
  clearMongoMemoryServer,
} from './setup';

describe('Document Model', () => {
  beforeAll(async () => {
    await setupMongoMemoryServer();
  });

  afterAll(async () => {
    await teardownMongoMemoryServer();
  });

  beforeEach(async () => {
    await clearMongoMemoryServer();
  });

  it('should create a document with default pending status and zero chunkCount', async () => {
    const ownerId = new mongoose.Types.ObjectId();
    const doc = new DocumentModel({
      ownerId,
      title: 'Machine Learning Basics',
      originalFileName: 'ml_basics.pdf',
      mimeType: 'application/pdf',
    });

    const saved = await doc.save();
    expect(saved._id).toBeDefined();
    expect(saved.ownerId.toString()).toBe(ownerId.toString());
    expect(saved.status).toBe('pending');
    expect(saved.chunkCount).toBe(0);
    expect(saved.metadata).toEqual({});
    expect(saved.createdAt).toBeInstanceOf(Date);
  });

  it('should reject invalid document status enum values', async () => {
    const ownerId = new mongoose.Types.ObjectId();
    const invalidDoc = new DocumentModel({
      ownerId,
      title: 'Invalid Status Doc',
      status: 'unknown_status' as any,
    });

    await expect(invalidDoc.save()).rejects.toThrow();
  });
});
