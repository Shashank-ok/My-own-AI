import { Router, Request, Response, NextFunction } from 'express';
import { registerUser, loginUser, getUserProfile } from '../services/auth.service';
import { authenticateToken } from '../middleware/authenticate';
import { authRateLimiter } from '../middleware/authRateLimiter';
import { validateBody } from '../middleware/validate';
import { registerSchema, loginSchema } from '../schemas/auth.schema';

export const authRouter = Router();

authRouter.use(authRateLimiter);

/**
 * POST /auth/register
 */
authRouter.post(
  '/register',
  validateBody(registerSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await registerUser(req.body);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /auth/login
 */
authRouter.post(
  '/login',
  validateBody(loginSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await loginUser(req.body);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /auth/me
 */
authRouter.get('/me', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const user = await getUserProfile(userId);
    res.status(200).json({ user });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /auth/logout
 */
authRouter.post('/logout', authenticateToken, (_req: Request, res: Response) => {
  res.status(200).json({ message: 'Logged out successfully' });
});
