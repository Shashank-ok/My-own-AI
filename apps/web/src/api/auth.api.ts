import { request, setAuthToken, clearAuthToken } from './client';
import { RegisterRequest, LoginRequest, AuthResponse, UserProfileResponse } from './types';

export const authApi = {
  async register(data: RegisterRequest): Promise<AuthResponse> {
    const res = await request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (res.token) {
      setAuthToken(res.token);
    }
    return res;
  },

  async login(data: LoginRequest): Promise<AuthResponse> {
    const res = await request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (res.token) {
      setAuthToken(res.token);
    }
    return res;
  },

  async getProfile(): Promise<UserProfileResponse> {
    return request<UserProfileResponse>('/auth/me', {
      method: 'GET',
    });
  },

  async logout(): Promise<{ message: string }> {
    try {
      const res = await request<{ message: string }>('/auth/logout', {
        method: 'POST',
      });
      return res;
    } finally {
      clearAuthToken();
    }
  },
};
