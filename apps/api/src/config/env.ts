import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

export const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  MONGODB_URI: z.string().default('mongodb://localhost:27017/myownai'),
  CPP_ENGINE_URL: z.string().optional().transform(v => v || undefined).pipe(z.string().url().default('http://localhost:8080')),
  CPP_ENGINE_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
  OLLAMA_URL: z.string().optional().transform(v => v || undefined).pipe(z.string().url().default('http://localhost:11434')),
  OLLAMA_EMBEDDING_MODEL: z.string().min(1).default('nomic-embed-text'),
  OLLAMA_GENERATE_MODEL: z.string().min(1).default('llama3:8b'),
  OLLAMA_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  DEFAULT_CHUNK_SIZE: z.coerce.number().int().positive().default(500),
  DEFAULT_CHUNK_OVERLAP: z.coerce.number().int().nonnegative().default(50),
  JWT_SECRET: z.string().min(1).default('dev-secret-key-change-in-prod-12345'),
  ALLOWED_ORIGINS: z
    .string()
    .default('http://localhost:3000,http://localhost:5173,http://localhost:3001')
    .transform((val) => val.split(',').map((origin) => origin.trim()).filter(Boolean)),
  REQUEST_SIZE_LIMIT: z.string().default('10mb'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
});

export type RawConfigInput = Record<string, string | undefined>;

export function loadConfig(rawInput: RawConfigInput = process.env) {
  const result = envSchema.safeParse(rawInput);
  if (!result.success) {
    const formatted = result.error.format();
    console.error('❌ Invalid environment configuration:', JSON.stringify(formatted, null, 2));
    throw new Error('Invalid environment configuration');
  }

  const data = result.data;
  return {
    port: data.PORT,
    env: data.NODE_ENV,
    mongoUri: data.MONGODB_URI,
    cppEngineUrl: data.CPP_ENGINE_URL,
    cppEngineTimeoutMs: data.CPP_ENGINE_TIMEOUT_MS,
    ollamaUrl: data.OLLAMA_URL,
    ollamaEmbeddingModel: data.OLLAMA_EMBEDDING_MODEL,
    ollamaGenerateModel: data.OLLAMA_GENERATE_MODEL,
    ollamaTimeoutMs: data.OLLAMA_TIMEOUT_MS,
    defaultChunkSize: data.DEFAULT_CHUNK_SIZE,
    defaultChunkOverlap: data.DEFAULT_CHUNK_OVERLAP,
    jwtSecret: data.JWT_SECRET,
    allowedOrigins: data.ALLOWED_ORIGINS,
    requestSizeLimit: data.REQUEST_SIZE_LIMIT,
    rateLimit: {
      windowMs: data.RATE_LIMIT_WINDOW_MS,
      max: data.RATE_LIMIT_MAX,
    },
    requestTimeoutMs: data.REQUEST_TIMEOUT_MS,
  };
}

export type AppConfig = ReturnType<typeof loadConfig>;
export const config = loadConfig(process.env);
