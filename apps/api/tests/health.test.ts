import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import {
  setupMongoMemoryServer,
  teardownMongoMemoryServer,
} from './models/setup';

describe('GET /health', () => {
  beforeAll(async () => {
    await setupMongoMemoryServer();
  });

  afterAll(async () => {
    await teardownMongoMemoryServer();
  });

  it('should return 200 OK with health details and service breakdown', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(['ok', 'degraded']).toContain(res.body.status);
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body).toHaveProperty('uptime');
    expect(res.body).toHaveProperty('services');
    expect(res.body.services).toHaveProperty('mongodb');
    expect(res.body.services).toHaveProperty('cppEngine');
    expect(res.body.services).toHaveProperty('ollama');
    expect(res.body.services.mongodb.status).toBe('connected');
  });
});
