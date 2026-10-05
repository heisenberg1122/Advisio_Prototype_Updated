import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  userId?: string | null;
}

const getThemeStorageKey = (userId: string) => `advisio_theme:${userId}`;

function isTheme(value: string | null): value is Theme {
  return value === 'dark' || value === 'light' || value === 'system';
}

export function ThemeProvider({ children, userId = null }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>('light');
  const [systemIsDark, setSystemIsDark] = useState(false);

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
      setThemeState('light');
      return;
    }

    const stored = localStorage.getItem(getThemeStorageKey(userId));
    setThemeState(isTheme(stored) ? stored : 'light');
  }, [userId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Remove the legacy global class so public authentication pages stay light.
    document.documentElement.classList.remove('dark');
  }, []);

  const saveTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    if (typeof window !== 'undefined' && userId) {
      localStorage.setItem(getThemeStorageKey(userId), newTheme);
    }
  };

  const toggleTheme = () => {
    saveTheme(isDark ? 'light' : 'dark');
  };

  const setTheme = (newTheme: Theme) => {
    saveTheme(newTheme);
  };

  const isDark = theme === 'dark' || (theme === 'system' && systemIsDark);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        isDark,
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

