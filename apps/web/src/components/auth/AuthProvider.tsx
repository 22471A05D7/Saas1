'use client';

import { useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { ApiError, api } from '@/lib/api';
import type { Organization, User } from '@/lib/types';

interface AuthContextValue {
  user: User | null;
  organization: Organization | null;
  /** True until the initial `GET /auth/me` has settled. */
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  /** Re-reads the session — used after organization settings change. */
  refresh: () => Promise<void>;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  organizationName: string;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Client-side session state.
 *
 * The session itself lives in an httpOnly cookie that page JavaScript cannot
 * read, so the user is resolved by asking the API who the caller is. This
 * context is a cache of that answer for rendering — it is never the thing that
 * authorizes a request; the API re-verifies the token on every call.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    try {
      const { data } = await api.get<{ user: User }>('/auth/me');
      setUser(data.user);
    } catch (error) {
      // A 401 simply means "not signed in" and is an expected outcome here.
      if (!(error instanceof ApiError) || error.status !== 401) {
        console.error('Failed to load session', error);
      }
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUser();
  }, [loadUser]);

  const login = useCallback(
    async (email: string, password: string) => {
      const { data } = await api.post<{ user: User }>('/auth/login', { email, password });
      setUser(data.user);
      router.replace('/dashboard');
    },
    [router],
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      const { data } = await api.post<{ user: User }>('/auth/register', input);
      setUser(data.user);
      router.replace('/dashboard');
    },
    [router],
  );

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      // Clear local state even if the request failed, so the UI cannot be left
      // showing a session the user asked to end.
      setUser(null);
      router.replace('/login');
    }
  }, [router]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      organization: user?.organization ?? null,
      loading,
      login,
      register,
      logout,
      refresh: loadUser,
    }),
    [user, loading, login, register, logout, loadUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
