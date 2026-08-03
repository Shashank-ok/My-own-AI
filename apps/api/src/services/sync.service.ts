import crypto from 'crypto';
import mongoose from 'mongoose';
import { DocumentChunk } from '../models/DocumentChunk';
import { VectorEngineClient, VectorItemInput } from '../clients/vectorEngine.client';
import { VectorEngineNotFoundError } from '../errors/vectorEngine.errors';

export interface ConsistencyCheckResult {
  namespace: string;
  ownerId: string;
  expectedCount: number;
  actualCount: number;
  status: 'SYNCHRONIZED' | 'OUT_OF_SYNC' | 'MISSING_INDEX' | 'REBUILDING';
  checksum: string;
}

export class SyncService {
  private vectorEngineClient: VectorEngineClient;
  private activeRebuilds = new Map<
    string,
    Promise<{ namespace: string; rebuilt: boolean; vectorCount: number; status: string }>
  >();

  constructor(vectorEngineClient = new VectorEngineClient()) {
    this.vectorEngineClient = vectorEngineClient;
  }

  /**
   * Rebuild a user namespace from MongoDB durable storage.
   * Lock-protected to prevent concurrent duplicate rebuilds for the same namespace.
   * Reads embeddings directly from MongoDB — 0 Ollama calls.
   */
  async rebuildNamespace(
    namespace: string,
    ownerId: string,
  ): Promise<{ namespace: string; rebuilt: boolean; vectorCount: number; status: string }> {
    if (!namespace || namespace.trim().length === 0) {
      const err = new Error('Namespace is required for rebuild') as Error & { statusCode?: number };
      err.statusCode = 400;
      throw err;
    }

    // Concurrent rebuild lock check
    if (this.activeRebuilds.has(namespace)) {
      console.log(`[SyncService] Rebuild already in progress for '${namespace}', attaching to active rebuild...`);
      return this.activeRebuilds.get(namespace)!;
    }

    const rebuildPromise = this.executeRebuild(namespace, ownerId);
    this.activeRebuilds.set(namespace, rebuildPromise);

    try {
      const result = await rebuildPromise;
      return result;
    } finally {
      this.activeRebuilds.delete(namespace);
    }
  }

  private async executeRebuild(
    namespace: string,
    ownerId: string,
  ): Promise<{ namespace: string; rebuilt: boolean; vectorCount: number; status: string }> {
    const ownerObjectId = new mongoose.Types.ObjectId(ownerId);

    // 1. Query all chunks for owner from MongoDB
    const chunks = await DocumentChunk.find(
      { ownerId: ownerObjectId, engineNamespace: namespace },
      'engineVectorId embedding metadata',
    );

    // 2. Map into vector items (zero Ollama calls!)
    const vectorItems: VectorItemInput[] = chunks.map((chunk) => ({
      id: chunk.engineVectorId,
      values: chunk.embedding,
      metadata: (chunk.metadata as Record<string, unknown>) || {},
    }));

    // 3. Perform atomic namespace rebuild in C++ engine
    try {
      const result = await this.vectorEngineClient.rebuildNamespace(
        namespace,
        vectorItems,
        'cosine',
      );
      console.log(`[SyncService] Successfully rebuilt namespace '${namespace}' with ${result.vectorCount} vectors.`);
      return result;
    } catch (error) {
      console.error(`❌ [SyncService] Rebuild failed for namespace '${namespace}': ${(error as Error)?.message}`);
      throw error;
    }
  }

  /**
   * Check consistency between MongoDB source of truth and C++ vector engine index.
   */
  async checkNamespaceConsistency(
    namespace: string,
    ownerId: string,
  ): Promise<ConsistencyCheckResult> {
    const ownerObjectId = new mongoose.Types.ObjectId(ownerId);

    // Check lock state
    if (this.activeRebuilds.has(namespace)) {
      return {
        namespace,
        ownerId,
        expectedCount: 0,
        actualCount: 0,
        status: 'REBUILDING',
        checksum: '',
      };
    }

    // 1. MongoDB expected count & checksum calculation
    const chunks = await DocumentChunk.find(
      { ownerId: ownerObjectId, engineNamespace: namespace },
      'engineVectorId',
    ).sort({ engineVectorId: 1 });

    const expectedCount = chunks.length;
    const sortedIds = chunks.map((c) => c.engineVectorId).join(',');
    const checksum = crypto.createHash('sha256').update(sortedIds).digest('hex');

    // 2. C++ Engine actual count
    let actualCount = 0;
    let engineStatus = 'SYNCHRONIZED';

    try {
      const statusRes = await this.vectorEngineClient.getNamespaceStatus(namespace);
      actualCount = statusRes.vectorCount || 0;

      if (actualCount !== expectedCount) {
        engineStatus = 'OUT_OF_SYNC';
      }
    } catch (error) {
      if (error instanceof VectorEngineNotFoundError) {
        engineStatus = 'MISSING_INDEX';
      } else {
        throw error;
      }
    }

    return {
      namespace,
      ownerId,
      expectedCount,
      actualCount,
      status: engineStatus as ConsistencyCheckResult['status'],
      checksum,
    };
  }
}
