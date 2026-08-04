import { Request, Response, NextFunction } from 'express';
import { RequestWithId } from './requestId';

export interface HttpRequestLogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  service: string;
  requestId: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  userAgent?: string;
}

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - start;
    const reqWithId = req as RequestWithId;
    const requestId =
      reqWithId.requestId || (res.getHeader('X-Request-ID') as string) || 'unknown';

    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';

    const logEntry: HttpRequestLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: 'api-gateway',
      requestId,
      method: req.method,
      path: req.originalUrl || req.url,
      statusCode: res.statusCode,
      durationMs,
      userAgent: req.get('user-agent'),
    };

    console.log(JSON.stringify(logEntry));
  });

  next();
}
