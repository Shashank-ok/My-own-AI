import rateLimit from 'express-rate-limit';

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // Limit each IP to 15 auth requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      message: 'Too many authentication attempts from this IP, please try again after 15 minutes',
    },
  },
  skip: () => process.env.NODE_ENV === 'test', // Skip rate-limiting during vitest test suite
});
