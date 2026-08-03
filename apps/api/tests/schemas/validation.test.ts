import { describe, it, expect } from 'vitest';
import { registerSchema, loginSchema } from '../../src/schemas/auth.schema';
import { createDocumentSchema } from '../../src/schemas/document.schema';
import { searchRequestSchema } from '../../src/schemas/search.schema';
import { askQuestionSchema } from '../../src/schemas/chat.schema';
import { objectIdSchema } from '../../src/schemas/common.schema';

describe('Zod Validation Schemas', () => {
  describe('objectIdSchema', () => {
    it('should validate valid 24-character hexadecimal ObjectId strings', () => {
      const validId = '66a709d8be93c2f85eaa857c';
      expect(objectIdSchema.safeParse(validId).success).toBe(true);
    });

    it('should reject non-hexadecimal or wrong length ObjectId strings', () => {
      expect(objectIdSchema.safeParse('invalid-id').success).toBe(false);
      expect(objectIdSchema.safeParse('12345678901234567890123').success).toBe(false); // 23 chars
      expect(objectIdSchema.safeParse('1234567890123456789012345').success).toBe(false); // 25 chars
    });
  });

  describe('auth.schema', () => {
    it('should validate valid registration payload', () => {
      const input = {
        email: 'user@example.com',
        password: 'securePassword123',
        name: 'John Doe',
      };
      const res = registerSchema.safeParse(input);
      expect(res.success).toBe(true);
    });

    it('should reject registration with invalid email or weak password', () => {
      expect(registerSchema.safeParse({ email: 'not-an-email', password: '123', name: 'John' }).success).toBe(false);
      expect(registerSchema.safeParse({ email: 'user@example.com', password: 'short', name: 'John' }).success).toBe(false);
    });

    it('should strip or reject unknown fields due to strictness', () => {
      const inputWithExtra = {
        email: 'user@example.com',
        password: 'securePassword123',
        name: 'John Doe',
        unauthorizedRole: 'admin',
      };
      const res = registerSchema.safeParse(inputWithExtra);
      expect(res.success).toBe(false); // .strict() rejects unknown fields
    });
  });

  describe('document.schema', () => {
    it('should validate document creation payload', () => {
      const input = {
        title: 'Valid Title',
        text: 'Document content text',
        chunkSize: 500,
        chunkOverlap: 50,
      };
      expect(createDocumentSchema.safeParse(input).success).toBe(true);
    });

    it('should reject document title over 200 characters or chunkSize out of bounds', () => {
      const longTitle = 'a'.repeat(201);
      expect(createDocumentSchema.safeParse({ title: longTitle, text: 'valid text' }).success).toBe(false);
      expect(createDocumentSchema.safeParse({ title: 'Title', text: 'Text', chunkSize: 10 }).success).toBe(false); // min 50
    });
  });

  describe('search.schema', () => {
    it('should validate valid search payload and apply default k', () => {
      const res = searchRequestSchema.safeParse({ query: 'vector search' });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.k).toBe(5);
      }
    });

    it('should reject k values out of bounds (< 1 or > 100)', () => {
      expect(searchRequestSchema.safeParse({ query: 'test', k: 0 }).success).toBe(false);
      expect(searchRequestSchema.safeParse({ query: 'test', k: 101 }).success).toBe(false);
    });

    it('should validate arrays of document IDs', () => {
      const validDocId = '66a709d8be93c2f85eaa857c';
      expect(
        searchRequestSchema.safeParse({
          query: 'test',
          documentIds: [validDocId],
        }).success,
      ).toBe(true);

      expect(
        searchRequestSchema.safeParse({
          query: 'test',
          documentIds: ['invalid-id'],
        }).success,
      ).toBe(false);
    });
  });

  describe('chat.schema', () => {
    it('should validate ask question payload', () => {
      const res = askQuestionSchema.safeParse({
        question: 'What is RAG?',
        k: 10,
      });
      expect(res.success).toBe(true);
    });

    it('should reject empty question or question exceeding 2000 characters', () => {
      expect(askQuestionSchema.safeParse({ question: '' }).success).toBe(false);
      expect(askQuestionSchema.safeParse({ question: 'a'.repeat(2001) }).success).toBe(false);
    });
  });
});
