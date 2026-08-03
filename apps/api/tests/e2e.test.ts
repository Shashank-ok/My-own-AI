import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { OllamaClient } from '../src/clients/ollama.client';
import { VectorEngineClient } from '../src/clients/vectorEngine.client';
import { DocumentChunk } from '../src/models/DocumentChunk';
import {
  setupMongoMemoryServer,
  teardownMongoMemoryServer,
  clearMongoMemoryServer,
} from './models/setup';

describe('End-to-End Complete User Lifecycle Test', () => {
  beforeAll(async () => {
    await setupMongoMemoryServer();
  });

  afterAll(async () => {
    await teardownMongoMemoryServer();
  });

  beforeEach(async () => {
    await clearMongoMemoryServer();

    vi.spyOn(OllamaClient.prototype, 'generateEmbedding').mockImplementation(async () => [0.1, 0.2, 0.3]);
    vi.spyOn(OllamaClient.prototype, 'generateEmbeddings').mockImplementation(async (texts) => {
      return texts.map(() => [0.1, 0.2, 0.3]);
    });
    vi.spyOn(OllamaClient.prototype, 'generateCompletion').mockResolvedValue(
      'The architecture consists of Node.js API gateway, C++ vector engine, and Ollama embeddings.',
    );

    vi.spyOn(VectorEngineClient.prototype, 'insertBatch').mockImplementation(async (namespace, vectors) => {
      return { inserted: vectors.length, updated: 0, rejected: 0, namespace };
    });
    vi.spyOn(VectorEngineClient.prototype, 'rebuildNamespace').mockImplementation(async (namespace, vectors) => {
      return { namespace, vectorCount: vectors.length, status: 'completed' };
    });
    vi.spyOn(VectorEngineClient.prototype, 'getNamespaceStatus').mockImplementation(async (namespace) => {
      return { namespace, vectorCount: 2, exists: true };
    });
  });

  it('should execute full E2E user lifecycle: register, login, ingest document, search, ask RAG, fetch conversation, rebuild namespace, delete resources', async () => {
    // 1. User Registration
    const regRes = await request(app).post('/auth/register').send({
      email: 'e2e.user@example.com',
      password: 'StrongPassword123!',
      name: 'E2E User',
    });
    expect(regRes.status).toBe(201);
    expect(regRes.body).toHaveProperty('token');
    expect(regRes.body.user.email).toBe('e2e.user@example.com');

    // 2. User Login
    const loginRes = await request(app).post('/auth/login').send({
      email: 'e2e.user@example.com',
      password: 'StrongPassword123!',
    });
    expect(loginRes.status).toBe(200);
    const token = loginRes.body.token;

    // 3. User Profile Verification
    const profileRes = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(profileRes.status).toBe(200);
    expect(profileRes.body.user.name).toBe('E2E User');

    // 4. Ingest Document
    const docRes = await request(app)
      .post('/api/documents')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'System Architecture Specification',
        text: 'The system architecture connects a high-performance C++ HNSW vector index with a durable Node.js API and MongoDB source of truth.',
        chunkSize: 100,
        chunkOverlap: 10,
      });

    expect(docRes.status).toBe(201);
    expect(docRes.body.document.status).toBe('completed');
    expect(docRes.body.document.chunkCount).toBeGreaterThan(0);
    const docId = docRes.body.document._id;

    // 5. Fetch Single Document
    const getDocRes = await request(app)
      .get(`/api/documents/${docId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(getDocRes.status).toBe(200);
    expect(getDocRes.body.document.title).toBe('System Architecture Specification');

    // Fetch the stored DocumentChunks from MongoDB to get exact engineVectorId
    const storedChunks = await DocumentChunk.find({ documentId: docId });
    expect(storedChunks.length).toBeGreaterThan(0);
    const firstChunkEngineId = storedChunks[0].engineVectorId;

    // 6. Mock Search Engine Hits for VectorEngineClient
    vi.spyOn(VectorEngineClient.prototype, 'searchVectors').mockImplementation(async (namespace) => {
      return {
        namespace,
        algorithm: 'hnsw',
        metric: 'cosine',
        latencyUs: 50,
        hits: [{ id: firstChunkEngineId, distance: 0.05 }],
      };
    });

    // 7. Perform Semantic Search
    const searchRes = await request(app)
      .post('/api/search')
      .set('Authorization', `Bearer ${token}`)
      .send({
        query: 'What is the system architecture?',
        k: 3,
      });

    expect(searchRes.status).toBe(200);
    expect(searchRes.body.results.length).toBeGreaterThan(0);
    expect(searchRes.body.results[0].documentTitle).toBe('System Architecture Specification');

    // 8. Ask RAG Question
    const ragRes = await request(app)
      .post('/api/chat/ask')
      .set('Authorization', `Bearer ${token}`)
      .send({
        question: 'Explain the architecture components.',
        k: 3,
      });

    expect(ragRes.status).toBe(200);
    expect(ragRes.body).toHaveProperty('conversationId');
    expect(ragRes.body.answer).toContain('Node.js API gateway');
    expect(ragRes.body.sources.length).toBeGreaterThan(0);
    const conversationId = ragRes.body.conversationId;

    // 9. Fetch Conversation Details
    const convRes = await request(app)
      .get(`/api/chat/conversations/${conversationId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(convRes.status).toBe(200);
    expect(convRes.body.conversation.messages.length).toBe(2); // 1 user + 1 assistant

    // 10. Rebuild Admin Namespace
    const userAId = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString()).userId;
    const userNamespace = `user_${userAId}`;

    const rebuildRes = await request(app)
      .post(`/api/admin/namespaces/${userNamespace}/rebuild`)
      .set('Authorization', `Bearer ${token}`);
    expect(rebuildRes.status).toBe(200);
    expect(rebuildRes.body.status).toBe('completed');

    // 11. Delete Document and Conversation Cleanup
    const delDocRes = await request(app)
      .delete(`/api/documents/${docId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(delDocRes.status).toBe(200);

    const delConvRes = await request(app)
      .delete(`/api/chat/conversations/${conversationId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(delConvRes.status).toBe(200);
  });
});
