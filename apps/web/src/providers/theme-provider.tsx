import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import {
  COLLEGE_THEMES,
  ColorThemePreference,
  CollegeThemeKey,
  CollegeThemeMetadata,
  resolveCollegeTheme,
  resolvePreferredCollegeTheme,
} from '@/lib/college-themes';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
  collegeTheme: CollegeThemeMetadata;
  assignedCollegeTheme: CollegeThemeMetadata;
  colorThemePreference: ColorThemePreference;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  setColorThemePreference: (preference: ColorThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  userId?: string | null;
  college?: { code?: string | null; name?: string | null } | null;
  program?: { code?: string | null; name?: string | null } | null;
  roles?: readonly string[] | null;
  appearancePreference?: string | null;
  colorThemePreference?: string | null;
}

const getThemeStorageKey = (userId: string) => `advisio_theme:${userId}`;
const getColorThemeStorageKey = (userId: string) =>
  `advisio_color-theme:${userId}`;

function isTheme(value: string | null): value is Theme {
  return value === 'dark' || value === 'light' || value === 'system';
}

function isColorThemePreference(
  value: string | null,
): value is ColorThemePreference {
  return value === 'DEFAULT_ADVISIO' || value === 'COLLEGE_PROGRAM';
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

function storedActiveColorThemePreference(): ColorThemePreference {
  if (typeof window === 'undefined' || !localStorage.getItem('advisio_token')) {
    return 'COLLEGE_PROGRAM';
  }
  const stored = localStorage.getItem('advisio_color-theme:active');
  return isColorThemePreference(stored) ? stored : 'COLLEGE_PROGRAM';
}

export function ThemeProvider({
  children,
  userId = null,
  college = null,
  program = null,
  roles = [],
  appearancePreference = null,
  colorThemePreference: serverColorThemePreference = null,
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(storedActiveTheme);
  const [colorThemePreference, setColorThemePreferenceState] =
    useState<ColorThemePreference>(storedActiveColorThemePreference);
  const [systemIsDark, setSystemIsDark] = useState(false);
  const normalizedRoles = useMemo(
    () => (roles || []).map((role) => role.toUpperCase()),
    [roles],
  );
  const isSystemAdministrator = normalizedRoles.includes('SYSTEM_ADMIN');
  const assignedCollegeTheme = useMemo(
    () =>
      resolveCollegeTheme(
        college,
        program,
        userId ? undefined : storedActiveCollegeTheme(),
      ),
    [college?.code, college?.name, program?.code, program?.name, userId],
  );
  const collegeTheme = useMemo(
    () =>
      resolvePreferredCollegeTheme(
        college,
        program,
        colorThemePreference,
        normalizedRoles,
        userId ? undefined : storedActiveCollegeTheme(),
      ),
    [
      college?.code,
      college?.name,
      colorThemePreference,
      normalizedRoles,
      program?.code,
      program?.name,
      userId,
    ],
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

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!userId) {
      setColorThemePreferenceState(storedActiveColorThemePreference());
      return;
    }

    const stored = localStorage.getItem(getColorThemeStorageKey(userId));
    const serverPreference = serverColorThemePreference?.toUpperCase() || null;
    const resolvedPreference: ColorThemePreference = isSystemAdministrator
      ? 'DEFAULT_ADVISIO'
      : userId.startsWith('demo-') && isColorThemePreference(stored)
        ? stored
        : isColorThemePreference(serverPreference)
          ? serverPreference
          : isColorThemePreference(stored)
            ? stored
            : 'COLLEGE_PROGRAM';

    setColorThemePreferenceState(resolvedPreference);
    localStorage.setItem(getColorThemeStorageKey(userId), resolvedPreference);
    localStorage.setItem('advisio_color-theme:active', resolvedPreference);
  }, [isSystemAdministrator, serverColorThemePreference, userId]);

  const isDark = theme === 'dark' || (theme === 'system' && systemIsDark);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const root = document.documentElement;
    root.classList.toggle('dark', Boolean(isDark));
    root.dataset.collegeTheme = collegeTheme.key;
    root.dataset.appearance = theme;
    root.style.colorScheme = isDark ? 'dark' : 'light';

    if (userId) {
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

  const setColorThemePreference = (newPreference: ColorThemePreference) => {
    if (isSystemAdministrator) {
      setColorThemePreferenceState('DEFAULT_ADVISIO');
      return;
    }

    const previousPreference = colorThemePreference;
    setColorThemePreferenceState(newPreference);
    if (typeof window !== 'undefined' && userId) {
      localStorage.setItem(getColorThemeStorageKey(userId), newPreference);
      localStorage.setItem('advisio_color-theme:active', newPreference);
      void apiClient.patch('/api/auth/me/appearance', {
        colorThemePreference: newPreference,
      }).catch(() => {
        setColorThemePreferenceState(previousPreference);
        localStorage.setItem(
          getColorThemeStorageKey(userId),
          previousPreference,
        );
        localStorage.setItem(
          'advisio_color-theme:active',
          previousPreference,
        );
      });
    }
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        isDark,
        collegeTheme,
        assignedCollegeTheme,
        colorThemePreference,
        toggleTheme,
        setTheme,
        setColorThemePreference,
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
