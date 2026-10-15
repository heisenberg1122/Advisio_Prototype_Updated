import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import {
  COLLEGE_THEMES,
  CollegeThemeKey,
  CollegeThemeMetadata,
  resolveCollegeTheme,
} from '@/lib/college-themes';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
  collegeTheme: CollegeThemeMetadata;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  userId?: string | null;
  college?: { code?: string | null; name?: string | null } | null;
  program?: { code?: string | null; name?: string | null } | null;
  appearancePreference?: string | null;
}

const getThemeStorageKey = (userId: string) => `advisio_theme:${userId}`;

function isTheme(value: string | null): value is Theme {
  return value === 'dark' || value === 'light' || value === 'system';
}

function storedActiveTheme(): Theme {
  if (typeof window === 'undefined' || !localStorage.getItem('advisio_token')) return 'light';
  const stored = localStorage.getItem('advisio_theme:active');
  return isTheme(stored) ? stored : 'system';
}

function storedActiveCollegeTheme(): CollegeThemeKey {
  if (typeof window === 'undefined' || !localStorage.getItem('advisio_token')) return 'default';
  const stored = localStorage.getItem('advisio_college-theme:active') as CollegeThemeKey | null;
  return stored && COLLEGE_THEMES[stored] ? stored : 'default';
}

export function ThemeProvider({
  children,
  userId = null,
  college = null,
  program = null,
  appearancePreference = null,
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(storedActiveTheme);
  const [systemIsDark, setSystemIsDark] = useState(false);
  const collegeTheme = useMemo(
    () => resolveCollegeTheme(college, program, storedActiveCollegeTheme()),
    [college?.code, college?.name, program?.code, program?.name],
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => setSystemIsDark(mediaQuery.matches);

    handleChange();
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!userId) {
      if (localStorage.getItem('advisio_token')) {
        const storedTheme = storedActiveTheme();
        setThemeState(storedTheme);
      } else {
        setThemeState('light');
      }
      return;
    }

    const stored = localStorage.getItem(getThemeStorageKey(userId));
    const serverTheme = appearancePreference?.toLowerCase() || null;
    const resolvedTheme =
      serverTheme && isTheme(serverTheme) && serverTheme !== 'system'
        ? serverTheme
        : isTheme(stored)
          ? stored
          : serverTheme && isTheme(serverTheme)
            ? serverTheme
            : 'system';
    setThemeState(resolvedTheme);
    localStorage.setItem(getThemeStorageKey(userId), resolvedTheme);
    localStorage.setItem('advisio_theme:active', resolvedTheme);

    // Preserve an existing per-account preference when upgrading from the
    // previous browser-only theme implementation.
    if (isTheme(stored) && serverTheme === 'system' && stored !== 'system') {
      void apiClient.patch('/api/auth/me/appearance', {
        appearancePreference: stored.toUpperCase(),
      }).catch(() => undefined);
    }
  }, [appearancePreference, userId]);

  const isDark = theme === 'dark' || (theme === 'system' && systemIsDark);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const root = document.documentElement;
    root.classList.toggle('dark', Boolean(isDark));
    root.dataset.collegeTheme = collegeTheme.key;
    root.dataset.appearance = theme;
    root.style.colorScheme = isDark ? 'dark' : 'light';

    if (userId && collegeTheme.key !== 'default') {
      localStorage.setItem('advisio_college-theme:active', collegeTheme.key);
    }
  }, [collegeTheme.key, isDark, theme, userId]);

  const saveTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    if (typeof window !== 'undefined' && userId) {
      localStorage.setItem(getThemeStorageKey(userId), newTheme);
      localStorage.setItem('advisio_theme:active', newTheme);
      void apiClient.patch('/api/auth/me/appearance', {
        appearancePreference: newTheme.toUpperCase(),
      }).catch(() => undefined);
    }
  };

  const toggleTheme = () => {
    saveTheme(isDark ? 'light' : 'dark');
  };

  const setTheme = (newTheme: Theme) => {
    saveTheme(newTheme);
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        isDark,
        collegeTheme,
        toggleTheme,
        setTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
