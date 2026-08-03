export class VectorEngineError extends Error {
  public statusCode: number;
  public errorCode?: string;

  constructor(message: string, statusCode = 500, errorCode?: string) {
    super(message);
    this.name = 'VectorEngineError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class VectorEngineUnavailableError extends VectorEngineError {
  constructor(message = 'C++ Vector Search Engine is unreachable or offline') {
    super(message, 503, 'ENGINE_UNAVAILABLE');
    this.name = 'VectorEngineUnavailableError';
  }
}

export class VectorEngineTimeoutError extends VectorEngineError {
  constructor(message = 'C++ Vector Search Engine request timed out') {
    super(message, 504, 'ENGINE_TIMEOUT');
    this.name = 'VectorEngineTimeoutError';
  }
}

export class VectorEngineNotFoundError extends VectorEngineError {
  constructor(message = 'Resource not found in Vector Search Engine') {
    super(message, 404, 'NOT_FOUND');
    this.name = 'VectorEngineNotFoundError';
  }
}

export class VectorEngineValidationError extends VectorEngineError {
  constructor(message: string, errorCode = 'INVALID_PARAMETER') {
    super(message, 422, errorCode);
    this.name = 'VectorEngineValidationError';
  }
}
