import { authApi } from './auth.api';
import { documentsApi } from './documents.api';
import { searchApi } from './search.api';
import { chatApi } from './chat.api';
import { healthApi } from './health.api';

export * from './types';
export * from './client';
export * from './auth.api';
export * from './documents.api';
export * from './search.api';
export * from './chat.api';
export * from './health.api';

export const api = {
  auth: authApi,
  documents: documentsApi,
  search: searchApi,
  chat: chatApi,
  health: healthApi,
};
