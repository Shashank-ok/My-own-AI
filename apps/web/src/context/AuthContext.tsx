import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api, UserDTO, getAuthToken, clearAuthToken } from '../api';

/**
 * ============================================================================
 * TOKEN STORAGE SECURITY STRATEGY & TRADEOFFS DOCUMENTATION
 * ============================================================================
 * Strategy: JWT access token is held in-memory and persisted in `localStorage`.
 *
 * Security Tradeoffs:
 * 1. Convenience (Pros): Preserves user session state across browser refreshes
 *    and tab switches without re-prompting for email/password.
 * 2. XSS Vulnerability (Cons): Data stored in `localStorage` can be read by
 *    any JavaScript script executing within the same origin.
 * 3. Mitigation Strategy: Strictly sanitize user inputs, apply Content Security
 *    Policy (CSP) headers via Helmet on Express backend, and recommend using
 *    httpOnly SameSite cookies for production deployment where feasible.
 * ============================================================================
 */

export interface AuthContextType {
  user: UserDTO | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserDTO | null>(null);
  const [token, setTokenState] = useState<string | null>(getAuthToken());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Initialize and hydrate user session from token on mount
  useEffect(() => {
    const hydrateSession = async () => {
      const existingToken = getAuthToken();
      if (!existingToken) {
        setIsLoading(false);
        return;
      }

      try {
        const res = await api.auth.getProfile();
        setUser(res.user);
        setTokenState(existingToken);
      } catch (err) {
        console.warn('[AuthContext] Session hydration failed, clearing stale token.', err);
        clearAuthToken();
        setUser(null);
        setTokenState(null);
      } finally {
        setIsLoading(false);
      }
    };

    hydrateSession();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.auth.login({ email, password });
    setUser(res.user);
    setTokenState(res.token);
  };

  const register = async (email: string, password: string, name: string) => {
    const res = await api.auth.register({ email, password, name });
    setUser(res.user);
    setTokenState(res.token);
  };

  const logout = async () => {
    try {
      await api.auth.logout();
    } catch (_err) {
      // Ignore logout API failures, ensure client state cleanup
    } finally {
      setUser(null);
      setTokenState(null);
      clearAuthToken();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: Boolean(user && token),
        isLoading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
