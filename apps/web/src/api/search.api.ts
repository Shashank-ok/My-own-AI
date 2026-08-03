import { request } from './client';
import { SearchRequest, SearchResponse } from './types';

export const searchApi = {
  async search(data: SearchRequest): Promise<SearchResponse> {
    return request<SearchResponse>('/api/search', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};
