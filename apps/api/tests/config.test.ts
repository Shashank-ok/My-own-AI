import { describe, it, expect, vi } from 'vitest';
import { loadConfig } from '../src/config/env';

describe('Centralized Typed Configuration (loadConfig)', () => {
  it('should load default configuration when minimal/empty environment input is provided', () => {
    const cfg = loadConfig({});

    expect(cfg.port).toBe(3000);
    expect(cfg.env).toBe('development');
    expect(cfg.mongoUri).toBe('mongodb://localhost:27017/myownai');
    expect(cfg.cppEngineUrl).toBe('http://localhost:8080');
    expect(cfg.ollamaUrl).toBe('http://localhost:11434');
    expect(cfg.jwtSecret).toBe('dev-secret-key-change-in-prod-12345');
    expect(cfg.allowedOrigins).toEqual(['http://localhost:3000', 'http://localhost:5173']);
    expect(cfg.requestSizeLimit).toBe('10mb');
    expect(cfg.rateLimit).toEqual({ windowMs: 900000, max: 100 });
    expect(cfg.requestTimeoutMs).toBe(30000);
  });

  it('should correctly parse valid custom environment inputs', () => {
    const customEnv = {
      PORT: '5000',
      NODE_ENV: 'production',
      MONGODB_URI: 'mongodb://user:pass@mongo-host:27017/prod-db',
      CPP_ENGINE_URL: 'http://cpp-engine:8080',
      OLLAMA_URL: 'http://ollama-host:11434',
      JWT_SECRET: 'production-super-secret-key-999',
      ALLOWED_ORIGINS: 'http://app.domain.com, https://admin.domain.com',
      REQUEST_SIZE_LIMIT: '50mb',
      RATE_LIMIT_WINDOW_MS: '600000',
      RATE_LIMIT_MAX: '500',
      REQUEST_TIMEOUT_MS: '15000',
    };

    const cfg = loadConfig(customEnv);

    expect(cfg.port).toBe(5000);
    expect(cfg.env).toBe('production');
    expect(cfg.mongoUri).toBe('mongodb://user:pass@mongo-host:27017/prod-db');
    expect(cfg.cppEngineUrl).toBe('http://cpp-engine:8080');
    expect(cfg.ollamaUrl).toBe('http://ollama-host:11434');
    expect(cfg.jwtSecret).toBe('production-super-secret-key-999');
    expect(cfg.allowedOrigins).toEqual(['http://app.domain.com', 'https://admin.domain.com']);
    expect(cfg.requestSizeLimit).toBe('50mb');
    expect(cfg.rateLimit).toEqual({ windowMs: 600000, max: 500 });
    expect(cfg.requestTimeoutMs).toBe(15000);
  });

  it('should fail fast on invalid PORT number', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => loadConfig({ PORT: 'invalid_port_number' })).toThrow(
      'Invalid environment configuration',
    );

    consoleSpy.mockRestore();
  });

  it('should fail fast on invalid URL formats for CPP_ENGINE_URL or OLLAMA_URL', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => loadConfig({ CPP_ENGINE_URL: 'not-a-valid-url' })).toThrow(
      'Invalid environment configuration',
    );

    consoleSpy.mockRestore();
  });

  it('should fail fast on invalid NODE_ENV value', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => loadConfig({ NODE_ENV: 'staging_invalid' })).toThrow(
      'Invalid environment configuration',
    );

    consoleSpy.mockRestore();
  });
});
