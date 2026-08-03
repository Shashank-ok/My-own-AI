import { Request, Response, NextFunction } from 'express';
import { config } from '../config/env';

export interface CustomError extends Error {
  statusCode?: number;
  errorCode?: string;
  details?: unknown;
}

export function errorHandler(
  err: CustomError,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const statusCode = err.statusCode || 500;
  const isProduction = config.env === 'production';

  // Log error internally
  if (statusCode >= 500) {
    console.error(`[Error] 500 - ${err.message}`, err);
  }

  // Operational vs Internal error sanitization
  const responseMessage =
    isProduction && statusCode === 500
      ? 'An unexpected error occurred on the server'
      : err.message || 'Internal server error';

  res.status(statusCode).json({
    error: {
      message: responseMessage,
      ...(err.errorCode ? { code: err.errorCode } : {}),
      ...(err.details ? { details: err.details } : {}),
    },
  });
}
