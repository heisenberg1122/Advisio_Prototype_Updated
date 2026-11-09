import React, { createContext, useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import {
  COLLEGE_THEMES,
  ColorThemePreference,
  CollegeThemeKey,
  CollegeThemeMetadata,
  HeadingFontPreference,
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
  headingFontPreference: HeadingFontPreference;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  setColorThemePreference: (preference: ColorThemePreference) => void;
  setHeadingFontPreference: (preference: HeadingFontPreference) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  useDefaultAppearance?: boolean;
  userId?: string | null;
  college?: { code?: string | null; name?: string | null } | null;
  program?: { code?: string | null; name?: string | null } | null;
  roles?: readonly string[] | null;
  appearancePreference?: string | null;
  colorThemePreference?: string | null;
  headingFontPreference?: string | null;
}

const getThemeStorageKey = (userId: string) => `advisio_theme:${userId}`;
const getColorThemeStorageKey = (userId: string) =>
  `advisio_color-theme:${userId}`;
const getHeadingFontStorageKey = (userId: string) =>
  `advisio_heading-font:${userId}`;

function isTheme(value: string | null): value is Theme {
  return value === 'dark' || value === 'light' || value === 'system';
}

function isColorThemePreference(
  value: string | null,
): value is ColorThemePreference {
  return value === 'DEFAULT_ADVISIO' || value === 'COLLEGE_PROGRAM' || value === 'COLLEGE_SOFT';
}

function isHeadingFontPreference(
  value: string | null | undefined,
): value is HeadingFontPreference {
  return value === 'STANDARD' || value === 'SERIF';
}

function storedActiveHeadingFont(): HeadingFontPreference {
  if (typeof window === 'undefined' || !localStorage.getItem('advisio_token')) return 'STANDARD';
  const stored = localStorage.getItem('advisio_heading-font:active');
  return isHeadingFontPreference(stored) ? stored : 'STANDARD';
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
  useDefaultAppearance = false,
  userId = null,
  college = null,
  program = null,
  roles = [],
  appearancePreference = null,
  colorThemePreference: serverColorThemePreference = null,
  headingFontPreference: serverHeadingFontPreference = null,
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(storedActiveTheme);
  const [colorThemePreference, setColorThemePreferenceState] =
    useState<ColorThemePreference>(storedActiveColorThemePreference);
  const [headingFontPreference, setHeadingFontPreferenceState] =
    useState<HeadingFontPreference>(storedActiveHeadingFont);
  const [systemIsDark, setSystemIsDark] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches,
  );
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
      : isColorThemePreference(serverPreference)
        ? serverPreference
        : isColorThemePreference(stored)
          ? stored
          : 'COLLEGE_PROGRAM';

    setColorThemePreferenceState(resolvedPreference);
    localStorage.setItem(getColorThemeStorageKey(userId), resolvedPreference);
    localStorage.setItem('advisio_color-theme:active', resolvedPreference);
  }, [isSystemAdministrator, serverColorThemePreference, userId]);

  useEffect(() => {
    if (typeof window === 'undefined' || !userId) return;
    const stored = localStorage.getItem(getHeadingFontStorageKey(userId));
    const resolved = isHeadingFontPreference(serverHeadingFontPreference)
      ? serverHeadingFontPreference
      : isHeadingFontPreference(stored)
        ? stored
        : 'STANDARD';
    setHeadingFontPreferenceState(resolved);
    localStorage.setItem(getHeadingFontStorageKey(userId), resolved);
    localStorage.setItem('advisio_heading-font:active', resolved);
  }, [serverHeadingFontPreference, userId]);

  const isDark = theme === 'dark' || (theme === 'system' && systemIsDark);

  // Override only the rendered appearance on auth routes. Keep account state and
  // storage intact so navigating back to a workspace restores its saved theme.
  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;
    const root = document.documentElement;
    const pageIsDark = !useDefaultAppearance && isDark;
    root.classList.toggle('dark', Boolean(pageIsDark));
    root.dataset.collegeTheme = useDefaultAppearance ? 'default' : collegeTheme.key;
    root.dataset.appearance = useDefaultAppearance ? 'light' : theme;
    if (!useDefaultAppearance && colorThemePreference === 'COLLEGE_SOFT' && collegeTheme.key !== 'default') {
      root.dataset.colorTone = 'soft';
    } else {
      delete root.dataset.colorTone;
    }
    if (!useDefaultAppearance && headingFontPreference === 'SERIF') {
      root.dataset.headingFont = 'serif';
    } else {
      delete root.dataset.headingFont;
    }
    root.style.colorScheme = pageIsDark ? 'dark' : 'light';

    if (userId) {
      localStorage.setItem('advisio_college-theme:active', collegeTheme.key);
    }
  }, [collegeTheme.key, colorThemePreference, headingFontPreference, isDark, theme, userId, useDefaultAppearance]);

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

  const setHeadingFontPreference = (newPreference: HeadingFontPreference) => {
    const previousPreference = headingFontPreference;
    setHeadingFontPreferenceState(newPreference);
    if (typeof window !== 'undefined' && userId) {
      localStorage.setItem(getHeadingFontStorageKey(userId), newPreference);
      localStorage.setItem('advisio_heading-font:active', newPreference);
      void apiClient.patch('/api/auth/me/appearance', {
        headingFontPreference: newPreference,
      }).catch(() => {
        setHeadingFontPreferenceState(previousPreference);
        localStorage.setItem(getHeadingFontStorageKey(userId), previousPreference);
        localStorage.setItem('advisio_heading-font:active', previousPreference);
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
        headingFontPreference,
        setHeadingFontPreference,
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
