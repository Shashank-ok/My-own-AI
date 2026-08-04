import { config } from '../config/env';
import { getCurrentRequestId } from '../middleware/requestId';
import {
  OllamaError,
  OllamaUnavailableError,
  OllamaTimeoutError,
  OllamaModelNotFoundError,
  OllamaMalformedResponseError,
} from '../errors/ollama.errors';

export interface CompletionOptions {
  model?: string;
  temperature?: number;
  systemPrompt?: string;
}

interface OllamaEmbeddingResponse {
  embedding?: unknown;
}

interface OllamaCompletionResponse {
  response?: unknown;
}

export class OllamaClient {
  private baseUrl: string;
  private defaultEmbedModel: string;
  private defaultGenModel: string;
  private timeoutMs: number;

  constructor(
    baseUrl: string = config.ollamaUrl,
    defaultEmbedModel: string = config.ollamaEmbeddingModel,
    defaultGenModel: string = config.ollamaGenerateModel,
    timeoutMs: number = config.ollamaTimeoutMs,
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.defaultEmbedModel = defaultEmbedModel;
    this.defaultGenModel = defaultGenModel;
    this.timeoutMs = timeoutMs;
  }

  /**
   * Health check probing Ollama service availability.
   * Returns true if Ollama is responsive, false otherwise.
   */
  async healthCheck(): Promise<boolean> {
    try {
      const res = await this.fetchWithTimeout(
        `${this.baseUrl}/api/tags`,
        {
          method: 'GET',
        },
        5000,
      );
      return res.ok;
    } catch (_error) {
      return false;
    }
  }

  /**
   * Generate vector embedding for a single text input.
   * Retries up to 2 times on transient network/service failures with exponential backoff.
   */
  async generateEmbedding(
    text: string,
    model: string = this.defaultEmbedModel,
  ): Promise<number[]> {
    const maxRetries = 2;
    let attempt = 0;

    while (attempt <= maxRetries) {
      try {
        const payload = { model, prompt: text };
        const res = await this.fetchWithTimeout(`${this.baseUrl}/api/embeddings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (res.status === 404) {
          throw new OllamaModelNotFoundError(model);
        }

        if (!res.ok) {
          throw new OllamaUnavailableError(
            `Ollama embedding request failed with HTTP ${res.status}`,
          );
        }

        let body: OllamaEmbeddingResponse;
        try {
          body = (await res.json()) as OllamaEmbeddingResponse;
        } catch (_jsonErr) {
          throw new OllamaMalformedResponseError('Failed to parse JSON response from Ollama');
        }

        if (!body || !Array.isArray(body.embedding) || body.embedding.length === 0) {
          throw new OllamaMalformedResponseError(
            'Ollama response did not contain a valid embedding array',
          );
        }

        const validNumbers = body.embedding.every(
          (val: unknown) => typeof val === 'number' && !isNaN(val),
        );
        if (!validNumbers) {
          throw new OllamaMalformedResponseError('Embedding array contains non-numeric values');
        }

        return body.embedding as number[];
      } catch (error) {
        if (
          error instanceof OllamaModelNotFoundError ||
          error instanceof OllamaMalformedResponseError
        ) {
          throw error;
        }

        if (attempt === maxRetries) {
          if (error instanceof OllamaError) throw error;
          if ((error as { name?: string })?.name === 'AbortError') {
            throw new OllamaTimeoutError(`Embedding generation timed out after ${this.timeoutMs}ms`);
          }
          throw new OllamaUnavailableError(
            (error as Error)?.message || 'Failed to connect to Ollama',
          );
        }

        attempt++;
        const backoffMs = Math.pow(2, attempt) * 100;
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }

    throw new OllamaUnavailableError('Failed to generate embedding after retries');
  }

  /**
   * Batch embedding generation using bounded concurrency while strictly preserving input order.
   */
  async generateEmbeddings(
    texts: string[],
    concurrency = 4,
    model: string = this.defaultEmbedModel,
  ): Promise<number[][]> {
    if (texts.length === 0) return [];

    const results: number[][] = new Array(texts.length);
    let currentIndex = 0;

    const worker = async () => {
      while (currentIndex < texts.length) {
        const index = currentIndex++;
        results[index] = await this.generateEmbedding(texts[index], model);
      }
    };

    const workers = Array.from({ length: Math.min(concurrency, texts.length) }, () => worker());
    await Promise.all(workers);

    return results;
  }

  /**
   * Generate text completion using LLM.
   * Zero automatic retries to ensure non-idempotent prompts are not re-executed on failure.
   */
  async generateCompletion(prompt: string, options: CompletionOptions = {}): Promise<string> {
    const model = options.model || this.defaultGenModel;
    const payload = {
      model,
      prompt,
      stream: false,
      system: options.systemPrompt,
      options:
        options.temperature !== undefined ? { temperature: options.temperature } : undefined,
    };

    try {
      const res = await this.fetchWithTimeout(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.status === 404) {
        throw new OllamaModelNotFoundError(model);
      }

      if (!res.ok) {
        throw new OllamaUnavailableError(
          `Ollama completion request failed with HTTP ${res.status}`,
        );
      }

      let body: OllamaCompletionResponse;
      try {
        body = (await res.json()) as OllamaCompletionResponse;
      } catch (_jsonErr) {
        throw new OllamaMalformedResponseError(
          'Failed to parse JSON response from Ollama completion',
        );
      }

      if (!body || typeof body.response !== 'string') {
        throw new OllamaMalformedResponseError(
          'Ollama response did not contain a valid response string',
        );
      }

      return body.response;
    } catch (error) {
      if (error instanceof OllamaError) throw error;
      if ((error as { name?: string })?.name === 'AbortError') {
        throw new OllamaTimeoutError(`Completion generation timed out after ${this.timeoutMs}ms`);
      }
      throw new OllamaUnavailableError((error as Error)?.message || 'Failed to connect to Ollama');
    }
  }

  private async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeout: number = this.timeoutMs,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

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
      return res;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
