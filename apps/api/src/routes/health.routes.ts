import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { VectorEngineClient } from '../clients/vectorEngine.client';
import { OllamaClient } from '../clients/ollama.client';
import { config } from '../config/env';

export const healthRouter = Router();

healthRouter.get('/health', async (_req: Request, res: Response) => {
  const vectorClient = new VectorEngineClient();
  const ollamaClient = new OllamaClient();

  // 1. MongoDB Health Probe
  const stateMap: Record<number, string> = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };
  let mongoStatus = stateMap[mongoose.connection.readyState] || 'unknown';
  let mongoLatencyMs: number | null = null;

  if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
    const start = Date.now();
    try {
      await mongoose.connection.db.admin().ping();
      mongoLatencyMs = Date.now() - start;
    } catch (_err) {
      mongoStatus = 'error';
    }
  }

  // 2. C++ Vector Engine Health Probe
  let cppStatus = 'down';
  let cppLatencyMs: number | null = null;
  let cppVersion: string | null = null;
  let cppUptimeSec: number | null = null;

  const cppStart = Date.now();
  try {
    const health = await vectorClient.getHealth();
    cppLatencyMs = Date.now() - cppStart;
    cppStatus = health.status || 'ok';
    cppVersion = health.version || null;
    cppUptimeSec = health.uptimeSec || null;
  } catch (_err) {
    cppStatus = 'down';
  }

  // 3. Ollama Service Health Probe
  let ollamaStatus = 'down';
  let ollamaLatencyMs: number | null = null;

  const ollamaStart = Date.now();
  try {
    const isUp = await ollamaClient.healthCheck();
    ollamaLatencyMs = Date.now() - ollamaStart;
    ollamaStatus = isUp ? 'ok' : 'down';
  } catch (_err) {
    ollamaStatus = 'down';
  }

  // Determine overall system status
  const isMongoOk = mongoStatus === 'connected';
  const isCppOk = cppStatus === 'ok' || cppStatus === 'healthy';
  const isOllamaOk = ollamaStatus === 'ok';

  let status = 'down';
  if (isMongoOk && isCppOk && isOllamaOk) {
    status = 'ok';
  } else if (isMongoOk) {
    status = 'degraded';
  }

  const httpCode = isMongoOk ? 200 : 503;
  const uptime = process.uptime();

  res.status(httpCode).json({
    status,
    timestamp: new Date().toISOString(),
    uptime,
    uptimeSec: uptime,
    services: {
      mongodb: {
        status: mongoStatus,
        latencyMs: mongoLatencyMs,
        databaseName: mongoose.connection.name || null,
      },
      cppEngine: {
        status: cppStatus,
        latencyMs: cppLatencyMs,
        version: cppVersion,
        uptimeSec: cppUptimeSec,
        url: config.cppEngineUrl,
      },
      ollama: {
        status: ollamaStatus,
        latencyMs: ollamaLatencyMs,
        embeddingModel: config.ollamaEmbeddingModel,
        generateModel: config.ollamaGenerateModel,
        url: config.ollamaUrl,
      },
    },
  });
});
