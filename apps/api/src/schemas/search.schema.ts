import { z } from 'zod';
import { objectIdSchema } from './common.schema';

export const searchRequestSchema = z
  .object({
    query: z.string().min(1, 'Search query is required').max(2000, 'Search query cannot exceed 2000 characters'),
    k: z.number().int().min(1, 'Parameter k must be at least 1').max(100, 'Parameter k cannot exceed 100').optional().default(5),
    documentIds: z.array(objectIdSchema).max(50, 'Cannot filter by more than 50 document IDs').optional(),
    algorithm: z.enum(['bruteforce', 'kdtree', 'hnsw']).optional(),
    metric: z.enum(['cosine', 'euclidean', 'manhattan']).optional(),
  })
  .strict();

export type SearchRequestInput = z.infer<typeof searchRequestSchema>;
