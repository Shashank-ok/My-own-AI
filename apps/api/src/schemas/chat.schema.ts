import { z } from 'zod';
import { objectIdSchema } from './common.schema';

export const askQuestionSchema = z
  .object({
    question: z.string().min(1, 'Question is required').max(2000, 'Question cannot exceed 2000 characters'),
    conversationId: objectIdSchema.optional(),
    k: z.number().int().min(1, 'Parameter k must be at least 1').max(100, 'Parameter k cannot exceed 100').optional(),
    documentIds: z.array(objectIdSchema).max(50, 'Cannot filter by more than 50 document IDs').optional(),
  })
  .strict();

export const conversationIdParamSchema = z
  .object({
    id: objectIdSchema,
  })
  .strict();

export type AskQuestionRequestInput = z.infer<typeof askQuestionSchema>;
export type ConversationIdParam = z.infer<typeof conversationIdParamSchema>;
