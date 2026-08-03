import mongoose from 'mongoose';
import { DocumentModel } from '../models/Document';
import { DocumentChunk, IDocumentChunk } from '../models/DocumentChunk';
import { OllamaClient } from '../clients/ollama.client';
import { VectorEngineClient, SearchOptions } from '../clients/vectorEngine.client';
import { VectorEngineNotFoundError } from '../errors/vectorEngine.errors';
import { SyncService } from './sync.service';

export interface SearchInput {
  ownerId: string;
  query: string;
  k?: number;
  documentIds?: string[];
  algorithm?: 'bruteforce' | 'kdtree' | 'hnsw';
  metric?: 'cosine' | 'euclidean' | 'manhattan';
}

export interface FormattedSearchHit {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  text: string;
  distance: number;
  chunkIndex: number;
  metadata: Record<string, unknown>;
}

export interface SearchResponse {
  query: string;
  namespace: string;
  totalHits: number;
  latencyUs: number;
  results: FormattedSearchHit[];
}

export class SearchService {
  private ollamaClient: OllamaClient;
  private vectorEngineClient: VectorEngineClient;
  private syncService: SyncService;

  constructor(
    ollamaClient = new OllamaClient(),
    vectorEngineClient = new VectorEngineClient(),
    syncService = new SyncService(vectorEngineClient),
  ) {
    this.ollamaClient = ollamaClient;
    this.vectorEngineClient = vectorEngineClient;
    this.syncService = syncService;
  }

  async search(input: SearchInput): Promise<SearchResponse> {
    if (!input.query || input.query.trim().length === 0) {
      const err = new Error('Search query is required and cannot be empty') as Error & { statusCode?: number };
      err.statusCode = 400;
      throw err;
    }

    const ownerObjectId = new mongoose.Types.ObjectId(input.ownerId);
    const engineNamespace = `user_${input.ownerId}`;
    const k = input.k || 5;

    // 1. Generate query embedding through Ollama client
    const queryVector = await this.ollamaClient.generateEmbedding(input.query.trim());

    // 2. Search C++ vector engine with lazy recovery fallback
    const searchOptions: SearchOptions = {
      algorithm: input.algorithm,
      metric: input.metric,
    };

    let engineResult;
    try {
      engineResult = await this.vectorEngineClient.searchVectors(
        engineNamespace,
        queryVector,
        k,
        searchOptions,
      );
    } catch (error) {
      // Lazy Recovery: If namespace is missing in C++ engine (e.g. engine restart), rebuild index & retry once!
      if (error instanceof VectorEngineNotFoundError) {
        console.warn(`[SearchService] Namespace '${engineNamespace}' not found in engine index. Triggering automatic lazy recovery...`);
        await this.syncService.rebuildNamespace(engineNamespace, input.ownerId);
        engineResult = await this.vectorEngineClient.searchVectors(
          engineNamespace,
          queryVector,
          k,
          searchOptions,
        );
      } else {
        throw error;
      }
    }

    if (!engineResult.hits || engineResult.hits.length === 0) {
      return {
        query: input.query,
        namespace: engineNamespace,
        totalHits: 0,
        latencyUs: engineResult.latencyUs || 0,
        results: [],
      };
    }

    // 3. Extract vector IDs returned by engine
    const hitVectorIds = engineResult.hits.map((h) => h.id);

    // 4. Hydrate matching DocumentChunks from MongoDB enforcing ownerId
    const chunks = await DocumentChunk.find({
      engineVectorId: { $in: hitVectorIds },
      ownerId: ownerObjectId,
    });

    const chunkMap = new Map<string, IDocumentChunk>();
    const docObjectIdsSet = new Set<string>();

    chunks.forEach((chunk) => {
      chunkMap.set(chunk.engineVectorId, chunk);
      docObjectIdsSet.add(chunk.documentId.toString());
    });

    // 5. Hydrate Document titles
    const docObjectIds = Array.from(docObjectIdsSet).map((id) => new mongoose.Types.ObjectId(id));
    const documents = await DocumentModel.find({
      _id: { $in: docObjectIds },
      ownerId: ownerObjectId,
    }, 'title');

    const docTitleMap = new Map<string, string>();
    documents.forEach((d) => {
      docTitleMap.set(d._id.toString(), d.title);
    });

    // Parse filter documentIds if provided
    const filterDocIds = input.documentIds && input.documentIds.length > 0
      ? new Set(input.documentIds)
      : null;

    // 6. Zero-trust verification & stale vector filtering
    const formattedResults: FormattedSearchHit[] = [];

    for (const hit of engineResult.hits) {
      const chunk = chunkMap.get(hit.id);

      // Stale engine vector check (exists in C++ engine but deleted/missing in MongoDB)
      if (!chunk) {
        console.warn(`[Search] Stale vector ID detected in engine index: ${hit.id}`);
        continue;
      }

      // Owner verification check
      if (chunk.ownerId.toString() !== input.ownerId) {
        console.warn(`[Search] Ownership mismatch for vector ID: ${hit.id}`);
        continue;
      }

      const docIdStr = chunk.documentId.toString();

      // Document filter check
      if (filterDocIds && !filterDocIds.has(docIdStr)) {
        continue;
      }

      formattedResults.push({
        chunkId: (chunk._id as mongoose.Types.ObjectId).toString(),
        documentId: docIdStr,
        documentTitle: docTitleMap.get(docIdStr) || 'Untitled Document',
        text: chunk.text,
        distance: hit.distance, // Raw distance metric (not probability)
        chunkIndex: chunk.chunkIndex,
        metadata: (chunk.metadata as Record<string, unknown>) || {},
      });
    }

    return {
      query: input.query,
      namespace: engineNamespace,
      totalHits: formattedResults.length,
      latencyUs: engineResult.latencyUs || 0,
      results: formattedResults,
    };
  }
}
