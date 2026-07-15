'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { AuthUser, LoginResponse } from '@fsg/shared';
import { ApiError, api } from './api';
import { clearToken, getToken, setToken } from './auth-storage';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  /** API is unreachable (e.g. restarting) while we still hold a session. */
  offline: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  can: (...permissions: string[]) => boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);

  const loadMe = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setOffline(false);
      setLoading(false);
      return;
    }
    try {
      const me = await api.get<AuthUser>('/auth/me');
      setUser(me);
      setOffline(false);
    } catch (err) {
      if (err instanceof ApiError) {
        // A real auth failure (401 after refresh failed): the session is over.
        setUser(null);
        setOffline(false);
      } else {
        // Network error — the API is unreachable/restarting. Keep the session
        // and retry instead of dumping the user at /login (which the presence
        // cookie would just bounce back, leaving them stuck on a spinner).
        setOffline(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMe();
  }, [loadMe]);

  // While offline, poll until the API comes back, then resume the session.
  useEffect(() => {
    if (!offline) return;
    const timer = setInterval(() => void loadMe(), 3000);
    return () => clearInterval(timer);
  }, [offline, loadMe]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<LoginResponse>('/auth/login', { email, password });
    setToken(res.accessToken);
    setUser(res.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      /* ignore */
    }
    clearToken();
    setUser(null);
  }, []);

  const can = useCallback(
    (...permissions: string[]) =>
      !!user && permissions.every((p) => user.permissions.includes(p)),
    [user],
  );

  return (
    <AuthContext.Provider value={{ user, loading, offline, login, logout, can, refreshUser: loadMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
