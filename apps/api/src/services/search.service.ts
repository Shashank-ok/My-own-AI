import mongoose from 'mongoose';
import { DocumentModel } from '../models/Document';
import { DocumentChunk, IDocumentChunk } from '../models/DocumentChunk';
import { OllamaClient, generateFallbackEmbedding } from '../clients/ollama.client';
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

    // 1. Generate query embedding (with Ollama fallback)
    let queryVector: number[];
    try {
      queryVector = await this.ollamaClient.generateEmbedding(input.query.trim());
    } catch {
      console.warn('[SearchService] Ollama unavailable — using fallback embedding for query.');
      queryVector = generateFallbackEmbedding(input.query.trim(), 768);
    }

    // 2. Try vector engine search; fall back to MongoDB text search if engine is offline
    const searchOptions: SearchOptions = {
      algorithm: input.algorithm,
      metric: input.metric,
    };

    let useMongoFallback = false;
    let engineResult: { hits: { id: string; distance: number }[]; latencyUs?: number } | null = null;

    try {
      engineResult = await this.vectorEngineClient.searchVectors(
        engineNamespace,
        queryVector,
        k,
        searchOptions,
      );
    } catch (error) {
      if (error instanceof VectorEngineNotFoundError) {
        // Namespace missing — attempt lazy rebuild and retry once
        console.warn(`[SearchService] Namespace '${engineNamespace}' not found. Triggering lazy recovery...`);
        try {
          await this.syncService.rebuildNamespace(engineNamespace, input.ownerId);
          engineResult = await this.vectorEngineClient.searchVectors(
            engineNamespace,
            queryVector,
            k,
            searchOptions,
          );
        } catch {
          console.warn('[SearchService] Lazy recovery failed — falling back to MongoDB text search.');
          useMongoFallback = true;
        }
      } else {
        // Engine unavailable (not deployed on Render) — fall back silently
        console.warn(`[SearchService] Vector engine unavailable (${(error as Error)?.message}) — falling back to MongoDB text search.`);
        useMongoFallback = true;
      }
    }

    // ── MongoDB text-search fallback ────────────────────────────────────────
    if (useMongoFallback || !engineResult) {
      const filterDocIds = input.documentIds && input.documentIds.length > 0
        ? input.documentIds.map((id) => new mongoose.Types.ObjectId(id))
        : null;

      const mongoQuery: Record<string, unknown> = {
        ownerId: ownerObjectId,
        text: { $regex: input.query.trim().split(/\s+/).join('|'), $options: 'i' },
      };
      if (filterDocIds) mongoQuery.documentId = { $in: filterDocIds };

      const mongoChunks = await DocumentChunk.find(mongoQuery).limit(k);

      if (mongoChunks.length === 0) {
        return { query: input.query, namespace: engineNamespace, totalHits: 0, latencyUs: 0, results: [] };
      }

      const docIds = [...new Set(mongoChunks.map((c) => c.documentId.toString()))]
        .map((id) => new mongoose.Types.ObjectId(id));
      const docs = await DocumentModel.find({ _id: { $in: docIds }, ownerId: ownerObjectId }, 'title');
      const docTitleMap = new Map(docs.map((d) => [d._id.toString(), d.title]));

      const results: FormattedSearchHit[] = mongoChunks.map((chunk, i) => ({
        chunkId: (chunk._id as mongoose.Types.ObjectId).toString(),
        documentId: chunk.documentId.toString(),
        documentTitle: docTitleMap.get(chunk.documentId.toString()) || 'Untitled Document',
        text: chunk.text,
        distance: i * 0.1, // Positional rank proxy (no real distance without vector engine)
        chunkIndex: chunk.chunkIndex,
        metadata: (chunk.metadata as Record<string, unknown>) || {},
      }));

      return { query: input.query, namespace: engineNamespace, totalHits: results.length, latencyUs: 0, results };
    }

    // ── Vector engine path ───────────────────────────────────────────────────
    if (!engineResult.hits || engineResult.hits.length === 0) {
      return { query: input.query, namespace: engineNamespace, totalHits: 0, latencyUs: engineResult.latencyUs || 0, results: [] };
    }

    const hitVectorIds = engineResult.hits.map((h) => h.id);

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

    const docObjectIds = Array.from(docObjectIdsSet).map((id) => new mongoose.Types.ObjectId(id));
    const documents = await DocumentModel.find({ _id: { $in: docObjectIds }, ownerId: ownerObjectId }, 'title');
    const docTitleMap = new Map<string, string>();
    documents.forEach((d) => { docTitleMap.set(d._id.toString(), d.title); });

    const filterDocIds = input.documentIds && input.documentIds.length > 0
      ? new Set(input.documentIds)
      : null;

    const formattedResults: FormattedSearchHit[] = [];
    for (const hit of engineResult.hits) {
      const chunk = chunkMap.get(hit.id);
      if (!chunk) { console.warn(`[Search] Stale vector ID: ${hit.id}`); continue; }
      if (chunk.ownerId.toString() !== input.ownerId) { console.warn(`[Search] Ownership mismatch: ${hit.id}`); continue; }
      const docIdStr = chunk.documentId.toString();
      if (filterDocIds && !filterDocIds.has(docIdStr)) continue;
      formattedResults.push({
        chunkId: (chunk._id as mongoose.Types.ObjectId).toString(),
        documentId: docIdStr,
        documentTitle: docTitleMap.get(docIdStr) || 'Untitled Document',
        text: chunk.text,
        distance: hit.distance,
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
