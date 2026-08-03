import { z } from 'zod';

export const namespaceParamSchema = z
  .object({
    namespace: z.string().min(1, 'Namespace is required').max(100, 'Namespace cannot exceed 100 characters'),
  })
  .strict();

export type NamespaceParam = z.infer<typeof namespaceParamSchema>;
