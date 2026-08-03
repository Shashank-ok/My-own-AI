import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { OllamaClient } from '../src/clients/ollama.client';
import { VectorEngineClient } from '../src/clients/vectorEngine.client';
import {
  setupMongoMemoryServer,
  teardownMongoMemoryServer,
  clearMongoMemoryServer,
} from './models/setup';

describe('Security Baseline Test Suite', () => {
  let userAToken: string;
  let userBToken: string;

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
    vi.spyOn(OllamaClient.prototype, 'generateCompletion').mockResolvedValue('Mock RAG completion response.');

    vi.spyOn(VectorEngineClient.prototype, 'insertBatch').mockImplementation(async (namespace, vectors) => {
      return { inserted: vectors.length, updated: 0, rejected: 0, namespace };
    });
    vi.spyOn(VectorEngineClient.prototype, 'searchVectors').mockImplementation(async (namespace) => {
      return { namespace, algorithm: 'hnsw', metric: 'cosine', latencyUs: 10, hits: [] };
    });
    vi.spyOn(VectorEngineClient.prototype, 'deleteVector').mockImplementation(async () => ({ deleted: true }));

    // Register User A
    const regA = await request(app).post('/auth/register').send({
      email: 'userA@example.com',
      password: 'passwordA123!',
      name: 'User A',
    });
    userAToken = regA.body.token;

    // Register User B
    const regB = await request(app).post('/auth/register').send({
      email: 'userB@example.com',
      password: 'passwordB123!',
      name: 'User B',
    });
    userBToken = regB.body.token;
  });

  describe('Unauthorized Access Enforcement', () => {
    it('should reject unauthenticated requests to protected endpoints with HTTP 401', async () => {
      const endpoints = [
        { method: 'get', path: '/api/documents' },
        { method: 'post', path: '/api/documents' },
        { method: 'post', path: '/api/search' },
        { method: 'post', path: '/api/chat/ask' },
        { method: 'get', path: '/api/chat/conversations' },
        { method: 'get', path: '/api/admin/namespaces/user_123/status' },
      ];

      for (const ep of endpoints) {
        let reqCall;
        if (ep.method === 'get') reqCall = request(app).get(ep.path);
        else reqCall = request(app).post(ep.path).send({});

        const res = await reqCall;
        expect(res.status).toBe(401);
        expect(res.body.error.message).toContain('token is required');
      }
    });
  });

  describe('Cross-User Authorization & Data Isolation', () => {
    it('should prevent User B from accessing, modifying, or deleting User A documents', async () => {
      // User A creates a document
      const docRes = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          title: 'User A Confidential Document',
          text: 'Private data belonging strictly to User A.',
        });

      const docId = docRes.body.document._id;

      // User B attempts GET User A's document -> 404 Not Found
      const getRes = await request(app)
        .get(`/api/documents/${docId}`)
        .set('Authorization', `Bearer ${userBToken}`);
      expect(getRes.status).toBe(404);

      // User B attempts DELETE User A's document -> 404 Not Found
      const delRes = await request(app)
        .delete(`/api/documents/${docId}`)
        .set('Authorization', `Bearer ${userBToken}`);
      expect(delRes.status).toBe(404);
    });

    it('should prevent User B from accessing or deleting User A conversations', async () => {
      // User A starts a conversation
      const askRes = await request(app)
        .post('/api/chat/ask')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ question: 'User A private question' });

      const convId = askRes.body.conversationId;

      // User B attempts GET User A's conversation -> 404 Not Found
      const getRes = await request(app)
        .get(`/api/chat/conversations/${convId}`)
        .set('Authorization', `Bearer ${userBToken}`);
      expect(getRes.status).toBe(404);

      // User B attempts DELETE User A's conversation -> 404 Not Found
      const delRes = await request(app)
        .delete(`/api/chat/conversations/${convId}`)
        .set('Authorization', `Bearer ${userBToken}`);
      expect(delRes.status).toBe(404);
    });
  });

  describe('Server-Side Namespace Derivation & Strict Validation', () => {
    it('should reject client attempts to supply custom namespace parameter via strict Zod schema', async () => {
      // Send search request with attempted namespace override
      const searchRes = await request(app)
        .post('/api/search')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          query: 'test query',
          namespace: 'user_OTHER_VICTIM', // Attempted override
        });

      expect(searchRes.status).toBe(400);
      expect(searchRes.body.error.message).toBe('Validation error');
    });

    it('should automatically derive user namespace on server for valid search requests', async () => {
      const searchRes = await request(app)
        .post('/api/search')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          query: 'valid search query',
        });

      expect(searchRes.status).toBe(200);
      const userAId = JSON.parse(Buffer.from(userAToken.split('.')[1], 'base64').toString()).userId;
      expect(searchRes.body.namespace).toBe(`user_${userAId}`);
    });
  });

  describe('CORS Restrictions', () => {
    it('should reject CORS preflight from un-whitelisted origin', async () => {
      const res = await request(app)
        .options('/api/documents')
        .set('Origin', 'http://malicious-website.com');

      expect(res.status).toBe(500); // CORS policy rejection
    });
  });
});
