import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';
import { SearchService } from '../../src/services/search.service';
import { DocumentModel } from '../../src/models/Document';
import { DocumentChunk } from '../../src/models/DocumentChunk';
import { OllamaClient } from '../../src/clients/ollama.client';
import { VectorEngineClient } from '../../src/clients/vectorEngine.client';
import {
  setupMongoMemoryServer,
  teardownMongoMemoryServer,
  clearMongoMemoryServer,
} from '../models/setup';
import { OllamaUnavailableError } from '../../src/errors/ollama.errors';
import { VectorEngineUnavailableError } from '../../src/errors/vectorEngine.errors';

describe('SearchService', () => {
  let searchService: SearchService;
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

    vi.spyOn(mockOllama, 'generateEmbedding').mockImplementation(async () => [0.1, 0.2, 0.3]);

    searchService = new SearchService(mockOllama, mockVectorEngine);
  });

  it('should execute search, hydrate MongoDB chunks & document title, and return formatted results', async () => {
    const userA = new mongoose.Types.ObjectId();
    const docA = await new DocumentModel({
      ownerId: userA,
      title: 'Machine Learning Guide',
      status: 'completed',
      chunkCount: 1,
    }).save();

    const chunkA = await new DocumentChunk({
      ownerId: userA,
      documentId: docA._id,
      chunkIndex: 0,
      text: 'Supervised learning trains models on labeled datasets.',
      embedding: [0.1, 0.2, 0.3],
      embeddingModel: 'nomic-embed-text',
      embeddingDimensions: 3,
      engineVectorId: `doc_${docA._id.toString()}_chunk_0`,
      engineNamespace: `user_${userA.toString()}`,
      metadata: { chunkIndex: 0 },
    }).save();

    vi.spyOn(mockVectorEngine, 'searchVectors').mockResolvedValueOnce({
      namespace: `user_${userA.toString()}`,
      algorithm: 'hnsw',
      metric: 'cosine',
      latencyUs: 50,
      hits: [
        { id: chunkA.engineVectorId, distance: 0.03, metadata: { chunkIndex: 0 } },
      ],
    });

    const res = await searchService.search({
      ownerId: userA.toString(),
      query: 'What is supervised learning?',
      k: 5,
    });

    expect(res.totalHits).toBe(1);
    expect(res.results[0]).toEqual({
      chunkId: chunkA._id.toString(),
      documentId: docA._id.toString(),
      documentTitle: 'Machine Learning Guide',
      text: 'Supervised learning trains models on labeled datasets.',
      distance: 0.03,
      chunkIndex: 0,
      metadata: { chunkIndex: 0 },
    });
  });

  it('should enforce ownership isolation and filter out chunks owned by another user', async () => {
    const userA = new mongoose.Types.ObjectId();
    const userB = new mongoose.Types.ObjectId();

    const docB = await new DocumentModel({
      ownerId: userB,
      title: 'Secret User B Document',
      status: 'completed',
    }).save();

    const chunkB = await new DocumentChunk({
      ownerId: userB,
      documentId: docB._id,
      chunkIndex: 0,
      text: 'Confidential User B information.',
      embedding: [0.1, 0.2, 0.3],
      embeddingModel: 'nomic-embed-text',
      embeddingDimensions: 3,
      engineVectorId: `doc_${docB._id.toString()}_chunk_0`,
      engineNamespace: `user_${userB.toString()}`,
    }).save();

    // Malicious or buggy engine returns User B's chunk vector ID during User A's search
    vi.spyOn(mockVectorEngine, 'searchVectors').mockResolvedValueOnce({
      namespace: `user_${userA.toString()}`,
      algorithm: 'hnsw',
      metric: 'cosine',
      latencyUs: 30,
      hits: [
        { id: chunkB.engineVectorId, distance: 0.01 },
      ],
    });

    const res = await searchService.search({
      ownerId: userA.toString(),
      query: 'secret data',
    });

    // User B's chunk must be filtered out!
    expect(res.totalHits).toBe(0);
    expect(res.results).toHaveLength(0);
  });

  it('should handle stale engine vectors missing from MongoDB', async () => {
    const userA = new mongoose.Types.ObjectId();

    // Engine returns stale vector ID that does not exist in MongoDB
    vi.spyOn(mockVectorEngine, 'searchVectors').mockResolvedValueOnce({
      namespace: `user_${userA.toString()}`,
      algorithm: 'hnsw',
      metric: 'cosine',
      latencyUs: 20,
      hits: [
        { id: 'stale_vector_id_123', distance: 0.01 },
      ],
    });

    const res = await searchService.search({
      ownerId: userA.toString(),
      query: 'test query',
    });

    expect(res.totalHits).toBe(0);
    expect(res.results).toEqual([]);
  });

  it('should filter results by documentIds when specified', async () => {
    const userA = new mongoose.Types.ObjectId();
    const doc1 = await new DocumentModel({ ownerId: userA, title: 'Doc 1' }).save();
    const doc2 = await new DocumentModel({ ownerId: userA, title: 'Doc 2' }).save();

    const chunk1 = await new DocumentChunk({
      ownerId: userA,
      documentId: doc1._id,
      chunkIndex: 0,
      text: 'Text 1',
      embedding: [0.1, 0.2],
      embeddingModel: 'test',
      embeddingDimensions: 2,
      engineVectorId: 'v1',
      engineNamespace: `user_${userA.toString()}`,
    }).save();

    const chunk2 = await new DocumentChunk({
      ownerId: userA,
      documentId: doc2._id,
      chunkIndex: 0,
      text: 'Text 2',
      embedding: [0.1, 0.2],
      embeddingModel: 'test',
      embeddingDimensions: 2,
      engineVectorId: 'v2',
      engineNamespace: `user_${userA.toString()}`,
    }).save();

    vi.spyOn(mockVectorEngine, 'searchVectors').mockResolvedValueOnce({
      namespace: `user_${userA.toString()}`,
      algorithm: 'hnsw',
      metric: 'cosine',
      latencyUs: 30,
      hits: [
        { id: 'v1', distance: 0.01 },
        { id: 'v2', distance: 0.02 },
      ],
    });

    const res = await searchService.search({
      ownerId: userA.toString(),
      query: 'test query',
      documentIds: [doc1._id.toString()],
    });

    expect(res.totalHits).toBe(1);
    expect(res.results[0].chunkId).toBe(chunk1._id.toString());
  });

  it('should handle Ollama service failure cleanly', async () => {
    vi.spyOn(mockOllama, 'generateEmbedding').mockRejectedValueOnce(
      new OllamaUnavailableError('Ollama offline'),
    );

    await expect(
      searchService.search({
        ownerId: new mongoose.Types.ObjectId().toString(),
        query: 'query during failure',
      }),
    ).rejects.toThrow(OllamaUnavailableError);
  });

  it('should handle C++ Vector Engine failure cleanly', async () => {
    vi.spyOn(mockVectorEngine, 'searchVectors').mockRejectedValueOnce(
      new VectorEngineUnavailableError('Engine offline'),
    );

    await expect(
      searchService.search({
        ownerId: new mongoose.Types.ObjectId().toString(),
        query: 'query during failure',
      }),
    ).rejects.toThrow(VectorEngineUnavailableError);
  });
});
