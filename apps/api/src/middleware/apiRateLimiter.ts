import rateLimit from 'express-rate-limit';
import { config } from '../config/env';

export const apiRateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      message: 'Too many requests from this IP, please try again later',
    },
  },
  skip: () => process.env.NODE_ENV === 'test', // Skip rate limiting in Vitest test environment
});
