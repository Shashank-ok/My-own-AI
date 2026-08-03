import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';

export interface AuthUserPayload {
  userId: string;
  email: string;
  role: 'user' | 'admin';
}

export function authenticateToken(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({
      error: {
        message: 'Authentication token is required',
      },
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as AuthUserPayload;
    req.user = decoded;
    next();
  } catch (_error) {
    res.status(401).json({
      error: {
        message: 'Invalid or expired authentication token',
      },
    });
  }
}
