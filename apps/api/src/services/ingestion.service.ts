import mongoose from 'mongoose';
import { DocumentModel, IDocument } from '../models/Document';
import { DocumentChunk, IDocumentChunk } from '../models/DocumentChunk';
import { chunkText } from './chunker.service';
import { OllamaClient, generateFallbackEmbedding } from '../clients/ollama.client';
import { VectorEngineClient, VectorItemInput } from '../clients/vectorEngine.client';
import { config } from '../config/env';

export interface IngestDocumentInput {
  ownerId: string;
  title: string;
  text: string;
  originalFileName?: string;
  mimeType?: string;
  metadata?: Record<string, unknown>;
  chunkSize?: number;
  chunkOverlap?: number;
}

export class IngestionService {
  private ollamaClient: OllamaClient;
  private vectorEngineClient: VectorEngineClient;

  constructor(
    ollamaClient = new OllamaClient(),
    vectorEngineClient = new VectorEngineClient(),
  ) {
    this.ollamaClient = ollamaClient;
    this.vectorEngineClient = vectorEngineClient;
  }

  /**
   * Complete document ingestion pipeline orchestrator.
   */
  async ingestDocument(input: IngestDocumentInput): Promise<IDocument> {
    const ownerObjectId = new mongoose.Types.ObjectId(input.ownerId);

    // 1. Input validation & duplicate check
    if (!input.title || input.title.trim().length === 0) {
      const err = new Error('Document title is required') as Error & { statusCode?: number };
      err.statusCode = 400;
      throw err;
    }
    if (!input.text || input.text.trim().length === 0) {
      const err = new Error('Document text content is required') as Error & { statusCode?: number };
      err.statusCode = 400;
      throw err;
    }

    // Check duplicate active submission (same title & ownerId)
    const existingDoc = await DocumentModel.findOne({
      ownerId: ownerObjectId,
      title: input.title.trim(),
      status: { $in: ['pending', 'processing', 'completed'] },
    });
    if (existingDoc) {
      const err = new Error('A document with this title already exists') as Error & { statusCode?: number };
      err.statusCode = 409;
      throw err;
    }

    // 2. Create pending Document record
    const doc = new DocumentModel({
      ownerId: ownerObjectId,
      title: input.title.trim(),
      status: 'pending',
      chunkCount: 0,
      originalFileName: input.originalFileName,
      mimeType: input.mimeType,
      metadata: input.metadata || {},
    });
    await doc.save();

    // Execute background processing and await completion
    return this.processIngestion(doc, input.text, input.chunkSize, input.chunkOverlap);
  }

  /**
   * Process chunking, embedding generation, Mongo persistence, and C++ vector indexing.
   */
  private async processIngestion(
    doc: IDocument,
    text: string,
    chunkSize?: number,
    chunkOverlap?: number,
  ): Promise<IDocument> {
    const engineNamespace = `user_${doc.ownerId.toString()}`;
    const docIdStr = doc._id.toString();

    try {
      // Update status to processing
      doc.status = 'processing';
      doc.ingestionError = undefined;
      await doc.save();

      // Step A: Text chunking
      const chunks = chunkText(text, chunkSize, chunkOverlap);
      if (chunks.length === 0) {
        throw new Error('Document text produced zero valid chunks');
      }

      const chunkTexts = chunks.map((c) => c.text);

      // Step B: Generate embeddings via Ollama Client (fallback to deterministic vector if Ollama is offline)
      let embeddings: number[][];
      try {
        embeddings = await this.ollamaClient.generateEmbeddings(
          chunkTexts,
          4,
          config.ollamaEmbeddingModel,
        );
      } catch (err) {
        console.warn(`⚠️ Ollama embedding unavailable (${(err as Error)?.message}). Using fallback vector embeddings.`);
        embeddings = chunkTexts.map((text) => generateFallbackEmbedding(text, 768));
      }

      if (embeddings.length !== chunks.length) {
        throw new Error(`Embedding count mismatch: expected ${chunks.length}, got ${embeddings.length}`);
      }

      const dims = embeddings[0].length;

      // Step C: Construct & Save DocumentChunk records in MongoDB
      const chunkDocs: Partial<IDocumentChunk>[] = chunks.map((chunk, i) => {
        const engineVectorId = `doc_${docIdStr}_chunk_${chunk.chunkIndex}`;
        return {
          ownerId: doc.ownerId,
          documentId: doc._id as mongoose.Types.ObjectId,
          chunkIndex: chunk.chunkIndex,
          text: chunk.text,
          embedding: embeddings[i],
          embeddingModel: config.ollamaEmbeddingModel,
          embeddingDimensions: dims,
          engineVectorId,
          engineNamespace,
          metadata: { chunkIndex: chunk.chunkIndex },
        };
      });

      await DocumentChunk.insertMany(chunkDocs);

      // Step D: Batch index vectors in C++ engine (NO document text sent!)
      const vectorItems: VectorItemInput[] = chunkDocs.map((chunk) => ({
        id: chunk.engineVectorId!,
        values: chunk.embedding as number[],
        metadata: { chunkIndex: chunk.chunkIndex },
      }));

      await this.vectorEngineClient.insertBatch(engineNamespace, vectorItems);

      // Step E: Mark Document completed
      doc.status = 'completed';
      doc.chunkCount = chunks.length;
      await doc.save();

      return doc;
    } catch (error) {
      // Execute Failure Compensation Pipeline
      const errorMessage = (error as Error)?.message || 'Document ingestion failed';
      console.error(`❌ Ingestion failed for document ${docIdStr}: ${errorMessage}`);

      // 1. Clean up MongoDB DocumentChunks for this document
      await DocumentChunk.deleteMany({ documentId: doc._id });

      // 2. Mark Document status = 'failed'
      doc.status = 'failed';
      doc.ingestionError = errorMessage;
      await doc.save();

      throw error;
    }
  }

  /**
   * Delete a document, all associated MongoDB chunks, and C++ engine vectors.
   */
  async deleteDocument(ownerId: string, documentId: string): Promise<{ deleted: boolean }> {
    const ownerObjectId = new mongoose.Types.ObjectId(ownerId);
    const docObjectId = new mongoose.Types.ObjectId(documentId);

    const doc = await DocumentModel.findOne({ _id: docObjectId, ownerId: ownerObjectId });
    if (!doc) {
      const err = new Error('Document not found') as Error & { statusCode?: number };
      err.statusCode = 404;
      throw err;
    }

    const engineNamespace = `user_${ownerId}`;

    // 1. Fetch chunk vector IDs
    const chunks = await DocumentChunk.find({ documentId: docObjectId }, 'engineVectorId');
    const vectorIds = chunks.map((c) => c.engineVectorId);

    // 2. Delete vectors from C++ engine
    for (const vecId of vectorIds) {
      try {
        await this.vectorEngineClient.deleteVector(engineNamespace, vecId);
      } catch (_err) {
        // Ignore vector not found errors during deletion cleanup
      }
    }

    // 3. Delete MongoDB DocumentChunks & Document
    await DocumentChunk.deleteMany({ documentId: docObjectId });
    await DocumentModel.deleteOne({ _id: docObjectId });

    return { deleted: true };
  }

  /**
   * Retry ingestion for a failed document.
   */
  async retryIngestion(
    ownerId: string,
    documentId: string,
    text: string,
  ): Promise<IDocument> {
    const ownerObjectId = new mongoose.Types.ObjectId(ownerId);
    const docObjectId = new mongoose.Types.ObjectId(documentId);

    const doc = await DocumentModel.findOne({ _id: docObjectId, ownerId: ownerObjectId });
    if (!doc) {
      const err = new Error('Document not found') as Error & { statusCode?: number };
      err.statusCode = 404;
      throw err;
    }

    if (doc.status !== 'failed') {
      const err = new Error('Only failed documents can be retried') as Error & { statusCode?: number };
      err.statusCode = 400;
      throw err;
    }

    // Clean up any stale partial chunks before retrying
    await DocumentChunk.deleteMany({ documentId: docObjectId });

    return this.processIngestion(doc, text);
  }
}
