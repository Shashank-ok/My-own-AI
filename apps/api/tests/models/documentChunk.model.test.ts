import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { DocumentChunk } from '../../src/models/DocumentChunk';
import {
  setupMongoMemoryServer,
  teardownMongoMemoryServer,
  clearMongoMemoryServer,
} from './setup';

describe('DocumentChunk Model', () => {
  beforeAll(async () => {
    await setupMongoMemoryServer();
  });

  afterAll(async () => {
    await teardownMongoMemoryServer();
  });

  beforeEach(async () => {
    await clearMongoMemoryServer();
  });

  it('should save a valid chunk with matching embedding dimensions', async () => {
    const ownerId = new mongoose.Types.ObjectId();
    const documentId = new mongoose.Types.ObjectId();

    const chunk = new DocumentChunk({
      ownerId,
      documentId,
      chunkIndex: 0,
      text: 'Vector search engines process high-dimensional embeddings.',
      embedding: [0.1, 0.2, 0.3],
      embeddingModel: 'nomic-embed-text',
      embeddingDimensions: 3,
      engineVectorId: `doc_${documentId.toString()}_chunk_0`,
      engineNamespace: `user_${ownerId.toString()}`,
    });

    const saved = await chunk.save();
    expect(saved._id).toBeDefined();
    expect(saved.embedding).toHaveLength(3);
    expect(saved.engineVectorId).toBe(`doc_${documentId.toString()}_chunk_0`);
  });

  it('should fail validation if embedding length does not match embeddingDimensions', async () => {
    const ownerId = new mongoose.Types.ObjectId();
    const documentId = new mongoose.Types.ObjectId();

    const invalidChunk = new DocumentChunk({
      ownerId,
      documentId,
      chunkIndex: 0,
      text: 'Sample text',
      embedding: [0.1, 0.2], // length 2
      embeddingModel: 'nomic-embed-text',
      embeddingDimensions: 3, // expected 3
      engineVectorId: 'vec_1',
      engineNamespace: 'ns_1',
    });

    await expect(invalidChunk.save()).rejects.toThrow(
      'Embedding length must match embeddingDimensions',
    );
  });

  it('should enforce unique compound index on { documentId, chunkIndex }', async () => {
    const ownerId = new mongoose.Types.ObjectId();
    const documentId = new mongoose.Types.ObjectId();

    await DocumentChunk.init(); // ensure compound indexes created

    const chunk1 = new DocumentChunk({
      ownerId,
      documentId,
      chunkIndex: 0,
      text: 'Chunk 0 original',
      embedding: [0.1, 0.2],
      embeddingModel: 'test-model',
      embeddingDimensions: 2,
      engineVectorId: 'vec_0',
      engineNamespace: 'ns_1',
    });
    await chunk1.save();

    const duplicateChunk = new DocumentChunk({
      ownerId,
      documentId,
      chunkIndex: 0, // Duplicate chunkIndex for same documentId
      text: 'Chunk 0 duplicate',
      embedding: [0.3, 0.4],
      embeddingModel: 'test-model',
      embeddingDimensions: 2,
      engineVectorId: 'vec_0_dup',
      engineNamespace: 'ns_1',
    });

    await expect(duplicateChunk.save()).rejects.toThrow();
  });
});
