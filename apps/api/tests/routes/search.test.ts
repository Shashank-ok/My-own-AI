import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import { OllamaClient } from '../../src/clients/ollama.client';
import { VectorEngineClient } from '../../src/clients/vectorEngine.client';
import {
  setupMongoMemoryServer,
  teardownMongoMemoryServer,
  clearMongoMemoryServer,
} from '../models/setup';

describe('Search API Routes (/api/search)', () => {
  let userToken: string;

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

    vi.spyOn(VectorEngineClient.prototype, 'insertBatch').mockImplementation(async (namespace, vectors) => {
      return { inserted: vectors.length, updated: 0, rejected: 0, namespace };
    });

    vi.spyOn(VectorEngineClient.prototype, 'searchVectors').mockImplementation(async (namespace) => {
      return {
        namespace,
        algorithm: 'hnsw',
        metric: 'cosine',
        latencyUs: 55,
        hits: [],
      };
    });

    // Register user & obtain Bearer token
    const reg = await request(app).post('/auth/register').send({
      email: 'search.user@example.com',
      password: 'securePassword123!',
      name: 'Search User',
    });
    userToken = reg.body.token;
  });

  it('POST /api/search — should execute search when authenticated and return 200 OK', async () => {
    // Ingest a document
    await request(app)
      .post('/api/documents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        title: 'Search Test Doc',
        text: 'Semantic vector search finds relevant context chunks.',
      });

    const res = await request(app)
      .post('/api/search')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        query: 'semantic vector search',
        k: 5,
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('query', 'semantic vector search');
    expect(res.body).toHaveProperty('results');
    expect(res.body).toHaveProperty('totalHits');
    expect(res.body).toHaveProperty('latencyUs');
  });

  it('POST /api/search — should reject unauthorized request without Bearer token', async () => {
    const res = await request(app).post('/api/search').send({
      query: 'unauthorized search query',
    });

    expect(res.status).toBe(401);
  });

  it('POST /api/search — should reject request with empty query', async () => {
    const res = await request(app)
      .post('/api/search')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        query: '',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Validation error');
  });
});
