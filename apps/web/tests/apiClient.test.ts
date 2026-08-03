import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { api, setAuthToken, getAuthToken, clearAuthToken, ApiError } from '../src/api';

describe('Frontend Typed API Client Test Suite', () => {
  let localStorageStore: Record<string, string> = {};

  beforeEach(() => {
    localStorageStore = {};
    const mockLocalStorage = {
      getItem: (key: string) => localStorageStore[key] || null,
      setItem: (key: string, value: string) => {
        localStorageStore[key] = value;
      },
      removeItem: (key: string) => {
        delete localStorageStore[key];
      },
      clear: () => {
        localStorageStore = {};
      },
    };

    vi.stubGlobal('localStorage', mockLocalStorage);
    clearAuthToken();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Token Storage & Authorization Header Management', () => {
    it('should store token in memory and localStorage', () => {
      setAuthToken('test-jwt-token-123');
      expect(getAuthToken()).toBe('test-jwt-token-123');
      expect(localStorageStore['your_own_ai_jwt_token']).toBe('test-jwt-token-123');

      clearAuthToken();
      expect(getAuthToken()).toBeNull();
      expect(localStorageStore['your_own_ai_jwt_token']).toBeUndefined();
    });

    it('should attach Authorization Bearer header when token is set', async () => {
      setAuthToken('mock-bearer-token');

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ user: { id: '1', email: 'test@example.com' } }),
      });

      vi.stubGlobal('fetch', mockFetch);

      await api.auth.getProfile();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('http://localhost:3000/auth/me');
      expect(options.headers).toHaveProperty('Authorization', 'Bearer mock-bearer-token');
    });
  });

  describe('Error Normalization & Status Mapping', () => {
    it('should normalize 400 Validation Error responses into ApiError', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          error: {
            message: 'Validation error',
            code: 'VALIDATION_ERROR',
            details: { email: 'Invalid email format' },
          },
        }),
      });

      vi.stubGlobal('fetch', mockFetch);

      try {
        await api.auth.login({ email: 'bad-email', password: '123' });
        expect.unreachable('Should have thrown ApiError');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ApiError);
        const apiErr = err as ApiError;
        expect(apiErr.statusCode).toBe(400);
        expect(apiErr.message).toBe('Validation error');
        expect(apiErr.errorCode).toBe('VALIDATION_ERROR');
        expect(apiErr.details).toHaveProperty('email');
      }
    });

    it('should normalize 401 Unauthorized responses', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          error: { message: 'Authentication token is required' },
        }),
      });

      vi.stubGlobal('fetch', mockFetch);

      await expect(api.documents.listDocuments()).rejects.toThrow('Authentication token is required');
    });
  });

  describe('Domain API Endpoint Methods', () => {
    it('should execute auth login and save returned token', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          user: { id: 'u1', email: 'user@example.com', name: 'User 1', role: 'user' },
          token: 'token-abc-xyz',
        }),
      });

      vi.stubGlobal('fetch', mockFetch);

      const res = await api.auth.login({ email: 'user@example.com', password: 'password123' });
      expect(res.token).toBe('token-abc-xyz');
      expect(getAuthToken()).toBe('token-abc-xyz');
    });

    it('should execute document ingestion endpoint', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          message: 'Document ingested successfully',
          document: { _id: 'd1', title: 'Test Spec', status: 'completed', chunkCount: 2 },
        }),
      });

      vi.stubGlobal('fetch', mockFetch);

      const res = await api.documents.ingestDocument({
        title: 'Test Spec',
        text: 'Document content for ingestion test.',
      });

      expect(res.document._id).toBe('d1');
      expect(res.document.status).toBe('completed');
    });

    it('should execute semantic vector search endpoint', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          query: 'test query',
          namespace: 'user_u1',
          totalHits: 1,
          latencyUs: 45,
          results: [{ chunkId: 'c1', documentTitle: 'Test Spec', text: 'Sample chunk', distance: 0.05 }],
        }),
      });

      vi.stubGlobal('fetch', mockFetch);

      const res = await api.search.search({ query: 'test query', k: 3 });
      expect(res.totalHits).toBe(1);
      expect(res.results[0].distance).toBe(0.05);
    });

    it('should execute RAG ask question endpoint', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          conversationId: 'conv1',
          question: 'What is vector search?',
          answer: 'Vector search finds semantically close embeddings.',
          sources: [],
          model: 'llama3:latest',
        }),
      });

      vi.stubGlobal('fetch', mockFetch);

      const res = await api.chat.askQuestion({ question: 'What is vector search?' });
      expect(res.conversationId).toBe('conv1');
      expect(res.answer).toContain('Vector search');
    });
  });
});
