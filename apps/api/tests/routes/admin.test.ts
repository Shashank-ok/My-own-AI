import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import { VectorEngineClient } from '../../src/clients/vectorEngine.client';
import {
  setupMongoMemoryServer,
  teardownMongoMemoryServer,
  clearMongoMemoryServer,
} from '../models/setup';

describe('Admin API Routes (/api/admin)', () => {
  let userToken: string;

  beforeAll(async () => {
    await setupMongoMemoryServer();
  });

  afterAll(async () => {
    await teardownMongoMemoryServer();
  });

  beforeEach(async () => {
    await clearMongoMemoryServer();

    vi.spyOn(VectorEngineClient.prototype, 'getNamespaceStatus').mockImplementation(async (namespace) => {
      return {
        namespace,
        status: 'ready',
        vectorCount: 0,
        dims: 128,
      };
    });

    vi.spyOn(VectorEngineClient.prototype, 'rebuildNamespace').mockImplementation(async (namespace, vectors) => {
      return {
        namespace,
        rebuilt: true,
        vectorCount: vectors.length,
        status: 'ready',
      };
    });

    // Register user & obtain Bearer token
    const reg = await request(app).post('/auth/register').send({
      email: 'admin.user@example.com',
      password: 'securePassword123!',
      name: 'Admin User',
    });
    userToken = reg.body.token;
  });

  it('GET /api/admin/namespaces/:namespace/status — should return namespace status', async () => {
    const res = await request(app)
      .get('/api/admin/namespaces/user_123/status')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status');
    expect(res.body).toHaveProperty('expectedCount');
    expect(res.body).toHaveProperty('actualCount');
  });

  it('GET /api/admin/namespaces/:namespace/check — should perform consistency check', async () => {
    const res = await request(app)
      .get('/api/admin/namespaces/user_123/check')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('checksum');
    expect(res.body.status).toBe('SYNCHRONIZED');
  });

  it('POST /api/admin/namespaces/:namespace/rebuild — should trigger atomic rebuild', async () => {
    const res = await request(app)
      .post('/api/admin/namespaces/user_123/rebuild')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.rebuilt).toBe(true);
  });

  it('admin endpoints should reject unauthorized request without Bearer token', async () => {
    const res = await request(app).get('/api/admin/namespaces/user_123/status');
    expect(res.status).toBe(401);
  });
});
