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

describe('Chat API Routes (/api/chat)', () => {
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
    vi.spyOn(OllamaClient.prototype, 'generateCompletion').mockResolvedValue(
      'This is a test LLM response generated for RAG.',
    );

    vi.spyOn(VectorEngineClient.prototype, 'insertBatch').mockImplementation(async (namespace, vectors) => {
      return { inserted: vectors.length, updated: 0, rejected: 0, namespace };
    });

    vi.spyOn(VectorEngineClient.prototype, 'searchVectors').mockImplementation(async (namespace) => {
      return {
        namespace,
        algorithm: 'hnsw',
        metric: 'cosine',
        latencyUs: 45,
        hits: [],
      };
    });

    // Register user & obtain token
    const reg = await request(app).post('/auth/register').send({
      email: 'chat.user@example.com',
      password: 'securePassword123!',
      name: 'Chat User',
    });
    userToken = reg.body.token;
  });

  it('POST /api/chat/ask — should execute RAG ask workflow and return 200 OK', async () => {
    const res = await request(app)
      .post('/api/chat/ask')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        question: 'What is vector search?',
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('conversationId');
    expect(res.body.answer).toBe('This is a test LLM response generated for RAG.');
    expect(res.body.sources).toBeDefined();
  });

  it('GET /api/chat/conversations — should list user conversations', async () => {
    await request(app)
      .post('/api/chat/ask')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ question: 'Question 1' });

    const res = await request(app)
      .get('/api/chat/conversations')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.conversations).toHaveLength(1);
  });

  it('GET /api/chat/conversations/:id — should return single conversation details with messages', async () => {
    const askRes = await request(app)
      .post('/api/chat/ask')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ question: 'Question 1' });

    const convId = askRes.body.conversationId;

    const res = await request(app)
      .get(`/api/chat/conversations/${convId}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.conversation.messages).toHaveLength(2); // user + assistant
  });

  it('DELETE /api/chat/conversations/:id — should delete conversation', async () => {
    const askRes = await request(app)
      .post('/api/chat/ask')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ question: 'Question to Delete' });

    const convId = askRes.body.conversationId;

    const delRes = await request(app)
      .delete(`/api/chat/conversations/${convId}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(delRes.status).toBe(200);
    expect(delRes.body.deleted).toBe(true);

    const getRes = await request(app)
      .get(`/api/chat/conversations/${convId}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(getRes.status).toBe(404);
  });

  it('POST /api/chat/ask — should reject unauthorized request without Bearer token', async () => {
    const res = await request(app).post('/api/chat/ask').send({
      question: 'Unauthorized question?',
    });

    expect(res.status).toBe(401);
  });
});
