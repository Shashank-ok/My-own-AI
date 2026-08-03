import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { Conversation } from '../../src/models/Conversation';
import {
  setupMongoMemoryServer,
  teardownMongoMemoryServer,
  clearMongoMemoryServer,
} from './setup';

describe('Conversation Model', () => {
  beforeAll(async () => {
    await setupMongoMemoryServer();
  });

  afterAll(async () => {
    await teardownMongoMemoryServer();
  });

  beforeEach(async () => {
    await clearMongoMemoryServer();
  });

  it('should create a conversation with message subdocuments', async () => {
    const ownerId = new mongoose.Types.ObjectId();
    const sourceChunkId = new mongoose.Types.ObjectId();

    const conversation = new Conversation({
      ownerId,
      title: 'Vector Index Architecture Discussion',
      messages: [
        {
          role: 'user',
          content: 'How does HNSW perform on 768-dim vectors?',
        },
        {
          role: 'assistant',
          content: 'HNSW maintains high Recall@K with sub-millisecond search latencies.',
          sourceChunkIds: [sourceChunkId],
          model: 'llama3:8b',
        },
      ],
    });

    const saved = await conversation.save();
    expect(saved._id).toBeDefined();
    expect(saved.ownerId.toString()).toBe(ownerId.toString());
    expect(saved.messages).toHaveLength(2);
    expect(saved.messages[1].role).toBe('assistant');
    expect(saved.messages[1].sourceChunkIds[0].toString()).toBe(sourceChunkId.toString());
    expect(saved.messages[1].model).toBe('llama3:8b');
  });
});
