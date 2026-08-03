/**
 * Application Environment Configuration
 */
export const config = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000',
  isDev: import.meta.env.DEV,
} as const;
