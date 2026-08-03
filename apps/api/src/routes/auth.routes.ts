import { Router, Request, Response, NextFunction } from 'express';
import {
  registerSchema,
  loginSchema,
  registerUser,
  loginUser,
  sanitizeUser,
} from '../services/auth.service';
import { authenticateToken } from '../middleware/authenticate';
import { authRateLimiter } from '../middleware/authRateLimiter';
import { User } from '../models/User';

export const authRouter = Router();

// Apply rate limiter to registration & login endpoints
authRouter.post('/register', authRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = registerSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: {
          message: 'Validation error',
          details: parseResult.error.format(),
        },
      });
      return;
    }

    const result = await registerUser(parseResult.data);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

authRouter.post('/login', authRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: {
          message: 'Validation error',
          details: parseResult.error.format(),
        },
      });
      return;
    }

    const result = await loginUser(parseResult.data);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

authRouter.get('/me', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    const user = await User.findById(userId);

    if (!user) {
      res.status(404).json({
        error: {
          message: 'User profile not found',
        },
      });
      return;
    }

    res.status(200).json({ user: sanitizeUser(user) });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/logout', authenticateToken, (_req: Request, res: Response) => {
  // Stateless JWT logout semantics: Return success response instructing client to clear stored token
  res.status(200).json({
    message: 'Logged out successfully. Please clear your token on the client.',
  });
});
