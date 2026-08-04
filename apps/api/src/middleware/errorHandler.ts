import { Request, Response, NextFunction } from 'express';
import { config } from '../config/env';
import { RequestWithId } from './requestId';
import { logger } from '../utils/logger';

export interface CustomError extends Error {
  statusCode?: number;
  errorCode?: string;
  details?: unknown;
}

export function errorHandler(
  err: CustomError,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const statusCode = err.statusCode || 500;
  const isProduction = config.env === 'production';
  const reqWithId = req as RequestWithId;
  const requestId =
    reqWithId.requestId || (res.getHeader('X-Request-ID') as string) || 'unknown';

  // Log error internally with structured logger
  if (statusCode >= 500) {
    logger.error(`Unhandled server error [${statusCode}]: ${err.message}`, err, {
      path: req.originalUrl || req.url,
      method: req.method,
      errorCode: err.errorCode,
    });
  } else {
    logger.warn(`Client operational error [${statusCode}]: ${err.message}`, {
      path: req.originalUrl || req.url,
      method: req.method,
      errorCode: err.errorCode,
    });
  }

  // Operational vs Internal error sanitization
  const responseMessage =
    isProduction && statusCode === 500
      ? 'An unexpected error occurred on the server'
      : err.message || 'Internal server error';

  res.status(statusCode).json({
    error: {
      message: responseMessage,
      requestId,
      ...(err.errorCode ? { code: err.errorCode } : {}),
      ...(err.details ? { details: err.details } : {}),
    },
  });
}
