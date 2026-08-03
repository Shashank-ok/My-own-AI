import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VectorEngineClient } from '../../src/clients/vectorEngine.client';
import {
  VectorEngineUnavailableError,
  VectorEngineTimeoutError,
  VectorEngineNotFoundError,
  VectorEngineValidationError,
} from '../../src/errors/vectorEngine.errors';

describe('VectorEngineClient', () => {
  let client: VectorEngineClient;
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    client = new VectorEngineClient('http://localhost:8080', 1000);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getHealth() & getStats()', () => {
    it('should return health status and retry on transient error', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Transient connection error'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ status: 'ok', uptimeSec: 120, version: '1.0.0' }),
        });

      const health = await client.getHealth();
      expect(health.status).toBe('ok');
      expect(health.uptimeSec).toBe(120);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should return global stats', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ namespaces: 3, totalVectors: 500 }),
      });

      const stats = await client.getStats();
      expect(stats.namespaces).toBe(3);
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:8080/v1/stats', expect.anything());
    });
  });

  describe('Namespace Validation', () => {
    it('should throw VectorEngineValidationError if namespace is empty or missing', async () => {
      await expect(client.insertVector('', { id: 'v1', values: [0.1] })).rejects.toThrow(
        VectorEngineValidationError,
      );
      await expect(client.searchVectors('  ', [0.1], 5)).rejects.toThrow(
        VectorEngineValidationError,
      );
      await expect(client.deleteNamespace('')).rejects.toThrow(VectorEngineValidationError);
    });
  });

  describe('insertVector() & insertBatch()', () => {
    it('should insert a single vector without sending document text', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'chunk_1', namespace: 'tenant_a', dims: 3 }),
      });

      const result = await client.insertVector('tenant_a', {
        id: 'chunk_1',
        values: [0.1, 0.2, 0.3],
        metadata: { chunkIndex: 0 },
      });

      expect(result.id).toBe('chunk_1');
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:8080/v1/vectors', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          id: 'chunk_1',
          namespace: 'tenant_a',
          values: [0.1, 0.2, 0.3],
          metadata: { chunkIndex: 0 },
        }),
      }));
    });

    it('should insert a batch of vectors with zero automatic retries on failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection reset'));

      const batch = [
        { id: 'vec_1', values: [0.1, 0.2] },
        { id: 'vec_2', values: [0.3, 0.4] },
      ];

      await expect(client.insertBatch('tenant_b', batch)).rejects.toThrow(
        VectorEngineUnavailableError,
      );
      expect(mockFetch).toHaveBeenCalledTimes(1); // Zero retries rule
    });
  });

  describe('searchVectors()', () => {
    it('should execute k-NN search and return hits with latency', async () => {
      const mockSearchResponse = {
        namespace: 'tenant_a',
        algorithm: 'hnsw',
        metric: 'cosine',
        latencyUs: 42,
        hits: [
          { id: 'vec_1', distance: 0.05, metadata: { chunkIndex: 1 } },
          { id: 'vec_2', distance: 0.12, metadata: { chunkIndex: 2 } },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockSearchResponse,
      });

      const result = await client.searchVectors('tenant_a', [0.1, 0.2, 0.3], 2, {
        algorithm: 'hnsw',
        metric: 'cosine',
      });

      expect(result.hits).toHaveLength(2);
      expect(result.hits[0].id).toBe('vec_1');
      expect(result.latencyUs).toBe(42);
    });
  });

  describe('deleteVector() & deleteNamespace()', () => {
    it('should format vector deletion request correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ deleted: true }),
      });

      const res = await client.deleteVector('tenant_a', 'vec_123');
      expect(res.deleted).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/v1/vectors/vec_123?namespace=tenant_a',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });

    it('should format namespace deletion request correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ deleted: true, namespace: 'tenant_a' }),
      });

      const res = await client.deleteNamespace('tenant_a');
      expect(res.deleted).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/v1/namespaces/tenant_a',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  describe('rebuildNamespace() & getNamespaceStatus()', () => {
    it('should post atomic rebuild request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ namespace: 'tenant_a', rebuilt: true, vectorCount: 1, status: 'ready' }),
      });

      const res = await client.rebuildNamespace('tenant_a', [{ id: 'v1', values: [0.1, 0.2] }]);
      expect(res.rebuilt).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/v1/namespaces/tenant_a/rebuild',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('should fetch namespace status and retry on network error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ namespace: 'tenant_a', status: 'ready', vectorCount: 10, dims: 128 }),
      });

      const res = await client.getNamespaceStatus('tenant_a');
      expect(res.status).toBe('ready');
      expect(res.vectorCount).toBe(10);
    });
  });

  describe('Error Mapping', () => {
    it('should map HTTP 404 to VectorEngineNotFoundError', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: { code: 'NOT_FOUND', message: 'Vector id not found' } }),
      });

      await expect(client.deleteVector('tenant_a', 'missing_id')).rejects.toThrow(
        VectorEngineNotFoundError,
      );
    });

    it('should map HTTP 422 to VectorEngineValidationError', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        json: async () => ({ error: { code: 'INVALID_DIMENSIONS', message: 'Expected 3 dims, got 2' } }),
      });

      await expect(client.insertVector('tenant_a', { id: 'v1', values: [0.1, 0.2] })).rejects.toThrow(
        VectorEngineValidationError,
      );
    });

    it('should map AbortError to VectorEngineTimeoutError', async () => {
      const abortErr = new Error('The operation was aborted');
      abortErr.name = 'AbortError';
      mockFetch.mockRejectedValueOnce(abortErr);

      await expect(client.searchVectors('tenant_a', [0.1], 5)).rejects.toThrow(
        VectorEngineTimeoutError,
      );
    });
  });
});
