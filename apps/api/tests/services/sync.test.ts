import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';
import { SyncService } from '../../src/services/sync.service';
import { DocumentChunk } from '../../src/models/DocumentChunk';
import { VectorEngineClient } from '../../src/clients/vectorEngine.client';
import { OllamaClient } from '../../src/clients/ollama.client';
import {
  setupMongoMemoryServer,
  teardownMongoMemoryServer,
  clearMongoMemoryServer,
} from '../models/setup';
import { VectorEngineNotFoundError } from '../../src/errors/vectorEngine.errors';

describe('SyncService', () => {
  let syncService: SyncService;
  let mockVectorEngine: VectorEngineClient;
  let mockOllama: OllamaClient;

  beforeAll(async () => {
    await setupMongoMemoryServer();
  });

  afterAll(async () => {
    await teardownMongoMemoryServer();
  });

  beforeEach(async () => {
    await clearMongoMemoryServer();

    mockVectorEngine = new VectorEngineClient();
    mockOllama = new OllamaClient();

    vi.spyOn(mockOllama, 'generateEmbedding');
    vi.spyOn(mockOllama, 'generateEmbeddings');

    syncService = new SyncService(mockVectorEngine);
  });

  it('should rebuild namespace from MongoDB embeddings without calling Ollama', async () => {
    const ownerId = new mongoose.Types.ObjectId();
    const namespace = `user_${ownerId.toString()}`;

    // Create 2 chunks in MongoDB
    await new DocumentChunk({
      ownerId,
      documentId: new mongoose.Types.ObjectId(),
      chunkIndex: 0,
      text: 'Chunk 1 text',
      embedding: [0.1, 0.2, 0.3],
      embeddingModel: 'nomic-embed-text',
      embeddingDimensions: 3,
      engineVectorId: 'vec_1',
      engineNamespace: namespace,
    }).save();

    await new DocumentChunk({
      ownerId,
      documentId: new mongoose.Types.ObjectId(),
      chunkIndex: 1,
      text: 'Chunk 2 text',
      embedding: [0.4, 0.5, 0.6],
      embeddingModel: 'nomic-embed-text',
      embeddingDimensions: 3,
      engineVectorId: 'vec_2',
      engineNamespace: namespace,
    }).save();

    vi.spyOn(mockVectorEngine, 'rebuildNamespace').mockResolvedValueOnce({
      namespace,
      rebuilt: true,
      vectorCount: 2,
      status: 'ready',
    });

    const res = await syncService.rebuildNamespace(namespace, ownerId.toString());

    expect(res.rebuilt).toBe(true);
    expect(res.vectorCount).toBe(2);

    // CRITICAL: Verify ZERO Ollama calls were made!
    expect(mockOllama.generateEmbedding).not.toHaveBeenCalled();
    expect(mockOllama.generateEmbeddings).not.toHaveBeenCalled();

    // Verify VectorEngineClient rebuild call
    expect(mockVectorEngine.rebuildNamespace).toHaveBeenCalledWith(
      namespace,
      expect.arrayContaining([
        expect.objectContaining({ id: 'vec_1', values: [0.1, 0.2, 0.3] }),
        expect.objectContaining({ id: 'vec_2', values: [0.4, 0.5, 0.6] }),
      ]),
      'cosine',
    );
  });

  it('should prevent concurrent duplicate rebuilds for the same namespace', async () => {
    const ownerId = new mongoose.Types.ObjectId();
    const namespace = `user_${ownerId.toString()}`;

    let resolveRebuild: (val: any) => void;
    const rebuildPromise = new Promise<{ namespace: string; rebuilt: boolean; vectorCount: number; status: string }>((resolve) => {
      resolveRebuild = resolve;
    });

    vi.spyOn(mockVectorEngine, 'rebuildNamespace').mockImplementationOnce(() => rebuildPromise);

    // Call rebuild twice concurrently
    const call1 = syncService.rebuildNamespace(namespace, ownerId.toString());
    const call2 = syncService.rebuildNamespace(namespace, ownerId.toString());

    resolveRebuild!({
      namespace,
      rebuilt: true,
      vectorCount: 0,
      status: 'ready',
    });

    const [res1, res2] = await Promise.all([call1, call2]);

    expect(res1).toBe(res2); // Returned identical promise/result
    expect(mockVectorEngine.rebuildNamespace).toHaveBeenCalledTimes(1); // Executed only ONCE
  });

  it('should check consistency and detect SYNCHRONIZED, OUT_OF_SYNC, and MISSING_INDEX', async () => {
    const ownerId = new mongoose.Types.ObjectId();
    const namespace = `user_${ownerId.toString()}`;

    await new DocumentChunk({
      ownerId,
      documentId: new mongoose.Types.ObjectId(),
      chunkIndex: 0,
      text: 'Text',
      embedding: [0.1],
      embeddingModel: 'test',
      embeddingDimensions: 1,
      engineVectorId: 'v1',
      engineNamespace: namespace,
    }).save();

    // 1. Synchronized
    vi.spyOn(mockVectorEngine, 'getNamespaceStatus').mockResolvedValueOnce({
      namespace,
      status: 'ready',
      vectorCount: 1,
      dims: 1,
    });

    const check1 = await syncService.checkNamespaceConsistency(namespace, ownerId.toString());
    expect(check1.status).toBe('SYNCHRONIZED');
    expect(check1.checksum).toBeDefined();

    // 2. Out of sync
    vi.spyOn(mockVectorEngine, 'getNamespaceStatus').mockResolvedValueOnce({
      namespace,
      status: 'ready',
      vectorCount: 5, // Expected 1, got 5
      dims: 1,
    });

    const check2 = await syncService.checkNamespaceConsistency(namespace, ownerId.toString());
    expect(check2.status).toBe('OUT_OF_SYNC');

    // 3. Missing index
    vi.spyOn(mockVectorEngine, 'getNamespaceStatus').mockRejectedValueOnce(
      new VectorEngineNotFoundError('Namespace not found'),
    );

    const check3 = await syncService.checkNamespaceConsistency(namespace, ownerId.toString());
    expect(check3.status).toBe('MISSING_INDEX');
  });
});
