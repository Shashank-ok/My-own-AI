import { z } from 'zod';
import { objectIdSchema } from './common.schema';

export const createDocumentSchema = z
  .object({
    title: z.string().min(1, 'Document title is required').max(200, 'Title cannot exceed 200 characters'),
    text: z.string().min(1, 'Document text content is required').max(1000000, 'Text content exceeds maximum limit of 1,000,000 characters'),
    originalFileName: z.string().max(255).optional(),
    mimeType: z.string().max(100).optional(),
    metadata: z.record(z.unknown()).optional(),
    chunkSize: z.number().int().min(50).max(2000).optional(),
    chunkOverlap: z.number().int().min(0).max(500).optional(),
  })
  .strict();

export const retryDocumentSchema = z
  .object({
    text: z.string().min(1, 'Document text content is required for retry').max(1000000),
  })
  .strict();

export const documentIdParamSchema = z
  .object({
    id: objectIdSchema,
  })
  .strict();

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;
export type RetryDocumentInput = z.infer<typeof retryDocumentSchema>;
export type DocumentIdParam = z.infer<typeof documentIdParamSchema>;
