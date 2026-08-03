import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OllamaClient } from '../../src/clients/ollama.client';
import {
  OllamaUnavailableError,
  OllamaTimeoutError,
  OllamaModelNotFoundError,
  OllamaMalformedResponseError,
} from '../../src/errors/ollama.errors';

describe('OllamaClient', () => {
  let client: OllamaClient;
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    client = new OllamaClient('http://localhost:11434', 'nomic-embed-text', 'llama3:8b', 1000);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('healthCheck()', () => {
    it('should return true when Ollama returns 200 OK', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      const isHealthy = await client.healthCheck();
      expect(isHealthy).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:11434/api/tags', expect.anything());
    });

    it('should return false when Ollama throws network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const isHealthy = await client.healthCheck();
      expect(isHealthy).toBe(false);
    });
  });

  describe('generateEmbedding()', () => {
    it('should return embedding array when Ollama returns valid JSON', async () => {
      const mockVector = [0.1, 0.2, 0.3, 0.4];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ embedding: mockVector }),
      });

      const vector = await client.generateEmbedding('Hello world');
      expect(vector).toEqual(mockVector);
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:11434/api/embeddings', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ model: 'nomic-embed-text', prompt: 'Hello world' }),
      }));
    });

    it('should throw OllamaModelNotFoundError on HTTP 404', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      await expect(client.generateEmbedding('Hello world', 'unknown-model')).rejects.toThrow(
        OllamaModelNotFoundError,
      );
    });

    it('should throw OllamaMalformedResponseError when embedding is missing or invalid', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ response: 'invalid schema' }),
      });

      await expect(client.generateEmbedding('Hello world')).rejects.toThrow(
        OllamaMalformedResponseError,
      );
    });

    it('should retry up to 2 times on transient network error and succeed', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Transient socket reset'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ embedding: [0.5, 0.6] }),
        });

      const vector = await client.generateEmbedding('Retry test');
      expect(vector).toEqual([0.5, 0.6]);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('generateEmbeddings() [batch]', () => {
    it('should generate embeddings for a batch while preserving exact input order', async () => {
      const texts = ['First text', 'Second text', 'Third text'];

      mockFetch.mockImplementation(async (_url, options) => {
        const body = JSON.parse(options.body);
        if (body.prompt === 'First text') {
          return { ok: true, status: 200, json: async () => ({ embedding: [1, 1] }) };
        }
        if (body.prompt === 'Second text') {
          return { ok: true, status: 200, json: async () => ({ embedding: [2, 2] }) };
        }
        if (body.prompt === 'Third text') {
          return { ok: true, status: 200, json: async () => ({ embedding: [3, 3] }) };
        }
        throw new Error('Unknown prompt');
      });

      const results = await client.generateEmbeddings(texts, 2);

      expect(results).toHaveLength(3);
      expect(results[0]).toEqual([1, 1]);
      expect(results[1]).toEqual([2, 2]);
      expect(results[2]).toEqual([3, 3]);
    });

    it('should return empty array for empty inputs', async () => {
      const results = await client.generateEmbeddings([]);
      expect(results).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('generateCompletion()', () => {
    it('should return completion string on 200 OK response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ response: 'Vector databases store embeddings.' }),
      });

      const response = await client.generateCompletion('What is vector DB?', {
        temperature: 0.7,
        systemPrompt: 'You are a technical assistant.',
      });

      expect(response).toBe('Vector databases store embeddings.');
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:11434/api/generate', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          model: 'llama3:8b',
          prompt: 'What is vector DB?',
          stream: false,
          system: 'You are a technical assistant.',
          options: { temperature: 0.7 },
        }),
      }));
    });

    it('should NOT retry on completion failure (zero retries rule)', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection reset'));

      await expect(client.generateCompletion('Prompt')).rejects.toThrow(OllamaUnavailableError);
      expect(mockFetch).toHaveBeenCalledTimes(1); // Exactly 1 call, zero retries
    });

    it('should throw OllamaTimeoutError when AbortError occurs', async () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValueOnce(abortError);

      await expect(client.generateCompletion('Timeout prompt')).rejects.toThrow(
        OllamaTimeoutError,
      );
    });
  });
});
