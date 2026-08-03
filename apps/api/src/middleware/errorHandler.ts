import { Request, Response, NextFunction } from 'express';
import { config } from '../config/env';

export interface CustomError extends Error {
  statusCode?: number;
}

export function errorHandler(
  err: CustomError,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  console.error(`[Error] ${statusCode} - ${message}`);
  if (err.stack && config.env !== 'production') {
    console.error(err.stack);
  }

  res.status(statusCode).json({
    error: {
      message,
      ...(config.env === 'development' && { stack: err.stack }),
    },
  });
}
