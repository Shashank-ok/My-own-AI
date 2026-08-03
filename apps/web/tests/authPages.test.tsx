import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../src/context/AuthContext';
import { LoginPage } from '../src/pages/LoginPage';
import { RegisterPage } from '../src/pages/RegisterPage';
import { ProtectedRoute } from '../src/components/ProtectedRoute';

// Mock API module
vi.mock('../src/api', async (importOriginal) => {
  const original = (await importOriginal()) as Record<string, unknown>;
  return {
    ...original,
    getAuthToken: vi.fn().mockReturnValue(null),
    setAuthToken: vi.fn(),
    clearAuthToken: vi.fn(),
    api: {
      auth: {
        login: vi.fn(),
        register: vi.fn(),
        getProfile: vi.fn(),
        logout: vi.fn(),
      },
    },
  };
});

describe('Authentication Pages & Component Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('LoginPage Component', () => {
    it('should render login form elements', () => {
      render(
        <MemoryRouter>
          <AuthProvider>
            <LoginPage />
          </AuthProvider>
        </MemoryRouter>
      );

      expect(screen.getByText('Welcome Back')).toBeDefined();
      expect(screen.getByLabelText(/Email Address/i)).toBeDefined();
      expect(screen.getByLabelText(/Password/i)).toBeDefined();
      expect(screen.getByRole('button', { name: /Sign In/i })).toBeDefined();
    });

    it('should show validation error when submitting empty form', async () => {
      render(
        <MemoryRouter>
          <AuthProvider>
            <LoginPage />
          </AuthProvider>
        </MemoryRouter>
      );

      fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));

      await waitFor(() => {
        expect(screen.getByText('Email address is required')).toBeDefined();
        expect(screen.getByText('Password is required')).toBeDefined();
      });
    });

    it('should validate email format', async () => {
      render(
        <MemoryRouter>
          <AuthProvider>
            <LoginPage />
          </AuthProvider>
        </MemoryRouter>
      );

      fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: 'invalid-email' } });
      fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'password123' } });
      fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));

      await waitFor(() => {
        expect(screen.getByText('Please enter a valid email address')).toBeDefined();
      });
    });
  });

  describe('RegisterPage Component', () => {
    it('should show validation error for password shorter than 8 characters', async () => {
      render(
        <MemoryRouter>
          <AuthProvider>
            <RegisterPage />
          </AuthProvider>
        </MemoryRouter>
      );

      fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: 'Jane Doe' } });
      fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: 'jane@example.com' } });
      fireEvent.change(screen.getByLabelText(/^Password/i), { target: { value: 'short' } });
      fireEvent.change(screen.getByLabelText(/Confirm Password/i), { target: { value: 'short' } });

      fireEvent.click(screen.getByRole('button', { name: /Register Account/i }));

      await waitFor(() => {
        expect(screen.getByText('Password must be at least 8 characters long')).toBeDefined();
      });
    });

    it('should show error when passwords do not match', async () => {
      render(
        <MemoryRouter>
          <AuthProvider>
            <RegisterPage />
          </AuthProvider>
        </MemoryRouter>
      );

      fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: 'Jane Doe' } });
      fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: 'jane@example.com' } });
      fireEvent.change(screen.getByLabelText(/^Password/i), { target: { value: 'password123' } });
      fireEvent.change(screen.getByLabelText(/Confirm Password/i), { target: { value: 'different123' } });

      fireEvent.click(screen.getByRole('button', { name: /Register Account/i }));

      await waitFor(() => {
        expect(screen.getByText('Passwords do not match')).toBeDefined();
      });
    });
  });

  describe('ProtectedRoute Component', () => {
    it('should redirect unauthenticated users to /login', async () => {
      render(
        <MemoryRouter initialEntries={['/profile']}>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<div>Login Screen</div>} />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <div>Protected Profile Content</div>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Login Screen')).toBeDefined();
        expect(screen.queryByText('Protected Profile Content')).toBeNull();
      });
    });
  });
});
