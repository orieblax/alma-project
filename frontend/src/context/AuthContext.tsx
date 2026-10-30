'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { User, AuthTokens } from '@/types';
import { api, getStoredTokens, setStoredTokens } from '@/lib/api';

interface AuthContextType {
  user: User | null;
  tokens: AuthTokens | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  loginWithGithub: (data: {
    github_id?: string;
    email?: string;
    name?: string;
    avatar_url?: string;
  }) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [tokens, setTokens] = useState<AuthTokens | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const router = useRouter();

  const refreshProfile = async () => {
    try {
      const storedTokens = getStoredTokens();
      if (!storedTokens?.access) {
        setUser(null);
        setTokens(null);
        setIsLoading(false);
        return;
      }
      setTokens(storedTokens);
      const res = await api.auth.getMe();
      if (res.user) {
        setUser(res.user);
      }
    } catch {
      setUser(null);
      setTokens(null);
      setStoredTokens(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshProfile();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.auth.login(email, password);
    setTokens(res.tokens);
    setUser(res.user);
    router.push('/dashboard');
  };

  const register = async (name: string, email: string, password: string) => {
    const res = await api.auth.register(name, email, password);
    setTokens(res.tokens);
    setUser(res.user);
    router.push('/dashboard');
  };

  const loginWithGithub = async (githubData: {
    github_id?: string;
    email?: string;
    name?: string;
    avatar_url?: string;
  }) => {
    const res = await api.auth.loginWithGithub(githubData);
    setTokens(res.tokens);
    setUser(res.user);
    router.push('/dashboard');
  };

  const logout = () => {
    api.auth.logout();
    setUser(null);
    setTokens(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        tokens,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        loginWithGithub,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
