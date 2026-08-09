import { config } from '../config/env';

export class ApiError extends Error {
  public statusCode: number;
  public errorCode?: string;
  public details?: unknown;

  constructor(message: string, statusCode: number, errorCode?: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
  }
}

// Token storage key
const TOKEN_KEY = 'your_own_ai_jwt_token';
let inMemoryToken: string | null = null;

export const setAuthToken = (token: string | null): void => {
  inMemoryToken = token;
  if (typeof localStorage !== 'undefined' && localStorage.setItem && localStorage.removeItem) {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  }
};

export const getAuthToken = (): string | null => {
  if (inMemoryToken) return inMemoryToken;
  if (typeof localStorage !== 'undefined' && localStorage.getItem) {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (stored) {
      inMemoryToken = stored;
    }
  }
  return inMemoryToken;
};

export const clearAuthToken = (): void => {
  setAuthToken(null);
};

export interface RequestOptions extends RequestInit {
  timeoutMs?: number;
}

export async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { timeoutMs = 15000, headers: customHeaders, ...fetchOptions } = options;

  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(customHeaders as Record<string, string>),
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const url = `${config.apiBaseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const isJson = response.headers.get('content-type')?.includes('application/json');
    const data = isJson ? await response.json() : null;

    if (!response.ok) {
      const errorMessage = data?.error?.message || response.statusText || 'An unexpected API error occurred';
      const errorCode = data?.error?.code;
      const errorDetails = data?.error?.details;
      throw new ApiError(errorMessage, response.status, errorCode, errorDetails);
    }

    return data as T;
  } catch (error: unknown) {
    clearTimeout(timeoutId);

    if (error instanceof ApiError) {
      throw error;
    }

    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError('Request timed out on the client', 504, 'CLIENT_TIMEOUT');
    }

    const netMessage =
      'Cannot reach the server. If this is the first request in a while, the server may be waking up ' +
      '(free tier — wait 30 seconds and try again). If the problem persists, check the browser console for CORS errors.';
    throw new ApiError(netMessage, 0, 'NETWORK_ERROR');
  }
}
