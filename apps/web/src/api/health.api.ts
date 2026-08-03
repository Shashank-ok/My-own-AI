import { request } from './client';
import { HealthStatusResponse } from './types';

export const healthApi = {
  async getHealth(): Promise<HealthStatusResponse> {
    return request<HealthStatusResponse>('/health', {
      method: 'GET',
    });
  },
};
