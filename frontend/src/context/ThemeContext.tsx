'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('system');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('dark');
  const [mounted, setMounted] = useState(false);

  const applyTheme = (targetTheme: Theme) => {
    if (typeof window === 'undefined') return;

    const root = document.documentElement;
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark =
      targetTheme === 'dark' || (targetTheme === 'system' && systemPrefersDark);

    if (isDark) {
      root.classList.add('dark');
      root.setAttribute('data-theme', 'dark');
    } else {
      root.classList.remove('dark');
      root.setAttribute('data-theme', 'light');
    }

    setResolvedTheme(isDark ? 'dark' : 'light');

    // Update meta color-scheme
    let metaTag = document.querySelector('meta[name="color-scheme"]');
    if (!metaTag) {
      metaTag = document.createElement('meta');
      metaTag.setAttribute('name', 'color-scheme');
      document.head.appendChild(metaTag);
    }
    metaTag.setAttribute(
      'content',
      targetTheme === 'system' ? 'light dark' : isDark ? 'dark' : 'light'
    );
  };

  useEffect(() => {
    setMounted(true);
    const stored = (localStorage.getItem('alma_theme') as Theme) || 'system';
    setThemeState(stored);
    applyTheme(stored);

    // Watch OS color scheme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleMediaChange = () => {
      const currentStored = (localStorage.getItem('alma_theme') as Theme) || 'system';
      if (currentStored === 'system') {
        applyTheme('system');
      }
    };

    mediaQuery.addEventListener('change', handleMediaChange);

    // Handle cross-tab sync
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'alma_theme') {
        const next = (e.newValue as Theme) || 'system';
        setThemeState(next);
        applyTheme(next);
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      mediaQuery.removeEventListener('change', handleMediaChange);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    if (newTheme === 'system') {
      localStorage.removeItem('alma_theme');
    } else {
      localStorage.setItem('alma_theme', newTheme);
    }
    applyTheme(newTheme);
  };

  const toggleTheme = () => {
    const next = resolvedTheme === 'dark' ? 'light' : 'dark';
    setTheme(next);
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
