import { Request, Response, NextFunction } from 'express';
import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';

// AsyncLocalStorage store for keeping the current request's ID accessible across asynchronous calls
export const requestIdStorage = new AsyncLocalStorage<string>();

export interface RequestWithId extends Request {
  requestId?: string;
}

/**
 * Middleware to extract or generate a unique X-Request-ID for every incoming request.
 * Sets the X-Request-ID response header and establishes an AsyncLocalStorage context.
 */
export function requestIdMiddleware(req: RequestWithId, res: Response, next: NextFunction): void {
  const existingId = req.headers['x-request-id'];
  const requestId =
    typeof existingId === 'string' && existingId.trim().length > 0
      ? existingId.trim()
      : randomUUID();

  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);

  requestIdStorage.run(requestId, () => {
    next();
  });
}

/**
 * Helper function to retrieve the current request ID from AsyncLocalStorage store.
 * Returns 'system' if invoked outside of an HTTP request context.
 */
export function getCurrentRequestId(): string {
  return requestIdStorage.getStore() || 'system';
}
