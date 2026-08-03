import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';
import { IngestionService } from '../../src/services/ingestion.service';
import { DocumentModel } from '../../src/models/Document';
import { DocumentChunk } from '../../src/models/DocumentChunk';
import { OllamaClient } from '../../src/clients/ollama.client';
import { VectorEngineClient } from '../../src/clients/vectorEngine.client';
import {
  setupMongoMemoryServer,
  teardownMongoMemoryServer,
  clearMongoMemoryServer,
} from '../models/setup';

describe('IngestionService', () => {
  let service: IngestionService;
  let mockOllama: OllamaClient;
  let mockVectorEngine: VectorEngineClient;

  beforeAll(async () => {
    await setupMongoMemoryServer();
  });

  afterAll(async () => {
    await teardownMongoMemoryServer();
  });

  beforeEach(async () => {
    await clearMongoMemoryServer();

    mockOllama = new OllamaClient();
    mockVectorEngine = new VectorEngineClient();

    vi.spyOn(mockOllama, 'generateEmbeddings').mockImplementation(async (texts) => {
      return texts.map(() => [0.1, 0.2, 0.3]);
    });

    vi.spyOn(mockVectorEngine, 'insertBatch').mockImplementation(async (namespace, vectors) => {
      return { inserted: vectors.length, updated: 0, rejected: 0, namespace };
    });

    vi.spyOn(mockVectorEngine, 'deleteVector').mockImplementation(async () => {
      return { deleted: true };
    });

    service = new IngestionService(mockOllama, mockVectorEngine);
  });

  it('should execute full document ingestion pipeline and mark status completed', async () => {
    const ownerId = new mongoose.Types.ObjectId().toString();

    const doc = await service.ingestDocument({
      ownerId,
      title: 'Neural Networks 101',
      text: 'Neural networks are computing systems inspired by biological neural networks.',
      chunkSize: 50,
      chunkOverlap: 5,
    });

    expect(doc.status).toBe('completed');
    expect(doc.chunkCount).toBeGreaterThan(0);

    // Verify MongoDB chunks
    const chunks = await DocumentChunk.find({ documentId: doc._id });
    expect(chunks).toHaveLength(doc.chunkCount);
    expect(chunks[0].engineNamespace).toBe(`user_${ownerId}`);
    expect(chunks[0].engineVectorId).toBe(`doc_${doc._id.toString()}_chunk_0`);

    // Verify C++ Engine batch insert was called with vector IDs (and NO text)
    expect(mockVectorEngine.insertBatch).toHaveBeenCalledWith(
      `user_${ownerId}`,
      expect.arrayContaining([
        expect.objectContaining({
          id: `doc_${doc._id.toString()}_chunk_0`,
          values: [0.1, 0.2, 0.3],
        }),
      ]),
    );
  });

  it('should run compensation cleanup when C++ vector indexing fails', async () => {
    const ownerId = new mongoose.Types.ObjectId().toString();

    vi.spyOn(mockVectorEngine, 'insertBatch').mockRejectedValueOnce(
      new Error('C++ engine connection timeout'),
    );

    await expect(
      service.ingestDocument({
        ownerId,
        title: 'Failing Document',
        text: 'This document will fail during vector engine indexing step.',
      }),
    ).rejects.toThrow('C++ engine connection timeout');

    // Verify document marked as failed
    const doc = await DocumentModel.findOne({ ownerId: new mongoose.Types.ObjectId(ownerId) });
    expect(doc?.status).toBe('failed');
    expect(doc?.ingestionError).toBe('C++ engine connection timeout');

    // Verify compensation: zero orphaned DocumentChunks left in MongoDB
    const orphanedChunks = await DocumentChunk.find({ documentId: doc?._id });
    expect(orphanedChunks).toHaveLength(0);
  });

  it('should delete document, MongoDB chunks, and C++ engine vectors', async () => {
    const ownerId = new mongoose.Types.ObjectId().toString();

    const doc = await service.ingestDocument({
      ownerId,
      title: 'Doc to Delete',
      text: 'Sample text for deletion test.',
    });

    const result = await service.deleteDocument(ownerId, doc._id.toString());
    expect(result.deleted).toBe(true);

    const docInDb = await DocumentModel.findById(doc._id);
    expect(docInDb).toBeNull();

    const chunksInDb = await DocumentChunk.find({ documentId: doc._id });
    expect(chunksInDb).toHaveLength(0);

    expect(mockVectorEngine.deleteVector).toHaveBeenCalled();
  });
});
