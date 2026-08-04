import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { OllamaClient } from '../src/clients/ollama.client';
import { VectorEngineClient } from '../src/clients/vectorEngine.client';
import { loadConfig } from '../src/config/env';
import {
  setupMongoMemoryServer,
  teardownMongoMemoryServer,
  clearMongoMemoryServer,
} from './models/setup';

const config = loadConfig(process.env);

describe('End-to-End Complete System Integration Test Suite', () => {
  let isOllamaAvailable = false;
  let isVectorEngineAvailable = false;

  beforeAll(async () => {
    await setupMongoMemoryServer();
    await clearMongoMemoryServer();

    // 1. Check live Ollama availability
    try {
      const ollamaClient = new OllamaClient(config.ollamaUrl, config.ollamaEmbeddingModel);
      isOllamaAvailable = await ollamaClient.healthCheck();
    } catch {
      isOllamaAvailable = false;
    }

    // 2. Check live C++ Vector Engine availability
    try {
      const vectorClient = new VectorEngineClient(config.cppEngineUrl);
      const health = await vectorClient.getHealth();
      isVectorEngineAvailable = health.status === 'ok';
    } catch {
      isVectorEngineAvailable = false;
    }

    if (!isOllamaAvailable) {
      console.warn('[E2E Suite] Live Ollama is unavailable at ' + config.ollamaUrl + '. Mocking embedding & completion providers for fallback tier test.');
      vi.spyOn(OllamaClient.prototype, 'generateEmbedding').mockImplementation(async () => [0.1, 0.2, 0.3, 0.4]);
      vi.spyOn(OllamaClient.prototype, 'generateEmbeddings').mockImplementation(async (texts) => texts.map(() => [0.1, 0.2, 0.3, 0.4]));
      vi.spyOn(OllamaClient.prototype, 'generateCompletion').mockImplementation(async () => 'Deterministic assistant answer powered by C++ vector retrieval.');
    }

    if (!isVectorEngineAvailable) {
      console.warn('[E2E Suite] Live C++ Vector Engine is unavailable at ' + config.cppEngineUrl + '. Mocking vector engine calls for fallback tier test.');
      vi.spyOn(VectorEngineClient.prototype, 'insertBatch').mockImplementation(async (namespace, vectors) => ({ inserted: vectors.length, updated: 0, rejected: 0, namespace }));
      vi.spyOn(VectorEngineClient.prototype, 'searchVectors').mockImplementation(async (namespace) => ({ namespace, algorithm: 'hnsw', metric: 'cosine', latencyUs: 100, hits: [] }));
      vi.spyOn(VectorEngineClient.prototype, 'deleteVector').mockImplementation(async () => ({ success: true }));
    }
  });

  afterAll(async () => {
    await teardownMongoMemoryServer();
  });

  it('should execute complete 8-step user lifecycle workflow with data cleanup', async () => {
    const timestamp = Date.now();
    const testEmail = `integration.user.${timestamp}@example.com`;
    const testPassword = 'IntegrationPassword123!';
    const testName = 'Integration E2E User';

    // Step 1: Register User
    const regRes = await request(app)
      .post('/auth/register')
      .send({ email: testEmail, password: testPassword, name: testName });

    if (regRes.status !== 201) {
      console.error('[E2E Failure Log] Step 1 Register failed:', regRes.body);
    }
    expect(regRes.status).toBe(201);
    expect(regRes.body).toHaveProperty('token');
    expect(regRes.body.user.email).toBe(testEmail);

    // Step 2: Log in
    const loginRes = await request(app)
      .post('/auth/login')
      .send({ email: testEmail, password: testPassword });

    if (loginRes.status !== 200) {
      console.error('[E2E Failure Log] Step 2 Login failed:', loginRes.body);
    }
    expect(loginRes.status).toBe(200);
    const token = loginRes.body.token;
    expect(token).toBeDefined();

    // Step 3: Create Document (Deterministic Input)
    const docTitle = `System Architecture Manual ${timestamp}`;
    const docText = 'The My Own AI monorepo integrates a C++17 vector engine, Node.js REST API gateway, and React frontend.';

    const createDocRes = await request(app)
      .post('/api/documents')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: docTitle,
        text: docText,
        chunkSize: 100,
        chunkOverlap: 10,
      });

    if (createDocRes.status !== 201) {
      console.error('[E2E Failure Log] Step 3 Document Creation failed:', createDocRes.body);
    }
    expect(createDocRes.status).toBe(201);
    const docId = createDocRes.body.document._id;
    expect(docId).toBeDefined();

    // Step 4: Verify Ingestion
    const getDocRes = await request(app)
      .get(`/api/documents/${docId}`)
      .set('Authorization', `Bearer ${token}`);

    if (getDocRes.status !== 200) {
      console.error('[E2E Failure Log] Step 4 Document Ingestion Check failed:', getDocRes.body);
    }
    expect(getDocRes.status).toBe(200);
    expect(getDocRes.body.document.title).toBe(docTitle);
    expect(getDocRes.body.document.status).toBe('completed');
    expect(getDocRes.body.document.chunkCount).toBeGreaterThan(0);

    // Step 5: Perform Semantic Search
    const searchRes = await request(app)
      .post('/api/search')
      .set('Authorization', `Bearer ${token}`)
      .send({
        query: 'What architecture does the platform use?',
        k: 3,
      });

    if (searchRes.status !== 200) {
      console.error('[E2E Failure Log] Step 5 Semantic Search failed:', searchRes.body);
    }
    expect(searchRes.status).toBe(200);
    expect(Array.isArray(searchRes.body.results)).toBe(true);

    // Step 6: Ask RAG Question
    const ragRes = await request(app)
      .post('/api/chat/ask')
      .set('Authorization', `Bearer ${token}`)
      .send({
        question: 'Describe the monorepo architecture components.',
        k: 3,
      });

    if (ragRes.status !== 200) {
      console.error('[E2E Failure Log] Step 6 RAG Ask Question failed:', ragRes.body);
    }
    expect(ragRes.status).toBe(200);
    expect(ragRes.body).toHaveProperty('answer');
    expect(typeof ragRes.body.answer).toBe('string');
    const conversationId = ragRes.body.conversationId;

    // Step 7: Verify Sources
    expect(Array.isArray(ragRes.body.sources)).toBe(true);

    // Step 8: Clean Up Created Data (Delete Document & Conversation)
    const delDocRes = await request(app)
      .delete(`/api/documents/${docId}`)
      .set('Authorization', `Bearer ${token}`);

    if (delDocRes.status !== 200) {
      console.error('[E2E Failure Log] Step 8 Document Deletion failed:', delDocRes.body);
    }
    expect(delDocRes.status).toBe(200);

    if (conversationId) {
      const delConvRes = await request(app)
        .delete(`/api/chat/conversations/${conversationId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(delConvRes.status).toBe(200);
    }

    // Verify Cleanup Confirmation
    const checkDeletedDoc = await request(app)
      .get(`/api/documents/${docId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(checkDeletedDoc.status).toBe(404);
  });
});
