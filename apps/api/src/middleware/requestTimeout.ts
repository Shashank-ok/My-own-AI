import { Request, Response, NextFunction } from 'express';
import { config } from '../config/env';

export function requestTimeout(_req: Request, res: Response, next: NextFunction): void {
  const timeoutMs = config.requestTimeoutMs;
  const timer = setTimeout(() => {
    if (!res.headersSent) {
      res.status(504).json({
        error: {
          message: 'Request timed out on the server',
        },
      });
    }
  }, timeoutMs);

  res.on('finish', () => clearTimeout(timer));
  res.on('close', () => clearTimeout(timer));

  next();
}
