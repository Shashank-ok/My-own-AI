import { z } from 'zod';

export const registerSchema = z
  .object({
    email: z.string().email('Invalid email address').max(255, 'Email cannot exceed 255 characters'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters long')
      .max(100, 'Password cannot exceed 100 characters'),
    name: z.string().min(1, 'Name is required').max(100, 'Name cannot exceed 100 characters'),
  })
  .strict();

export const loginSchema = z
  .object({
    email: z.string().email('Invalid email address').max(255),
    password: z.string().min(1, 'Password is required').max(100),
  })
  .strict();

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
