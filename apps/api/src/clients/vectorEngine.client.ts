import { config } from '../config/env';
import { getCurrentRequestId } from '../middleware/requestId';
import {
  VectorEngineError,
  VectorEngineUnavailableError,
  VectorEngineTimeoutError,
  VectorEngineNotFoundError,
  VectorEngineValidationError,
} from '../errors/vectorEngine.errors';

export interface VectorItemInput {
  id: string;
  values: number[];
  metadata?: Record<string, unknown>;
}

export interface SearchOptions {
  k?: number;
  algorithm?: 'bruteforce' | 'kdtree' | 'hnsw';
  metric?: 'cosine' | 'euclidean' | 'manhattan';
}

export interface SearchHit {
  id: string;
  distance: number;
  metadata?: Record<string, unknown>;
  values?: number[];
}

export interface SearchResult {
  namespace: string;
  algorithm: string;
  metric: string;
  latencyUs: number;
  hits: SearchHit[];
}

interface EngineErrorResponse {
  error?: {
    code?: string;
    message?: string;
  };
}

export class VectorEngineClient {
  private baseUrl: string;
  private timeoutMs: number;

  constructor(
    baseUrl: string = config.cppEngineUrl,
    timeoutMs: number = config.cppEngineTimeoutMs,
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.timeoutMs = timeoutMs;
  }

  /**
   * Health check for C++ engine. Safe idempotent request (retries up to 2 times).
   */
  async getHealth(): Promise<{ status: string; uptimeSec: number; version: string }> {
    return this.requestWithRetry('/v1/health', { method: 'GET' });
  }

  /**
   * Global statistics for C++ engine.
   */
  async getStats(): Promise<Record<string, unknown>> {
    return this.requestNoRetry('/v1/stats', { method: 'GET' });
  }

  /**
   * Insert a single vector into a specified namespace.
   * Requires non-empty namespace string. Does NOT retry.
   */
  async insertVector(
    namespace: string,
    item: VectorItemInput,
  ): Promise<{ id: string; namespace: string; dims: number }> {
    this.validateNamespace(namespace);
    this.validateVectorInput(item);

    const payload = {
      id: item.id,
      namespace,
      values: item.values,
      metadata: item.metadata || {},
    };

    return this.requestNoRetry('/v1/vectors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  /**
   * Insert a batch of vectors into a specified namespace.
   * Requires non-empty namespace string. Does NOT retry.
   */
  async insertBatch(
    namespace: string,
    vectors: VectorItemInput[],
  ): Promise<{ inserted: number; updated: number; rejected: number; namespace: string }> {
    this.validateNamespace(namespace);
    if (!Array.isArray(vectors) || vectors.length === 0) {
      throw new VectorEngineValidationError('Vectors batch array cannot be empty');
    }
    vectors.forEach((v) => this.validateVectorInput(v));

    const payload = {
      namespace,
      vectors: vectors.map((v) => ({
        id: v.id,
        values: v.values,
        metadata: v.metadata || {},
      })),
    };

    return this.requestNoRetry('/v1/vectors/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  /**
   * Namespace-scoped vector nearest-neighbor search.
   * Requires non-empty namespace string. Does NOT retry.
   */
  async searchVectors(
    namespace: string,
    queryVector: number[],
    k = 10,
    options: SearchOptions = {},
  ): Promise<SearchResult> {
    this.validateNamespace(namespace);
    if (!Array.isArray(queryVector) || queryVector.length === 0) {
      throw new VectorEngineValidationError('Query vector values array cannot be empty');
    }
    if (k <= 0) {
      throw new VectorEngineValidationError('Parameter k must be greater than 0');
    }

    const payload = {
      namespace,
      vector: queryVector,
      k,
      algorithm: options.algorithm || 'hnsw',
      metric: options.metric || 'cosine',
    };

    return this.requestNoRetry('/v1/vectors/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  /**
   * Delete a vector by ID. Requires non-empty namespace string. Does NOT retry.
   */
  async deleteVector(namespace: string, vectorId: string): Promise<{ deleted: boolean }> {
    this.validateNamespace(namespace);
    if (!vectorId || typeof vectorId !== 'string') {
      throw new VectorEngineValidationError('Vector ID must be a non-empty string');
    }

    const url = `/v1/vectors/${encodeURIComponent(vectorId)}?namespace=${encodeURIComponent(namespace)}`;
    return this.requestNoRetry(url, { method: 'DELETE' });
  }

  /**
   * Delete an entire namespace. Requires non-empty namespace string. Does NOT retry.
   */
  async deleteNamespace(namespace: string): Promise<{ deleted: boolean; namespace: string }> {
    this.validateNamespace(namespace);
    const url = `/v1/namespaces/${encodeURIComponent(namespace)}`;
    return this.requestNoRetry(url, { method: 'DELETE' });
  }

  /**
   * Rebuild namespace index atomically without downtime. Does NOT retry.
   */
  async rebuildNamespace(
    namespace: string,
    vectors: VectorItemInput[],
    metric = 'cosine',
  ): Promise<{ namespace: string; rebuilt: boolean; vectorCount: number; status: string }> {
    this.validateNamespace(namespace);
    if (!Array.isArray(vectors)) {
      throw new VectorEngineValidationError('Rebuild vectors parameter must be an array');
    }
    vectors.forEach((v) => this.validateVectorInput(v));

    const payload = {
      metric,
      vectors: vectors.map((v) => ({
        id: v.id,
        values: v.values,
        metadata: v.metadata || {},
      })),
    };

    const url = `/v1/namespaces/${encodeURIComponent(namespace)}/rebuild`;
    return this.requestNoRetry(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  /**
   * Query namespace status (ready, rebuilding, empty, failed). Safe idempotent request (retries up to 2 times).
   */
  async getNamespaceStatus(
    namespace: string,
  ): Promise<{ namespace: string; status: string; vectorCount: number; dims: number }> {
    this.validateNamespace(namespace);
    const url = `/v1/namespaces/${encodeURIComponent(namespace)}/status`;
    return this.requestWithRetry(url, { method: 'GET' });
  }

  private validateNamespace(namespace: string): void {
    if (!namespace || typeof namespace !== 'string' || namespace.trim().length === 0) {
      throw new VectorEngineValidationError('Namespace parameter is required and cannot be empty');
    }
  }

  private validateVectorInput(item: VectorItemInput): void {
    if (!item || typeof item.id !== 'string' || item.id.trim().length === 0) {
      throw new VectorEngineValidationError('Vector item id must be a non-empty string');
    }
    if (!Array.isArray(item.values) || item.values.length === 0) {
      throw new VectorEngineValidationError(`Vector item '${item.id}' values must be a non-empty number array`);
    }
  }

  private async requestNoRetry<T>(path: string, options: RequestInit): Promise<T> {
    return this.executeRequest<T>(path, options);
  }

  private async requestWithRetry<T>(path: string, options: RequestInit): Promise<T> {
    const maxRetries = 2;
    let attempt = 0;

    while (attempt <= maxRetries) {
      try {
        return await this.executeRequest<T>(path, options);
      } catch (error) {
        if (
          error instanceof VectorEngineNotFoundError ||
          error instanceof VectorEngineValidationError
        ) {
          throw error;
        }

        if (attempt === maxRetries) {
          throw error;
        }

        attempt++;
        const backoffMs = Math.pow(2, attempt) * 100;
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }

    throw new VectorEngineUnavailableError();
  }

  private async executeRequest<T>(path: string, options: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const requestId = getCurrentRequestId();
      const headers = {
        'X-Request-ID': requestId,
        ...(options.headers as Record<string, string>),
      };

      const res = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      let jsonBody: unknown = null;
      try {
        jsonBody = await res.json();
      } catch (_jsonErr) {
        // Ignore body JSON parse error if response body is empty
      }

      if (!res.ok) {
        this.handleErrorResponse(res.status, jsonBody as EngineErrorResponse);
      }

      return jsonBody as T;
    } catch (error) {
      if (error instanceof VectorEngineError) throw error;
      if ((error as { name?: string })?.name === 'AbortError') {
        throw new VectorEngineTimeoutError(
          `C++ Engine request to '${path}' timed out after ${this.timeoutMs}ms`,
        );
      }
      throw new VectorEngineUnavailableError(
        (error as Error)?.message || 'Failed to connect to C++ Vector Engine',
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private handleErrorResponse(status: number, body?: EngineErrorResponse): never {
    const code = body?.error?.code || 'UNKNOWN_ERROR';
    const message = body?.error?.message || `Vector engine HTTP ${status} error`;

    if (status === 404) {
      throw new VectorEngineNotFoundError(message);
    }
    if (status === 400 || status === 422) {
      throw new VectorEngineValidationError(message, code);
    }
    if (status === 503 || status === 502) {
      throw new VectorEngineUnavailableError(message);
    }

    throw new VectorEngineError(message, status, code);
  }
}
