import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../src/app';
import { DocumentModel } from '../../src/models/Document';
import { OllamaClient } from '../../src/clients/ollama.client';
import { VectorEngineClient } from '../../src/clients/vectorEngine.client';
import {
  setupMongoMemoryServer,
  teardownMongoMemoryServer,
  clearMongoMemoryServer,
} from '../models/setup';

describe('Document API Routes (/api/documents)', () => {
  let userToken: string;

  beforeAll(async () => {
    await setupMongoMemoryServer();
  });

  afterAll(async () => {
    await teardownMongoMemoryServer();
  });

  beforeEach(async () => {
    await clearMongoMemoryServer();

    vi.spyOn(OllamaClient.prototype, 'generateEmbeddings').mockImplementation(async (texts) => {
      return texts.map(() => [0.1, 0.2, 0.3]);
    });

    vi.spyOn(VectorEngineClient.prototype, 'insertBatch').mockImplementation(async (namespace, vectors) => {
      return { inserted: vectors.length, updated: 0, rejected: 0, namespace };
    });

    vi.spyOn(VectorEngineClient.prototype, 'deleteVector').mockImplementation(async () => {
      return { deleted: true };
    });

    // Register test user and get Bearer token
    const reg = await request(app).post('/auth/register').send({
      email: 'doc.owner@example.com',
      password: 'securePassword123!',
      name: 'Document Owner',
    });
    userToken = reg.body.token;
  });

  it('POST /api/documents — should ingest a new document when authenticated', async () => {
    const res = await request(app)
      .post('/api/documents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        title: 'Introduction to Vectors',
        text: 'Vector embeddings represent semantic relationships in multi-dimensional space.',
      });

    expect(res.status).toBe(201);
    expect(res.body.document).toBeDefined();
    expect(res.body.document.title).toBe('Introduction to Vectors');
    expect(res.body.document.status).toBe('completed');
  });

  it('POST /api/documents — should reject unauthorized request without Bearer token', async () => {
    const res = await request(app).post('/api/documents').send({
      title: 'Unauthorized Doc',
      text: 'Text content',
    });

    expect(res.status).toBe(401);
  });

  it('GET /api/documents — should list user documents', async () => {
    await request(app)
      .post('/api/documents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ title: 'Doc One', text: 'Text one content' });

    await request(app)
      .post('/api/documents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ title: 'Doc Two', text: 'Text two content' });

    const res = await request(app)
      .get('/api/documents')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.documents).toHaveLength(2);
  });

  it('GET /api/documents/:id — should return single document details', async () => {
    const created = await request(app)
      .post('/api/documents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ title: 'Single Doc Test', text: 'Sample text' });

    const docId = created.body.document._id;

    const res = await request(app)
      .get(`/api/documents/${docId}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.document.title).toBe('Single Doc Test');
  });

  it('DELETE /api/documents/:id — should delete document', async () => {
    const created = await request(app)
      .post('/api/documents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ title: 'Doc to Delete', text: 'Delete text content' });

    const docId = created.body.document._id;

    const res = await request(app)
      .delete(`/api/documents/${docId}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(true);

    const getRes = await request(app)
      .get(`/api/documents/${docId}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(getRes.status).toBe(404);
  });

  it('POST /api/documents/:id/retry — should retry failed document ingestion', async () => {
    // Manually create a failed document
    const userReg = await request(app).post('/auth/login').send({
      email: 'doc.owner@example.com',
      password: 'securePassword123!',
    });
    const userId = userReg.body.user.id;

    const failedDoc = new DocumentModel({
      ownerId: new mongoose.Types.ObjectId(userId),
      title: 'Failed Document',
      status: 'failed',
      chunkCount: 0,
      ingestionError: 'Simulated network timeout',
    });
    await failedDoc.save();

    const res = await request(app)
      .post(`/api/documents/${failedDoc._id.toString()}/retry`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ text: 'Retry document text content' });

    expect(res.status).toBe(200);
    expect(res.body.document.status).toBe('completed');
  });
});
