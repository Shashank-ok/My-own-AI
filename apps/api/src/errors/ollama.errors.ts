export class OllamaError extends Error {
  public statusCode: number;

  constructor(message: string, statusCode = 500) {
    super(message);
    this.name = 'OllamaError';
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class OllamaUnavailableError extends OllamaError {
  constructor(message = 'Ollama service is currently unavailable or unreachable') {
    super(message, 503);
    this.name = 'OllamaUnavailableError';
  }
}

export class OllamaTimeoutError extends OllamaError {
  constructor(message = 'Ollama request timed out') {
    super(message, 504);
    this.name = 'OllamaTimeoutError';
  }
}

export class OllamaModelNotFoundError extends OllamaError {
  constructor(model: string) {
    super(`Ollama model '${model}' was not found. Please pull the model first.`, 404);
    this.name = 'OllamaModelNotFoundError';
  }
}

export class OllamaMalformedResponseError extends OllamaError {
  constructor(details = 'Received malformed or invalid response structure from Ollama') {
    super(details, 502);
    this.name = 'OllamaMalformedResponseError';
  }
}
