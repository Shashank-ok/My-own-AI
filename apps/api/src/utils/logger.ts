import { getCurrentRequestId } from '../middleware/requestId';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  service: string;
  requestId: string;
  message: string;
  details?: unknown;
  error?: {
    name?: string;
    message?: string;
    stack?: string;
  };
}

class StructuredLogger {
  private serviceName = 'api-gateway';

  private formatEntry(
    level: LogLevel,
    message: string,
    details?: unknown,
    err?: Error,
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.serviceName,
      requestId: getCurrentRequestId(),
      message,
    };

    if (details !== undefined) {
      entry.details = details;
    }

    if (err) {
      entry.error = {
        name: err.name,
        message: err.message,
        stack: err.stack,
      };
    }

    return entry;
  }

  info(message: string, details?: unknown): void {
    const entry = this.formatEntry('info', message, details);
    console.log(JSON.stringify(entry));
  }

  warn(message: string, details?: unknown): void {
    const entry = this.formatEntry('warn', message, details);
    console.warn(JSON.stringify(entry));
  }

  error(message: string, err?: Error | unknown, details?: unknown): void {
    const errorObject = err instanceof Error ? err : undefined;
    const extraDetails =
      details !== undefined
        ? details
        : err && !(err instanceof Error)
          ? err
          : undefined;

    const entry = this.formatEntry('error', message, extraDetails, errorObject);
    console.error(JSON.stringify(entry));
  }
}

export const logger = new StructuredLogger();
