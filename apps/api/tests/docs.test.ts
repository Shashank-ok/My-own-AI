import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';

describe('OpenAPI Documentation Endpoints (/api/docs)', () => {
  it('should serve valid raw OpenAPI 3.0 JSON specification at /api/docs/openapi.json', async () => {
    const res = await request(app).get('/api/docs/openapi.json');
    expect(res.status).toBe(200);
    expect(res.header['content-type']).toContain('application/json');
    expect(res.body).toHaveProperty('openapi', '3.0.3');
    expect(res.body.info.title).toBe('Your OWN AI - Public REST API');
    expect(res.body.paths).toHaveProperty('/api/search');
    expect(res.body.paths).toHaveProperty('/api/chat/ask');
    expect(res.body.paths).toHaveProperty('/api/documents');
  });

  it('should explicitly document that search distance values are raw metrics, not probabilities', async () => {
    const res = await request(app).get('/api/docs/openapi.json');
    expect(res.status).toBe(200);
    const searchHitSchema = res.body.components.schemas.SearchHit;
    expect(searchHitSchema.properties.distance.description).toContain('Not a probability score');
  });

  it('should serve interactive Swagger UI documentation at /api/docs/', async () => {
    const res = await request(app).get('/api/docs/');
    expect(res.status).toBe(200);
    expect(res.header['content-type']).toContain('text/html');
    expect(res.text).toContain('swagger');
  });
});
